'use client'
import { useEffect, useState } from 'react'

export default function RemindersPage(){
  const [perm,setPerm]=useState<NotificationPermission>('default')
  useEffect(()=>{ if (typeof Notification !== 'undefined') setPerm(Notification.permission) },[])

  async function askPermission(){
    if (typeof Notification === 'undefined') return alert('Notifications not supported in this browser')
    const p = await Notification.requestPermission()
    setPerm(p)
    if (p==='granted') new Notification('Notifications enabled 🎉')
  }

  async function scheduleLocal(){
    // naive local: fire one in 10 seconds
    setTimeout(()=>{
      if (Notification.permission==='granted') new Notification('Nightcap: log Success • Progress • Effort')
    }, 10000)
    alert('Scheduled a test notification in 10 seconds (tab must be open on some browsers).')
  }

  return (
    <div className="grid gap-6">
      <h1 className="h1">Reminders & Notifications</h1>
      <div className="card grid gap-3">
        <div>Notification permission: <span className="badge">{perm}</span></div>
        <button className="btn" onClick={askPermission}>Enable Notifications</button>
        <button className="btn" onClick={scheduleLocal}>Schedule test notification</button>
        <div className="label">Zapier: use "Schedule → Email by Zapier" to get email reminders (see README).</div>
      </div>
    </div>
  )
}
