"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

interface DepartmentBarChartProps {
  data: Array<{
    department_name: string;
    average_score: number;
    risk_level: string;
    total_employees: number;
    evaluated_employees: number;
  }>;
}

const getColor = (riskLevel: string) => {
  switch (riskLevel) {
    case "healthy":
      return "#10b981";
    case "intermediate":
      return "#f59e0b";
    case "risk":
      return "#ef4444";
    default:
      return "#6b7280";
  }
};

export default function DepartmentBarChart({ data }: DepartmentBarChartProps) {
  const chartData = data
    .sort((a, b) => b.average_score - a.average_score)
    .map((item) => ({
      name: item.department_name.length > 18
        ? item.department_name.substring(0, 18) + "..."
        : item.department_name,
      fullName: item.department_name,
      score: item.average_score,
      riskLevel: item.risk_level,
      employees: item.total_employees,
      evaluated: item.evaluated_employees,
    }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12 }}
          />
          <ReferenceLine x={33} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine x={66} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-brand-border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-brand-text mb-1">{d.fullName}</p>
                    <p className="text-sm text-brand-text-2">
                      Score: <span className="font-medium">{d.score}/100</span>
                    </p>
                    <p className="text-sm text-brand-text-2">
                      {d.evaluated}/{d.employees} avaliados
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.riskLevel)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
