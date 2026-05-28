"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getApiBase } from "@/lib/api";
import {
  PGROverview, Campaign, PaginatedResponse,
  GranularMode, GranularPreviewResponse, GranularGenerateResponse,
} from "@/types";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isMedicalOrAbove } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  History,
  Sparkles,
  Bot,
  FileCheck,
  ClipboardList,
  Check,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  GitCompare,
  Filter,
  Building2,
  MapPin,
  Briefcase,
  Users,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface NarrativeDraft {
  id: number;
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
}

interface Plan5W2H {
  dimensao: string;
  classificacao: string;
  o_que: string;
  por_que: string;
  quem: string;
  onde: string;
  quando: string;
  como: string;
  quanto: string;
  indicador: string;
}

interface Draft5W2H {
  id: number;
  campaign_id: number;
  plans: Plan5W2H[];
  status: string;
}

// ─── Constants ──────────────────────────────────────────

const WIZARD_STEPS = [
  { label: "Campanha", icon: ClipboardList },
  { label: "Inventário IA", icon: Sparkles },
  { label: "Plano 5W2H", icon: Bot },
  { label: "Gerar PGR", icon: FileCheck },
] as const;

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

const FIELD_LABELS: Record<string, string> = {
  o_que: "O quê",
  por_que: "Por quê",
  quem: "Quem",
  onde: "Onde",
  quando: "Quando",
  como: "Como",
  quanto: "Quanto",
  indicador: "Indicador",
};

// ─── Step Indicator ─────────────────────────────────────

