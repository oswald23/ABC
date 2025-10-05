// lib/storage.ts
import localforage from "localforage";

/** Small ID helper: uses crypto.randomUUID() when available */
const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
};

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

/** Settings: which questions are enabled for scoring */
export type UserSettings = {
  activeRoutines: RoutineKey[];   // routines that count as daily “questions”
  includeDepositChecks: boolean;  // S/P/E are questions
  includeReframeCheck: boolean;   // Reframe is a question
};

/** ********************
 * LocalForage stores
 ********************* */
const depositsStore = localforage.createInstance({ name: "cmc", storeName: "deposits" });
const reframesStore  = localforage.createInstance({ name: "cmc", storeName: "reframes" });
const routinesStore  = localforage.createInstance({ name: "cmc", storeName: "routines" });
const projectsStore  = localforage.createInstance({ name: "cmc", storeName: "projects" });
const settingsStore  = localforage.createInstance({ name: "cmc", storeName: "settings" });

/** ********************
 * Utilities
 ********************* */
export const todayKey = (): string => new Date().toISOString().slice(0, 10);
const inLastDays = (iso: string, days = 7) =>
  Date.now() - new Date(iso).getTime() < days * 24 * 60 * 60 * 1000;

/** ********************
 * Settings (merge defaults into stored values)
 ********************* */
export async function getSettings(): Promise<UserSettings> {
  const defaults: UserSettings = {
    activeRoutines: ["affirmations", "nightcap", "openDoorway"],
    includeDepositChecks: true,
    includeReframeCheck: true,
  };
  const stored = await settingsStore.getItem<UserSettings>("user");

  const merged: UserSettings = {
    ...defaults,
    ...(stored || {}),
    activeRoutines: Array.isArray(stored?.activeRoutines)
      ? stored!.activeRoutines
      : defaults.activeRoutines,
  };

  // Persist upgraded object if fields were missing
  if (
    !stored ||
    stored.includeDepositChecks === undefined ||
    stored.includeReframeCheck === undefined
  ) {
    await settingsStore.setItem("user", merged);
  }
  return merged;
}

export async function saveSettings(patch: Partial<UserSettings>) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await settingsStore.setItem("user", next);
}

/** ********************
 * RESET (for testing)
 ********************* */
export async function resetAllData() {
  await Promise.all([
    depositsStore.clear(),
    reframesStore.clear(),
    routinesStore.clear(),
    projectsStore.clear(),
  ]);
  await settingsStore.removeItem("user"); // will be recreated with defaults
}

/** ********************
 * Deposits (flexible signature)
 ********************* */
export async function addDeposit(
  typeOrObj: DepositType | { type: DepositType; text: string; date?: string },
  text?: string,
  date = new Date().toISOString()
): Promise<Deposit> {
  let type: DepositType;
  let finalText: string;
  let finalDate: string = date;

  if (typeof typeOrObj === "object") {
    type = typeOrObj.type;
    finalText = typeOrObj.text;
    finalDate = typeOrObj.date ?? new Date().toISOString();
  } else {
    type = typeOrObj;
    finalText = text ?? "";
  }

  const id = newId();
  const d: Deposit = { id, date: finalDate, type, text: finalText };
  await depositsStore.setItem(id, d);
  return d;
}

export async function listDeposits(): Promise<Deposit[]> {
  const arr: Deposit[] = [];
  await depositsStore.iterate<Deposit, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}
export const allDeposits = () => listDeposits();

/** Helpers to support “count once per day per type” UX */
export async function hasDepositTypeToday(type: DepositType): Promise<boolean> {
  const today = todayKey();
  const list = await listDeposits();
  return list.some((d) => d.type === type && d.date.slice(0, 10) === today);
}

/** Log a deposit and tell caller if it newly counted for today’s +10 */
export async function logDepositIfNeeded(
  type: DepositType,
  text: string
): Promise<{ created: Deposit; counted: boolean }> {
  const already = await hasDepositTypeToday(type);
  const created = await addDeposit({ type, text });
  // “counted” means this action flipped the daily boolean from false→true
  return { created, counted: !already };
}

/** ********************
 * Reframes (flexible signature)
 ********************* */
