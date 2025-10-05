// lib/storage.ts
import localforage from "localforage";

/* ---------------- Local-day helpers (avoid UTC boundary bugs) ---------------- */
const ymdLocal = (d?: Date) => {
  const dt = d ?? new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const todayKey = (): string => ymdLocal();
const localDayOfISO = (iso: string) => ymdLocal(new Date(iso));

/* ---------------- IDs ---------------- */
const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
};

/* ---------------- Types ---------------- */
export type DepositType = "success" | "progress" | "effort";

export type Deposit = {
  id: string;
  date: string; // ISO timestamp
  day?: string; // local YYYY-MM-DD (added for robustness)
  type: DepositType;
  text: string;
};

export type Reframe = {
  id: string;
  date: string;
  day?: string;
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
  day?: string;
  routine: RoutineKey;
  done: boolean;
};

export type Project = {
  id: string;
  title: string;
  date?: string;
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
    confidence: number;
  };
};

export type CoachDigest = {
  totals: { success: number; progress: number; effort: number; reframes: number };
  recent: {
    deposits: Array<{ type: DepositType; text: string; date: string }>;
    reframes: Array<{ original: string; reframed: string; date: string }>;
  };
  summary: string;
};

export type UserSettings = {
  activeRoutines: RoutineKey[];
  includeDepositChecks: boolean;
  includeReframeCheck: boolean;
};

/* ---------------- NEW: Daily checklist flags ---------------- */
type DailyFlags = {
  success?: boolean;
  progress?: boolean;
  effort?: boolean;
  reframe?: boolean;
  routines?: Partial<Record<RoutineKey, boolean>>;
};

/* ---------------- Stores ---------------- */
const depositsStore = localforage.createInstance({ name: "cmc", storeName: "deposits" });
const reframesStore  = localforage.createInstance({ name: "cmc", storeName: "reframes" });
const routinesStore  = localforage.createInstance({ name: "cmc", storeName: "routines" });
const projectsStore  = localforage.createInstance({ name: "cmc", storeName: "projects" });
const settingsStore  = localforage.createInstance({ name: "cmc", storeName: "settings" });
const dailyStore     = localforage.createInstance({ name: "cmc", storeName: "daily" });

/* ---------------- Settings ---------------- */
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
  await settingsStore.setItem("user", { ...cur, ...patch });
}

/* ---------------- Daily helpers ---------------- */
async function getDaily(day: string): Promise<DailyFlags> {
  return (await dailyStore.getItem<DailyFlags>(day)) || {};
}
async function setDaily(day: string, flags: DailyFlags) {
  await dailyStore.setItem(day, flags);
}
async function patchDaily(day: string, patch: Partial<DailyFlags>) {
  const cur = await getDaily(day);
  await setDaily(day, { ...cur, ...patch, routines: { ...(cur.routines || {}), ...(patch.routines || {}) } });
}

/* ---------------- Reset (for testing) ---------------- */
export async function resetAllData() {
  await Promise.all([
    depositsStore.clear(),
    reframesStore.clear(),
    routinesStore.clear(),
    projectsStore.clear(),
    dailyStore.clear(),
  ]);
  await settingsStore.removeItem("user");
}

/* ---------------- Deposits ---------------- */
export async function addDeposit(
  typeOrObj: DepositType | { type: DepositType; text: string; date?: string },
  text?: string,
  date = new Date().toISOString()
): Promise<Deposit> {
  let type: DepositType;
  let finalText: string;
  let finalDate = date;

  if (typeof typeOrObj === "object") {
    type = typeOrObj.type;
    finalText = typeOrObj.text;
    finalDate = typeOrObj.date ?? new Date().toISOString();
  } else {
    type = typeOrObj;
    finalText = text ?? "";
  }

  const id = newId();
  const d: Deposit = {
    id,
    date: finalDate,
    day: localDayOfISO(finalDate),
    type,
    text: finalText,
  };
  await depositsStore.setItem(id, d);
  return d;
}
export async function listDeposits(): Promise<Deposit[]> {
  const arr: Deposit[] = [];
  await depositsStore.iterate<Deposit, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}
