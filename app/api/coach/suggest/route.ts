// app/api/coach/suggest/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { digestForCoach } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { weeklyGoal } = await req.json().catch(() => ({ weeklyGoal: "" }));

  // Build structured digest (last 7 days)
  const digest = await digestForCoach();

  // Tiny, helpful summary for the prompt
  const summaryLine = digest.summary;
  const recentLines = [
    ...digest.recent.deposits.map(
      (d) => `• deposit: [${d.type}] ${d.text} (${d.date.slice(0, 10)})`
    ),
    ...digest.recent.reframes.map(
      (r) => `• reframe: "${r.original}" → "${r.reframed}" (${r.date.slice(0, 10)})`
    ),
  ].slice(0, 5); // cap tokens

  const apiKey = process.env.OPENAI_API_KEY;

  // Fallback if no key configured
  if (!apiKey) {
    return NextResponse.json({
      fallback: true,
      suggestions: {
        summary: `Focus: ${weeklyGoal || "Build consistent deposits"}. ${summaryLine}`,
        actions: [
          "Log 1 success, 1 progress, 1 effort daily",
          "Reframe 1 setback per day",
          "Do a 2-minute visualization (ideal outcome) each morning",
        ],
        affirmation: "I refuel confidence through daily deposits and constructive choices.",
      },
    });
  }

  const client = new OpenAI({ apiKey });

  const sys = `You are a concise, practical confidence coach.
Use the user's weekly goal and their last-7-day digest to produce 1) a two-sentence feedback summary, 2) three specific action items for the coming week, and 3) one short present-tense affirmation.
Keep output tight and actionable.`;

  const user = [
    `Weekly goal: ${weeklyGoal || "(not provided)"}`,
    `Digest: ${summaryLine}`,
    ...(recentLines.length ? ["Recent items:", ...recentLines] : []),
  ].join("\n");

  const resp = await client.chat.completions.create({
    model: "gpt-5-mini", // low-cost; swap if needed
    temperature: 0.6,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    stream: false,
  });

  return NextResponse.json({
    text: resp.choices[0]?.message?.content ?? "",
    structured: digest, // also return digest if client wants to show it
  });
}
