/**
 * שמירת מקום בתרגול (localStorage).
 * למה: נגה יוצאת לוואטסאפ באמצע תרגיל, הנייד סוגר את הדף, וכשהיא חוזרת –
 * צריך להמשיך מאותו תרגיל, מאותן שורות ומאותו רצף, ולא להתחיל מהתחלה.
 */
export interface ResumeState {
  v: 3;
  typeId: string;
  topicId: string;
  title?: string;
  level: number;
  /** זרע ההגרלה – ממנו נבנה אותו תרגיל בדיוק (לא קיים בתרגיל מצילום) */
  seed?: number;
  /** תרגיל מצילום – מסודר כ-JSON (בלי פונקציות) */
  customEx?: string;
  promptLatex?: string;
  history: string[];
  draft: string;
  hintLevel: number;
  hintsUsed: number;
  reveals: number;
  wrongCount: number;
  mistakes: string[];
  activeMs: number;
  firstInputSec: number | null;
  sessionCount: number;
  sessionWrong: number;
  cleanRun: number;
  /** לחיצות "=" במחשבון בתרגיל הזה */
  calcUses?: number;
  /** התרגיל כבר נפתר – לשחזר רק את המונים, ולבנות תרגיל חדש */
  finished?: boolean;
  savedAt: number;
}

const KEY = (typeId: string) => `mg_resume_${typeId}`;
const LAST = "mg_resume_last";
/** עד מתי שווה להחזיר את אותו תרגיל */
export const RESUME_MAX_AGE_MS = 12 * 3600e3;
/** עד מתי זה נחשב "אותו סשן" (מונים של רצף וסיכום) */
export const SESSION_MAX_AGE_MS = 90 * 60e3;

function safeLocal(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveResume(state: Omit<ResumeState, "v" | "savedAt">) {
  const ls = safeLocal();
  if (!ls) return;
  const rec: ResumeState = { ...state, v: 3, savedAt: Date.now() };
  try {
    ls.setItem(KEY(state.typeId), JSON.stringify(rec));
    ls.setItem(LAST, state.typeId);
  } catch {
    /* מלא / חסום – לא נורא */
  }
}

export function loadResume(typeId: string): ResumeState | null {
  const ls = safeLocal();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY(typeId));
    if (!raw) return null;
    const rec = JSON.parse(raw) as ResumeState;
    if (rec?.v !== 3 || rec.typeId !== typeId) return null;
    if (Date.now() - rec.savedAt > RESUME_MAX_AGE_MS) {
      ls.removeItem(KEY(typeId));
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

export function clearResume(typeId: string) {
  const ls = safeLocal();
  if (!ls) return;
  try {
    ls.removeItem(KEY(typeId));
    if (ls.getItem(LAST) === typeId) ls.removeItem(LAST);
  } catch {
    /* ignore */
  }
}

/** התרגיל האחרון שנקטע באמצע – בשביל כפתור "להמשיך מאיפה שעצרת" */
export function lastResume(): ResumeState | null {
  const ls = safeLocal();
  if (!ls) return null;
  try {
    const t = ls.getItem(LAST);
    if (!t) return null;
    const rec = loadResume(t);
    // שווה להציע רק אם באמת יש התקדמות באותו תרגיל
    if (!rec || rec.finished) return null;
    return rec.history.length || rec.draft || rec.hintsUsed || rec.wrongCount ? rec : null;
  } catch {
    return null;
  }
}

/** "לפני 12 דקות" וכו' – בעברית, קצר */
export function agoText(ts: number): string {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `לפני ${m} ${m === 1 ? "דקה" : "דקות"}`;
  const h = Math.round(m / 60);
  return `לפני ${h} ${h === 1 ? "שעה" : "שעות"}`;
}
