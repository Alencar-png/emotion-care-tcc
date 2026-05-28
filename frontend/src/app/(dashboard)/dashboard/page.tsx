"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  Users,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Megaphone,
  Activity,
  Building2,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  Lock,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { DashboardSummary, OnboardingStatusResponse, UserRole, Campaign, PaginatedResponse } from "@/types";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { getCurrentUserFromToken } from "@/lib/auth";
import OnboardingProgressCard from "@/components/onboarding-progress-card";
import RiskGaugeChart from "@/components/charts/risk-gauge-chart";
import DepartmentBarChart from "@/components/charts/department-bar-chart";
import RiskDistributionChart from "@/components/charts/risk-distribution-chart";
import CampaignMultiPanel from "@/components/campaign-multi-panel";

// ─── Helpers ────────────────────────────────────────────

const riskLevelLabel: Record<string, string> = {
  healthy: "Saudável",
  intermediate: "Intermediário",
  risk: "Crítico",
};

const riskLevelCores: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  healthy: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  intermediate: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  risk: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
};

function getRiskCores(level: string) {
  return riskLevelCores[level] || riskLevelCores.intermediate;
}

// ─── Componentes auxiliares ─────────────────────────────

function RiscoBadge({ nivel }: { nivel: string }) {
  const cores = getRiskCores(nivel);
  const label = riskLevelLabel[nivel] || nivel;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cores.bg} ${cores.text} ${cores.border} border`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cores.dot}`} />
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color = "primary",
  progress,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: typeof Users;
  color?: "primary" | "accent" | "green" | "red" | "yellow";
  progress?: number;
}) {
  const colorClasses: Record<string, string> = {
    primary: "bg-primary-light text-primary",
    accent: "bg-accent/10 text-accent",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    yellow: "bg-yellow-50 text-yellow-600",
  };
  const barColors: Record<string, string> = {
    primary: "bg-primary",
    accent: "bg-accent",
    green: "bg-green-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
  };

  return (
    <div className="bg-white rounded-xl border border-brand-border p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs text-brand-muted font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-brand-text">{value}</p>
      {sublabel && <p className="text-[11px] text-brand-muted">{sublabel}</p>}
      {progress !== undefined && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-auto">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColors[color]}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, max, color = "accent" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barColor = color === "accent" ? "bg-accent" : color === "orange" ? "bg-orange-500" : color === "yellow" ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-body-sm font-medium text-brand-text tabular-nums w-10 text-right">{pct}%</span>
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  const loadDashboard = useCallback(async (campaignId?: number | null) => {
    if (!companyId) {
      setLoading(false);
      setDashboard(null);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, unknown> = { company_id: companyId };
      if (campaignId) {
        params.campaign_id = campaignId;
      }
      const data = await api.get<DashboardSummary>("/analytics/dashboard", params);
      setDashboard(data);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao carregar dashboard.");
    } finally {
      setLoading(false);
    }
  }, [toast, companyId]);

  useEffect(() => {
    loadDashboard(selectedCampaignId);
  }, [loadDashboard, selectedCampaignId]);

  // Load campaigns for multi-campaign panel
  const loadCampaigns = useCallback(async () => {
    if (!companyId) {
      setCampaignsLoading(false);
      setCampaigns([]);
      return;
    }
    setCampaignsLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
        page: 1,
        page_size: 20,
        company_id: companyId,
      });
      setCampaigns(res.data);
    } catch {
      // Silent fail - campaigns panel is supplementary
    } finally {
      setCampaignsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Verificar onboarding status
  useEffect(() => {
    const user = getCurrentUserFromToken();
    if (user && user.role !== UserRole.SUPER_ADMIN) {
      api.get<OnboardingStatusResponse>("/onboarding/status/")
        .then((status) => {
          if (status.onboarding_status && status.onboarding_status !== "completed") {
            setOnboardingStep(status.onboarding_current_step || 1);
            setShowOnboarding(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="max-w-[1200px]">
        {showOnboarding && onboardingStep !== null && (
          <OnboardingProgressCard currentStep={onboardingStep} />
        )}
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-brand-muted mx-auto mb-4" />
          <p className="text-body text-brand-text">Nenhum dado disponivel ainda.</p>
          <p className="text-body-sm text-brand-muted mt-2">Crie uma campanha e colete respostas para ver os dados aqui.</p>
        </div>
      </div>
    );
  }

  const pctAvaliados = dashboard.total_employees > 0
    ? Math.round((dashboard.evaluated_employees / dashboard.total_employees) * 100)
    : 0;

  const lastEvalFormatted = dashboard.last_evaluation_date
    ? new Date(dashboard.last_evaluation_date).toLocaleDateString("pt-BR")
    : "—";

  // Count departments by risk level
  const deptHealthy = dashboard.departments.filter(d => d.risk_level === "healthy").length;
  const deptIntermediate = dashboard.departments.filter(d => d.risk_level === "intermediate").length;
  const deptRisk = dashboard.departments.filter(d => d.risk_level === "risk").length;

  // NC_ANON_SCORE: verificar se scores devem ser ocultados
  const isScoreRestricted = dashboard.is_score_restricted === true;
  const scoreMinResponses = dashboard.anonymity_thresholds?.score_min ?? 4;
  const totalResponses = dashboard.total_responses ?? 0;

  return (
    <div className="max-w-[1200px]">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-heading-1 text-brand-text">Painel de Saúde Mental</h1>
          <p className="text-body text-brand-muted mt-1">{dashboard.company_name}</p>
        </div>
        {!isScoreRestricted && dashboard.overall_risk_level && (
          <RiscoBadge nivel={dashboard.overall_risk_level} />
        )}
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
              Para garantir o anonimato dos participantes, os scores e gráficos só são exibidos quando o número mínimo de respostas é atingido. Os dados de participação continuam visíveis.
            </p>
          </div>
        </div>
      )}

      {/* ─── Onboarding Progress ─── */}
      {showOnboarding && onboardingStep !== null && (
        <OnboardingProgressCard currentStep={onboardingStep} />
      )}

      {/* ─── Stat Cards Row ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={ShieldAlert}
          label="Índice de Risco"
          value={isScoreRestricted ? "—" : (dashboard.overall_risk_score ?? "—")}
          sublabel={isScoreRestricted ? "Aguardando respostas" : (riskLevelLabel[dashboard.overall_risk_level || ""] || "Sem dados")}
          color={isScoreRestricted ? "yellow" : (dashboard.overall_risk_level === "risk" ? "red" : dashboard.overall_risk_level === "intermediate" ? "yellow" : "green")}
          progress={isScoreRestricted ? 0 : (dashboard.overall_risk_score ?? 0)}
        />
        <StatCard
          icon={Users}
          label="Colaboradores Avaliados"
          value={`${dashboard.evaluated_employees}/${dashboard.total_employees}`}
          sublabel={`${pctAvaliados}% de cobertura`}
          color="accent"
          progress={pctAvaliados}
        />
        <StatCard
          icon={CalendarClock}
          label="Última Avaliação"
          value={lastEvalFormatted}
          sublabel={`${dashboard.completed_campaigns} ciclo(s) concluído(s)`}
          color="primary"
        />
        <StatCard
          icon={AlertTriangle}
          label="Dimensões em Alerta"
          value={isScoreRestricted ? "—" : (dashboard.critical_dimensions.length + dashboard.intermediate_dimensions.length)}
          sublabel={isScoreRestricted ? "Aguardando respostas" : `${dashboard.critical_dimensions.length} crítica(s), ${dashboard.intermediate_dimensions.length} intermediária(s)`}
          color={isScoreRestricted ? "yellow" : (dashboard.critical_dimensions.length > 0 ? "red" : "yellow")}
        />
      </div>

      {/* ─── Multi-Campaign Panel ─── */}
      <div className="mb-6">
        <CampaignMultiPanel
          campaigns={campaigns}
          loading={campaignsLoading}
          selectedCampaignId={selectedCampaignId}
          onCampaignSelect={setSelectedCampaignId}
        />
      </div>

      {/* ─── Main Grid: Risk Overview + Dimensions ─── */}
      {isScoreRestricted ? (
        <div className="mb-6 bg-white rounded-xl border border-brand-border p-8 text-center">
          <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-body font-semibold text-brand-text">Scores e gráficos indisponíveis</p>
          <p className="text-body-sm text-brand-muted mt-2">
            Resultados disponíveis após {scoreMinResponses} respostas. Atual: {totalResponses} resposta(s).
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 mb-6">
        {/* Left column: Risk gauge + distribution */}
        <div className="space-y-4">
          {/* Gauge */}
          <div className="bg-white rounded-xl border border-brand-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="text-heading-3 text-brand-text">Índice Geral de Risco</h2>
            </div>
            <div className="flex justify-center">
              <RiskGaugeChart score={dashboard.overall_risk_score ?? 0} size={200} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 font-medium">Saudável</p>
                <p className="text-sm font-bold text-green-700">0-33</p>
              </div>
              <div className="p-2 bg-yellow-50 rounded-lg">
                <p className="text-xs text-yellow-600 font-medium">Intermed.</p>
                <p className="text-sm font-bold text-yellow-700">34-66</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <p className="text-xs text-red-600 font-medium">Crítico</p>
                <p className="text-sm font-bold text-red-700">67-100</p>
              </div>
            </div>
          </div>

          {/* Distribution by department risk */}
          {dashboard.departments.length > 0 && (
            <div className="bg-white rounded-xl border border-brand-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-primary" />
                <h2 className="text-heading-3 text-brand-text">Setores por Nível</h2>
              </div>
              <RiskDistributionChart
                healthy={deptHealthy}
                intermediate={deptIntermediate}
                risk={deptRisk}
              />
            </div>
          )}
        </div>

        {/* Right column: Dimension alerts */}
        <div className="space-y-4">
          {/* Dimensões em nível crítico */}
          <div className="bg-white rounded-xl border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-heading-3 text-brand-text">Dimensões em Nível Crítico</h2>
              <span className="ml-auto text-caption bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                {dashboard.critical_dimensions.length}
              </span>
            </div>
            <div className="divide-y divide-brand-border">
              {dashboard.critical_dimensions.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-body-sm text-brand-muted">Nenhuma dimensão em nível crítico.</p>
                </div>
              ) : (
                dashboard.critical_dimensions.map((dim, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center justify-between hover:bg-brand-bg-subtle transition-colors">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-body font-medium text-brand-text">{dim.dimension_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 max-w-[120px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${dim.score}%` }} />
                        </div>
                        <span className="text-caption text-brand-muted tabular-nums">{dim.score}/100</span>
                      </div>
                    </div>
                    <RiscoBadge nivel={dim.risk_level} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dimensões intermediárias */}
          {dashboard.intermediate_dimensions.length > 0 && (
            <div className="bg-white rounded-xl border border-brand-border">
              <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <h2 className="text-heading-3 text-brand-text">Dimensões Intermediárias</h2>
                <span className="ml-auto text-caption bg-yellow-50 text-yellow-600 font-semibold px-2 py-0.5 rounded-full">
                  {dashboard.intermediate_dimensions.length}
                </span>
              </div>
              <div className="divide-y divide-brand-border">
                {dashboard.intermediate_dimensions.map((dim, i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center justify-between hover:bg-brand-bg-subtle transition-colors">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-body font-medium text-brand-text">{dim.dimension_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 max-w-[120px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-yellow-500" style={{ width: `${dim.score}%` }} />
                        </div>
                        <span className="text-caption text-brand-muted tabular-nums">{dim.score}/100</span>
                      </div>
                    </div>
                    <RiscoBadge nivel={dim.risk_level} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ─── Department Analysis ─── */}
      {dashboard.departments.length > 0 && !isScoreRestricted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Chart - only show departments that are not sector-restricted */}
          <div className="bg-white rounded-xl border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h2 className="text-heading-3 text-brand-text">Score por Departamento</h2>
            </div>
            <div className="p-4">
              <DepartmentBarChart data={dashboard.departments.filter(d => !d.is_sector_restricted)} />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-brand-border">
            <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="text-heading-3 text-brand-text">Detalhes por Departamento</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-bg-subtle">
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2.5">Setor</th>
                    <th className="text-center text-label-upper text-brand-muted px-4 py-2.5">Risco</th>
                    <th className="text-center text-label-upper text-brand-muted px-4 py-2.5">Avaliados</th>
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2.5 min-w-[100px]">Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {dashboard.departments
                    .sort((a, b) => b.average_score - a.average_score)
                    .map((dept) => (
                      <tr key={dept.department_id} className="hover:bg-brand-bg-subtle transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-body-sm font-medium text-brand-text">{dept.department_name}</span>
                        </td>
                        {dept.is_sector_restricted ? (
                          <td colSpan={3} className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
                              <Lock className="w-3 h-3" />
                              Dados não disponíveis (mínimo {dashboard.anonymity_thresholds?.sector_min ?? 3} respondentes).
                            </span>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-center">
                              <RiscoBadge nivel={dept.risk_level} />
                            </td>
                            <td className="px-4 py-3 text-center text-body-sm text-brand-text tabular-nums">
                              {dept.evaluated_employees}/{dept.total_employees}
                            </td>
                            <td className="px-4 py-3">
                              <ProgressBar value={dept.evaluated_employees} max={dept.total_employees} color={dept.risk_level === "risk" ? "orange" : dept.risk_level === "healthy" ? "green" : "yellow"} />
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

      {/* ─── Score por Função ─── */}
      {!isScoreRestricted && dashboard.job_roles && dashboard.job_roles.length > 0 && (
        <div className="bg-white rounded-xl border border-brand-border mb-6">
          <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <h2 className="text-heading-3 text-brand-text">Score por Função</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg-subtle">
                  <th className="text-left text-label-upper text-brand-muted px-4 py-2.5">Função</th>
                  <th className="text-center text-label-upper text-brand-muted px-4 py-2.5">Score</th>
                  <th className="text-center text-label-upper text-brand-muted px-4 py-2.5">Risco</th>
                  <th className="text-center text-label-upper text-brand-muted px-4 py-2.5">Avaliados</th>
                  <th className="text-left text-label-upper text-brand-muted px-4 py-2.5 min-w-[100px]">Indicador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {dashboard.job_roles
                  .sort((a: { average_score: number }, b: { average_score: number }) => b.average_score - a.average_score)
                  .map((role: { job_role_id: number; job_role_title: string; average_score: number; risk_level: string; evaluated_employees: number; total_employees: number; is_sector_restricted?: boolean }) => (
                  <tr key={role.job_role_id} className="hover:bg-brand-bg-subtle/50 transition-colors">
                    <td className="px-4 py-3 text-body-sm font-medium text-brand-text">{role.job_role_title}</td>
                    {role.is_sector_restricted ? (
                      <td colSpan={4} className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
                          <Lock className="w-3 h-3" />
                          Dados não disponíveis (mínimo {dashboard.anonymity_thresholds?.sector_min ?? 3} respondentes).
                        </span>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-center text-body-sm font-bold text-brand-text">{role.average_score}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            role.risk_level === "healthy" ? "bg-green-50 text-green-700" :
                            role.risk_level === "intermediate" ? "bg-yellow-50 text-yellow-700" :
                            "bg-red-50 text-red-700"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              role.risk_level === "healthy" ? "bg-green-500" :
                              role.risk_level === "intermediate" ? "bg-yellow-500" :
                              "bg-red-500"
                            }`} />
                            {role.risk_level === "healthy" ? "Saudável" : role.risk_level === "intermediate" ? "Intermediário" : "Crítico"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-body-sm text-brand-text">
                          {role.evaluated_employees}/{role.total_employees}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-2 rounded-full transition-all ${
                                role.risk_level === "healthy" ? "bg-green-500" :
                                role.risk_level === "intermediate" ? "bg-yellow-500" :
                                "bg-red-500"
                              }`} style={{ width: `${role.average_score}%` }} />
                            </div>
                            <span className="text-caption text-brand-muted w-8">{role.average_score}</span>
                          </div>
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

      {/* ─── Compliance ─── */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Painel de Compliance */}
        <div className="bg-white rounded-xl border border-brand-border">
          <div className="px-5 py-4 border-b border-brand-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-heading-3 text-brand-text">Compliance Regulatório</h2>
          </div>
          <div className="p-5 space-y-2">
            <div className={`flex items-center gap-3 p-3 rounded-lg ${dashboard.completed_campaigns > 0 ? "bg-green-50/60" : "bg-orange-50/60"}`}>
              {dashboard.completed_campaigns > 0 ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <Clock className="w-5 h-5 text-orange-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-brand-text">Avaliação de Riscos Psicossociais</p>
                <p className="text-caption text-brand-muted">
                  {dashboard.completed_campaigns > 0
                    ? `${dashboard.completed_campaigns} ciclo(s) concluído(s)`
                    : "Nenhuma avaliação concluída"}
                </p>
              </div>
              <span className={`text-caption font-semibold px-2 py-0.5 rounded-full ${
                dashboard.completed_campaigns > 0
                  ? "text-green-600 bg-green-100"
                  : "text-orange-600 bg-orange-100"
              }`}>
                {dashboard.completed_campaigns > 0 ? "OK" : "Pendente"}
              </span>
            </div>

            <div
              className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => router.push("/pgr")}
            >
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-brand-text">PGR com Riscos Psicossociais</p>
                <p className="text-caption text-brand-muted">Inventário de riscos e plano de ação NR-01</p>
              </div>
              <span className="text-caption font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Acessar
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50/60">
              <Clock className="w-5 h-5 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-brand-text">Laudo NR-17 Ergonômico</p>
                <p className="text-caption text-brand-muted">Geração automática em breve</p>
              </div>
              <span className="text-caption font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                Em breve
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Access Footer ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => router.push("/questionnaires")}
          className="card-emotioncare hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer text-left"
        >
          <div className="card-body">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary-light text-primary">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h3 className="text-heading-3 text-brand-text">Questionários</h3>
              <ChevronRight className="w-4 h-4 text-brand-muted ml-auto" />
            </div>
            <p className="text-body-sm text-brand-muted">
              Configure e gerencie questionários de saúde mental
            </p>
          </div>
        </button>
        <button
          onClick={() => router.push("/campaigns")}
          className="card-emotioncare hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer text-left"
        >
          <div className="card-body">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <Megaphone className="w-5 h-5" />
              </div>
              <h3 className="text-heading-3 text-brand-text">Campanhas</h3>
              <ChevronRight className="w-4 h-4 text-brand-muted ml-auto" />
            </div>
            <p className="text-body-sm text-brand-muted">
              Crie e gerencie campanhas de avaliação
            </p>
          </div>
        </button>
        <button
          onClick={() => router.push("/analytics")}
          className="card-emotioncare hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer text-left"
        >
          <div className="card-body">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary-light text-primary">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-heading-3 text-brand-text">Análise</h3>
              <ChevronRight className="w-4 h-4 text-brand-muted ml-auto" />
            </div>
            <p className="text-body-sm text-brand-muted">
              Visualize resultados e relatórios consolidados
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