export async function addReframe(
  originalOrObj:
    | string
    | { original: string; reframed: string; date?: string },
  reframed?: string,
  date = new Date().toISOString()
): Promise<Reframe> {
  let original: string;
  let finalReframed: string;
  let finalDate: string = date;

  if (typeof originalOrObj === "object") {
    original = originalOrObj.original;
    finalReframed = originalOrObj.reframed;
    finalDate = originalOrObj.date ?? new Date().toISOString();
  } else {
    original = originalOrObj;
    finalReframed = reframed ?? "";
  }

  const id = newId();
  const r: Reframe = { id, date: finalDate, original, reframed: finalReframed };
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
  const id = newId();
  const rec: RoutineCheck = { id, date, routine, done: true };
  await routinesStore.setItem(id, rec);
  return rec;
}
/** Accept string date or boolean (ignored) as 2nd arg */
export const markRoutine = (routine: RoutineKey, dateOrFlag?: string | boolean) => {
  const date = typeof dateOrFlag === "string" ? dateOrFlag : undefined;
  return markRoutineDone(routine, date);
};
export async function listRoutineChecks(): Promise<RoutineCheck[]> {
  const arr: RoutineCheck[] = [];
  await routinesStore.iterate<RoutineCheck, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

/** ********************
 * Scoring helpers (Page 1)
 ********************* */
export async function answeredMapForDay(localDay: string) {
  const settings = await getSettings();
  const deposits = await listDeposits();
  const reframes = await listReframes();
  const routines = await listRoutineChecks();

  const dayMatch = (iso: string) => iso.slice(0, 10) === localDay;
  const m: Record<string, boolean> = {};

  if (settings.includeDepositChecks) {
    m["q:successLogged"]  = deposits.some((d) => d.type === "success"  && dayMatch(d.date));
    m["q:progressLogged"] = deposits.some((d) => d.type === "progress" && dayMatch(d.date));
    m["q:effortLogged"]   = deposits.some((d) => d.type === "effort"   && dayMatch(d.date));
  }
  if (settings.includeReframeCheck) {
    m["q:reframeLogged"]  = reframes.some((r) => dayMatch(r.date));
  }
  for (const r of settings.activeRoutines) {
    m[`q:${r}`] = routines.some((x) => x.routine === r && x.done && dayMatch(x.date));
  }
  return m;
}

export async function dayCounts(localDay: string) {
  const map = await answeredMapForDay(localDay);
  const keys = Object.keys(map);
  const eligible = keys.length;
  const answered = keys.filter((k) => map[k]).length;
  return { eligible, answered, keys, map };
}

/** 7-day series with inactivity rule */
export async function weeklyPointsSeriesWithDeductions(): Promise<
  { date: string; deposits: number; withdrawals: number; total: number; answered: number; eligible: number }[]
> {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  const raw: { date: string; eligible: number; answered: number; deposits: number; withdrawals: number }[] = [];
  for (const day of days) {
    const { eligible, answered } = await dayCounts(day);
    const deposits = answered * 10;
    let withdrawals = Math.max(0, (eligible - answered) * 10);
    raw.push({ date: day, eligible, answered, deposits, withdrawals });
  }
  // apply inactivity rule
  let zeroStreak = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].answered === 0) {
      zeroStreak++;
      if (zeroStreak >= 3) raw[i].withdrawals = 0;
    } else {
      zeroStreak = 0;
    }
  }
  return raw.map((x) => ({ ...x, total: x.deposits - x.withdrawals }));
}

export async function todayPoints() {
  const today = todayKey();
  const series = await weeklyPointsSeriesWithDeductions();
  const rec = series.find((s) => s.date === today);
  return (
    rec ?? { date: today, deposits: 0, withdrawals: 0, total: 0, answered: 0, eligible: 0 }
  );
}

/** Helpful for debugging on UI */
export async function todayChecklist() {
  const today = todayKey();
  return dayCounts(today);
}

/** ********************
 * Coach digest (unchanged)
 ********************* */
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

  const recentDeposits = deps7.slice(0, 3).map((d) => ({ type: d.type, text: d.text, date: d.date }));
  const recentReframes = refs7.slice(0, 3).map((r) => ({ original: r.original, reframed: r.reframed, date: r.date }));

  const summary = `Last 7d — success:${totals.success}, progress:${totals.progress}, effort:${totals.effort}, reframes:${totals.reframes}`;

  return { totals, recent: { deposits: recentDeposits, reframes: recentReframes }, summary };
}
export async function digestForCoachText(): Promise<string> {
  const d = await digestForCoach();
  return d.summary;
}

/** ********************
 * Projects (flexible createProject)
 ********************* */
export async function createProject(input: string | Partial<Project>): Promise<Project> {
  const id = newId();
  const now = new Date().toISOString();

  const base: Project = {
    id,
    title: "Untitled Project",
    date: now,
    pre: { vaultNotes: [], affirmations: [], arena: { what: "", who: "", where: "" }, flatTires: [], visualizationNotes: "" },
    during: { cbaUses: 0, shooter: false, lastWordNotes: [] },
    post: { aar: { what: "", soWhat: "", nowWhat: "" }, esp: { e: "", s: "", p: "" }, confidence: 0 },
  };

  let merged: Project;
  if (typeof input === "string") {
    merged = { ...base, title: input };
  } else {
    merged = {
      ...base,
      title: input.title ?? base.title,
      pre: { ...base.pre, ...(input.pre || {}) },
      during: { ...base.during, ...(input.during || {}) },
      post: { ...base.post, ...(input.post || {}) },
    };
  }

  await projectsStore.setItem(id, merged);
  return merged;
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
export async function updateProject(id: string, patch: Partial<Project>): Promise<Project | null> {
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
