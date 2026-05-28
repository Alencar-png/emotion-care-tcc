"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ResponseRateChartProps {
  data: Array<{
    name: string;
    rate: number;
    responses: number;
    invited: number;
  }>;
}

export default function ResponseRateChart({ data }: ResponseRateChartProps) {
  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: "Taxa de Resposta (%)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white border border-brand-border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-brand-text mb-1">{data.name}</p>
                    <p className="text-sm text-brand-text-2">
                      Taxa: <span className="font-medium">{data.rate}%</span>
                    </p>
                    <p className="text-sm text-brand-text-2">
                      {data.responses} de {data.invited} respondentes
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: "#10b981", r: 4 }}
            name="Taxa de Resposta (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
