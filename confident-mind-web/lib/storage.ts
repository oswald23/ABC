'use client'
import localforage from 'localforage'
import { v4 as uuid } from 'uuid'
import type { Deposit, RoutineKey } from './types'

localforage.config({ name: 'confident-mind' })

export function todayKey(d = new Date()){
  return d.toISOString().slice(0,10)
}

export async function addDeposit({ type, text }:{ type: Deposit['type'], text: string }){
  const item: Deposit = { id: uuid(), date: todayKey(), type, text }
  const list = (await localforage.getItem<Deposit[]>('deposits')) || []
  list.push(item)
  await localforage.setItem('deposits', list)
  return item
}

export async function allDeposits(): Promise<Deposit[]>{
  return (await localforage.getItem<Deposit[]>('deposits')) || []
}

export async function weeklyDepositSeries(){
  const list = await allDeposits()
  const map = new Map<string, number>()
  const now = new Date()
  for (let i=6;i>=0;i--){
    const d = new Date(now); d.setDate(now.getDate()-i)
    map.set(todayKey(d), 0)
  }
  for (const d of list){
    if (map.has(d.date)) map.set(d.date, (map.get(d.date) || 0) + 1)
  }
  return Array.from(map, ([date,total])=>({date,total}))
}

export async function addReframe({ original, reframed }:{ original:string, reframed:string }){
  const item = { id: uuid(), date: todayKey(), original, reframed }
  const list = (await localforage.getItem<any[]>('reframes')) || []
  list.push(item)
  await localforage.setItem('reframes', list)
  return item
}

export async function allReframes(){
  return (await localforage.getItem<any[]>('reframes')) || []
}

export async function markRoutine(r: RoutineKey, done: boolean){
  const key = `routine:${r}:${todayKey()}`
  await localforage.setItem(key, done)
}

export async function digestForCoach(){
  const deposits = await allDeposits()
  const week = await weeklyDepositSeries()
  const reframes = await allReframes()
  const lines = [
    `Deposits last 7 days: ${week.reduce((a,b)=>a+b.total,0)}`,
    `Today deposits: ${deposits.filter(d=>d.date===todayKey()).length}`,
    `Reframes (total): ${reframes.length}`
  ]
  return lines.join('\n')
}
