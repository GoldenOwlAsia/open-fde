#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { mapCommand } from "./commands/map.js";
import { checkCommand } from "./commands/check.js";
import { reportCommand } from "./commands/report.js";
import { validateCommand } from "./commands/validate.js";
import { testCommand } from "./commands/test.js";
import { exportCommand } from "./commands/export.js";
import { mcpCommand } from "./commands/mcp.js";
import { evidenceAddCommand } from "./commands/evidence.js";
import { importIncidentCommand, importTraceCommand } from "./commands/importCmd.js";
import { replayCommand } from "./commands/replay.js";
import { statusCommand } from "./commands/status.js";
import { decisionAddCommand } from "./commands/decision.js";
import { learningAddCommand } from "./commands/learning.js";
import { handoffCommand } from "./commands/handoff.js";
import { VERSION } from "./version.js";

const program = new Command();
program.name("fde").description("OpenFDE delivery harness").version(VERSION);

const normalize = (root?: string) => path.resolve(root ?? process.cwd());

program.command("init").argument("[root]").action(async (root) => initCommand(normalize(root)));
program.command("scan").argument("[root]").action(async (root) => scanCommand(normalize(root)));
program.command("map").argument("[root]").action(async (root) => mapCommand(normalize(root)));
program
  .command("check")
  .argument("[root]")
  .option("--only <ids>", "run only these comma-separated check ids")
  .option("--skip <ids>", "skip these comma-separated check ids")
  .option("--format <format>", "output format: text, json, or sarif", "text")
  .option("--fail-on <level>", "exit 1 when findings reach this severity: critical, warning, or never", "critical")
  .action(async (root, options) => checkCommand(normalize(root), options));
program
  .command("validate")
  .description("Validate fde.yaml against the engagement schema")
  .argument("[root]")
  .action(async (root) => validateCommand(normalize(root)));
program
  .command("test")
  .description("Run local, deterministic engagement tests")
  .argument("[root]")
  .option("--contracts", "run contract fixtures from .fde/contracts/")
  .action(async (root, options) => {
    await testCommand(normalize(root), options);
  });
program
  .command("export")
  .description("Export engagement artifacts (currently: context)")
  .argument("<target>", "what to export: context")
  .argument("[root]")
  .action(async (target, root) => exportCommand(normalize(root), target));
program
  .command("mcp")
  .description("Serve the engagement over MCP (stdio, read-only, opt-in)")
  .argument("[root]")
  .action(async (root) => mcpCommand(normalize(root)));

const evidence = program.command("evidence").description("Manage redacted evidence packs");
evidence
  .command("add")
  .description("Add a text file to .fde/evidence/ with automatic redaction")
  .argument("<file>", "file to add")
  .argument("[root]")
  .action(async (file, root) => {
    await evidenceAddCommand(normalize(root), file);
  });

const importCmd = program.command("import").description("Import external records into the workspace");
importCmd
  .command("trace")
  .description("Import a file-based OTLP JSON trace export into .fde/traces/")
  .argument("<file>", "OTLP JSON export")
  .argument("[root]")
  .action(async (file, root) => {
    await importTraceCommand(normalize(root), file);
  });
importCmd
  .command("incident")
  .description("Import and normalize an incident record into .fde/incidents/")
  .argument("<file>", "incident YAML/JSON")
  .argument("[root]")
  .action(async (file, root) => {
    await importIncidentCommand(normalize(root), file);
  });

program
  .command("replay")
  .description("Re-run an imported trace against the contract fixtures (no production calls)")
  .argument("<trace>", "trace name in .fde/traces/")
  .argument("[root]")
  .action(async (trace, root) => {
    await replayCommand(normalize(root), trace);
  });
program
  .command("status")
  .description("Deployment health summary from imported evidence (declared vs observed)")
  .argument("[root]")
  .action(async (root) => {
    await statusCommand(normalize(root));
  });

const decision = program.command("decision").description("Architecture decision records");
decision
  .command("add")
  .description("Record an ADR in .fde/architecture/decisions/")
  .argument("<title>", "decision title")
  .argument("[root]")
  .option("--status <status>", "proposed | accepted | superseded", "accepted")
  .option("--context <text>", "what motivates this decision")
  .option("--decision <text>", "what was decided")
  .option("--consequences <text>", "what becomes easier/harder")
  .action(async (title, root, options) => {
    await decisionAddCommand(normalize(root), title, options);
  });

const learning = program.command("learning").description("Known-failure-modes registry");
learning
  .command("add")
  .description("Record a known failure mode in .fde/learnings/")
  .argument("<title>", "learning title")
  .argument("[root]")
  .option("--failure-mode <text>", "how it fails")
  .option("--mitigation <text>", "how to prevent or recover")
  .option("--checks <ids>", "comma-separated check ids this learning relates to")
  .option("--incidents <ids>", "comma-separated incident ids this learning came from")
  .action(async (title, root, options) => {
    await learningAddCommand(normalize(root), title, options);
  });

program
  .command("handoff")
  .description("Generate the handoff package (handoff.md + handoff.json + runbook skeletons)")
  .argument("[root]")
  .action(async (root) => {
    await handoffCommand(normalize(root));
  });
program.command("report").argument("[root]").action(async (root) => reportCommand(normalize(root)));

program.parseAsync().catch((error) => {
  console.error(`OpenFDE error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
