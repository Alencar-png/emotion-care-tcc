"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface RiskGaugeChartProps {
  score: number;
  size?: number;
}

const RISK_COLORS = {
  healthy: { main: "#10b981", bg: "#d1fae5", label: "Saudável" },
  intermediate: { main: "#f59e0b", bg: "#fef3c7", label: "Intermediário" },
  risk: { main: "#ef4444", bg: "#fee2e2", label: "Crítico" },
};

function getRiskInfo(score: number) {
  if (score <= 33) return RISK_COLORS.healthy;
  if (score <= 66) return RISK_COLORS.intermediate;
  return RISK_COLORS.risk;
}

export default function RiskGaugeChart({ score, size = 180 }: RiskGaugeChartProps) {
  const riskInfo = getRiskInfo(score);
  const data = [
    { value: score },
    { value: 100 - score },
  ];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.33}
              outerRadius={size * 0.44}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={riskInfo.main} />
              <Cell fill="#f3f4f6" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-brand-text">{score}</span>
          <span className="text-xs text-brand-muted">/100</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskInfo.main }} />
        <span className="text-sm font-medium" style={{ color: riskInfo.main }}>
          {riskInfo.label}
        </span>
      </div>
    </div>
  );
}
