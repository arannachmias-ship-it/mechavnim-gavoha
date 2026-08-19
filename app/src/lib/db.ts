/**
 * Storage: Neon Postgres when DATABASE_URL is set, otherwise an in-memory store
 * (dev only – resets on restart).
 */
import { neon } from "@neondatabase/serverless";

export interface AttemptRow {
  id: number;
  profile: string;
  type_id: string;
  topic_id: string;
  level: number;
  correct: boolean;
  hints: number;
  reveals: number;
  wrong_lines: number;
  duration_sec: number;
  lines: string[];
  prompt: string;
  mistakes: string[];
  /** seconds from exercise shown until first keystroke (הססנות) */
  first_input_sec: number | null;
  /** exercise was skipped (נטישה) */
  skipped: boolean;
  /** כמה פעמים לחצה "=" במחשבון של האפליקציה במהלך התרגיל */
  calc_uses: number;
  created_at: string;
}

export type NewAttempt = Omit<AttemptRow, "id" | "created_at">;

const memory: AttemptRow[] = [];
let memId = 1;

function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

let ensured = false;
async function ensureSchema() {
  const sql = sqlClient();
  if (!sql || ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS attempts (
    id SERIAL PRIMARY KEY,
    profile TEXT NOT NULL,
    type_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    level INT NOT NULL,
    correct BOOLEAN NOT NULL,
    hints INT NOT NULL DEFAULT 0,
    reveals INT NOT NULL DEFAULT 0,
    wrong_lines INT NOT NULL DEFAULT 0,
    duration_sec INT NOT NULL DEFAULT 0,
    lines JSONB NOT NULL DEFAULT '[]',
    prompt TEXT NOT NULL DEFAULT '',
    mistakes JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS attempts_profile_idx ON attempts(profile, created_at)`;
  await sql`ALTER TABLE attempts ADD COLUMN IF NOT EXISTS first_input_sec INT`;
  await sql`ALTER TABLE attempts ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE attempts ADD COLUMN IF NOT EXISTS calc_uses INT NOT NULL DEFAULT 0`;
  await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  ensured = true;
}

export async function insertAttempt(a: NewAttempt): Promise<void> {
  const sql = sqlClient();
  if (!sql) {
    memory.push({ ...a, id: memId++, created_at: new Date().toISOString() });
    return;
  }
  await ensureSchema();
  await sql`INSERT INTO attempts (profile, type_id, topic_id, level, correct, hints, reveals, wrong_lines, duration_sec, lines, prompt, mistakes, first_input_sec, skipped, calc_uses)
    VALUES (${a.profile}, ${a.type_id}, ${a.topic_id}, ${a.level}, ${a.correct}, ${a.hints}, ${a.reveals}, ${a.wrong_lines}, ${a.duration_sec}, ${JSON.stringify(a.lines)}, ${a.prompt}, ${JSON.stringify(a.mistakes)}, ${a.first_input_sec}, ${a.skipped}, ${a.calc_uses})`;
}

export async function deleteAttempts(profile: string): Promise<number> {
  const sql = sqlClient();
  if (!sql) {
    const before = memory.length;
    for (let i = memory.length - 1; i >= 0; i--) if (memory[i].profile === profile) memory.splice(i, 1);
    return before - memory.length;
  }
  await ensureSchema();
  const rows = (await sql`DELETE FROM attempts WHERE profile = ${profile} RETURNING id`) as unknown as { id: number }[];
  return rows.length;
}

export async function listAttempts(profile: string, limit = 2000): Promise<AttemptRow[]> {
  const sql = sqlClient();
  if (!sql) return memory.filter((m) => m.profile === profile).slice(-limit);
  await ensureSchema();
  const rows = (await sql`SELECT * FROM attempts WHERE profile = ${profile} ORDER BY created_at DESC LIMIT ${limit}`) as unknown as AttemptRow[];
  return rows.reverse().map((r) => ({
    ...r,
    created_at: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at as unknown as Date).toISOString(),
    lines: typeof r.lines === "string" ? JSON.parse(r.lines) : r.lines,
    mistakes: typeof r.mistakes === "string" ? JSON.parse(r.mistakes) : (r.mistakes ?? []),
    first_input_sec: r.first_input_sec ?? null,
    skipped: !!r.skipped,
    calc_uses: Number(r.calc_uses ?? 0),
  }));
}

/* ---------------- settings (encrypted values) ---------------- */
export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}
const memSettings = new Map<string, SettingRow>();

export async function getSetting(key: string): Promise<SettingRow | null> {
  const sql = sqlClient();
  if (!sql) return memSettings.get(key) ?? null;
  await ensureSchema();
  const rows = (await sql`SELECT key, value, updated_at FROM settings WHERE key = ${key}`) as unknown as SettingRow[];
  if (!rows.length) return null;
  const r = rows[0];
  return { ...r, updated_at: typeof r.updated_at === "string" ? r.updated_at : new Date(r.updated_at as unknown as Date).toISOString() };
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sql = sqlClient();
  if (!sql) {
    memSettings.set(key, { key, value, updated_at: new Date().toISOString() });
    return;
  }
  await ensureSchema();
  await sql`INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

export async function deleteSetting(key: string): Promise<void> {
  const sql = sqlClient();
  if (!sql) {
    memSettings.delete(key);
    return;
  }
  await ensureSchema();
  await sql`DELETE FROM settings WHERE key = ${key}`;
}

/* ---------------- ראיונות משתמש (נגה ↔ Claude) ---------------- */
export interface InterviewMsg {
  role: "assistant" | "user";
  text: string;
  at: string;
}
export interface InterviewRow {
  id: number;
  token: string;
  title: string;
  status: "open" | "done";
  messages: InterviewMsg[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}
const memInterviews: InterviewRow[] = [];
let memIvId = 1;

async function ensureInterviews() {
  const sql = sqlClient();
  if (!sql) return;
  await ensureSchema();
  await sql`CREATE TABLE IF NOT EXISTS interviews (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    messages JSONB NOT NULL DEFAULT '[]',
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}
function normIv(r: InterviewRow): InterviewRow {
  return {
    ...r,
    messages: typeof r.messages === "string" ? JSON.parse(r.messages) : (r.messages ?? []),
    created_at: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at as unknown as Date).toISOString(),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : new Date(r.updated_at as unknown as Date).toISOString(),
    summary: r.summary ?? null,
  };
}
export async function createInterview(token: string, title: string): Promise<InterviewRow> {
  const sql = sqlClient();
  if (!sql) {
    const row: InterviewRow = { id: memIvId++, token, title, status: "open", messages: [], summary: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    memInterviews.push(row);
    return row;
  }
  await ensureInterviews();
  const rows = (await sql`INSERT INTO interviews (token, title) VALUES (${token}, ${title}) RETURNING *`) as unknown as InterviewRow[];
  return normIv(rows[0]);
}
export async function getInterview(token: string): Promise<InterviewRow | null> {
  const sql = sqlClient();
  if (!sql) return memInterviews.find((i) => i.token === token) ?? null;
  await ensureInterviews();
  const rows = (await sql`SELECT * FROM interviews WHERE token = ${token}`) as unknown as InterviewRow[];
  return rows.length ? normIv(rows[0]) : null;
}
export async function listInterviews(): Promise<InterviewRow[]> {
  const sql = sqlClient();
  if (!sql) return [...memInterviews].reverse();
  await ensureInterviews();
  const rows = (await sql`SELECT * FROM interviews ORDER BY created_at DESC LIMIT 50`) as unknown as InterviewRow[];
  return rows.map(normIv);
}
export async function updateInterview(token: string, patch: { messages?: InterviewMsg[]; status?: "open" | "done"; summary?: string | null }): Promise<void> {
  const sql = sqlClient();
  if (!sql) {
    const row = memInterviews.find((i) => i.token === token);
    if (row) Object.assign(row, patch, { updated_at: new Date().toISOString() });
    return;
  }
  await ensureInterviews();
  const cur = await getInterview(token);
  if (!cur) return;
  const messages = patch.messages ?? cur.messages;
  const status = patch.status ?? cur.status;
  const summary = patch.summary === undefined ? cur.summary : patch.summary;
  await sql`UPDATE interviews SET messages = ${JSON.stringify(messages)}, status = ${status}, summary = ${summary}, updated_at = now() WHERE token = ${token}`;
}
export async function deleteInterview(token: string): Promise<void> {
  const sql = sqlClient();
  if (!sql) {
    const i = memInterviews.findIndex((x) => x.token === token);
    if (i >= 0) memInterviews.splice(i, 1);
    return;
  }
  await ensureInterviews();
  await sql`DELETE FROM interviews WHERE token = ${token}`;
}
