"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface RiskDistributionChartProps {
  healthy: number;
  intermediate: number;
  risk: number;
}

const COLORS = {
  healthy: { fill: "#10b981", label: "Saudável" },
  intermediate: { fill: "#f59e0b", label: "Intermediário" },
  risk: { fill: "#ef4444", label: "Crítico" },
};

export default function RiskDistributionChart({ healthy, intermediate, risk, compact = false }: RiskDistributionChartProps & { compact?: boolean }) {
  const total = healthy + intermediate + risk;
  if (total === 0) return null;

  const data = [
    { name: COLORS.healthy.label, value: healthy, fill: COLORS.healthy.fill },
    { name: COLORS.intermediate.label, value: intermediate, fill: COLORS.intermediate.fill },
    { name: COLORS.risk.label, value: risk, fill: COLORS.risk.fill },
  ].filter(d => d.value > 0);

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-28 h-28 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={26} outerRadius={48} dataKey="value" strokeWidth={2} stroke="#fff">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-brand-text">{total}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
              <span className="text-xs text-brand-text">{item.name}</span>
              <span className="text-xs font-semibold text-brand-text">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="w-32 h-32 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              dataKey="value"
              strokeWidth={2}
              stroke="#fff"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-brand-border rounded-lg p-2 shadow-lg text-xs">
                      <span className="font-medium">{d.name}: {d.value}</span>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-brand-text">{total}</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
            <span className="text-sm text-brand-text">{item.name}</span>
            <span className="text-sm font-semibold text-brand-text ml-auto">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
