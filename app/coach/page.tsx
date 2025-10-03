'use client'
import { useEffect, useState } from 'react'
import { digestForCoach } from '@/lib/storage'

export default function CoachPage(){
  const [weeklyGoal,setWeeklyGoal]=useState('Stay consistent with deposits.')
  const [digest,setDigest]=useState('')
  const [suggestion,setSuggestion]=useState<string | null>(null)
  const [usage,setUsage]=useState(0)

  useEffect(()=>{
    (async ()=> setDigest(await digestForCoach()))()
  },[])

  async function ask(){
    const res = await fetch('/api/coach/suggest',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ weeklyGoal, digest })
    })
    const data = await res.json()
    setSuggestion(data.text ?? JSON.stringify(data.suggestions ?? data, null, 2))
    setUsage(u=>u+1)
  }

  return (
    <div className="grid gap-6">
      <h1 className="h1">Confidence Coach</h1>
      <div className="card grid gap-3">
        <div className="label">Weekly goal</div>
        <input className="input" value={weeklyGoal} onChange={e=>setWeeklyGoal(e.target.value)} />
        <div className="label">Digest (auto from your logs)</div>
        <textarea className="textarea" value={digest} onChange={e=>setDigest(e.target.value)} />
        <button className="btn" onClick={ask}>Get suggestions</button>
        {suggestion && <pre className="card whitespace-pre-wrap">{suggestion}</pre>}
        <div className="badge">API calls this session: {usage}</div>
      </div>
    </div>
  )
}
