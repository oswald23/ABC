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

/** Convenience names expected by app/page.tsx */
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

/** Convenience name expected by app/page.tsx */
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

/** Alias expected by app/page.tsx */
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
export async function buildWeeklyDigest(): Promise<string> {
  const deposits = await listDeposits();
  const reframes = await listReframes();
  const last7 = (d: string) =>
    Date.now() - new Date(d).getTime() < 7 * 24 * 60 * 60 * 1000;

  const deps = deposits.filter((d) => last7(d.date));
  const refs = reframes.filter((r) => last7(r.date));

  const counts = {
    success: deps.filter((d) => d.type === "success").length,
    progress: deps.filter((d) => d.type === "progress").length,
    effort: deps.filter((d) => d.type === "effort").length,
    reframes: refs.length,
  };

  return `Weekly totals — success:${counts.success}, progress:${counts.progress}, effort:${counts.effort}, reframes:${counts.reframes}`;
}

/** Alias expected by app/coach/page.tsx */
export const digestForCoach = () => buildWeeklyDigest();

/** Time-series for charts: last 7 days, YYYY-MM-DD + count */
export async function weeklyDepositSeries(): Promise<
  { date: string; count: number }[]
> {
  const deposits = await listDeposits();
  // Build last 7 day keys
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
  return days.map((d) => ({ date: d, count: map.get(d) || 0 }));
}

/** Simple “balance” helper = #deposits in last 7 days */
export async function getWeeklyBalanceNumber(): Promise<number> {
  const series = await weeklyDepositSeries();
  return series.reduce((sum, p) => sum + p.count, 0);
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
