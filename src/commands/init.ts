import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists } from "../core/workspace.js";

const starter = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: example-engagement

spec:
  customer:
    name: example-customer

  objective:
    summary: Describe the production outcome this engagement should achieve

  successMetrics: []

  environment:
    cloud: unknown
    regions: []

  systems: []

  constraints:
    dataResidency:
      allowedRegions: []
    pii:
      allowExternalModel: false
    humanApproval:
      requiredFor: []

  # Declare these to satisfy the default preflight checks:
  #
  # reliability:
  #   timeout: 30s
  #   retry: exponential-backoff
  #   fallback: human-escalation
  #
  # evaluation:
  #   required: true
`;

export async function initCommand(root: string): Promise<void> {
  await ensureWorkspace(root);
  const fdeFile = path.join(root, "fde.yaml");
  if (await exists(fdeFile)) {
    console.log(`Preserved existing ${fdeFile}`);
  } else {
    await writeFile(fdeFile, starter, "utf8");
    console.log(`Created ${fdeFile}`);
  }
  console.log(`Initialized OpenFDE workspace at ${root}`);
}
