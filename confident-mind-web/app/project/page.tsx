'use client'
import { useState } from 'react'
import { createProject } from '@/lib/storage'

export default function ProjectPage(){
  const [title,setTitle]=useState('')
  const [what,setWhat]=useState('')
  const [who,setWho]=useState('')
  const [where,setWhere]=useState('')
  const [affirm,setAffirm]=useState('')
  const [viz,setViz]=useState('')
  const [flat,setFlat]=useState('')

  async function save(){
    await createProject({
      title,
      pre: { vaultNotes: [], affirmations: affirm? [affirm]:[], arena:{what,who,where}, flatTires: flat? [flat]:[], visualizationNotes: viz },
      during: { cbaUses:0, shooter:false, lastWordNotes:[] },
      post: { aar:{ what:'', soWhat:'', nowWhat:''}, esp:{e:'',s:'',p:''}, confidence: 0 }
    })
    setTitle(''); setWhat(''); setWho(''); setWhere(''); setAffirm(''); setViz(''); setFlat('')
    alert('Project saved locally!')
  }

  return (
    <div className="grid gap-6">
      <h1 className="h1">Project / Performance Prep</h1>
      <div className="card grid gap-3">
        <input className="input" placeholder="Project title" value={title} onChange={e=>setTitle(e.target.value)} />
        <div className="grid sm:grid-cols-3 gap-2">
          <input className="input" placeholder="What (task)" value={what} onChange={e=>setWhat(e.target.value)} />
          <input className="input" placeholder="Who (opponent/force)" value={who} onChange={e=>setWho(e.target.value)} />
          <input className="input" placeholder="Where (arena)" value={where} onChange={e=>setWhere(e.target.value)} />
        </div>
        <textarea className="textarea" placeholder="Event affirmations" value={affirm} onChange={e=>setAffirm(e.target.value)} />
        <textarea className="textarea" placeholder="Visualization notes" value={viz} onChange={e=>setViz(e.target.value)} />
        <textarea className="textarea" placeholder="Flat Tire rehearsal" value={flat} onChange={e=>setFlat(e.target.value)} />
        <button className="btn" onClick={save}>Save</button>
      </div>
    </div>
  )
}
