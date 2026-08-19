import type { MathNode } from "mathjs";

export type ExerciseKind = "expr" | "equation" | "system" | "fracdomain" | "geo";

/* ---------- פונקציות וגאומטריה אנליטית (kind = "geo") ---------- */
/** מה מבקשים מנגה למצוא – ערך (m=2), נקודה ((3,0)) או משוואה של הגרף (y=2x+1) */
export interface GeoAsk {
  key: string;
  label: string; // בשפה של ארן, לרשימת המשימות
  kind: "value" | "point" | "eq";
  value?: number;
  x?: number;
  y?: number;
}
/** הגרף שהתשובה "eq" צריכה לתאר – ישר y=mx+b או פרבולה y=ax²+bx+c */
export interface GeoCurve {
  kind: "line" | "parabola";
  coeffs: number[];
}
/** טעות צפויה: ערך/נקודה שנגה עלולה לכתוב, והמשפט שמסביר מה קרה */
export interface GeoTrap {
  key?: string; // ערך של משתנה, או "point"
  value?: number;
  x?: number;
  y?: number;
  message: string;
  mistake?: string;
}
/** ציור: מה מראים לנגה במערכת הצירים (רק הנתונים – לא התשובות) */
export interface PlotSpec {
  points?: { x: number; y: number; label?: string }[];
  lines?: { m: number; b: number; label?: string }[];
  parabolas?: { a: number; b: number; c: number }[];
  segments?: { a: [number, number]; b: [number, number]; dashed?: boolean; label?: string }[];
  polygon?: [number, number][];
}
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
  /** geo: functions & analytic geometry */
  asks?: GeoAsk[];
  curve?: GeoCurve;
  /** ערכים שהמחולל יודע (m, b, d…) – כדי לאשר שורות ביניים נכונות גם אם לא ביקשנו אותן */
  params?: Record<string, number>;
  geoTraps?: GeoTrap[];
  /** "AB=5" עונה על d – מיפוי שם קטע (segKey) לבקשה */
  aliases?: Record<string, string>;
  plot?: PlotSpec;
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
