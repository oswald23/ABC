export type Deposit = {
  id: string
  date: string
  type: 'success'|'progress'|'effort'
  text: string
}
export type Reframe = {
  id: string
  date: string
  original: string
  reframed: string
}
export type RoutineKey = 'affirmations'|'nightcap'|'openDoorway'|'visualization'|'flatTire'|'mentalSanctuary'|'breathingReset'|'attitudeLockdown'|'lastWord'
