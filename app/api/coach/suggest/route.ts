import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

function fallback(weeklyGoal: string, digest: string){
  const actions = [
    'Log 1 success, 1 progress, 1 effort today',
    'Reframe 1 setback today',
    'Do a 2-minute visualization'
  ]
  return `Focus: ${weeklyGoal}

Feedback: Based on your digest, keep fueling deposits daily and protect confidence with quick reframes.
Actions:
- ${actions.join('\n- ')}
Affirmation: I refuel confidence through small, steady deposits.`
}

export async function POST(req: NextRequest){
  const body = await req.json()
  const { weeklyGoal, digest } = body || {}
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey){
    return NextResponse.json({ text: fallback(weeklyGoal,digest), note:'OPENAI_API_KEY missing; using rule-based fallback.' })
  }

  const client = new OpenAI({ apiKey })
  const sys = 'You are a concise, supportive confidence coach. Use only the user-provided digest. Return short, specific guidance.'
  const user = `Weekly goal: ${weeklyGoal}
Digest:
${digest}
Return: 2-sentence feedback, 3 concrete actions (bulleted), and 1 present-tense affirmation.`

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.6,
    messages: [{role:'system', content: sys}, {role:'user', content: user}]
  })

  const text = resp.choices?.[0]?.message?.content ?? fallback(weeklyGoal,digest)
  return NextResponse.json({ text })
}
