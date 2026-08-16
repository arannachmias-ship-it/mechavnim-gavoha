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
  ensured = true;
}

export async function insertAttempt(a: NewAttempt): Promise<void> {
  const sql = sqlClient();
  if (!sql) {
    memory.push({ ...a, id: memId++, created_at: new Date().toISOString() });
    return;
  }
  await ensureSchema();
  await sql`INSERT INTO attempts (profile, type_id, topic_id, level, correct, hints, reveals, wrong_lines, duration_sec, lines, prompt, mistakes, first_input_sec, skipped)
    VALUES (${a.profile}, ${a.type_id}, ${a.topic_id}, ${a.level}, ${a.correct}, ${a.hints}, ${a.reveals}, ${a.wrong_lines}, ${a.duration_sec}, ${JSON.stringify(a.lines)}, ${a.prompt}, ${JSON.stringify(a.mistakes)}, ${a.first_input_sec}, ${a.skipped})`;
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
  }));
}
