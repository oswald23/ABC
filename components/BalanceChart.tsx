// components/BalanceChart.tsx
'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type Point = { date: string; deposits: number; withdrawals: number; total?: number };

export default function BalanceChart({ data }: { data: Point[] }) {
  return (
    <div className="w-full h-64 rounded border p-3 bg-white">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="deposits" dot={false} />
          <Line type="monotone" dataKey="withdrawals" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
