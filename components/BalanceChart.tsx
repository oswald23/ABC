// components/BalanceChart.tsx
'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

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
          {/* Deposits line (blue) */}
          <Line
            name="deposits"
            type="monotone"
            dataKey="deposits"
            dot={false}
            stroke="#2563eb"  // blue-600
          />
          {/* Withdrawals line (red) */}
          <Line
            name="withdrawals"
            type="monotone"
            dataKey="withdrawals"
            dot={false}
            stroke="#dc2626"  // red-600
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
