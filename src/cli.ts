#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import { initCommand } from "./commands/init.js";
import { scanCommand } from "./commands/scan.js";
import { mapCommand } from "./commands/map.js";
import { checkCommand } from "./commands/check.js";
import { reportCommand } from "./commands/report.js";

const program = new Command();
program.name("fde").description("OpenFDE delivery harness").version("0.1.0-alpha.0");

const normalize = (root?: string) => path.resolve(root ?? process.cwd());

program.command("init").argument("[root]").action(async (root) => initCommand(normalize(root)));
program.command("scan").argument("[root]").action(async (root) => scanCommand(normalize(root)));
program.command("map").argument("[root]").action(async (root) => mapCommand(normalize(root)));
program.command("check").argument("[root]").action(async (root) => checkCommand(normalize(root)));
program.command("report").argument("[root]").action(async (root) => reportCommand(normalize(root)));

program.parseAsync().catch((error) => {
  console.error(`OpenFDE error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
