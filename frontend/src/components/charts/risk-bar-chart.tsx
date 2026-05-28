"use client";

import { DimensionResult } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface RiskBarChartProps {
  data: DimensionResult[];
}

export default function RiskBarChart({ data }: RiskBarChartProps) {
  const chartData = data.map((item) => ({
    name: item.dimension_name.length > 20 
      ? item.dimension_name.substring(0, 20) + "..." 
      : item.dimension_name,
    fullName: item.dimension_name,
    score: item.average_score,
    riskLevel: item.risk_level,
  }));

  const getColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "healthy":
        return "#10b981"; // green
      case "intermediate":
        return "#f59e0b"; // yellow
      case "risk":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: "Score (0-100)", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white border border-brand-border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-brand-text mb-1">{data.fullName}</p>
                    <p className="text-sm text-brand-text-2">
                      Score: <span className="font-medium">{data.score}</span>
                    </p>
                    <p className="text-sm text-brand-text-2">
                      Nível: <span className="font-medium">{data.riskLevel}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.riskLevel)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
