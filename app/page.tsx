// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import BalanceChart from '@/components/BalanceChart'
import {
  addDeposit,
  addReframe,
  markRoutine,
  weeklyPointsSeriesWithDeductions,
  todayPoints,
  getSettings,
  saveSettings,
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

  // quick-add inputs
  const [depText, setDepText] = useState('')
  const [depType, setDepType] = useState<'success' | 'progress' | 'effort'>('success')

  const [origText, setOrigText] = useState('')
  const [refrText, setRefrText] = useState('')

  // settings: which routines count as questions
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const allRoutines: RoutineKey[] = [
    'affirmations',
    'nightcap',
    'openDoorway',
    'visualization',
    'flatTire',
    'mentalSanctuary',
    'breathingReset',
    'attitudeLockdown',
    'lastWord',
  ]

  async function refresh() {
    setSeries(await weeklyPointsSeriesWithDeductions())
    const t = await todayPoints()
    setToday({ deposits: t.deposits, withdrawals: t.withdrawals, total: t.total })
    setSettings(await getSettings())
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function addDepositClick() {
    if (!depText.trim()) return
    await addDeposit({ type: depType, text: depText })
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
    // mark done now (counts as answering that question today)
    await markRoutine(r, true)
    refresh()
  }

  async function toggleRoutineEnabled(r: RoutineKey) {
    if (!settings) return
    const set = new Set(settings.activeRoutines)
    if (set.has(r)) set.delete(r)
    else set.add(r)
    const next = { ...settings, activeRoutines: Array.from(set) }
    await saveSettings(next)
    setSettings(next)
    refresh()
  }

  return (
    <div className="space-y-8">
      {/* TOP SCOREBOARD */}
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

      {/* CHART: 7-day deposits vs withdrawals */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Last 7 Days</h2>
        <BalanceChart data={series} />
      </section>

      {/* QUICK ADD: Deposits */}
      <section className="rounded-2xl border bg-white p-4 space-y-3">
        <h3 className="font-semibold">Add Deposit</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="rounded border p-2"
            value={depType}
            onChange={(e) => setDepType(e.target.value as any)}
          >
            <option value="success">Success</option>
            <option value="progress">Progress</option>
            <option value="effort">Effort</option>
          </select>
          <input
            className="flex-1 rounded border p-2"
            placeholder="What went right?"
            value={depText}
            onChange={(e) => setDepText(e.target.value)}
          />
          <button onClick={addDepositClick} className="rounded bg-black text-white px-4 py-2">
            Save
          </button>
        </div>
        <p className="text-xs text-gray-500">Each answered “question” is worth +10 points for today.</p>
      </section>

      {/* QUICK ADD: Reframe (counts as a question if enabled) */}
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

      {/* ROUTINE QUESTIONS: enable / mark done */}
      <section className="rounded-2xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Routines (count toward points)</h3>
          <div className="text-xs text-gray-500">Toggle to include/exclude which routines are scored</div>
        </div>

        {/* Enable/disable which routines count as questions */}
        <div className="flex flex-wrap gap-2">
          {allRoutines.map((r) => {
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

        {/* Mark done now (counts as answered today) */}
        {settings?.activeRoutines?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {settings.activeRoutines.map((r) => (
              <button
                key={`done-${r}`}
                onClick={() => markRoutineDoneToday(r)}
                className="rounded-lg border px-3 py-2 text-left hover:bg-gray-50"
              >
                ✅ Mark “{r}” done today
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No routines selected. Enable some above to count them toward points.</p>
        )}
      </section>
    </div>
  )
}
