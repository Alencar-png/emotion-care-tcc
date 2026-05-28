"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CampaignResult, DimensionResult } from "@/types";
import { useToast } from "@/components/toast";
import { ArrowLeft, RefreshCw, BarChart3, Lock } from "lucide-react";
import RiskBarChart from "@/components/charts/risk-bar-chart";

export default function CampaignResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [results, setResults] = useState<CampaignResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const loadResults = useCallback(async () => {
    try {
      const id = parseInt(params.id as string);
      const data = await api.get<CampaignResult>(`/campaigns/${id}/results`);
      setResults(data);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar resultados."
      );
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const handleCompute = async () => {
    if (!params.id) return;
    setComputing(true);
    try {
      const id = parseInt(params.id as string);
      await api.post(`/campaigns/${id}/compute-results`);
      toast("success", "Resultados calculados com sucesso.");
      await loadResults();
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao calcular resultados."
      );
    } finally {
      setComputing(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    const colorMap: Record<string, string> = {
      healthy: "text-green-600 bg-green-50",
      intermediate: "text-yellow-600 bg-yellow-50",
      risk: "text-red-600 bg-red-50",
    };
    return colorMap[level] || colorMap.intermediate;
  };

  const getRiskLevelLabel = (level: string) => {
    const labelMap: Record<string, string> = {
      healthy: "Saudável",
      intermediate: "Intermediário",
      risk: "Risco",
    };
    return labelMap[level] || level;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!results) {
    return (
      <div>
        <button
          onClick={() => router.push(`/campaigns/${params.id}`)}
          className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          Voltar para campanha
        </button>
        <div className="card-emotioncare">
          <div className="card-body text-center py-12">
            <BarChart3 className="w-12 h-12 text-brand-muted mx-auto mb-4" />
            <p className="text-body text-brand-text mb-4">
              Nenhum resultado disponível ainda.
            </p>
            <button
              onClick={handleCompute}
              disabled={computing}
              className="btn btn-primary btn-md"
            >
              {computing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Calcular Resultados
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // NC_ANON_SCORE: verificar se scores devem ser ocultados
  const isScoreRestricted = results.is_score_restricted === true;
  const scoreMinResponses = results.anonymity_thresholds?.score_min ?? 4;
  const sectorMinResponses = results.anonymity_thresholds?.sector_min ?? 3;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.push(`/campaigns/${params.id}`)}
          className="btn btn-ghost btn-sm text-brand-muted hover:text-primary"
        >
          <ArrowLeft size={16} />
          Voltar para campanha
        </button>
        <button
          onClick={handleCompute}
          disabled={computing}
          className="btn btn-secondary btn-sm"
        >
          {computing ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Recalculando...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Recalcular
            </>
          )}
        </button>
      </div>

      {/* NC_ANON_SCORE: Banner de anonimato */}
      {isScoreRestricted && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-body font-semibold text-amber-800">
              Resultados disponíveis após {scoreMinResponses} respostas. Atual: {results.total_responses} resposta(s).
            </p>
            <p className="text-body-sm text-amber-700 mt-1">
              Para garantir o anonimato dos participantes, os scores e gráficos só são exibidos quando o número mínimo de respostas é atingido. Os dados de participação continuam visíveis.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Overall Summary */}
        <div className="card-emotioncare">
          <div className="card-body">
            <h2 className="text-heading-2 text-brand-text mb-6">Resumo Geral</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-body-sm text-brand-muted">Convidados</p>
                <p className="text-heading-3 text-brand-text mt-1">
                  {results.total_invited}
                </p>
              </div>
              <div>
                <p className="text-body-sm text-brand-muted">Respostas</p>
                <p className="text-heading-3 text-brand-text mt-1">
                  {results.total_responses}
                </p>
              </div>
              <div>
                <p className="text-body-sm text-brand-muted">Taxa de Resposta</p>
                <p className="text-heading-3 text-brand-text mt-1">
                  {results.response_rate}%
                </p>
              </div>
              <div>
                <p className="text-body-sm text-brand-muted">Score Geral</p>
                {isScoreRestricted ? (
                  <p className="text-body-sm text-amber-700 mt-1 font-medium">
                    Aguardando mínimo de respostas
                  </p>
                ) : (
                  <>
                    <p className="text-heading-3 text-brand-text mt-1">
                      {results.overall_risk_score}
                    </p>
                    <span
                      className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${getRiskLevelColor(
                        results.risk_level
                      )}`}
                    >
                      {getRiskLevelLabel(results.risk_level)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score restricted placeholder */}
        {isScoreRestricted && (
          <div className="card-emotioncare">
            <div className="card-body text-center py-10">
              <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-body font-semibold text-brand-text">Scores e gráficos indisponíveis</p>
              <p className="text-body-sm text-brand-muted mt-2">
                Resultados disponíveis após {scoreMinResponses} respostas. Atual: {results.total_responses} resposta(s).
              </p>
            </div>
          </div>
        )}

        {/* Dimension Results - hidden when score restricted */}
        {!isScoreRestricted && results.dimension_results.length > 0 && (
          <div className="card-emotioncare">
            <div className="card-body">
              <h3 className="text-heading-3 text-brand-text mb-4">
                Resultados por Dimensão
              </h3>
              <RiskBarChart data={results.dimension_results} />
              <div className="mt-6 space-y-3">
                {results.dimension_results.map((dim) => (
                  <div
                    key={dim.dimension_id}
                    className="border border-brand-border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-body font-medium text-brand-text">
                          {dim.dimension_name}
                        </p>
                        <p className="text-body-sm text-brand-muted">
                          {dim.response_count} respostas
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-heading-3 text-brand-text">
                          {dim.average_score}
                        </p>
                        <span
                          className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${getRiskLevelColor(
                            dim.risk_level
                          )}`}
                        >
                          {getRiskLevelLabel(dim.risk_level)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sector Summaries - hidden when score restricted, with per-sector restriction */}
        {!isScoreRestricted && results.sector_summaries.length > 0 && (
          <div className="card-emotioncare">
            <div className="card-body">
              <h3 className="text-heading-3 text-brand-text mb-4">
                Resultados por Setor
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-bg-subtle">
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                        Setor
                      </th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                        Score Médio
                      </th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                        Nível de Risco
                      </th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                        Respostas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {results.sector_summaries.map((sector) => (
                      <tr key={sector.department_id} className="hover:bg-brand-bg-subtle">
                        <td className="px-4 py-3 text-body-sm text-brand-text">
                          {sector.department_name}
                        </td>
                        {sector.is_sector_restricted ? (
                          <td colSpan={3} className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
                              <Lock className="w-3 h-3" />
                              Dados não disponíveis (mínimo {sectorMinResponses} respondentes).
                            </span>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-body-sm text-brand-text">
                              {sector.average_score}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getRiskLevelColor(
                                  sector.risk_level
                                )}`}
                              >
                                {getRiskLevelLabel(sector.risk_level)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-body-sm text-brand-text">
                              {sector.response_count}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
