"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Campaign, PaginatedResponse } from "@/types";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import {
  MessageSquareQuote,
  Lock,
  Loader2,
  Info,
  RefreshCw,
  Hash,
} from "lucide-react";

// ---- Types for the qualitative API response ----

interface ThematicCluster {
  theme: string;
  count: number;
  summary: string;
}

interface QuestionPerception {
  question_id: number;
  question_text: string;
  response_count: number;
  threshold: number;
  status: "ok" | "blocked" | "error";
  clusters: ThematicCluster[];
  message?: string;
}

interface PerceptionsResponse {
  company_id: number;
  campaign_id: number | null;
  questions: QuestionPerception[];
  message?: string;
}

// ---- Color palette for cluster cards (muted tones) ----
const clusterColors = [
  { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", badge: "bg-teal-100 text-teal-800" },
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-800" },
  { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700", badge: "bg-sky-100 text-sky-800" },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-800" },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-800" },
];

export default function QualitativePage() {
  const { toast } = useToast();
  const companyId = useCompanyId();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "">("");
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [perceptions, setPerceptions] = useState<QuestionPerception[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!companyId) return;
      setLoadingCampaigns(true);
      try {
        const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
          company_id: companyId,
          page_size: 100,
        });
        const filtered = res.data.filter(
          (c) => c.status === "completed" || c.status === "in_progress"
        );
        setCampaigns(filtered);
        if (filtered.length > 0) {
          setSelectedCampaignId(filtered[0].id);
        }
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar campanhas."
        );
      } finally {
        setLoadingCampaigns(false);
      }
    };
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Load qualitative perceptions
  const loadPerceptions = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const params: Record<string, unknown> = { company_id: companyId };
      if (selectedCampaignId) {
        params.campaign_id = selectedCampaignId;
      }
      const res = await api.get<PerceptionsResponse>(
        "/qualitative/perceptions",
        params
      );
      setPerceptions(res.questions || []);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar percepcoes."
      );
      setPerceptions([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [companyId, selectedCampaignId, toast]);

  // Load when campaign changes
  useEffect(() => {
    if (selectedCampaignId) {
      loadPerceptions();
    }
  }, [selectedCampaignId, loadPerceptions]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100">
            <MessageSquareQuote className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-heading-1 text-brand-text">
              Percepcoes Qualitativas
            </h1>
            <p className="text-body-sm text-brand-muted">
              Visao agregada das respostas abertas por similaridade tematica
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50 border border-violet-200">
        <Info className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
        <div className="text-sm text-violet-800">
          <p className="font-medium mb-1">Area de dados qualitativos</p>
          <p>
            Esta area apresenta percepcoes qualitativas agregadas. Estes dados
            NAO sao utilizados no calculo de riscos ou na geracao do PGR. As
            respostas sao agrupadas por similaridade tematica usando
            inteligencia artificial, preservando o anonimato dos respondentes.
          </p>
        </div>
      </div>

      {/* Campaign selector */}
      <div className="card-emotioncare">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <label className="label-emotioncare">Campanha</label>
              {loadingCampaigns ? (
                <div className="flex items-center gap-2 text-brand-muted text-sm mt-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando campanhas...
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-body-sm text-brand-muted mt-1">
                  Nenhuma campanha com respostas encontrada.
                </p>
              ) : (
                <select
                  value={selectedCampaignId}
                  onChange={(e) =>
                    setSelectedCampaignId(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="input-emotioncare w-full max-w-md mt-1"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{" "}
                      {c.status === "completed"
                        ? "(Finalizada)"
                        : "(Em andamento)"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedCampaignId && (
              <button
                onClick={loadPerceptions}
                disabled={loading}
                className="btn btn-secondary btn-sm flex items-center gap-2 mt-auto"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Atualizar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500 mb-3" />
          <p className="text-body-sm text-brand-muted">
            Analisando respostas e agrupando por temas...
          </p>
          <p className="text-caption text-brand-muted mt-1">
            A inteligencia artificial esta processando os dados
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && loaded && (
        <div className="space-y-6">
          {perceptions.length === 0 ? (
            <div className="card-emotioncare">
              <div className="card-body text-center py-12">
                <MessageSquareQuote className="h-12 w-12 text-brand-muted/30 mx-auto mb-3" />
                <p className="text-body text-brand-muted">
                  Nenhuma pergunta aberta encontrada nesta campanha.
                </p>
                <p className="text-body-sm text-brand-muted mt-1">
                  Adicione perguntas do tipo &quot;Texto Aberto&quot; ao configurar o
                  questionario para coletar percepcoes qualitativas.
                </p>
              </div>
            </div>
          ) : (
            perceptions.map((q) => (
              <div key={q.question_id} className="card-emotioncare">
                <div className="card-body">
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-body font-semibold text-brand-text">
                        {q.question_text}
                      </h3>
                      <p className="text-caption text-brand-muted mt-1">
                        {q.response_count}{" "}
                        {q.response_count === 1 ? "resposta" : "respostas"}
                      </p>
                    </div>
                    {q.status === "ok" && (
                      <span className="badge badge-success whitespace-nowrap">
                        Dados disponiveis
                      </span>
                    )}
                    {q.status === "blocked" && (
                      <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap">
                        <Lock className="h-3 w-3" />
                        Bloqueado
                      </span>
                    )}
                  </div>

                  {/* Blocked state */}
                  {q.status === "blocked" && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                      <Lock className="h-5 w-5 text-gray-400 shrink-0" />
                      <p className="text-sm text-gray-600">
                        {q.message ||
                          `Volume insuficiente para exibicao protegida (minimo ${q.threshold} respostas).`}
                      </p>
                    </div>
                  )}

                  {/* Error state */}
                  {q.status === "error" && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                      <Info className="h-5 w-5 text-red-400 shrink-0" />
                      <p className="text-sm text-red-600">
                        {q.message || "Erro ao processar agrupamento tematico."}
                      </p>
                    </div>
                  )}

                  {/* Clusters */}
                  {q.status === "ok" && q.clusters.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {q.clusters.map((cluster, cIdx) => {
                        const color =
                          clusterColors[cIdx % clusterColors.length];
                        return (
                          <div
                            key={cIdx}
                            className={`rounded-lg border p-4 ${color.bg} ${color.border}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4
                                className={`text-sm font-semibold ${color.text}`}
                              >
                                {cluster.theme}
                              </h4>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color.badge}`}
                              >
                                <Hash className="h-3 w-3" />
                                {cluster.count}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {cluster.summary}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.status === "ok" && q.clusters.length === 0 && (
                    <p className="text-body-sm text-brand-muted">
                      Nenhum agrupamento tematico identificado.
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
