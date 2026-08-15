export type ComponentCategory =
  | "runtime"
  | "infrastructure"
  | "data"
  | "cloud"
  | "ai"
  | "observability"
  | "auth"
  | "cicd"
  | "agent"
  | "tool"
  | "other";

export interface DetectedComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  evidence: string[];
  confidence: "low" | "medium" | "high";
}

export interface RegionSignal {
  region: string;
  /** file:line where the region literal appears */
  evidence: string;
}

export interface SecretSignal {
  file: string;
  line: number;
  /** What was matched (e.g. "AWS access key id"). Never the secret value itself. */
  kind: string;
}

export interface WriteSignal {
  /** Declared system type the signal maps to (e.g. postgres, s3, redis). */
  systemType: string;
  file: string;
  line: number;
  /** Named heuristic that matched (e.g. "SQL INSERT/UPDATE/DELETE"). */
  pattern: string;
}

export interface ScanSignals {
  regions: RegionSignal[];
  secretSuspects: SecretSignal[];
  writeSignals: WriteSignal[];
}

export interface Inventory {
  generatedAt: string;
  root: string;
  components: DetectedComponent[];
  signals?: ScanSignals;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship: string;
  access?: "read_only" | "read_write" | "unknown";
  data?: string[];
  containsPii?: boolean;
}

export interface IntegrationGraph {
  generatedAt: string;
  nodes: Array<{ id: string; label: string; category: ComponentCategory }>;
  edges: GraphEdge[];
}

export type Severity = "critical" | "warning" | "info";

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category:
    | "security"
    | "data"
    | "reliability"
    | "evaluation"
    | "observability"
    | "human_control";
  explanation: string;
  evidence?: string[];
  recommendation?: string;
}

export interface CheckResult {
  generatedAt: string;
  overallScore: number;
  scores: Record<
    "security" | "data" | "reliability" | "evaluation" | "observability" | "human_control",
    number
  >;
  findings: Finding[];
}