export const allDeposits = () => listDeposits();

/** Count-once via daily flags (authoritative) */
export async function logDepositIfNeeded(type: DepositType, text: string) {
  const created = await addDeposit({ type, text });
  const day = created.day || localDayOfISO(created.date);
  const cur = await getDaily(day);
  const counted = !cur[type];
  if (counted) await patchDaily(day, { [type]: true } as any);
  return { created, counted };
}

/* ---------------- Reframes ---------------- */
export async function addReframe(
  originalOrObj: string | { original: string; reframed: string; date?: string },
  reframed?: string,
  date = new Date().toISOString()
): Promise<Reframe> {
  let original: string;
  let finalReframed: string;
  let finalDate = date;

  if (typeof originalOrObj === "object") {
    original = originalOrObj.original;
    finalReframed = originalOrObj.reframed;
    finalDate = originalOrObj.date ?? new Date().toISOString();
  } else {
    original = originalOrObj;
    finalReframed = reframed ?? "";
  }

  const id = newId();
  const r: Reframe = {
    id,
    date: finalDate,
    day: localDayOfISO(finalDate),
    original,
    reframed: finalReframed,
  };
  await reframesStore.setItem(id, r);

  // flip daily flag
  const day = r.day || localDayOfISO(r.date);
  await patchDaily(day, { reframe: true });

  return r;
}
export async function listReframes(): Promise<Reframe[]> {
  const arr: Reframe[] = [];
  await reframesStore.iterate<Reframe, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}
export const allReframes = () => listReframes();

/* ---------------- Routines ---------------- */
export async function markRoutineDone(
  routine: RoutineKey,
  date = new Date().toISOString()
): Promise<RoutineCheck> {
  const id = newId();
  const rec: RoutineCheck = {
    id,
    date,
    day: localDayOfISO(date),
    routine,
    done: true,
  };
  await routinesStore.setItem(id, rec);

  const day = rec.day || localDayOfISO(rec.date);
  const cur = await getDaily(day);
  await patchDaily(day, { routines: { ...(cur.routines || {}), [routine]: true } });

  return rec;
}
export const markRoutine = (routine: RoutineKey, dateOrFlag?: string | boolean) =>
  markRoutineDone(routine, typeof dateOrFlag === "string" ? dateOrFlag : new Date().toISOString());
