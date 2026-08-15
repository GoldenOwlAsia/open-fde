import type { Finding } from "../core/types.js";
import type { Check } from "./registry.js";

const hasAgents: Check["appliesTo"] = ({ engagement }) => (engagement?.spec?.agents?.length ?? 0) > 0;

const sideEffectApproval: Check = {
  id: "agent-side-effect-unapproved",
  category: "human_control",
  description: "A side-effecting agent tool has no matching human-approval entry.",
  appliesTo: hasAgents,
  run: ({ engagement }) => {
    const requiredFor = engagement?.spec?.constraints?.humanApproval?.requiredFor ?? [];
    const findings: Finding[] = [];
    for (const agent of engagement?.spec?.agents ?? []) {
      for (const tool of agent.tools ?? []) {
        if (!tool.sideEffects || !tool.id) continue;
        const approved = requiredFor.includes(tool.id) || requiredFor.includes(`${agent.id}.${tool.id}`);
        if (approved) continue;
        findings.push({
          id: "agent-side-effect-unapproved",
          title: `Side-effecting tool "${tool.id}" has no human-approval entry`,
          severity: "critical",
          category: "human_control",
          explanation: `Agent "${agent.id}" holds tool "${tool.id}" declared with sideEffects: true, but neither "${tool.id}" nor "${agent.id}.${tool.id}" appears in spec.constraints.humanApproval.requiredFor. A side-effecting action with no approval boundary is a production incident waiting for a prompt.`,
          evidence: [
            `fde.yaml: spec.agents["${agent.id}"].tools["${tool.id}"] declares sideEffects: true`,
            `fde.yaml: spec.constraints.humanApproval.requiredFor is ${requiredFor.length ? `[${requiredFor.join(", ")}]` : "empty"}`
          ],
          recommendation: `Add "${tool.id}" (or "${agent.id}.${tool.id}") to spec.constraints.humanApproval.requiredFor, or set sideEffects: false if the tool truly cannot mutate anything.`
        });
      }
    }
    return findings;
  }
};

const accessBoundary: Check = {
  id: "agent-access-exceeds-boundary",
  category: "security",
  description: "An agent tool is granted broader access than the declared system boundary.",
  appliesTo: hasAgents,
  run: ({ engagement }) => {
    const systems = new Map(
      (engagement?.spec?.systems ?? []).filter((s) => s.id).map((s) => [s.id as string, s])
    );
    const findings: Finding[] = [];
    for (const agent of engagement?.spec?.agents ?? []) {
      for (const tool of agent.tools ?? []) {
        if (!tool.system) continue;
        const system = systems.get(tool.system);
        if (!system) continue; // covered by agent-tool-system-undeclared
        if (system.access !== "read_only") continue;
        const writes = tool.access === "read_write" || tool.sideEffects === true;
        if (!writes) continue;
        findings.push({
          id: "agent-access-exceeds-boundary",
          title: `Tool "${tool.id}" exceeds the read_only boundary of system "${tool.system}"`,
          severity: "critical",
          category: "security",
          explanation: `System "${tool.system}" is declared read_only, but agent "${agent.id}" holds tool "${tool.id}" with ${tool.access === "read_write" ? "access: read_write" : "sideEffects: true"}. The agent's effective permissions are wider than the boundary the customer signed off on.`,
          evidence: [
            `fde.yaml: spec.systems["${tool.system}"].access is read_only`,
            `fde.yaml: spec.agents["${agent.id}"].tools["${tool.id}"] declares ${tool.access === "read_write" ? "access: read_write" : "sideEffects: true"}`
          ],
          recommendation: `Narrow the tool to read-only, or change the declared access of "${tool.system}" to read_write after confirming with the customer.`
        });
      }
    }
    return findings;
  }
};

const undeclaredSystem: Check = {
  id: "agent-tool-system-undeclared",
  category: "security",
  description: "An agent tool references a system that is not declared in spec.systems.",
  appliesTo: hasAgents,
  run: ({ engagement }) => {
    const declared = new Set((engagement?.spec?.systems ?? []).map((s) => s.id).filter(Boolean));
    const findings: Finding[] = [];
    for (const agent of engagement?.spec?.agents ?? []) {
      for (const tool of agent.tools ?? []) {
        if (!tool.system || declared.has(tool.system)) continue;
        findings.push({
          id: "agent-tool-system-undeclared",
          title: `Tool "${tool.id}" references undeclared system "${tool.system}"`,
          severity: "warning",
          category: "security",
          explanation: `Agent "${agent.id}" holds tool "${tool.id}" pointing at system "${tool.system}", but no spec.systems entry has that id. The tool's target has no declared access boundary at all.`,
          evidence: [
            `fde.yaml: spec.agents["${agent.id}"].tools["${tool.id}"].system is "${tool.system}"`,
            `fde.yaml: spec.systems ids are ${declared.size ? `[${[...declared].join(", ")}]` : "empty"}`
          ],
          recommendation: `Declare "${tool.system}" under spec.systems with an explicit access level.`
        });
      }
    }
    return findings;
  }
};

export const agentChecks: Check[] = [sideEffectApproval, accessBoundary, undeclaredSystem];
