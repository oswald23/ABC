'use client'

import { useEffect, useState } from 'react'
import { digestForCoachText } from '@/lib/storage'

export default function CoachPage() {
  const [weeklyGoal, setWeeklyGoal] = useState<string>('Stay consistent with deposits.')
  const [digest, setDigest] = useState<string>('Loading digest…')
  const [answer, setAnswer] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      try {
        const d = await digestForCoachText()
        setDigest(d)
      } catch (e) {
        setDigest('No recent data yet. Add a few deposits/reframes on the Dashboard.')
      }
    })()
  }, [])

  async function ask() {
    setAnswer('Thinking…')
    try {
      const res = await fetch('/api/coach/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyGoal }),
      })
      const data = await res.json()
      if (data?.text) {
        setAnswer(data.text)
      } else if (data?.fallback) {
        // rule-based fallback payload
        const f = data.suggestions
        const out = [
          f?.summary ? `Summary: ${f.summary}` : '',
          f?.actions?.length ? `Actions:\n- ${f.actions.join('\n- ')}` : '',
          f?.affirmation ? `Affirmation: ${f.affirmation}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
        setAnswer(out || 'No response.')
      } else {
        setAnswer('No response.')
      }
    } catch (e) {
      setAnswer('Error contacting coach.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Confidence Coach</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Weekly goal</label>
        <input
          className="w-full rounded border p-2"
          value={weeklyGoal}
          onChange={(e) => setWeeklyGoal(e.target.value)}
          placeholder="e.g., Reframe 1 setback daily and visualize each morning"
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Last 7 days digest</div>
        <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{digest}</pre>
      </div>

      <button
        onClick={ask}
        className="rounded bg-black px-4 py-2 text-white hover:opacity-90"
      >
        Ask the Coach
      </button>

      {answer ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Coach response</div>
          <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">
            {answer}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
