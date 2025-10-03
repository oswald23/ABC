// lib/storage.ts
import localforage from "localforage";
import { v4 as uuidv4 } from "uuid";

/**
 * Types
 */
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

/**
 * LocalForage instances
 */
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

/**
 * -------- Deposits (success/progress/effort) ----------
 */

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
  await depositsStore.iterate<Deposit, void>((v) => {
    arr.push(v);
  });
  // Newest first
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * -------- Reframes ----------
 */

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
  await reframesStore.iterate<Reframe, void>((v) => {
    arr.push(v);
  });
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * -------- Routines (check off daily) ----------
 */

export async function markRoutineDone(
  routine: RoutineKey,
  date = new Date().toISOString()
): Promise<RoutineCheck> {
  const id = uuidv4();
  const rec: RoutineCheck = { id, date, routine, done: true };
  await routinesStore.setItem(id, rec);
  return rec;
}

export async function listRoutineChecks(): Promise<RoutineCheck[]> {
  const arr: RoutineCheck[] = [];
  await routinesStore.iterate<RoutineCheck, void>((v) => {
    arr.push(v);
  });
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Utility: a tiny weekly digest for the Coach API to read (keeps OpenAI tokens low)
 */
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

/**
 * -------- Projects (needed by /app/project/page.tsx) ----------
 */

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
  await projectsStore.iterate<Project, void>((v) => {
    arr.push(v);
  });
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

/**
 * -------- Confidence Balance ----------
 * Simple helper: count deposits (past 7 days) as a “balance” proxy.
 */
export async function getWeeklyBalanceNumber(): Promise<number> {
  const deps = await listDeposits();
  const last7 = deps.filter(
    (d) => Date.now() - new Date(d.date).getTime() < 7 * 24 * 60 * 60 * 1000
  );
  return last7.length;
}
