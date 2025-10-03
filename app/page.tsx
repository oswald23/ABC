'use client'
import { useEffect, useMemo, useState } from 'react'
import { addDeposit, allDeposits, addReframe, allReframes, markRoutine, todayKey, weeklyDepositSeries } from '@/lib/storage'
import type { Deposit } from '@/lib/types'
import { BalanceChart } from '@/components/BalanceChart'

export default function DashboardPage() {
  const [type, setType] = useState<'success'|'progress'|'effort'>('success')
  const [text, setText] = useState('')
  const [neg, setNeg] = useState('')
  const [pos, setPos] = useState('')
  const [deps, setDeps] = useState<Deposit[]>([])
  const [series, setSeries] = useState<{date:string; total:number}[]>([])
  const [reframes, setReframes] = useState<{original:string; reframed:string}[]>([])

  async function refresh() {
    setDeps(await allDeposits())
    setSeries(await weeklyDepositSeries())
    setReframes(await allReframes())
  }
  useEffect(()=>{ refresh() }, [])

  async function add() {
    if (!text.trim()) return
    await addDeposit({ type, text })
    setText(''); refresh()
  }
  async function reframe() {
    if (!neg.trim() || !pos.trim()) return
    await addReframe({ original:neg, reframed:pos })
    setNeg(''); setPos(''); refresh()
  }
  async function toggleRoutine(r: string) {
    await markRoutine(r as any, true)
    refresh()
  }

  const todayCount = useMemo(()=>deps.filter(d=>d.date===todayKey()).length,[deps])
  const depositThisWeek = series.reduce((a,b)=>a + b.total,0)

  return (
    <div className="grid gap-6">
      <section className="card">
        <h1 className="h1 mb-2">Confidence Bank</h1>
        <p className="label mb-4">Log Success • Progress • Effort • Reframe a setback</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card">
            <div className="label mb-2">Add deposit</div>
            <select className="input mb-2" value={type} onChange={e=>setType(e.target.value as any)}>
              <option value="success">Success</option>
              <option value="progress">Progress</option>
              <option value="effort">Effort</option>
            </select>
            <textarea className="textarea mb-2" placeholder="What happened?" value={text} onChange={e=>setText(e.target.value)} />
            <button className="btn" onClick={add}>Add deposit</button>
          </div>
          <div className="card sm:col-span-2">
            <div className="label mb-2">Reframe setback</div>
            <textarea className="textarea mb-2" placeholder="Original negative thought" value={neg} onChange={e=>setNeg(e.target.value)} />
            <textarea className="textarea mb-2" placeholder="Constructive replacement" value={pos} onChange={e=>setPos(e.target.value)} />
            <button className="btn" onClick={reframe}>Save reframe</button>
          </div>
        </div>
        <div className="mt-4 flex gap-4 items-center">
          <span className="badge">Today deposits: {todayCount}</span>
          <span className="badge">This week deposits: {depositThisWeek}</span>
        </div>
      </section>

      <section className="card">
        <h2 className="h2 mb-2">Balance Trend</h2>
        <BalanceChart data={series} />
      </section>

      <section className="card">
        <h2 className="h2 mb-2">Daily Routines</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {['affirmations','nightcap','openDoorway','visualization','flatTire','mentalSanctuary','breathingReset','attitudeLockdown','lastWord'].map(r=>(
            <button key={r} className="btn" onClick={()=>toggleRoutine(r)}>{r}</button>
          ))}
        </div>
      </section>
    </div>
  )
}
