"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AnalyticsSummary, Campaign, PaginatedResponse } from "@/types";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import RiskBarChart from "@/components/charts/risk-bar-chart";
import ResponseRateChart from "@/components/charts/response-rate-chart";
import SectorRadarChart from "@/components/charts/sector-radar-chart";
import RiskGaugeChart from "@/components/charts/risk-gauge-chart";
import RiskDistributionChart from "@/components/charts/risk-distribution-chart";
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle2,
  Activity,
  Building2,
  Calendar,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
  Target,
  Lock,
  ChevronDown,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────

const riskLevelLabel: Record<string, string> = {
  healthy: "Saudável",
  intermediate: "Intermediário",
  risk: "Risco",
};

const riskColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  healthy: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  intermediate: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  risk: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
};

function RiscoBadge({ nivel }: { nivel: string }) {
  const cores = riskColors[nivel] || riskColors.intermediate;
  const label = riskLevelLabel[nivel] || nivel;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cores.bg} ${cores.text} ${cores.border} border`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cores.dot}`} />
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score <= 33 ? "bg-green-500" : score <= 66 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-brand-muted tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

// "all" = sem filtro (campanha com mais respostas, default do backend)
type SelectedCampaign = number | "all";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  sending: "Enviando",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<SelectedCampaign>("all");
  const [loading, setLoading] = useState(true);

  // 1) carrega lista de campanhas da empresa para popular o seletor
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
          company_id: companyId,
          page: 1,
          page_size: 100,
        });
        if (!cancelled) setCampaigns(resp.data || []);
      } catch (err: unknown) {
        if (!cancelled) {
          toast(
            "error",
            err instanceof Error ? err.message : "Erro ao carregar campanhas."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, toast]);

  // 2) carrega o resumo analítico — re-roda quando muda a campanha selecionada
  const loadAnalytics = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { company_id: companyId };
      if (selectedCampaign !== "all") {
        params.campaign_id = selectedCampaign;
      }
      const data = await api.get<AnalyticsSummary>("/analytics/summary", params);
      setAnalytics(data);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar análises."
      );
    } finally {
      setLoading(false);
    }
  }, [toast, companyId, selectedCampaign]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // ordena campanhas: completed primeiro, depois mais recentes
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return -1;
      if (b.status === "completed" && a.status !== "completed") return 1;
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dbt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dbt - da;
    });
  }, [campaigns]);

  const focusedCampaignName = useMemo(() => {
    if (selectedCampaign === "all") return null;
    const c = campaigns.find((x) => x.id === selectedCampaign);
    return c?.name ?? null;
  }, [selectedCampaign, campaigns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 text-brand-muted mx-auto mb-4" />
        <p className="text-body text-brand-text">
          Nenhum dado analítico disponível ainda.
        </p>
        <p className="text-body-sm text-brand-muted mt-2">
          Complete uma campanha para ver os resultados aqui.
        </p>
      </div>
    );
  }

  const historyData = (analytics.response_timeline || []).map((point: { hour: string; responses: number; rate: number }) => ({
    name: point.hour,
    rate: point.rate,
    responses: point.responses,
    invited: analytics.campaign_history?.[0]?.total_invited || 0,
  }));

  // NC_ANON: filter sectors that are not restricted for charts
  const sectorData = (analytics.latest_sector_summaries || [])
    .filter((sector) => !sector.is_sector_restricted)
    .map((sector) => ({
      sector: sector.department_name,
      score: sector.average_score,
      riskLevel: sector.risk_level,
    }));

  // NC_ANON: full list with restriction info for tables
  const allSectorData = (analytics.latest_sector_summaries || []).map((sector) => ({
    sector: sector.department_name,
    score: sector.average_score,
    riskLevel: sector.risk_level,
    responseCount: sector.response_count,
    isSectorRestricted: sector.is_sector_restricted === true,
  }));

  const dimResults = analytics.latest_dimension_results || [];
  const healthyDims = dimResults.filter(d => d.risk_level === "healthy").length;
  const intermediateDims = dimResults.filter(d => d.risk_level === "intermediate").length;
  const riskDims = dimResults.filter(d => d.risk_level === "risk").length;

  // NC_ANON_SCORE: verificar se scores devem ser ocultados
  const isScoreRestricted = analytics.is_score_restricted === true;
  const scoreMinResponses = analytics.anonymity_thresholds?.score_min ?? 4;
  const sectorMinResponses = analytics.anonymity_thresholds?.sector_min ?? 3;
  const totalResponses = analytics.total_responses ?? 0;

  return (
    <div className="max-w-[1200px]">
      {/* ─── Header ─── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">Análise das Campanhas</h1>
          <p className="page-subtitle">
            {focusedCampaignName
              ? `Você está visualizando a campanha "${focusedCampaignName}".`
              : "Visão consolidada dos resultados das campanhas da empresa."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ─── Seletor de campanha ─── */}
          <label className="flex flex-col gap-1">
            <span className="text-label-upper text-brand-muted">Campanha em foco</span>
            <div className="relative">
              <select
                value={selectedCampaign}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedCampaign(v === "all" ? "all" : Number(v));
                }}
                className="input-emotioncare !h-10 pr-9 min-w-[260px] sm:min-w-[320px] text-body-sm cursor-pointer appearance-none"
              >
                <option value="all">
                  Todas (campanha principal)
                </option>
                {sortedCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {statusLabel[c.status] ?? c.status}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand-muted" />
            </div>
          </label>

          {analytics.latest_campaign_id && (
            <button
              onClick={() => router.push(`/campaigns/${analytics.latest_campaign_id}/results`)}
              className="btn btn-primary btn-sm flex items-center gap-2 h-10"
            >
              Ver detalhes
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── NC_ANON_SCORE: Banner de anonimato ─── */}
      {isScoreRestricted && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-body font-semibold text-amber-800">
              Resultados disponíveis após {scoreMinResponses} respostas. Atual: {totalResponses} resposta(s).
            </p>
            <p className="text-body-sm text-amber-700 mt-1">
              Para garantir o anonimato dos participantes, os scores e gráficos só são exibidos quando o número mínimo de respostas é atingido.
            </p>
          </div>
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary-light text-primary">
              <BarChart3 className="w-4 h-4" />
            </div>
            <p className="text-xs text-brand-muted font-medium">Total de Campanhas</p>
          </div>
          <p className="text-2xl font-bold text-brand-text">{analytics.total_campaigns}</p>
        </div>
        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs text-brand-muted font-medium">Concluídas</p>
          </div>
          <p className="text-2xl font-bold text-brand-text">{analytics.total_completed_campaigns}</p>
        </div>
        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${isScoreRestricted ? "bg-yellow-50 text-yellow-600" : analytics.latest_risk_level === "risk" ? "bg-red-50 text-red-600" : analytics.latest_risk_level === "intermediate" ? "bg-yellow-50 text-yellow-600" : "bg-green-50 text-green-600"}`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <p className="text-xs text-brand-muted font-medium">Score Geral</p>
          </div>
          <p className="text-2xl font-bold text-brand-text">{isScoreRestricted ? "—" : (analytics.latest_risk_score ?? "—")}</p>
          {!isScoreRestricted && analytics.latest_risk_level && (
            <RiscoBadge nivel={analytics.latest_risk_level} />
          )}
        </div>
        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-xs text-brand-muted font-medium">Taxa de Resposta</p>
          </div>
          <p className="text-2xl font-bold text-brand-text">
            {analytics.latest_response_rate ?? "—"}%
          </p>
        </div>
      </div>

      {/* ─── Risk Overview + Dimension Chart side by side ─── */}
      {isScoreRestricted && analytics.latest_campaign_id && (
        <div className="mb-6 bg-white rounded-xl border border-brand-border p-8 text-center">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-body font-semibold text-brand-text">Scores e gráficos indisponíveis</p>
          <p className="text-body-sm text-brand-muted mt-2">
            Resultados disponíveis após {scoreMinResponses} respostas. Atual: {totalResponses} resposta(s).
          </p>
        </div>
      )}
      {!isScoreRestricted && analytics.latest_campaign_id && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 mb-6">
          {/* Risk gauge + dimension distribution */}
          <div className="bg-white rounded-xl border border-brand-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="text-heading-3 text-brand-text">Índice de Risco</h3>
            </div>
            <div className="flex justify-center">
              <RiskGaugeChart score={analytics.latest_risk_score ?? 0} size={170} />
            </div>

            {dimResults.length > 0 && (
              <>
                <div className="border-t border-brand-border my-4" />
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="text-heading-3 text-brand-text">Dimensões</h3>
                </div>
                <RiskDistributionChart
                  healthy={healthyDims}
                  intermediate={intermediateDims}
                  risk={riskDims}
                  compact
                />
              </>
            )}
          </div>

          {/* Dimension bar chart */}
          <div className="bg-white rounded-xl border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-heading-3 text-brand-text">
                Resultado por Dimensão
              </h3>
              <span className="ml-auto text-caption text-brand-muted">
                {analytics.latest_campaign_name}
              </span>
            </div>
            <div className="p-4">
              {dimResults.length > 0 && (
                <RiskBarChart data={dimResults} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Dimension Detail Table ─── */}
      {!isScoreRestricted && dimResults.length > 0 && (
        <div className="bg-white rounded-xl border border-brand-border mb-6">
          <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent" />
            <h3 className="text-heading-3 text-brand-text">Detalhamento por Dimensão</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg-subtle">
                  <th className="text-left text-label-upper text-brand-muted px-5 py-2.5">Dimensão</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Score</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Nível de Risco</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Respondentes</th>
                  <th className="text-left text-label-upper text-brand-muted px-5 py-2.5 min-w-[150px]">Indicador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {dimResults
                  .sort((a, b) => b.average_score - a.average_score)
                  .map((dim) => (
                    <tr key={dim.dimension_id} className="hover:bg-brand-bg-subtle transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-body-sm font-medium text-brand-text">{dim.dimension_name}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-body font-bold text-brand-text tabular-nums">{dim.average_score}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <RiscoBadge nivel={dim.risk_level} />
                      </td>
                      <td className="px-5 py-3 text-center text-body-sm text-brand-text tabular-nums">
                        {dim.response_count}
                      </td>
                      <td className="px-5 py-3">
                        <ScoreBar score={dim.average_score} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Sector Analysis + Response Rate History ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sector Radar - hidden when score restricted */}
        {!isScoreRestricted && sectorData.length > 0 && (
          <div className="bg-white rounded-xl border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="text-heading-3 text-brand-text">Análise por Setor</h3>
            </div>
            <div className="p-4">
              <SectorRadarChart data={sectorData} />
            </div>
          </div>
        )}

        {/* Response Rate History */}
        {historyData.length > 0 && (
          <div className="bg-white rounded-xl border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h3 className="text-heading-3 text-brand-text">Histórico de Respostas</h3>
            </div>
            <div className="p-4">
              <ResponseRateChart data={historyData} />
            </div>
          </div>
        )}
      </div>

      {/* ─── Sector Ranking Table ─── */}
      {!isScoreRestricted && allSectorData.length > 0 && (
        <div className="bg-white rounded-xl border border-brand-border mb-6">
          <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="text-heading-3 text-brand-text">Ranking de Setores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg-subtle">
                  <th className="text-left text-label-upper text-brand-muted px-5 py-2.5 w-8">#</th>
                  <th className="text-left text-label-upper text-brand-muted px-5 py-2.5">Departamento</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Score</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Nível de Risco</th>
                  <th className="text-left text-label-upper text-brand-muted px-5 py-2.5 min-w-[150px]">Indicador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {allSectorData
                  .sort((a, b) => b.score - a.score)
                  .map((sector, index) => (
                    <tr key={sector.sector} className="hover:bg-brand-bg-subtle transition-colors">
                      <td className="px-5 py-3 text-body-sm text-brand-muted tabular-nums">{index + 1}</td>
                      <td className="px-5 py-3">
                        <span className="text-body-sm font-medium text-brand-text">{sector.sector}</span>
                      </td>
                      {sector.isSectorRestricted ? (
                        <td colSpan={3} className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
                            <Lock className="w-3 h-3" />
                            Dados não disponíveis (mínimo {sectorMinResponses} respondentes).
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="px-5 py-3 text-center">
                            <span className="text-body font-bold text-brand-text tabular-nums">{sector.score}</span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <RiscoBadge nivel={sector.riskLevel} />
                          </td>
                          <td className="px-5 py-3">
                            <ScoreBar score={sector.score} />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Campaign History Table ─── */}
      {analytics.campaign_history.length > 0 && (
        <div className="bg-white rounded-xl border border-brand-border mb-6">
          <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-heading-3 text-brand-text">Histórico de Campanhas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg-subtle">
                  <th className="text-left text-label-upper text-brand-muted px-5 py-2.5">Campanha</th>
                  <th className="text-left text-label-upper text-brand-muted px-5 py-2.5">Data</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Score</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Risco</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Respondentes</th>
                  <th className="text-center text-label-upper text-brand-muted px-5 py-2.5">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {analytics.campaign_history.map((campaign) => {
                  const isFocused = selectedCampaign === campaign.campaign_id;
                  return (
                  <tr
                    key={campaign.campaign_id}
                    className={`cursor-pointer transition-colors ${
                      isFocused
                        ? "bg-primary-light/40 hover:bg-primary-light/60"
                        : "hover:bg-brand-bg-subtle"
                    }`}
                    onClick={() => setSelectedCampaign(campaign.campaign_id)}
                    title="Clique para focar a análise nesta campanha"
                  >
                    <td className="px-5 py-3">
                      <span className="text-body-sm font-medium text-brand-text flex items-center gap-2">
                        {isFocused && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        {campaign.campaign_name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-body-sm text-brand-muted">
                      {new Date(campaign.computed_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-body font-bold text-brand-text tabular-nums">{campaign.overall_risk_score}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <RiscoBadge nivel={campaign.risk_level} />
                    </td>
                    <td className="px-5 py-3 text-center text-body-sm text-brand-text tabular-nums">
                      {campaign.total_responses}/{campaign.total_invited}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-body-sm font-medium text-brand-text tabular-nums">{campaign.response_rate}%</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
