// lib/storage.ts
import localforage from "localforage";
import { v4 as uuidv4 } from "uuid";

/** ********************
 * Types
 ********************* */
export type DepositType = "success" | "progress" | "effort";

export type Deposit = {
  id: string;
  date: string; // ISO
  type: DepositType;
  text: string;
};

export type Reframe = {
  id: string;
  date: string; // ISO
  original: string;
  reframed: string;
};

export type RoutineKey =
  | "affirmations"
  | "nightcap"
  | "openDoorway"
  | "visualization"
  | "flatTire"
  | "mentalSanctuary"
  | "breathingReset"
  | "attitudeLockdown"
  | "lastWord";

export type RoutineCheck = {
  id: string;
  date: string;
  routine: RoutineKey;
  done: boolean;
};

export type Project = {
  id: string;
  title: string;
  date?: string; // created at
  pre: {
    vaultNotes: string[];
    affirmations: string[];
    arena: { what: string; who: string; where: string };
    flatTires: string[];
    visualizationNotes: string;
  };
  during: {
    cbaUses: number;
    shooter: boolean;
    lastWordNotes: string[];
  };
  post: {
    aar: { what: string; soWhat: string; nowWhat: string };
    esp: { e: string; s: string; p: string };
    confidence: number; // 0..100
  };
};

/** Coach digest (structured) */
export type CoachDigest = {
  totals: { success: number; progress: number; effort: number; reframes: number };
  recent: {
    deposits: Array<{ type: DepositType; text: string; date: string }>;
    reframes: Array<{ original: string; reframed: string; date: string }>;
  };
  summary: string; // compact human-readable line
};

/** ********************
 * LocalForage stores
 ********************* */
const depositsStore = localforage.createInstance({
  name: "cmc",
  storeName: "deposits",
});

const reframesStore = localforage.createInstance({
  name: "cmc",
  storeName: "reframes",
});

const routinesStore = localforage.createInstance({
  name: "cmc",
  storeName: "routines",
});

const projectsStore = localforage.createInstance({
  name: "cmc",
  storeName: "projects",
});

/** ********************
 * Utilities
 ********************* */
export const todayKey = (): string => new Date().toISOString().slice(0, 10);

const inLastDays = (iso: string, days = 7) =>
  Date.now() - new Date(iso).getTime() < days * 24 * 60 * 60 * 1000;

/** ********************
 * Deposits
 ********************* */
export async function addDeposit(
  type: DepositType,
  text: string,
  date = new Date().toISOString()
): Promise<Deposit> {
  const id = uuidv4();
  const d: Deposit = { id, date, type, text };
  await depositsStore.setItem(id, d);
  return d;
}

export async function listDeposits(): Promise<Deposit[]> {
  const arr: Deposit[] = [];
  await depositsStore.iterate<Deposit, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

/** Convenience alias used by pages */
export const allDeposits = () => listDeposits();

/** ********************
 * Reframes
 ********************* */
export async function addReframe(
  original: string,
  reframed: string,
  date = new Date().toISOString()
): Promise<Reframe> {
  const id = uuidv4();
  const r: Reframe = { id, date, original, reframed };
  await reframesStore.setItem(id, r);
  return r;
}

export async function listReframes(): Promise<Reframe[]> {
  const arr: Reframe[] = [];
  await reframesStore.iterate<Reframe, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

export const allReframes = () => listReframes();

/** ********************
 * Routines
 ********************* */
export async function markRoutineDone(
  routine: RoutineKey,
  date = new Date().toISOString()
): Promise<RoutineCheck> {
  const id = uuidv4();
  const rec: RoutineCheck = { id, date, routine, done: true };
  await routinesStore.setItem(id, rec);
  return rec;
}

export const markRoutine = (routine: RoutineKey, date?: string) =>
  markRoutineDone(routine, date);

export async function listRoutineChecks(): Promise<RoutineCheck[]> {
  const arr: RoutineCheck[] = [];
  await routinesStore.iterate<RoutineCheck, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

/** ********************
 * Coach digest & weekly series
 ********************* */

/** Structured digest for the coach (last 7 days) */
export async function digestForCoach(): Promise<CoachDigest> {
  const deposits = await listDeposits();
  const reframes = await listReframes();

  const deps7 = deposits.filter((d) => inLastDays(d.date, 7));
  const refs7 = reframes.filter((r) => inLastDays(r.date, 7));

  const totals = {
    success: deps7.filter((d) => d.type === "success").length,
    progress: deps7.filter((d) => d.type === "progress").length,
    effort: deps7.filter((d) => d.type === "effort").length,
    reframes: refs7.length,
  };

  // Include up to 3 of the most recent items for color
  const recentDeposits = deps7.slice(0, 3).map((d) => ({
    type: d.type,
    text: d.text,
    date: d.date,
  }));

  const recentReframes = refs7.slice(0, 3).map((r) => ({
    original: r.original,
    reframed: r.reframed,
    date: r.date,
  }));

  const summary = `Last 7d — success:${totals.success}, progress:${totals.progress}, effort:${totals.effort}, reframes:${totals.reframes}`;

  return {
    totals,
    recent: { deposits: recentDeposits, reframes: recentReframes },
    summary,
  };
}

/** Legacy one-line digest (string) to keep old callers working */
export async function digestForCoachText(): Promise<string> {
  const d = await digestForCoach();
  return d.summary;
}

/** Time-series for charts: last 7 days, YYYY-MM-DD + total */
export async function weeklyDepositSeries(): Promise<
  { date: string; total: number }[]
> {
  const deposits = await listDeposits();

  // last 7 days keys
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }

  const map = new Map<string, number>(days.map((d) => [d, 0]));
  for (const dep of deposits) {
    const key = dep.date.slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }

  return days.map((d) => ({ date: d, total: map.get(d) || 0 }));
}

/** # of deposits in last 7 days */
export async function getWeeklyBalanceNumber(): Promise<number> {
  const series = await weeklyDepositSeries();
  return series.reduce((sum, p) => sum + p.total, 0);
}

/** ********************
 * Projects
 ********************* */
export async function createProject(title: string): Promise<Project> {
  const id = uuidv4();
  const p: Project = {
    id,
    title,
    date: new Date().toISOString(),
    pre: {
      vaultNotes: [],
      affirmations: [],
      arena: { what: "", who: "", where: "" },
      flatTires: [],
      visualizationNotes: "",
    },
    during: {
      cbaUses: 0,
      shooter: false,
      lastWordNotes: [],
    },
    post: {
      aar: { what: "", soWhat: "", nowWhat: "" },
      esp: { e: "", s: "", p: "" },
      confidence: 0,
    },
  };
  await projectsStore.setItem(id, p);
  return p;
}

export async function listProjects(): Promise<Project[]> {
  const arr: Project[] = [];
  await projectsStore.iterate<Project, void>((v) => arr.push(v));
  return arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export async function getProject(id: string): Promise<Project | null> {
  const p = await projectsStore.getItem<Project>(id);
  return p ?? null;
}

export async function updateProject(
  id: string,
  patch: Partial<Project>
): Promise<Project | null> {
  const existing = await projectsStore.getItem<Project>(id);
  if (!existing) return null;
  const merged: Project = {
    ...existing,
    ...patch,
    pre: { ...existing.pre, ...(patch.pre || {}) },
    during: { ...existing.during, ...(patch.during || {}) },
    post: { ...existing.post, ...(patch.post || {}) },
  };
  await projectsStore.setItem(id, merged);
  return merged;
}
