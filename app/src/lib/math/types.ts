import type { MathNode } from "mathjs";

export type ExerciseKind = "expr" | "equation" | "system" | "fracdomain";
export type FinalForm = "expanded" | "factored" | "any";

export interface Step {
  latex: string;
  stage: number;
  note: string;
}

export interface StageInfo {
  name: string; // שם הצעד בשפה של ארן
  hint1: string; // רמז – הדימוי
  hint2: string; // רמז חזק – מה לעשות עכשיו
}

export interface Trap {
  plain: string; // mathjs-parsable
  message: string;
  mistake?: string; // analytics key
}

export interface Exercise {
  id: string;
  typeId: string;
  topicId: string;
  kind: ExerciseKind;
  instruction: string;
  promptLatex: string;
  /** expr */
  originalPlain?: string;
  finalPlain?: string;
  finalLatex: string;
  finalForm?: FinalForm;
  /** equation */
  variable?: string;
  solutions?: number[] | "all" | "none";
  /** quadratic: [a,b,c] of the normalised form – lets the student write the "a=…, b=…, c=…" line */
  abc?: [number, number, number];
  /** fracdomain: values that make a denominator zero (must be declared before any algebra) */
  excluded?: number[];
  /** system */
  vars?: string[];
  solutionMap?: Record<string, number>;
  askFor?: string[];
  /** guidance */
  steps: Step[];
  stages: StageInfo[];
  traps?: Trap[];
  /** classify a student's (parsed) line into a stage index; expr/eq nodes given */
  stageOf?: (info: { node?: MathNode; lhs?: MathNode; rhs?: MathNode; plain: string }) => number;
  /** difficulty 1..3 */
  level: number;
}

export type CheckStatus = "ok" | "done" | "wrong" | "same" | "unparsable" | "notprogress";

export interface CheckResult {
  status: CheckStatus;
  message: string;
  stage: number;
  /** for equations: what solutions the student's line has (debug) */
  detail?: string;
  /** machine-readable mistake key for analytics (e.g. "divx", "pow_sum", "domain_first", "pm", "pair_order") */
  mistake?: string;
  /** accepted, but with a habit warning (e.g. correct value, wrong order of operations) – shown amber */
  warn?: string;
}
