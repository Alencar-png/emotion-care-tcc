"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCompanyId } from "@/lib/contexts/company-context";
import { useToast } from "@/components/toast";
import { Campaign, CampaignComparison, PaginatedResponse } from "@/types";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, GitCompare } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

export default function PGRComparisonPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignA, setCampaignA] = useState<number | null>(null);
  const [campaignB, setCampaignB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<CampaignComparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      try {
        const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
          company_id: companyId,
          page_size: 100,
        });
        const valid = (res.data || []).filter(
          (c) => c.status === "completed" || c.status === "in_progress"
        );
        setCampaigns(valid);
      } catch {
        toast("error", "Erro ao carregar campanhas.");
      }
    };
    load();
  }, [companyId, toast]);

  const handleCompare = useCallback(async () => {
    if (!companyId || !campaignA || !campaignB) return;
    if (campaignA === campaignB) {
      toast("error", "Selecione duas campanhas diferentes.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.get<CampaignComparison>(
        `/pgr/${companyId}/comparison`,
        { campaign_a: campaignA, campaign_b: campaignB }
      );
      setComparison(data);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao comparar campanhas.");
    } finally {
      setLoading(false);
    }
  }, [companyId, campaignA, campaignB, toast]);

  const getDeltaColor = (delta: number) => {
    if (delta < 0) return "text-green-600"; // melhora (score diminuiu)
    if (delta > 0) return "text-red-600";   // piora
    return "text-brand-muted";
  };

  const getDeltaIcon = (delta: number) => {
    if (delta < 0) return <TrendingDown size={16} className="text-green-600" />;
    if (delta > 0) return <TrendingUp size={16} className="text-red-600" />;
    return <Minus size={16} className="text-brand-muted" />;
  };

  const dimensionChartData = comparison?.dimension_deltas.map((d) => ({
    name: d.dimension_name.length > 20 ? d.dimension_name.slice(0, 20) + "..." : d.dimension_name,
    Antes: d.score_a,
    Depois: d.score_b,
  })) || [];

  return (
    <div>
      <button
        onClick={() => router.push("/pgr")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para PGR
      </button>

      <div className="space-y-6">
        <div>
          <h2 className="text-heading-2 text-brand-text">Comparativo entre Ciclos</h2>
          <p className="text-body-sm text-brand-muted mt-1">
            Compare resultados de duas campanhas para avaliar evolução.
          </p>
        </div>

        {/* Campaign Selectors */}
        <div className="card-emotioncare">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="label-emotioncare">Campanha A (Antes)</label>
                <select
                  value={campaignA ?? ""}
                  onChange={(e) => setCampaignA(e.target.value ? Number(e.target.value) : null)}
                  className="input-emotioncare w-full"
                >
                  <option value="">Selecione...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-emotioncare">Campanha B (Depois)</label>
                <select
                  value={campaignB ?? ""}
                  onChange={(e) => setCampaignB(e.target.value ? Number(e.target.value) : null)}
                  className="input-emotioncare w-full"
                >
                  <option value="">Selecione...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCompare}
                disabled={!campaignA || !campaignB || loading}
                className="btn btn-primary btn-md"
              >
                {loading ? (
                  <div className="spinner-brand-white" />
                ) : (
                  <GitCompare size={16} />
                )}
                Comparar
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {comparison && (
          <>
            {/* Overall Delta */}
            <div className="card-emotioncare">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-heading-3 text-brand-text">Score Geral de Risco</h3>
                    <p className="text-body-sm text-brand-muted mt-1">
                      {comparison.campaign_a.name} → {comparison.campaign_b.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-body-sm text-brand-muted">Antes</p>
                      <p className="text-2xl font-bold text-brand-text">{comparison.overall_delta.score_a}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getDeltaIcon(comparison.overall_delta.delta)}
                      <span className={`text-lg font-bold ${getDeltaColor(comparison.overall_delta.delta)}`}>
                        {comparison.overall_delta.delta > 0 ? "+" : ""}
                        {comparison.overall_delta.delta}
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-body-sm text-brand-muted">Depois</p>
                      <p className="text-2xl font-bold text-brand-text">{comparison.overall_delta.score_b}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dimension Chart */}
            {dimensionChartData.length > 0 && (
              <div className="card-emotioncare">
                <div className="card-body">
                  <h3 className="text-heading-3 text-brand-text mb-4">Comparativo por Dimensão</h3>
                  <div style={{ width: "100%", height: 400 }}>
                    <ResponsiveContainer>
                      <BarChart data={dimensionChartData} margin={{ bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <ReferenceLine y={33} stroke="#10b981" strokeDasharray="3 3" label="Saudável" />
                        <ReferenceLine y={66} stroke="#ef4444" strokeDasharray="3 3" label="Risco" />
                        <Bar dataKey="Antes" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Depois" fill="#46347F" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Dimension Table */}
            <div className="card-emotioncare">
              <div className="card-body">
                <h3 className="text-heading-3 text-brand-text mb-4">Detalhamento por Dimensão</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-brand-border bg-brand-bg-subtle">
                        <th className="text-left text-label-upper text-brand-muted px-4 py-2">Dimensão</th>
                        <th className="text-center text-label-upper text-brand-muted px-4 py-2">Score Antes</th>
                        <th className="text-center text-label-upper text-brand-muted px-4 py-2">Score Depois</th>
                        <th className="text-center text-label-upper text-brand-muted px-4 py-2">Variação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {comparison.dimension_deltas.map((d) => (
                        <tr key={d.dimension_id} className="hover:bg-brand-bg-subtle">
                          <td className="px-4 py-3 text-body-sm font-medium text-brand-text">
                            {d.dimension_name}
                          </td>
                          <td className="px-4 py-3 text-center text-body-sm text-brand-text-2">
                            {d.score_a}
                          </td>
                          <td className="px-4 py-3 text-center text-body-sm text-brand-text-2">
                            {d.score_b}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {getDeltaIcon(d.delta)}
                              <span className={`text-body-sm font-semibold ${getDeltaColor(d.delta)}`}>
                                {d.delta > 0 ? "+" : ""}{d.delta}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sector Deltas */}
            {comparison.sector_deltas.length > 0 && (
              <div className="card-emotioncare">
                <div className="card-body">
                  <h3 className="text-heading-3 text-brand-text mb-4">Comparativo por Setor</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-brand-border bg-brand-bg-subtle">
                          <th className="text-left text-label-upper text-brand-muted px-4 py-2">Setor</th>
                          <th className="text-center text-label-upper text-brand-muted px-4 py-2">Score Antes</th>
                          <th className="text-center text-label-upper text-brand-muted px-4 py-2">Score Depois</th>
                          <th className="text-center text-label-upper text-brand-muted px-4 py-2">Variação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border">
                        {comparison.sector_deltas.map((s) => (
                          <tr key={s.department_id} className="hover:bg-brand-bg-subtle">
                            <td className="px-4 py-3 text-body-sm font-medium text-brand-text">
                              {s.department_name}
                            </td>
                            <td className="px-4 py-3 text-center text-body-sm text-brand-text-2">
                              {s.score_a}
                            </td>
                            <td className="px-4 py-3 text-center text-body-sm text-brand-text-2">
                              {s.score_b}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {getDeltaIcon(s.delta)}
                                <span className={`text-body-sm font-semibold ${getDeltaColor(s.delta)}`}>
                                  {s.delta > 0 ? "+" : ""}{s.delta}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!comparison && !loading && (
          <div className="card-emotioncare">
            <div className="card-body text-center py-12">
              <GitCompare size={48} className="mx-auto text-brand-muted/30 mb-4" />
              <p className="text-body text-brand-muted">
                Selecione duas campanhas e clique em &ldquo;Comparar&rdquo; para ver a evolução.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
