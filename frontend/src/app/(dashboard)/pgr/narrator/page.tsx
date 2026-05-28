"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Campaign, PaginatedResponse } from "@/types";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isMedicalOrAbove } from "@/lib/auth";
import {
  Sparkles,
  RefreshCw,
  Check,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface NarrativeDraft {
  id: number;
  company_id: number;
  campaign_id: number;
  secao_introducao: string;
  secao_resultados_gerais: string;
  secao_riscos_criticos: string;
  secao_riscos_intermediarios: string;
  secao_fatores_favoraveis: string;
  secao_analise_por_setor: string;
  secao_conclusao: string;
  total_palavras: number | null;
  status: string;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  secao_introducao: "Introdução",
  secao_resultados_gerais: "Resultados Gerais",
  secao_riscos_criticos: "Riscos Críticos",
  secao_riscos_intermediarios: "Riscos Intermediários",
  secao_fatores_favoraveis: "Fatores Favoráveis",
  secao_analise_por_setor: "Análise por Setor",
  secao_conclusao: "Conclusão",
};

const SECTION_KEYS = Object.keys(SECTION_LABELS);

export default function NarratorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [draft, setDraft] = useState<NarrativeDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});

  const hasPermission = isMedicalOrAbove();

  const loadCampaigns = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
        company_id: companyId,
        page_size: 100,
      });
      setCampaigns(res.data.filter((c) => c.status === "completed" || c.status === "in_progress"));
    } catch {
      // silencioso
    }
  }, [companyId]);

  const loadDraft = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setLoading(true);
    try {
      const res = await api.get<{ draft: NarrativeDraft | null }>(
        `/ai/${companyId}/narrator/draft`,
        { campaign_id: selectedCampaignId }
      );
      setDraft(res.draft);
      if (res.draft) {
        const sections: Record<string, string> = {};
        for (const key of SECTION_KEYS) {
          sections[key] = (res.draft as unknown as Record<string, string>)[key] || "";
        }
        setEditedSections(sections);
      }
    } catch {
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedCampaignId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedCampaignId) loadDraft();
  }, [selectedCampaignId, loadDraft]);

  const handleGenerate = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setGenerating(true);
    try {
      const res = await api.post<{ draft_id: number; sections: Record<string, string> }>(
        `/ai/${companyId}/narrator/generate`,
        { campaign_id: selectedCampaignId }
      );
      toast("success", "Narrativa gerada com sucesso!");
      await loadDraft();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao gerar narrativa.");
    } finally {
      setGenerating(false);
    }
  }, [companyId, selectedCampaignId, toast, loadDraft]);

  const handleRegenerateSection = useCallback(async (sectionKey: string) => {
    if (!companyId || !selectedCampaignId) return;
    setRegeneratingSection(sectionKey);
    try {
      const res = await api.post<{ new_text: string }>(
        `/ai/${companyId}/narrator/regenerate-section`,
        {
          campaign_id: selectedCampaignId,
          section_key: sectionKey,
          current_text: editedSections[sectionKey] || "",
        }
      );
      setEditedSections((prev) => ({ ...prev, [sectionKey]: res.new_text }));
      toast("success", `Seção "${SECTION_LABELS[sectionKey]}" regenerada.`);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao regenerar seção.");
    } finally {
      setRegeneratingSection(null);
    }
  }, [companyId, selectedCampaignId, editedSections, toast]);

  const handleSaveDraft = useCallback(async () => {
    if (!companyId || !draft) return;
    try {
      await api.put(`/ai/${companyId}/narrator/draft/${draft.id}`, editedSections);
      toast("success", "Rascunho salvo.");
      await loadDraft();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }, [companyId, draft, editedSections, toast, loadDraft]);

  const handleApprove = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setApproving(true);
    try {
      // Salvar edições primeiro
      if (draft) {
        await api.put(`/ai/${companyId}/narrator/draft/${draft.id}`, editedSections);
      }
      await api.post(`/ai/${companyId}/narrator/approve`, {
        campaign_id: selectedCampaignId,
      });
      toast("success", "Narrativa aprovada com sucesso!");
      await loadDraft();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao aprovar.");
    } finally {
      setApproving(false);
    }
  }, [companyId, selectedCampaignId, draft, editedSections, toast, loadDraft]);

  if (!hasPermission) {
    return (
      <div className="text-center py-12">
        <p className="text-body text-brand-muted">Acesso restrito a profissionais de saúde ou superiores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px]">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/pgr")} className="btn btn-ghost btn-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="page-title text-heading-2 text-brand-text flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Narradora IA do PGR
            </h1>
            <p className="text-body-sm text-brand-muted mt-1">
              Gere automaticamente o texto do Inventário de Riscos Psicossociais.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign selector */}
      <div className="card-emotioncare mb-6">
        <div className="card-body">
          <label className="text-body-sm text-brand-text font-medium mb-2 block">Campanha</label>
          <select
            className="input-emotioncare w-full sm:w-80"
            value={selectedCampaignId ?? ""}
            onChange={(e) => setSelectedCampaignId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Selecione uma campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status === "completed" ? "Concluída" : "Em andamento"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedCampaignId && (
        <div className="text-center py-12 text-brand-muted">
          Selecione uma campanha para continuar.
        </div>
      )}

      {selectedCampaignId && !draft && !loading && (
        <div className="card-emotioncare">
          <div className="card-body text-center py-12">
            <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-heading-3 text-brand-text mb-2">Gerar Narrativa com IA</h2>
            <p className="text-body-sm text-brand-muted mb-6 max-w-lg mx-auto">
              A IA analisará os scores da campanha e gerará automaticamente o texto do
              Inventário de Riscos Psicossociais, pronto para revisão e aprovação.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn btn-primary btn-md inline-flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="spinner-emotioncare w-4 h-4" />
                  Gerando narrativa...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Narrativa
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {loading && selectedCampaignId && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="spinner-emotioncare" />
        </div>
      )}

      {/* Draft review */}
      {draft && !loading && (
        <div>
          {/* Status bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span
                className={`badge ${
                  draft.status === "aprovado"
                    ? "badge-success"
                    : draft.status === "aguardando_revisao"
                    ? "badge-warning"
                    : "badge-error"
                }`}
              >
                {draft.status === "aprovado"
                  ? "Aprovado"
                  : draft.status === "aguardando_revisao"
                  ? "Aguardando Revisão"
                  : draft.status}
              </span>
              {draft.total_palavras && (
                <span className="text-xs text-brand-muted">{draft.total_palavras} palavras</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn btn-secondary btn-sm flex items-center gap-1"
              >
                {generating ? <div className="spinner-emotioncare w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                Regenerar Tudo
              </button>
              <button onClick={handleSaveDraft} className="btn btn-secondary btn-sm">
                Salvar Edições
              </button>
              {draft.status !== "aprovado" && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="btn btn-primary btn-sm flex items-center gap-1"
                >
                  {approving ? <div className="spinner-emotioncare w-3 h-3" /> : <Check className="w-3 h-3" />}
                  Aprovar e Gerar PDF
                </button>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {SECTION_KEYS.map((key) => (
              <div key={key} className="card-emotioncare">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-heading-3 text-brand-text">{SECTION_LABELS[key]}</h3>
                    <button
                      onClick={() => handleRegenerateSection(key)}
                      disabled={regeneratingSection === key}
                      className="btn btn-ghost btn-sm flex items-center gap-1 text-primary"
                    >
                      {regeneratingSection === key ? (
                        <div className="spinner-emotioncare w-3 h-3" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Regenerar
                    </button>
                  </div>
                  <textarea
                    className="input-emotioncare w-full min-h-[120px] resize-y"
                    value={editedSections[key] || ""}
                    onChange={(e) =>
                      setEditedSections((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