export async function listRoutineChecks(): Promise<RoutineCheck[]> {
  const arr: RoutineCheck[] = [];
  await routinesStore.iterate<RoutineCheck, void>((v) => arr.push(v));
  return arr.sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------------- Scoring (uses daily flags first) ---------------- */
export async function answeredMapForDay(localDay: string) {
  const settings = await getSettings();

  // Authoritative flags
  const flags = await getDaily(localDay);

  // Fallbacks (for legacy entries before flags existed)
  const deposits = await listDeposits();
  const reframes = await listReframes();
  const routines = await listRoutineChecks();
  const depMatch = (d: Deposit) => (d.day || localDayOfISO(d.date)) === localDay;
  const refMatch = (r: Reframe) => (r.day || localDayOfISO(r.date)) === localDay;
  const rouMatch = (r: RoutineCheck) => (r.day || localDayOfISO(r.date)) === localDay;

  const m: Record<string, boolean> = {};

  if (settings.includeDepositChecks) {
    m["q:successLogged"]  = !!flags.success  || deposits.some(d => d.type === "success"  && depMatch(d));
    m["q:progressLogged"] = !!flags.progress || deposits.some(d => d.type === "progress" && depMatch(d));
    m["q:effortLogged"]   = !!flags.effort   || deposits.some(d => d.type === "effort"   && depMatch(d));
  }
  if (settings.includeReframeCheck) {
    m["q:reframeLogged"]  = !!flags.reframe  || reframes.some(r => refMatch(r));
  }
  for (const r of settings.activeRoutines) {
    const routineOk = !!flags.routines?.[r] || routines.some(x => x.routine === r && x.done && rouMatch(x));
    m[`q:${r}`] = routineOk;
  }

  return m;
}

export async function dayCounts(localDay: string) {
  const map = await answeredMapForDay(localDay);
  const keys = Object.keys(map);
  const eligible = keys.length;
  const answered = keys.filter(k => map[k]).length;
  return { eligible, answered, keys, map };
}

/* 7-day series with inactivity rule (local days) */
export async function weeklyPointsSeriesWithDeductions(): Promise<
  { date: string; deposits: number; withdrawals: number; total: number; answered: number; eligible: number }[]
> {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(ymdLocal(d));
  }

  const raw: { date: string; eligible: number; answered: number; deposits: number; withdrawals: number }[] = [];
  for (const day of days) {
    const { eligible, answered } = await dayCounts(day);
    const deposits = answered * 10;
    let withdrawals = Math.max(0, (eligible - answered) * 10);
    raw.push({ date: day, eligible, answered, deposits, withdrawals });
  }

  // Inactivity rule: stop deducting on the 3rd consecutive zero-answered day
  let zeroStreak = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].answered === 0) {
      zeroStreak++;
      if (zeroStreak >= 3) raw[i].withdrawals = 0;
    } else {
      zeroStreak = 0;
    }
  }

  return raw.map(x => ({ ...x, total: x.deposits - x.withdrawals }));
}

export async function todayPoints() {
  const day = todayKey();
  const series = await weeklyPointsSeriesWithDeductions();
  const rec = series.find(s => s.date === day);
  return rec ?? { date: day, deposits: 0, withdrawals: 0, total: 0, answered: 0, eligible: 0 };
}

/* ---------------- Coach digest (unchanged) ---------------- */
const inLastDays = (iso: string, days = 7) =>
  Date.now() - new Date(iso).getTime() < days * 86400000;

export async function digestForCoach(): Promise<CoachDigest> {
  const deposits = await listDeposits();
  const reframes = await listReframes();

  const deps7 = deposits.filter(d => inLastDays(d.date, 7));
  const refs7 = reframes.filter(r => inLastDays(r.date, 7));

  const totals = {
    success: deps7.filter(d => d.type === "success").length,
    progress: deps7.filter(d => d.type === "progress").length,
    effort:   deps7.filter(d => d.type === "effort").length,
    reframes: refs7.length,
  };

  const recentDeposits = deps7.slice(0, 3).map(d => ({ type: d.type, text: d.text, date: d.date }));
  const recentReframes = refs7.slice(0, 3).map(r => ({ original: r.original, reframed: r.reframed, date: r.date }));

  const summary = `Last 7d — success:${totals.success}, progress:${totals.progress}, effort:${totals.effort}, reframes:${totals.reframes}`;

  return { totals, recent: { deposits: recentDeposits, reframes: recentReframes }, summary };
}
export async function digestForCoachText(): Promise<string> {
  const d = await digestForCoach();
  return d.summary;
}

/* ---------------- Projects (unchanged) ---------------- */
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

  const merged: Project = typeof input === "string"
    ? { ...base, title: input }
    : {
        ...base,
        title: input.title ?? base.title,
        pre:    { ...base.pre,    ...(input.pre    || {}) },
        during: { ...base.during, ...(input.during || {}) },
        post:   { ...base.post,   ...(input.post   || {}) },
      };

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
    pre:    { ...existing.pre,    ...(patch.pre    || {}) },
    during: { ...existing.during, ...(patch.during || {}) },
    post:   { ...existing.post,   ...(patch.post   || {}) },
  };
  await projectsStore.setItem(id, merged);
  return merged;
}
