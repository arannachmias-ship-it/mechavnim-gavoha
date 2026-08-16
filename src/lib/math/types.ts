import type { MathNode } from "mathjs";

export type ExerciseKind = "expr" | "equation" | "system";
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
}
