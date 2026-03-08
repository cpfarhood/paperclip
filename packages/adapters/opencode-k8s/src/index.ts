// opencode_k8s adapter
//
// Runs OpenCode agents as Kubernetes Jobs rather than child processes.
// See DEVELOPMENT.md for design rationale and implementation status.

export const type = "opencode_k8s";
export const label = "OpenCode (Kubernetes Job)";

// Models mirror opencode-local — the k8s execution layer is model-agnostic.
export const models = [
  { id: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "openrouter/minimax/minimax-m2.5", label: "MiniMax M2.5 (via OpenRouter)" },
];

export const agentConfigurationDoc = `# opencode_k8s agent configuration

Adapter: opencode_k8s

Runs the agent as a Kubernetes Job for process isolation and independent
resource limits. Each heartbeat creates a new Job; the adapter watches for
completion and streams logs back to Paperclip.

Core fields:
- namespace (string, optional): Kubernetes namespace for Jobs (default: "paperclip")
- image (string, optional): container image to use for the Job pod
- model (string, optional): OpenCode model ID
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- env (object, optional): KEY=VALUE environment variables injected into the Job pod
- resources.requests.memory (string, optional): e.g. "512Mi"
- resources.requests.cpu (string, optional): e.g. "250m"
- resources.limits.memory (string, optional): e.g. "4Gi"
- resources.limits.cpu (string, optional): e.g. "2"
- ttlSecondsAfterFinished (number, optional): Job TTL for auto-cleanup (default: 3600)

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- serviceAccountName (string, optional): Kubernetes ServiceAccount for the Job pod
`;
