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
  todayChecklist,
  resetAllData,
  type RoutineKey,
  type UserSettings,
} from '@/lib/storage'

export default function DashboardPage() {
  const [series, setSeries] = useState<
    { date: string; deposits: number; withdrawals: number; total: number }[]
  >([])
  const [today, setToday] = useState<{ deposits: number; withdrawals: number; total: number }>({
    deposits: 0,
    withdrawals: 0,
    total: 0,
  })

  // quick-add inputs (free text entry)
  const [depText, setDepText] = useState('')

  const [origText, setOrigText] = useState('')
  const [refrText, setRefrText] = useState('')

  // settings & checklist
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [checklist, setChecklist] = useState<{ eligible: number; answered: number; keys?: string[]; map?: Record<string, boolean> } | null>(null)

  const allRoutines: RoutineKey[] = [
    'affirmations','nightcap','openDoorway','visualization','flatTire',
    'mentalSanctuary','breathingReset','attitudeLockdown','lastWord'
  ]

  async function refresh() {
    setSeries(await weeklyPointsSeriesWithDeductions())
    const t = await todayPoints()
    setToday({ deposits: t.deposits, withdrawals: t.withdrawals, total: t.total })
    setSettings(await getSettings())
    const c = await todayChecklist()
    setChecklist({ eligible: c.eligible, answered: c.answered, keys: c.keys, map: c.map })
  }

  useEffect(() => { refresh() }, [])

  // One-click loggers that count only if not already counted today
  async function logSuccess() {
    await logDepositIfNeeded('success', depText || 'Logged success')
    setDepText('')
    refresh()
  }
  async function logProgress() {
    await logDepositIfNeeded('progress', depText || 'Logged progress')
    setDepText('')
    refresh()
  }
  async function logEffort() {
    await logDepositIfNeeded('effort', depText || 'Logged effort')
    setDepText('')
    refresh()
  }

  async function addReframeClick() {
    if (!origText.trim() || !refrText.trim()) return
    await addReframe({ original: origText, reframed: refrText })
    setOrigText('')
    setRefrText('')
    refresh()
  }

  async function markRoutineDoneToday(r: RoutineKey) {
    await markRoutine(r, true)
    refresh()
  }

  async function toggleRoutineEnabled(r: RoutineKey) {
    if (!settings) return
    const set = new Set(settings.activeRoutines)
    if (set.has(r)) set.delete(r); else set.add(r)
    const next = { ...settings, activeRoutines: Array.from(set) }
    await saveSettings(next)
    setSettings(next)
    refresh()
  }

  async function toggleIncludeDeposits(on: boolean) {
    if (!settings) return
    await saveSettings({ includeDepositChecks: on })
    refresh()
  }
  async function toggleIncludeReframe(on: boolean) {
    if (!settings) return
    await saveSettings({ includeReframeCheck: on })
    refresh()
  }

  async function resetAll() {
    const ok = confirm('Reset ALL local data? This clears deposits, reframes, routines, projects, and settings.')
    if (!ok) return
    await resetAllData()
    await refresh()
    alert('All data cleared. Defaults restored.')
  }

  const successDone  = !!checklist?.map?.['q:successLogged']
  const progressDone = !!checklist?.map?.['q:progressLogged']
  const effortDone   = !!checklist?.map?.['q:effortLogged']

  return (
    <div className="space-y-8">
      {/* TOP: heading + reset */}
      <div className="flex items-center justify-between">
        <h1 className="sr-only">Dashboard</h1>
        <button
          onClick={resetAll}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          title="Clear all local data to test scoring from scratch"
        >
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

      {/* SETTINGS: which questions count */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Scored Questions</h3>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!settings?.includeDepositChecks}
              onChange={(e) => toggleIncludeDeposits(e.target.checked)}
            />
            Include deposit checks (Success / Progress / Effort)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!settings?.includeReframeCheck}
              onChange={(e) => toggleIncludeReframe(e.target.checked)}
            />
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

      {/* ONE-CLICK: Deposit checks */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Quick +10 (once per day each)</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={logSuccess}
            disabled={successDone}
            className={`rounded px-3 py-2 border ${successDone ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            title={successDone ? 'Already counted today' : 'Log a success'}
          >
            ✅ Success
          </button>
          <button
            onClick={logProgress}
            disabled={progressDone}
            className={`rounded px-3 py-2 border ${progressDone ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            title={progressDone ? 'Already counted today' : 'Log progress'}
          >
            📈 Progress
          </button>
          <button
            onClick={logEffort}
            disabled={effortDone}
            className={`rounded px-3 py-2 border ${effortDone ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
            title={effortDone ? 'Already counted today' : 'Log effort'}
          >
            💪 Effort
          </button>
        </div>

        {/* Optional shared text for the above logs */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded border p-2"
            placeholder="Optional note for the above actions"
            value={depText}
            onChange={(e) => setDepText(e.target.value)}
          />
        </div>
        <p className="text-xs text-gray-500">Each of Success, Progress, Effort can contribute +10 once per day.</p>
      </section>

      {/* QUICK ADD: Reframe */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Reframe a Setback</h3>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="flex-1 rounded border p-2"
            placeholder="Original thought"
            value={origText}
            onChange={(e) => setOrigText(e.target.value)}
          />
          <input
            className="flex-1 rounded border p-2"
            placeholder="Constructive reframe"
            value={refrText}
            onChange={(e) => setRefrText(e.target.value)}
          />
          <button onClick={addReframeClick} className="rounded bg-black text-white px-4 py-2">
            Reframe
          </button>
        </div>
      </section>

      {/* ROUTINE: Mark done today */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Mark Routines Done (today)</h3>
        {settings?.activeRoutines?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {settings.activeRoutines.map((r) => (
              <button
                key={`done-${r}`}
                onClick={() => markRoutineDoneToday(r)}
                className="rounded-lg border px-3 py-2 text-left hover:bg-gray-50"
              >
                ✅ Mark “{r}”
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No routines selected. Enable some above to count them toward points.</p>
        )}
      </section>

      {/* DEBUG: see what counted today */}
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
