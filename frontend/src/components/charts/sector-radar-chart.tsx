"use client";

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SectorRadarChartProps {
  data: Array<{
    sector: string;
    score: number;
    riskLevel: string;
  }>;
}

export default function SectorRadarChart({ data }: SectorRadarChartProps) {
  const chartData = data.map((item) => ({
    sector: item.sector.length > 15 ? item.sector.substring(0, 15) + "..." : item.sector,
    fullSector: item.sector,
    score: item.score,
    riskLevel: item.riskLevel,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="sector"
            tick={{ fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white border border-brand-border rounded-lg p-3 shadow-lg">
                    <p className="font-semibold text-brand-text mb-1">{data.fullSector}</p>
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
          <Radar
            name="Score"
            dataKey="score"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.6}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
