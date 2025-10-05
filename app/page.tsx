// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import BalanceChart from '@/components/BalanceChart'
import {
  logDepositIfNeeded,
  addReframe,
  markRoutine,
  weeklyPointsSeriesWithDeductions,
  todayPoints,
  getSettings,
  saveSettings,
  dayCounts,
  todayKey,
  resetAllData,
  type RoutineKey,
  type UserSettings,
} from '@/lib/storage'

type SeriesPoint = { date: string; deposits: number; withdrawals: number; total: number }

export default function DashboardPage() {
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [today, setToday] = useState({ deposits: 0, withdrawals: 0, total: 0 })

  // separate notes for each question
  const [successNote, setSuccessNote] = useState('')
  const [progressNote, setProgressNote] = useState('')
  const [effortNote, setEffortNote] = useState('')

  // reframe inputs
  const [origText, setOrigText] = useState('')
  const [refrText, setRefrText] = useState('')

  // settings & debug
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [checklist, setChecklist] = useState<{
    eligible: number
    answered: number
    keys?: string[]
    map?: Record<string, boolean>
  } | null>(null)

  const allRoutines: RoutineKey[] = [
    'affirmations','nightcap','openDoorway','visualization','flatTire',
    'mentalSanctuary','breathingReset','attitudeLockdown','lastWord'
  ]

  async function refresh() {
    setSeries(await weeklyPointsSeriesWithDeductions())
    const t = await todayPoints()
    setToday({ deposits: t.deposits, withdrawals: t.withdrawals, total: t.total })
    setSettings(await getSettings())

    // 🔧 replaced todayChecklist with dayCounts(todayKey())
    const c = await dayCounts(todayKey())
    setChecklist({ eligible: c.eligible, answered: c.answered, keys: c.keys, map: c.map })
  }
  useEffect(() => { refresh() }, [])

  // which questions already counted today?
  const successDone  = !!checklist?.map?.['q:successLogged']
  const progressDone = !!checklist?.map?.['q:progressLogged']
  const effortDone   = !!checklist?.map?.['q:effortLogged']

  // handlers — each logs its own type (+10 once per day)
  async function saveSuccess() {
    await logDepositIfNeeded('success', successNote.trim() || 'Logged success')
    setSuccessNote('')
    await refresh()
  }
  async function saveProgress() {
    await logDepositIfNeeded('progress', progressNote.trim() || 'Logged progress')
    setProgressNote('')
    await refresh()
  }
  async function saveEffort() {
    await logDepositIfNeeded('effort', effortNote.trim() || 'Logged effort')
    setEffortNote('')
    await refresh()
  }

  async function addReframeClick() {
    if (!origText.trim() || !refrText.trim()) return
    await addReframe({ original: origText, reframed: refrText })
    setOrigText(''); setRefrText('')
    await refresh()
  }

  async function markRoutineDoneToday(r: RoutineKey) {
    await markRoutine(r, true)
    await refresh()
  }

  async function toggleRoutineEnabled(r: RoutineKey) {
    if (!settings) return
    const set = new Set(settings.activeRoutines)
    set.has(r) ? set.delete(r) : set.add(r)
    await saveSettings({ activeRoutines: Array.from(set) })
    await refresh()
  }
  async function toggleIncludeDeposits(on: boolean) { await saveSettings({ includeDepositChecks: on }); await refresh() }
  async function toggleIncludeReframe(on: boolean)  { await saveSettings({ includeReframeCheck: on });  await refresh() }

  async function resetAll() {
    if (!confirm('Reset ALL local data?')) return
    await resetAllData()
    await refresh()
    alert('All data cleared. Defaults restored.')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="sr-only">Dashboard</h1>
        <button onClick={resetAll} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Reset Progress
        </button>
      </div>

      {/* SCOREBOARD */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Deposits (Today)</div>
          <div className="text-3xl font-bold">{today.deposits}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Withdrawals (Today)</div>
          <div className="text-3xl font-bold">{today.withdrawals}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total (Today)</div>
          <div className={`text-3xl font-bold ${today.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {today.total}
          </div>
        </div>
      </section>

      {/* CHART */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Last 7 Days</h2>
        <BalanceChart data={series} />
      </section>

      {/* SETTINGS */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Scored Questions</h3>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings?.includeDepositChecks} onChange={(e) => toggleIncludeDeposits(e.target.checked)} />
            Include deposit checks (Success / Progress / Effort)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!settings?.includeReframeCheck} onChange={(e) => toggleIncludeReframe(e.target.checked)} />
            Include reframe check
          </label>
        </div>

        <div className="pt-2">
          <div className="text-sm font-medium mb-1">Enable routines to count toward points</div>
          <div className="flex flex-wrap gap-2">
            {allRoutines.map(r => {
              const enabled = settings?.activeRoutines?.includes(r)
              return (
                <button
                  key={r}
                  onClick={() => toggleRoutineEnabled(r)}
                  className={[
                    'px-3 py-1 rounded-full text-sm border',
                    enabled ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50',
                  ].join(' ')}
                >
                  {r}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* DAILY DEPOSIT QUESTIONS — three separate inputs */}
      <section className="rounded-2xl border bg-white p-4 space-y-4">
        <h3 className="font-semibold">Daily Deposits (+10 each, once per day)</h3>

        {/* Success */}
        <div className="flex flex-col gap-2 sm:flex-row items-stretch">
          <div className="w-32 shrink-0 font-medium pt-2">✅ Success</div>
          <input
            className="flex-1 rounded border p-2"
            placeholder="(Optional) What went right?"
            value={successNote}
            onChange={(e) => setSuccessNote(e.target.value)}
          />
          <button
            onClick={saveSuccess}
            disabled={successDone}
            className={`rounded px-4 py-2 border ${successDone ? 'opacity-50 cursor-not-allowed bg-gray-200 border-gray-300' : 'bg-black text-white border-black'}`}
            title={successDone ? 'Already counted today' : 'Save (+10)'}
          >
            Save
          </button>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-2 sm:flex-row items-stretch">
          <div className="w-32 shrink-0 font-medium pt-2">📈 Progress</div>
          <input
            className="flex-1 rounded border p-2"
            placeholder="(Optional) What moved forward?"
            value={progressNote}
            onChange={(e) => setProgressNote(e.target.value)}
          />
          <button
            onClick={saveProgress}
            disabled={progressDone}
            className={`rounded px-4 py-2 border ${progressDone ? 'opacity-50 cursor-not-allowed bg-gray-200 border-gray-300' : 'bg-black text-white border-black'}`}
            title={progressDone ? 'Already counted today' : 'Save (+10)'}
          >
            Save
          </button>
        </div>

        {/* Effort */}
        <div className="flex flex-col gap-2 sm:flex-row items-stretch">
          <div className="w-32 shrink-0 font-medium pt-2">💪 Effort</div>
          <input
            className="flex-1 rounded border p-2"
            placeholder="(Optional) What effort did you put in?"
            value={effortNote}
            onChange={(e) => setEffortNote(e.target.value)}
          />
          <button
            onClick={saveEffort}
            disabled={effortDone}
            className={`rounded px-4 py-2 border ${effortDone ? 'opacity-50 cursor-not-allowed bg-gray-200 border-gray-300' : 'bg-black text-white border-black'}`}
            title={effortDone ? 'Already counted today' : 'Save (+10)'}
          >
            Save
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Each question contributes +10 once per local day. Buttons disable after they count.
        </p>
      </section>

      {/* REFRAME */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Reframe a Setback (+10)</h3>
        <div className="flex flex-col gap-2 md:flex-row">
          <input className="flex-1 rounded border p-2" placeholder="Original thought" value={origText} onChange={(e) => setOrigText(e.target.value)} />
          <input className="flex-1 rounded border p-2" placeholder="Constructive reframe" value={refrText} onChange={(e) => setRefrText(e.target.value)} />
          <button onClick={addReframeClick} className="rounded bg-black text-white px-4 py-2">Reframe</button>
        </div>
      </section>

      {/* ROUTINES */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Mark Routines Done (today)</h3>
        {settings?.activeRoutines?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {settings.activeRoutines.map((r) => (
              <button key={`done-${r}`} onClick={() => markRoutineDoneToday(r)} className="rounded-lg border px-3 py-2 text-left hover:bg-gray-50">
                ✅ Mark “{r}”
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No routines selected. Enable some above to count them toward points.</p>
        )}
      </section>

      {/* DEBUG */}
      <section className="rounded-2xl border bg-white p-4 space-y-2">
        <div className="text-sm font-medium">
          Debug — Today counted {checklist?.answered ?? 0} / {checklist?.eligible ?? 0}
        </div>
        <div className="text-xs text-gray-600">
          {checklist?.keys?.map((k) => (
            <span
              key={k}
              className={[
                'inline-block mr-2 mb-2 px-2 py-1 rounded border',
                checklist?.map?.[k] ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200',
              ].join(' ')}
              title={String(checklist?.map?.[k])}
            >
              {k} {checklist?.map?.[k] ? '✓' : '—'}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
