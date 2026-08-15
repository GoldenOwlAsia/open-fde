import { readFile } from "node:fs/promises";
import { engagementPath } from "../core/engagement.js";
import { exists } from "../core/workspace.js";
import { formatIssue, SUPPORTED_API_VERSION, validateEngagementText } from "../core/schema.js";

export async function validateCommand(root: string): Promise<void> {
  const file = engagementPath(root);
  if (!(await exists(file))) throw new Error("No fde.yaml found. Run `fde init` to create one.");

  const text = await readFile(file, "utf8");
  const { errors, warnings } = await validateEngagementText(text);

  for (const issue of errors) console.error(`error   ${formatIssue("fde.yaml", issue)}`);
  for (const issue of warnings) console.warn(`warning ${formatIssue("fde.yaml", issue)}`);

  if (errors.length) {
    console.error(`\nfde.yaml is invalid: ${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `fde.yaml is valid (${SUPPORTED_API_VERSION})${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`
  );
}
