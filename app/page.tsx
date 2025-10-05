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
  const [today, setToday] = useState<{ deposits: number; withdrawals: number; total: number }>({ deposits: 0, withdrawals: 0, total: 0 })

  // deposit dropdown
  const [depType, setDepType] = useState<'success' | 'progress' | 'effort'>('success')
  const [depText, setDepText] = useState('')

  // reframe inputs
  const [origText, setOrigText] = useState('')
  const [refrText, setRefrText] = useState('')

  // settings & debug
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [checklist, setChecklist] = useState<{ eligible: number; answered: number; keys?: string[]; map?: Record<string, boolean> } | null>(null)

  const allRoutines: Array<RoutineKey> = ['affirmations','nightcap','openDoorway','visualization','flatTire','mentalSanctuary','breathingReset','attitudeLockdown','lastWord']

  async function refresh() {
    setSeries(await weeklyPointsSeriesWithDeductions())
    const t = await todayPoints()
    setToday({ deposits: t.deposits, withdrawals: t.withdrawals, total: t.total })
    setSettings(await getSettings())
    const c = await todayChecklist()
    setChecklist({ eligible: c.eligible, answered: c.answered, keys: c.keys, map: c.map })
  }
  useEffect(() => { refresh() }, [])

  // derived: what’s already counted today
  const successDone  = !!checklist?.map?.['q:successLogged']
  const progressDone = !!checklist?.map?.['q:progressLogged']
  const effortDone   = !!checklist?.map?.['q:effortLogged']

  const selectedAlready =
    (depType === 'success'  && successDone) ||
    (depType === 'progress' && progressDone) ||
    (depType === 'effort'   && effortDone)

  // SAVE for Add Deposit (dropdown flow) — now uses logDepositIfNeeded
  async function addDepositClick() {
    if (!depText.trim()) return
    await logDepositIfNeeded(depType, depText)
    setDepText('')
    refresh()
  }

  async function addReframeClick() {
    if (!origText.trim() || !refrText.trim()) return
    await addReframe({ original: origText, reframed: refrText })
    setOrigText(''); setRefrText('')
    refresh()
  }

  async function markRoutineDoneToday(r: RoutineKey) { await markRoutine(r, true); refresh() }

  async function toggleRoutineEnabled(r: RoutineKey) {
    if (!settings) return
    const set = new Set(settings.activeRoutines); set.has(r) ? set.delete(r) : set.add(r)
    await saveSettings({ activeRoutines: Array.from(set) }); refresh()
  }
  async function toggleIncludeDeposits(on: boolean) { if (!settings) return; await saveSettings({ includeDepositChecks: on }); refresh() }
  async function toggleIncludeReframe(on: boolean)  { if (!settings) return; await saveSettings({ includeReframeCheck: on });  refresh() }

  async function resetAll() {
    if (!confirm('Reset ALL local data?')) return
    await resetAllData(); await refresh(); alert('All data cleared.')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="sr-only">Dashboard</h1>
        <button onClick={resetAll} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Reset Progress</button>
      </div>

      {/* SCOREBOARD */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-gray-500">Deposits (Today)</div><div className="text-3xl font-bold">{today.deposits}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-gray-500">Withdrawals (Today)</div><div className="text-3xl font-bold">{today.withdrawals}</div></div>
        <div className="rounded-2xl border bg-white p-4"><div className="text-xs uppercase tracking-wide text-gray-500">Total (Today)</div><div className={`text-3xl font-bold ${today.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{today.total}</div></div>
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
                <button key={r} onClick={() => toggleRoutineEnabled(r)} className={['px-3 py-1 rounded-full text-sm border', enabled ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50'].join(' ')}>
                  {r}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ADD DEPOSIT (dropdown) */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Add Deposit</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="rounded border p-2" value={depType} onChange={e => setDepType(e.target.value as any)}>
            <option value="success">Success</option>
            <option value="progress">Progress</option>
            <option value="effort">Effort</option>
          </select>
          <input className="flex-1 rounded border p-2" placeholder="What went right?" value={depText} onChange={e => setDepText(e.target.value)} />
          <button
            onClick={addDepositClick}
            disabled={selectedAlready || !depText.trim()}
            className={`rounded px-4 py-2 border ${selectedAlready || !depText.trim() ? 'opacity-50 cursor-not-allowed bg-gray-200 border-gray-300' : 'bg-black text-white border-black'}`}
            title={selectedAlready ? 'This type already counted today' : 'Save'}
          >
            Save
          </button>
        </div>
        <p className="text-xs text-gray-500">Each of Success, Progress, Effort can contribute +10 once per day. Switch the dropdown to another type to add its +10.</p>
      </section>

      {/* REFRAME */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Reframe a Setback</h3>
        <div className="flex flex-col gap-2 md:flex-row">
          <input className="flex-1 rounded border p-2" placeholder="Original thought" value={origText} onChange={e => setOrigText(e.target.value)} />
          <input className="flex-1 rounded border p-2" placeholder="Constructive reframe" value={refrText} onChange={e => setRefrText(e.target.value)} />
          <button onClick={addReframeClick} className="rounded bg-black text-white px-4 py-2">Reframe</button>
        </div>
      </section>

      {/* ROUTINE: Mark done today */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Mark Routines Done (today)</h3>
        {settings?.activeRoutines?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {settings.activeRoutines.map(r => (
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
        <div className="text-sm font-medium">Debug — Today counted {checklist?.answered ?? 0} / {checklist?.eligible ?? 0}</div>
        <div className="text-xs text-gray-600">
          {checklist?.keys?.map(k => (
            <span key={k} className={['inline-block mr-2 mb-2 px-2 py-1 rounded border', checklist?.map?.[k] ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'].join(' ')} title={String(checklist?.map?.[k])}>
              {k} {checklist?.map?.[k] ? '✓' : '—'}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
