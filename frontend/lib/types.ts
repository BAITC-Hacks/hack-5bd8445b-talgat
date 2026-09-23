export type CardField =
  | "context"
  | "need"
  | "users"
  | "data"
  | "constraints"
  | "expectedResult"
  | "successCriteria"
  | "contact"
  | "format";

export type CardFields = Record<CardField, string>;
export type LevelId = "DRAFT" | "WORKING" | "READY" | "PRIORITY";
export type CriterionId = "contextNeed" | "data" | "result" | "success" | "constraints" | "users" | "link";
export type Decision = "SELECTED" | "REJECTED" | "PENDING";

export interface Level {
  id: LevelId;
  name: string;
  min: number;
  max: number;
  note: string;
}

export interface Check {
  label: string;
  points: number;
  field: CardField;
  ok: boolean;
}

export interface CriterionResult {
  id: CriterionId;
  name: string;
  short: string;
  max: number;
  earned: number;
  checks: Check[];
}

export interface Evaluation {
  total: number;
  level: Level;
  criteria: CriterionResult[];
  missing: Array<{ criterionId: CriterionId; criterion: string; label: string; points: number; field: CardField }>;
}

export interface Meta {
  criteria: Array<{ id: CriterionId; name: string; short: string; max: number; hint: string; checks: Array<{ label: string; points: number; field: CardField }> }>;
  levels: Level[];
  topics: string[];
  fields: Array<{ id: CardField; label: string; placeholder: string; criterion: CriterionId }>;
}

export interface Business {
  id: string;
  name: string;
  industry: string;
  city: string;
  contact: string;
  email: string;
}

export interface Team {
  id: string;
  name: string;
  members: number;
  interests: string[];
  skills: string[];
  stack: string[];
}

export interface Question {
  id: string;
  criterion: CriterionId;
  field: CardField;
  text: string;
  why: string;
  answer: string;
}

export interface Clarification {
  source: "openai" | "rules";
  model: string | null;
  analyzedAt: string;
  extracted: { title: string; fields: CardFields };
  questions: Question[];
  warnings: string[];
  proposed?: { title: string; fields: CardFields; source: "openai" | "rules"; model: string | null; warnings: string[]; createdAt: string } | null;
}

export interface Preview {
  total: number;
  level: Level;
  criteria: CriterionResult[];
  rank: number;
}

export interface Task {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  topic: string;
  title: string;
  rawDraft: string;
  fields: CardFields;
  score: number;
  evaluation: Evaluation;
  business: { id: string; name: string; industry: string; city: string };
  rank: number;
  catalogSize: number;
  proposalsCount: number;
  history: Array<{ score: number; level: LevelId; reason: string; createdAt: string }>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clarification?: Clarification | null;
  preview?: Preview;
}

export interface CatalogItem {
  id: string;
  title: string;
  topic: string;
  need: string;
  business: { id: string; name: string };
  score: number;
  level: Level;
  rank: number;
  points: Array<{ id: CriterionId; short: string; earned: number; max: number }>;
  missing: string[];
  proposalsCount: number;
  publishedAt: string;
  isNew: boolean;
  delta: number | null;
}

export interface Catalog {
  total: number;
  counts: { levels: Record<LevelId, number>; topics: Record<string, number> };
  items: CatalogItem[];
}

export interface MyTask {
  id: string;
  title: string;
  topic: string;
  status: "DRAFT" | "PUBLISHED";
  score: number;
  level: Level;
  rank: number | null;
  proposalsCount: number;
  pendingTeams: number;
  selectedTeams: number;
  hasQuestions: boolean;
  updatedAt: string;
}

export interface ProposalView {
  id: string;
  idea: string;
  plan: string;
  deadline: string;
  prototypeUrl: string;
  createdAt: string;
  team: Team;
  decision: Decision;
}

export interface TeamProposal {
  id: string;
  idea: string;
  deadline: string;
  createdAt: string;
  task: { id: string; title: string; score: number; business: string };
  decision: Decision;
}

export interface Recommendation {
  task: { id: string; title: string; topic: string; score: number; business: string };
  reason: string;
}

export interface AiInfo {
  enabled: boolean;
  provider: string;
  model: string;
  reasoningEffort: string;
  steps: Array<{ id: string; title: string; endpoint: string; systemPrompt: string; inputExample: string; outputSchema: unknown }>;
  safeguards: string[];
}
