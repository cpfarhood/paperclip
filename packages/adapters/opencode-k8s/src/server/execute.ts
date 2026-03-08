// opencode_k8s execution
//
// NOT YET IMPLEMENTED.
//
// Intended behavior:
//   1. Build a Kubernetes Job spec from AdapterExecutionContext
//   2. Create the Job via @kubernetes/client-node (in-cluster ServiceAccount auth)
//   3. Watch the Job pod for log output, stream via onLog callbacks
//   4. On Job completion, parse structured result from logs
//   5. Delete Job (or rely on TTL) and return AdapterExecutionResult
//
// See DEVELOPMENT.md for design decisions around:
//   - Log streaming strategy
//   - Result/session ID handoff
//   - Secret and workspace volume mounting
//   - RBAC requirements

import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";

export async function execute(_ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  throw new Error(
    "opencode_k8s adapter is not yet implemented. See packages/adapters/opencode-k8s/DEVELOPMENT.md."
  );
}
