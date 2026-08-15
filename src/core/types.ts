export type ComponentCategory =
  | "runtime"
  | "infrastructure"
  | "data"
  | "cloud"
  | "ai"
  | "observability"
  | "auth"
  | "cicd"
  | "other";

export interface DetectedComponent {
  id: string;
  name: string;
  category: ComponentCategory;
  evidence: string[];
  confidence: "low" | "medium" | "high";
}

export interface Inventory {
  generatedAt: string;
  root: string;
  components: DetectedComponent[];
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