function StepIndicator({
  currentStep,
  completedSteps,
  onStepClick,
}: {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {WIZARD_STEPS.map((step, i) => {
        const stepNum = i + 1;
        const isCompleted = completedSteps.has(stepNum);
        const isCurrent = stepNum === currentStep;
        const isClickable = isCompleted || stepNum <= currentStep;
        const Icon = step.icon;

        return (
          <div key={step.label} className="flex items-center">
            <div
              className={cn("flex flex-col items-center gap-1.5", isClickable && "cursor-pointer")}
              onClick={() => isClickable && onStepClick(stepNum)}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                  isCompleted && "bg-primary border-primary text-white",
                  isCurrent && !isCompleted && "border-primary text-primary bg-primary/5",
                  !isCompleted && !isCurrent && "border-brand-border text-brand-muted"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  isCurrent ? "text-primary" : isCompleted ? "text-primary" : "text-brand-muted"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "w-16 h-0.5 mx-2 mb-5 transition-colors",
                  completedSteps.has(stepNum) ? "bg-primary" : "bg-brand-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────

export default function PGRPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Data state
  const [overview, setOverview] = useState<PGROverview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 2: Narrator
  const [narratorDraft, setNarratorDraft] = useState<NarrativeDraft | null>(null);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [generatingNarrator, setGeneratingNarrator] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [approvingNarrator, setApprovingNarrator] = useState(false);

  // Step 3: 5W2H
  const [draft5w2h, setDraft5w2h] = useState<Draft5W2H | null>(null);
  const [generating5w2h, setGenerating5w2h] = useState(false);
  const [approving5w2h, setApproving5w2h] = useState(false);

  // Step 4: Final
  const [generateNotes, setGenerateNotes] = useState("");
  const [generatingPGR, setGeneratingPGR] = useState(false);
  const [responseRateAlert, setResponseRateAlert] = useState<{
    level: "warning" | "critical";
    rate: number;
    message: string;
  } | null>(null);
  const [showRateConfirm, setShowRateConfirm] = useState(false);

  // NC_PGR_FILTER: Granular mode
  const [granularEnabled, setGranularEnabled] = useState(false);
  const [granularMode, setGranularMode] = useState<GranularMode>("sector");
  const [granularPreview, setGranularPreview] = useState<GranularPreviewResponse | null>(null);
  const [loadingGranularPreview, setLoadingGranularPreview] = useState(false);
  const [generatingGranular, setGeneratingGranular] = useState(false);
  const [granularResult, setGranularResult] = useState<GranularGenerateResponse | null>(null);

  const hasPermission = isMedicalOrAbove();

  // ─── Data Loading ───

  const loadCampaigns = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
        company_id: companyId,
        page_size: 100,
      });
      setCampaigns(res.data.filter((c) => c.status === "completed" || c.status === "in_progress"));
    } catch {
      // silent
    }
  }, [companyId]);

  const loadOverview = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await api.get<PGROverview>(`/pgr/${companyId}/overview`);
      setOverview(data);
      if (data.latest_campaign_id && !selectedCampaignId) {
        setSelectedCampaignId(data.latest_campaign_id);
      }
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedCampaignId]);

  const loadNarratorDraft = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    try {
      const res = await api.get<{ draft: NarrativeDraft | null }>(
        `/ai/${companyId}/narrator/draft`,
        { campaign_id: selectedCampaignId }
      );
      setNarratorDraft(res.draft);
      if (res.draft) {
        const sections: Record<string, string> = {};
        for (const key of SECTION_KEYS) {
          sections[key] = (res.draft as unknown as Record<string, string>)[key] || "";
        }
        setEditedSections(sections);
      }
    } catch {
      setNarratorDraft(null);
    }
  }, [companyId, selectedCampaignId]);

  const load5w2hDraft = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    try {
      const res = await api.get<{ draft: Draft5W2H | null }>(
        `/ai/${companyId}/action-plan-5w2h/draft`,
        { campaign_id: selectedCampaignId }
      );
      setDraft5w2h(res.draft);
    } catch {
      setDraft5w2h(null);
    }
  }, [companyId, selectedCampaignId]);

  useEffect(() => {
    loadCampaigns();
    loadOverview();
  }, [loadCampaigns, loadOverview]);

  useEffect(() => {
    // Reset wizard ao trocar de campanha
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setNarratorDraft(null);
    setDraft5w2h(null);
    setEditedSections({});
    // NC_PGR_FILTER: reset granular
    setGranularEnabled(false);
    setGranularPreview(null);
    setGranularResult(null);
  }, [selectedCampaignId]);

  // ─── Step 1 Actions ───

  const handleNextFromCampaign = () => {
    if (!selectedCampaignId) {
      toast("error", "Selecione uma campanha para continuar.");
      return;
    }
    // Resetar drafts para começar fluxo IA do zero
    setNarratorDraft(null);
    setDraft5w2h(null);
    setEditedSections({});
    setCompletedSteps(new Set([1]));
    setCurrentStep(2);
  };

  // ─── Step 2 Actions (Narrator) ───

  const handleGenerateNarrator = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setGeneratingNarrator(true);
    try {
      await api.post(`/ai/${companyId}/narrator/generate`, { campaign_id: selectedCampaignId });
      toast("success", "Narrativa gerada com sucesso!");
      await loadNarratorDraft();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao gerar narrativa.");
    } finally {
      setGeneratingNarrator(false);
    }
  }, [companyId, selectedCampaignId, toast, loadNarratorDraft]);

  const handleRegenerateSection = useCallback(async (sectionKey: string) => {
    if (!companyId || !selectedCampaignId) return;
    setRegeneratingSection(sectionKey);
    try {
      const res = await api.post<{ new_text: string }>(
        `/ai/${companyId}/narrator/regenerate-section`,
        { campaign_id: selectedCampaignId, section_key: sectionKey, current_text: editedSections[sectionKey] || "" }
      );
      setEditedSections((prev) => ({ ...prev, [sectionKey]: res.new_text }));
      toast("success", `Seção "${SECTION_LABELS[sectionKey]}" regenerada.`);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao regenerar.");
    } finally {
      setRegeneratingSection(null);
    }
  }, [companyId, selectedCampaignId, editedSections, toast]);

  const handleApproveNarrator = useCallback(async () => {
    if (!companyId || !selectedCampaignId || !narratorDraft) return;
    setApprovingNarrator(true);
    try {
      await api.put(`/ai/${companyId}/narrator/draft/${narratorDraft.id}`, editedSections);
      await api.post(`/ai/${companyId}/narrator/approve`, { campaign_id: selectedCampaignId });
      toast("success", "Inventário de riscos aprovado!");
      setCompletedSteps((prev) => new Set([...Array.from(prev), 2]));
      await loadNarratorDraft();
      setCurrentStep(3);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao aprovar.");
    } finally {
      setApprovingNarrator(false);
    }
  }, [companyId, selectedCampaignId, narratorDraft, editedSections, toast, loadNarratorDraft]);

  // ─── Step 3 Actions (5W2H) ───

  const handleGenerate5w2h = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setGenerating5w2h(true);
    try {
      await api.post(`/ai/${companyId}/action-plan-5w2h/generate`, {
        campaign_id: selectedCampaignId,
        texto_inventario_aprovado: "",
      });
      toast("success", "Plano 5W2H gerado com sucesso!");
      await load5w2hDraft();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao gerar plano.");
    } finally {
      setGenerating5w2h(false);
    }
  }, [companyId, selectedCampaignId, toast, load5w2hDraft]);

  const handleApprove5w2h = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setApproving5w2h(true);
    try {
      await api.post(`/ai/${companyId}/action-plan-5w2h/approve`, { campaign_id: selectedCampaignId });
      toast("success", "Plano de ação aprovado!");
      setCompletedSteps((prev) => new Set([...Array.from(prev), 3]));
      await load5w2hDraft();
      setCurrentStep(4);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao aprovar.");
    } finally {
      setApproving5w2h(false);
    }
  }, [companyId, selectedCampaignId, toast, load5w2hDraft]);

  // ─── Step 4 Actions (Generate PGR) ───

  const downloadPdf = useCallback(async (campId: number) => {
    if (!companyId) return;
    try {
      const token = localStorage.getItem("access_token");
      const base = getApiBase().replace(/\/+$/, "");
      const response = await fetch(`${base}/pgr/${companyId}/export-pdf?campaign_id=${campId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `Erro ao gerar PDF (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("PDF vazio.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `PGR_NR01_${companyId}_${campId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao baixar PDF.");
    }
  }, [companyId, toast]);

  const doGeneratePGR = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setGeneratingPGR(true);
    setShowRateConfirm(false);
    try {
      await api.post(`/pgr/${companyId}/generate`, {
        campaign_id: selectedCampaignId,
        ...(generateNotes.trim() ? { notes: generateNotes.trim() } : {}),
      });
      toast("success", "PGR gerado com sucesso! Baixando PDF...");
      setCompletedSteps((prev) => new Set([...Array.from(prev), 4]));
      loadOverview();
      await downloadPdf(selectedCampaignId);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao gerar PGR.");
    } finally {
      setGeneratingPGR(false);
    }
  }, [companyId, selectedCampaignId, generateNotes, toast, loadOverview, downloadPdf]);

  const handleGeneratePGR = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    // Check response rate before generating
    try {
      const check = await api.get<{ response_rate: number; alert_level: string; message: string }>(
        `/pgr/${companyId}/response-rate-check`,
        { campaign_id: selectedCampaignId }
      );
      if (check.alert_level === "ok") {
        setResponseRateAlert(null);
        await doGeneratePGR();
      } else {
        setResponseRateAlert({
          level: check.alert_level as "warning" | "critical",
          rate: check.response_rate,
          message: check.message,
        });
        setShowRateConfirm(true);
      }
    } catch {
      // If check fails (e.g. no results yet), proceed anyway
      await doGeneratePGR();
    }
  }, [companyId, selectedCampaignId, doGeneratePGR]);

  // ─── NC_PGR_FILTER: Granular Actions ───

  const loadGranularPreview = useCallback(async (mode: GranularMode) => {
    if (!companyId || !selectedCampaignId) return;
    setLoadingGranularPreview(true);
    try {
      const res = await api.post<GranularPreviewResponse>(
        `/pgr/${companyId}/granular-preview`,
        { campaign_id: selectedCampaignId, granular_mode: mode }
      );
      setGranularPreview(res);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao carregar preview granular.");
      setGranularPreview(null);
    } finally {
      setLoadingGranularPreview(false);
    }
  }, [companyId, selectedCampaignId, toast]);

  const handleGranularModeChange = useCallback((mode: GranularMode) => {
    setGranularMode(mode);
    setGranularPreview(null);
    setGranularResult(null);
    loadGranularPreview(mode);
  }, [loadGranularPreview]);

  const handleGenerateGranular = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setGeneratingGranular(true);
    try {
      const res = await api.post<GranularGenerateResponse>(
        `/pgr/${companyId}/generate-granular`,
        {
          campaign_id: selectedCampaignId,
          granular_mode: granularMode,
          ...(generateNotes.trim() ? { notes: generateNotes.trim() } : {}),
        }
      );
      setGranularResult(res);
      toast("success", res.message);
      setCompletedSteps((prev) => new Set([...Array.from(prev), 4]));
      loadOverview();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao gerar PGRs granulares.");
    } finally {
      setGeneratingGranular(false);
    }
  }, [companyId, selectedCampaignId, granularMode, generateNotes, toast, loadOverview]);

  const downloadGranularPdf = useCallback(async (groupName: string) => {
    if (!companyId || !selectedCampaignId) return;
    try {
      const token = localStorage.getItem("access_token");
      const base = getApiBase().replace(/\/+$/, "");
      const params = new URLSearchParams({
        campaign_id: String(selectedCampaignId),
        group_name: groupName,
        granular_mode: granularMode,
      });
      const response = await fetch(
        `${base}/pgr/${companyId}/export-pdf-granular?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `Erro ao gerar PDF (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("PDF vazio.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = groupName.replace(/\s+/g, "_").replace(/\//g, "-");
      link.download = `PGR_NR01_${companyId}_${selectedCampaignId}_${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao baixar PDF granular.");
    }
  }, [companyId, selectedCampaignId, granularMode, toast]);

  // ─── Loading / Permission ───

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="text-center py-12">
        <ShieldCheck className="w-12 h-12 text-brand-muted mx-auto mb-4" />
        <p className="text-body text-brand-text">Acesso restrito.</p>
        <p className="text-body-sm text-brand-muted mt-2">
          Apenas profissionais de saúde ou superiores podem acessar o PGR.
        </p>
      </div>
    );
  }

  // ─── Quick Links ───

  const quickLinks = [
    { href: "/pgr/risk-inventory", icon: ShieldCheck, title: "Inventário de Riscos" },
    { href: "/pgr/action-plan", icon: CheckCircle, title: "Plano de Ação" },
    { href: "/pgr/history", icon: History, title: "Histórico" },
    { href: "/pgr/comparison", icon: GitCompare, title: "Comparativo" },
  ];

  const handleExportPdf = async () => {
    if (!companyId || !selectedCampaignId) {
      toast("error", "Selecione uma campanha para exportar o PDF.");
      return;
    }
    try {
      const token = localStorage.getItem("access_token");
      const base = getApiBase().replace(/\/+$/, "");
      const response = await fetch(`${base}/pgr/${companyId}/export-pdf?campaign_id=${selectedCampaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.detail || `Erro ao gerar PDF (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("PDF vazio.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `PGR_NR01_${companyId}_${selectedCampaignId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast("success", "PDF exportado com sucesso!");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao exportar PDF.");
    }
  };

  // ─── Render ───

  return (
    <div className="max-w-[1000px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-heading-2 text-brand-text">
          PGR — Programa de Gerenciamento de Riscos
        </h1>
        <p className="text-body-sm text-brand-muted mt-1 mb-4">
          Siga os passos para gerar o documento completo do PGR.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {quickLinks.map((l) => {
            const Icon = l.icon;
            return (
              <button
                key={l.href}
                onClick={() => router.push(l.href)}
                className="inline-flex items-center gap-1.5 text-xs text-brand-muted hover:text-primary px-3 py-1.5 rounded-full border border-brand-border hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <Icon className="w-3.5 h-3.5" />
                {l.title}
              </button>
            );
          })}
          <button
            onClick={handleExportPdf}
            disabled={!selectedCampaignId}
            className="inline-flex items-center gap-1.5 text-xs text-white bg-primary hover:bg-primary-hover px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(step) => {
          if (completedSteps.has(step) || step <= currentStep) setCurrentStep(step);
        }}
      />

      {/* ═══════════════════════════════════════════════════
          STEP 1 — Selecionar Campanha
          ═══════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="card-emotioncare">
          <div className="card-body">
            <h2 className="text-heading-3 text-brand-text mb-1">Selecione a campanha</h2>
            <p className="text-body-sm text-brand-muted mb-5">
              Escolha a campanha de avaliação que servirá de base para o PGR.
            </p>
            <select
              className="input-emotioncare w-full sm:w-96"
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

            {/* NC_PGR_FILTER: Toggle PGR Granular */}
            {selectedCampaignId && (
              <div className="mt-6 rounded-xl border border-brand-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-primary" />
                    <span className="text-body-sm font-medium text-brand-text">PGR Granular</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={granularEnabled}
                      onChange={(e) => {
                        setGranularEnabled(e.target.checked);
                        setGranularPreview(null);
                        setGranularResult(null);
                        if (e.target.checked) {
                          loadGranularPreview(granularMode);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                  </label>
                </div>
                <p className="text-xs text-brand-muted mb-3">
                  Gera documentos PGR independentes por setor, unidade ou atividade.
                </p>

                {granularEnabled && (
                  <div className="space-y-3">
                    {/* Seletor de critério */}
                    <div className="flex gap-2">
                      {([
                        { mode: "sector" as GranularMode, label: "Setor", icon: Building2 },
                        { mode: "location" as GranularMode, label: "Unidade", icon: MapPin },
                        { mode: "activity" as GranularMode, label: "Atividade", icon: Briefcase },
                      ]).map(({ mode, label, icon: Icon }) => (
                        <button
                          key={mode}
                          onClick={() => handleGranularModeChange(mode)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                            granularMode === mode
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-brand-border text-brand-muted hover:border-primary/30"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Preview dos grupos */}
                    {loadingGranularPreview && (
                      <div className="flex items-center gap-2 text-xs text-brand-muted py-2">
                        <div className="spinner-emotioncare w-3 h-3" /> Analisando grupos...
                      </div>
                    )}

                    {granularPreview && !loadingGranularPreview && (
                      <div className="rounded-lg bg-brand-bg-subtle p-3 space-y-2">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-brand-text font-medium">
                            {granularPreview.total_groups} grupo(s) encontrado(s)
                          </span>
                          <span className="text-green-600">
                            {granularPreview.eligible_groups} elegível(is)
                          </span>
                          {granularPreview.ineligible_groups > 0 && (
                            <span className="text-amber-600">
                              {granularPreview.ineligible_groups} insuficiente(s)
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {granularPreview.groups.map((g) => (
                            <div
                              key={g.group_key}
                              className={cn(
                                "flex items-center justify-between text-xs py-1 px-2 rounded",
                                g.eligible ? "text-brand-text" : "text-brand-muted bg-amber-50"
                              )}
                            >
                              <span className="flex items-center gap-1.5">
                                {g.eligible ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                )}
                                {g.group_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {g.respondent_count}
                                {!g.eligible && " (min. 3)"}
                              </span>
                            </div>
                          ))}
                        </div>
                        {granularPreview.eligible_groups === 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Nenhum grupo possui respondentes suficientes para gerar PGR granular.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation — dual flow */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-5 mt-5 border-t border-brand-border">
              <button
                onClick={() => {
                  if (!selectedCampaignId) { toast("error", "Selecione uma campanha."); return; }
                  setCompletedSteps(new Set([1, 2, 3]));
                  setCurrentStep(4);
                }}
                disabled={!selectedCampaignId}
                className="btn btn-secondary btn-md flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Gerar PGR Manual
              </button>
              <button
                onClick={handleNextFromCampaign}
                disabled={!selectedCampaignId}
                className="btn btn-primary btn-md flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Gerar com IA
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {selectedCampaignId && (
              <p className="text-xs text-brand-muted mt-3">
                <b>Gerar com IA:</b> a IA gera o inventário e plano de ação automaticamente, e você revisa antes de gerar o PDF.
                <br />
                <b>Gerar PGR Manual:</b> gera o PDF diretamente com os dados já preenchidos nos submódulos.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 2 — Inventário de Riscos (IA Narradora)
          ═══════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="card-emotioncare">
          <div className="card-body">
            {/* No draft yet */}
            {!narratorDraft && (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-heading-3 text-brand-text mb-2">Gerar Inventário de Riscos com IA</h2>
                <p className="text-body-sm text-brand-muted mb-6 max-w-md mx-auto">
                  A IA analisará os scores da campanha e gerará o texto do Inventário de Riscos Psicossociais.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleGenerateNarrator}
                    disabled={generatingNarrator}
                    className="btn btn-primary btn-md inline-flex items-center gap-2"
                  >
                    {generatingNarrator ? (
                      <><div className="spinner-emotioncare w-4 h-4" /> Gerando narrativa...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Gerar com IA</>
                    )}
                  </button>
                  <button
                    onClick={() => { setCompletedSteps((prev) => new Set([...Array.from(prev), 2])); setCurrentStep(3); }}
                    className="btn btn-secondary btn-md inline-flex items-center gap-2"
                  >
                    Pular <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Draft approved */}
            {narratorDraft && narratorDraft.status === "aprovado" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-green-100"><Check className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <h2 className="text-heading-3 text-brand-text">Inventário Aprovado</h2>
                    <p className="text-body-sm text-brand-muted">
                      Texto revisado e aprovado.
                      {narratorDraft.total_palavras && ` ${narratorDraft.total_palavras} palavras.`}
                    </p>
                  </div>
                </div>
                <details>
                  <summary className="text-body-sm text-primary cursor-pointer font-medium">Ver texto completo</summary>
                  <div className="mt-3 space-y-3">
                    {SECTION_KEYS.map((key) => (
                      <div key={key}>
                        <p className="text-xs font-medium text-brand-muted mb-1">{SECTION_LABELS[key]}</p>
                        <p className="text-body-sm text-brand-text bg-brand-bg-subtle rounded-lg p-3">
                          {(narratorDraft as unknown as Record<string, string>)[key] || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Draft awaiting review */}
            {narratorDraft && narratorDraft.status !== "aprovado" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-heading-3 text-brand-text">Revisar Inventário de Riscos</h2>
                    <p className="text-body-sm text-brand-muted mt-0.5">Edite as seções abaixo e aprove quando estiver satisfeito.</p>
                  </div>
                  <button
                    onClick={handleGenerateNarrator}
                    disabled={generatingNarrator}
                    className="btn btn-secondary btn-sm flex items-center gap-1.5"
                  >
                    {generatingNarrator ? <div className="spinner-emotioncare w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                    Regenerar Tudo
                  </button>
                </div>
                <div className="space-y-3">
                  {SECTION_KEYS.map((key) => (
                    <div key={key} className="rounded-xl border border-brand-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-heading-4 text-brand-text">{SECTION_LABELS[key]}</h3>
                        <button
                          onClick={() => handleRegenerateSection(key)}
                          disabled={regeneratingSection === key}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
                        >
                          {regeneratingSection === key ? <div className="spinner-emotioncare w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                          Regenerar
                        </button>
                      </div>
                      <textarea
                        className="input-emotioncare w-full min-h-[90px] resize-y text-sm"
                        value={editedSections[key] || ""}
                        onChange={(e) => setEditedSections((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation footer */}
            {narratorDraft && (
              <div className="flex justify-between pt-5 mt-5 border-t border-brand-border">
                <button onClick={() => setCurrentStep(1)} className="btn btn-secondary btn-md flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                {narratorDraft.status === "aprovado" ? (
                  <button onClick={() => setCurrentStep(3)} className="btn btn-primary btn-md flex items-center gap-2">
                    Próximo <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleApproveNarrator}
                    disabled={approvingNarrator}
                    className="btn btn-primary btn-md flex items-center gap-2"
                  >
                    {approvingNarrator ? <div className="spinner-emotioncare w-4 h-4" /> : <Check className="w-4 h-4" />}
                    Aprovar e Continuar
                  </button>
                )}
              </div>
            )}
            {!narratorDraft && (
              <div className="flex justify-start pt-5 mt-5 border-t border-brand-border">
                <button onClick={() => setCurrentStep(1)} className="btn btn-secondary btn-md flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 3 — Plano de Ação 5W2H (IA)
          ═══════════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="card-emotioncare">
          <div className="card-body">
            {/* No draft */}
            {!draft5w2h && (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-heading-3 text-brand-text mb-2">Gerar Plano de Ação 5W2H com IA</h2>
                <p className="text-body-sm text-brand-muted mb-6 max-w-md mx-auto">
                  A IA gerará um plano de ação estruturado para cada dimensão de risco identificada.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleGenerate5w2h}
                    disabled={generating5w2h}
                    className="btn btn-primary btn-md inline-flex items-center gap-2"
                  >
                    {generating5w2h ? (
                      <><div className="spinner-emotioncare w-4 h-4" /> Gerando plano...</>
                    ) : (
                      <><Bot className="w-4 h-4" /> Gerar Plano 5W2H</>
                    )}
                  </button>
                  <button
                    onClick={() => { setCompletedSteps((prev) => new Set([...Array.from(prev), 3])); setCurrentStep(4); }}
                    className="btn btn-secondary btn-md inline-flex items-center gap-2"
                  >
                    Pular <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Draft approved */}
            {draft5w2h && draft5w2h.status === "aprovado" && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-green-100"><Check className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <h2 className="text-heading-3 text-brand-text">Plano de Ação Aprovado</h2>
                    <p className="text-body-sm text-brand-muted">{draft5w2h.plans.length} plano(s) revisados e aprovados.</p>
                  </div>
                </div>
                <details>
                  <summary className="text-body-sm text-primary cursor-pointer font-medium">Ver planos</summary>
                  <div className="mt-3 space-y-3">
                    {draft5w2h.plans.map((plan, idx) => (
                      <div key={idx} className="bg-brand-bg-subtle rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${plan.classificacao === "Vermelho" ? "badge-error" : "badge-warning"}`}>{plan.classificacao}</span>
                          <span className="text-sm font-medium text-brand-text">{plan.dimensao}</span>
                        </div>
                        <p className="text-xs text-brand-muted">{plan.o_que}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Draft awaiting review */}
            {draft5w2h && draft5w2h.status !== "aprovado" && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-heading-3 text-brand-text">Revisar Planos de Ação</h2>
                    <p className="text-body-sm text-brand-muted mt-0.5">{draft5w2h.plans.length} plano(s) gerados. Revise e aprove.</p>
                  </div>
                  <button
                    onClick={handleGenerate5w2h}
                    disabled={generating5w2h}
                    className="btn btn-secondary btn-sm flex items-center gap-1.5"
                  >
                    {generating5w2h ? <div className="spinner-emotioncare w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                    Regenerar
                  </button>
                </div>
                <div className="space-y-3">
                  {draft5w2h.plans.map((plan, idx) => (
                    <div key={idx} className="rounded-xl border border-brand-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`badge ${plan.classificacao === "Vermelho" ? "badge-error" : "badge-warning"}`}>{plan.classificacao}</span>
                        <h3 className="text-heading-4 text-brand-text">{plan.dimensao}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(FIELD_LABELS).map(([field, label]) => (
                          <div key={field} className={field === "como" ? "sm:col-span-2" : ""}>
                            <p className="text-[11px] font-medium text-brand-muted mb-0.5 uppercase tracking-wide">{label}</p>
                            <p className="text-xs text-brand-text bg-brand-bg-subtle rounded-lg p-2.5">
                              {(plan as unknown as Record<string, string>)[field] || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation footer */}
            {draft5w2h && (
              <div className="flex justify-between pt-5 mt-5 border-t border-brand-border">
                <button onClick={() => setCurrentStep(2)} className="btn btn-secondary btn-md flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                {draft5w2h.status === "aprovado" ? (
                  <button onClick={() => setCurrentStep(4)} className="btn btn-primary btn-md flex items-center gap-2">
                    Próximo <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleApprove5w2h}
                    disabled={approving5w2h}
                    className="btn btn-primary btn-md flex items-center gap-2"
                  >
                    {approving5w2h ? <div className="spinner-emotioncare w-4 h-4" /> : <Check className="w-4 h-4" />}
                    Aprovar e Continuar
                  </button>
                )}
              </div>
            )}
            {!draft5w2h && (
              <div className="flex justify-start pt-5 mt-5 border-t border-brand-border">
                <button onClick={() => setCurrentStep(2)} className="btn btn-secondary btn-md flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 4 — Gerar PGR Final
          ═══════════════════════════════════════════════════ */}
      {currentStep === 4 && (
        <div className="card-emotioncare">
          <div className="card-body">
            <h2 className="text-heading-3 text-brand-text mb-1">Gerar Documento Final</h2>
            <p className="text-body-sm text-brand-muted mb-5">Revise o checklist e gere o PGR completo em PDF.</p>

            {/* Checklist */}
            <div className="rounded-xl bg-brand-bg-subtle p-5 mb-6 space-y-4">
              {[
                { step: 1, icon: ClipboardList, label: "Campanha selecionada" },
                { step: 2, icon: Sparkles, label: "Inventário de Riscos (IA)" },
                { step: 3, icon: Bot, label: "Plano de Ação 5W2H (IA)" },
              ].map(({ step, icon: Icon, label }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${completedSteps.has(step) ? "bg-green-100 text-green-600" : "bg-white text-gray-400 border border-brand-border"}`}>
                    {completedSteps.has(step) ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-body-sm text-brand-text flex-1">{label}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${completedSteps.has(step) ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {completedSteps.has(step) ? "Concluído" : "Pendente"}
                  </span>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="text-body-sm text-brand-text font-medium mb-2 block">Observações (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Versão para revisão do comitê de SST"
                className="input-emotioncare w-full"
                value={generateNotes}
                onChange={(e) => setGenerateNotes(e.target.value)}
              />
            </div>

            {/* Generate button — Consolidado */}
            <button
              onClick={handleGeneratePGR}
              disabled={generatingPGR}
              className="btn btn-primary btn-md w-full flex items-center justify-center gap-2 h-12 text-base"
            >
              {generatingPGR ? (
                <><div className="spinner-emotioncare w-4 h-4" /> Gerando PGR...</>
              ) : (
                <><Download className="w-5 h-5" /> Gerar PGR Consolidado e Baixar PDF</>
              )}
            </button>

            {/* NC_PGR_FILTER: Geração Granular */}
            {granularEnabled && granularPreview && granularPreview.eligible_groups > 0 && (
              <div className="mt-6 rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-5 h-5 text-primary" />
                  <h3 className="text-heading-4 text-brand-text">PGR Granular — {granularPreview.mode_label}</h3>
                </div>
                <p className="text-xs text-brand-muted mb-4">
                  Serão gerados <b>{granularPreview.eligible_groups}</b> documento(s) PGR independente(s).
                  {granularPreview.ineligible_groups > 0 && (
                    <> <span className="text-amber-600">{granularPreview.ineligible_groups} grupo(s) ignorado(s) por insuficiência de respondentes.</span></>
                  )}
                </p>

                {!granularResult && (
                  <button
                    onClick={handleGenerateGranular}
                    disabled={generatingGranular}
                    className="btn btn-primary btn-md w-full flex items-center justify-center gap-2 h-11"
                  >
                    {generatingGranular ? (
                      <><div className="spinner-emotioncare w-4 h-4" /> Gerando PGRs Granulares...</>
                    ) : (
                      <><Filter className="w-4 h-4" /> Gerar {granularPreview.eligible_groups} PGR(s) Granular(es)</>
                    )}
                  </button>
                )}

                {/* Resultado — lista de PGRs gerados com download individual */}
                {granularResult && (
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">{granularResult.message}</span>
                    </div>

                    {granularResult.skipped_warnings.length > 0 && (
                      <div className="rounded-lg bg-amber-50 p-3 space-y-1">
                        <p className="text-xs font-medium text-amber-700">Grupos ignorados:</p>
                        {granularResult.skipped_warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {w}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {granularResult.generated.map((gv) => (
                        <div
                          key={gv.version_id}
                          className="flex items-center justify-between bg-white rounded-lg border border-brand-border px-4 py-3"
                        >
                          <div>
                            <span className="text-sm font-medium text-brand-text">{gv.group_name}</span>
                            <div className="flex items-center gap-3 text-xs text-brand-muted mt-0.5">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {gv.respondent_count} respondentes</span>
                              <span>{gv.total_dimensions_at_risk} dimensao(oes) em risco</span>
                              <span className="text-brand-muted">v{gv.version_number}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => downloadGranularPdf(gv.group_name)}
                            className="btn btn-secondary btn-sm flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation footer */}
            <div className="flex justify-start pt-5 mt-5 border-t border-brand-border">
              <button onClick={() => setCurrentStep(3)} className="btn btn-secondary btn-md flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de alerta de taxa de resposta (I5) ─── */}
      {showRateConfirm && responseRateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${
              responseRateAlert.level === "critical"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-700"
            }`}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold">
                {responseRateAlert.level === "critical"
                  ? `Taxa de resposta insuficiente: ${responseRateAlert.rate.toFixed(0)}%`
                  : `Taxa de resposta abaixo do recomendado: ${responseRateAlert.rate.toFixed(0)}%`}
              </span>
            </div>
            <p className="text-sm text-brand-text mb-6">{responseRateAlert.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRateConfirm(false)}
                className="btn btn-secondary btn-md flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={doGeneratePGR}
                disabled={generatingPGR}
                className={`btn btn-md flex-1 flex items-center justify-center gap-2 ${
                  responseRateAlert.level === "critical"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "btn-primary"
                }`}
              >
                {generatingPGR ? (
                  <><div className="spinner-emotioncare w-4 h-4" /> Gerando...</>
                ) : (
                  <><Download className="w-4 h-4" /> Gerar mesmo assim</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
