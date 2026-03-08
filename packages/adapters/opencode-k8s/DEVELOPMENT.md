# opencode_k8s Adapter — Development Notes

## Intent

Run Paperclip agents as Kubernetes Jobs rather than child processes within the
Paperclip pod. The existing `opencode_local` (and `claude_local`) adapters spawn
agent processes via `runChildProcess()` inside the Paperclip pod itself. This
means all agents share the same memory pool — one OOMKill takes down the entire
platform.

The `opencode_k8s` adapter replaces child process spawning with Kubernetes Job
creation. Each agent run gets its own isolated pod with dedicated resource limits,
scheduled by Kubernetes.

## Motivation

- **Isolation**: OOMKill of one agent run does not affect others or the Paperclip
  control plane
- **Per-agent resource tuning**: Opus agents get more RAM than Haiku agents via
  Job pod resource limits
- **Horizontal scale**: Multiple concurrent runs of the same agent = multiple Jobs,
  no contention
- **Observability**: Each run is a discrete Kubernetes Job with its own logs,
  events, and status
- **Natural fit**: Hugh Hackman (VP of Engineering Operations) already has cluster
  access and can manage Job lifecycle

## Architecture

### Current flow (`opencode_local`)

```
Paperclip pod
  └── runChildProcess(opencode ...)
        ├── stdin: prompt
        ├── stdout/stderr: streamed back via onLog callbacks
        └── exit: result parsed, session ID saved
```

### Target flow (`opencode_k8s`)

```
Paperclip pod
  └── k8s API: create Job
        └── Job pod
              ├── opencode process (prompt injected via env/ConfigMap)
              ├── sidecar or init: POST logs back to Paperclip API
              └── exit: Job status → Paperclip watches/polls for completion
```

## Key Design Decisions (to be resolved)

### 1. Log streaming

The current adapter streams stdout/stderr in real-time via `onLog` callbacks
provided by the Paperclip runtime. Kubernetes Jobs have no pipe back to the
creating process.

Options:
- **Poll Job logs via k8s API**: Paperclip watches `kubectl logs -f` equivalent
  for the Job pod. Adds latency, simpler implementation.
- **Sidecar log forwarder**: Job pod runs a sidecar that tails the agent stdout
  and POSTs chunks to a Paperclip log ingestion endpoint. Real-time but more
  complex.
- **Structured output only**: Agent writes structured result to a known path
  (ConfigMap or PVC), Paperclip reads it on Job completion. Loses real-time logs.

Current lean: **poll Job logs via k8s API** for the initial implementation.
Real-time streaming via sidecar can follow.

### 2. Result / session ID handoff

The `opencode_local` adapter parses session ID and usage from the agent process
stdout and writes it back to the DB via the `AdapterExecutionResult` return value.
With a Job, the return path needs to be async.

Options:
- **Job polls completion then reads logs**: Paperclip watches Job until `Complete`
  or `Failed`, then reads full logs and parses result. Simple but blocking.
- **Agent POSTs result to Paperclip API on completion**: Requires agent to know
  the Paperclip API endpoint and auth token.

Current lean: **watch Job to completion, parse logs** for initial implementation.

### 3. Secrets and env injection

Currently secrets (GitHub App PEM, API keys) live on the shared PVC at known
paths and are passed via env vars in `adapter_config`. For Jobs, secrets should
be proper Kubernetes Secrets mounted into the Job pod.

Migration path:
- Create a Kubernetes Secret per agent containing their env vars
- Job spec references the Secret via `envFrom`
- PEM files mounted as Secret volumes

This is also a security improvement — secrets leave the DB.

### 4. Workspace volume

Agents currently work out of `/paperclip/privilegedescalation/...` on the shared
PVC. Jobs will need the same PVC mounted.

Constraint: If the PVC is `ReadWriteOnce`, all Job pods must land on the same
node as the PVC. Either:
- Use `ReadWriteMany` (NFS/CephFS) — already available via TrueNAS
- Or scope each agent to an `emptyDir` workspace cloned fresh each run (stateless)

Current lean: **mount shared PVC as ReadWriteMany** — agents need persistent
workspace state (git repos, credentials, etc.).

### 5. Kubernetes client in adapter

The adapter needs to speak to the Kubernetes API. Options:
- `@kubernetes/client-node` npm package — official client, in-cluster config
  auto-detected
- Shell out to `kubectl` — simpler but fragile

Current lean: **`@kubernetes/client-node`** — proper in-cluster ServiceAccount
authentication, no dependency on `kubectl` binary in the Paperclip image.

### 6. Job naming and cleanup

Jobs should be named deterministically from `runId` for idempotency and
traceability. TTL via `ttlSecondsAfterFinished` to auto-clean completed Jobs.

```
paperclip-run-{runId}  (truncated/hashed to fit k8s name limits)
```

## RBAC Requirements

The Paperclip pod's ServiceAccount needs:
- `create`, `get`, `watch`, `delete` on `jobs` in the `paperclip` namespace
- `get`, `watch` on `pods` in the `paperclip` namespace (for log streaming)
- `get` on `pods/log` in the `paperclip` namespace

These should be added to `cpfarhood/kubernetes` via Flux before this adapter
can function in cluster.

## Rebase Strategy

This is a long-lived branch. To stay current with upstream:

```bash
# Sync fork master with upstream
git fetch upstream
git checkout master
git merge upstream/master
git push origin master

# Rebase feature branch
git checkout feat/opencode-k8s-adapter
git rebase master
```

Rebase after every upstream release. Conflicts are most likely in:
- `packages/adapter-utils/src/server-utils.ts` (if upstream changes `runChildProcess`)
- `packages/adapters/opencode-local/src/server/execute.ts` (reference implementation)

## Status

- [x] Branch created
- [x] Design notes written
- [ ] `package.json` finalized
- [ ] `src/index.ts` (adapter metadata + model list)
- [ ] `src/server/index.ts` (execution entry point)
- [ ] `src/server/execute.ts` (Job creation, log polling, result parsing)
- [ ] `src/server/job.ts` (Job spec builder)
- [ ] RBAC manifests in `cpfarhood/kubernetes`
- [ ] Integration test against animaniacs cluster
- [ ] Upstream PR to `paperclipai/paperclip`
