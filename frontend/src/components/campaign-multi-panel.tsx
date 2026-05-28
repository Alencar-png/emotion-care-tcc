"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  ChevronDown,
  Eye,
  Bell,
  FileText,
  Lock,
  Unlock,
  Calendar,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Campaign } from "@/types";

// ─── Status helpers ─────────────────────────────────────

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  draft: { label: "Rascunho", badgeClass: "badge badge-neutral" },
  sending: { label: "Enviando", badgeClass: "badge badge-info" },
  in_progress: { label: "Em Andamento", badgeClass: "badge badge-success" },
  completed: { label: "Concluida", badgeClass: "badge badge-neutral" },
  cancelled: { label: "Cancelada", badgeClass: "badge badge-error" },
};

function getStatusInfo(status: string) {
  return statusConfig[status] || statusConfig.draft;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function getParticipationRate(campaign: Campaign): number {
  const total = campaign.total_participants || 0;
  if (total === 0) return 0;
  return Math.round(((campaign.total_responses || 0) / total) * 100);
}

function isScoreAvailable(campaign: Campaign): boolean {
  return (campaign.total_responses || 0) >= 4;
}

// ─── Campaign Dropdown Selector ─────────────────────────

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function CampaignSelector({ campaigns, selectedId, onSelect }: CampaignSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = campaigns.find((c) => c.id === selectedId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-brand-border bg-white hover:bg-brand-bg-subtle transition-colors text-body-sm text-brand-text min-w-[220px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Megaphone className="w-4 h-4 text-accent shrink-0" />
        <span className="truncate flex-1 text-left">
          {selected ? selected.name : "Selecionar campanha"}
        </span>
        <ChevronDown className={`w-4 h-4 text-brand-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1 w-full min-w-[280px] bg-white border border-brand-border rounded-lg shadow-md py-1 max-h-[260px] overflow-y-auto"
          role="listbox"
        >
          {campaigns.map((c) => {
            const info = getStatusInfo(c.status);
            const rate = getParticipationRate(c);
            return (
              <button
                key={c.id}
                role="option"
                aria-selected={c.id === selectedId}
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 hover:bg-brand-bg-subtle transition-colors flex items-center gap-3 ${
                  c.id === selectedId ? "bg-primary-lighter" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-brand-text truncate">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={info.badgeClass}>{info.label}</span>
                    <span className="text-caption text-brand-muted">{rate}% resp.</span>
                  </div>
                </div>
                {c.id === selectedId && (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}

          {campaigns.length === 0 && (
            <div className="px-3 py-4 text-center text-caption text-brand-muted">
              Nenhuma campanha encontrada.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Campaign Status Card ────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  onViewResults: () => void;
  onSendReminders: () => void;
  onGeneratePGR: () => void;
}

function CampaignCard({ campaign, onViewResults, onSendReminders, onGeneratePGR }: CampaignCardProps) {
  const rate = getParticipationRate(campaign);
  const scoreAvailable = isScoreAvailable(campaign);
  const statusInfo = getStatusInfo(campaign.status);
  const totalResponses = campaign.total_responses || 0;
  const totalParticipants = campaign.total_participants || 0;

  const rateColor =
    rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="bg-white rounded-xl border border-brand-border p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-heading-3 text-brand-text truncate">{campaign.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className={statusInfo.badgeClass}>{statusInfo.label}</span>
            {scoreAvailable ? (
              <span className="inline-flex items-center gap-1 text-caption text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                <Unlock className="w-3 h-3" />
                Score disponivel
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-caption text-brand-muted bg-brand-bg-muted px-1.5 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                Min. 4 respostas
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          <div className="min-w-0">
            <p className="text-caption text-brand-muted">Periodo</p>
            <p className="text-body-sm font-medium text-brand-text">
              {formatDate(campaign.start_date)} - {formatDate(campaign.deadline)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          <div>
            <p className="text-caption text-brand-muted">Respostas</p>
            <p className="text-body-sm font-medium text-brand-text">
              {totalResponses}/{totalParticipants}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          <div>
            <p className="text-caption text-brand-muted">Participacao</p>
            <p className="text-body-sm font-medium text-brand-text">{rate}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scoreAvailable ? (
            <Unlock className="w-3.5 h-3.5 text-green-600 shrink-0" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          )}
          <div>
            <p className="text-caption text-brand-muted">Score</p>
            <p className={`text-body-sm font-medium ${scoreAvailable ? "text-green-600" : "text-brand-muted"}`}>
              {scoreAvailable ? "Liberado" : "Bloqueado"}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-caption text-brand-muted">Progresso de respostas</span>
          <span className="text-caption font-medium text-brand-text">{rate}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${rateColor}`}
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onViewResults}
          className="btn btn-sm btn-secondary"
          disabled={!scoreAvailable}
        >
          <Eye className="w-3.5 h-3.5" />
          Ver Resultados
        </button>
        <button
          onClick={onSendReminders}
          className="btn btn-sm btn-secondary"
          disabled={campaign.status !== "in_progress"}
        >
          <Bell className="w-3.5 h-3.5" />
          Enviar Lembretes
        </button>
        <button
          onClick={onGeneratePGR}
          className="btn btn-sm btn-secondary"
          disabled={!scoreAvailable}
        >
          <FileText className="w-3.5 h-3.5" />
          Gerar PGR
        </button>
      </div>
    </div>
  );
}

// ─── Overview Summary Cards ──────────────────────────────

interface CampaignOverviewProps {
  campaigns: Campaign[];
}

export function CampaignOverviewCards({ campaigns }: CampaignOverviewProps) {
  const activeCampaigns = campaigns.filter(
    (c) => c.status === "in_progress" || c.status === "sending"
  );

  const totalActive = activeCampaigns.length;

  const totalResponses = activeCampaigns.reduce(
    (sum, c) => sum + (c.total_responses || 0),
    0
  );

  const avgParticipation =
    activeCampaigns.length > 0
      ? Math.round(
          activeCampaigns.reduce((sum, c) => sum + getParticipationRate(c), 0) /
            activeCampaigns.length
        )
      : 0;

  const needsAttention = activeCampaigns.filter((c) => {
    const rate = getParticipationRate(c);
    const nearDeadline =
      c.deadline &&
      new Date(c.deadline).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
    return rate < 50 || nearDeadline;
  });

  const items = [
    {
      label: "Campanhas Ativas",
      value: totalActive,
      icon: Megaphone,
      color: "bg-accent/10 text-accent",
    },
    {
      label: "Respostas Totais",
      value: totalResponses,
      icon: Users,
      color: "bg-primary-light text-primary",
    },
    {
      label: "Participacao Media",
      value: `${avgParticipation}%`,
      icon: TrendingUp,
      color: avgParticipation >= 80 ? "bg-green-50 text-green-600" : avgParticipation >= 50 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600",
    },
    {
      label: "Atencao Necessaria",
      value: needsAttention.length,
      icon: needsAttention.length > 0 ? AlertTriangle : CheckCircle2,
      color: needsAttention.length > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-brand-border p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-brand-muted font-medium">{item.label}</p>
          </div>
          <p className="text-2xl font-bold text-brand-text">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Needs Attention List ────────────────────────────────

function AttentionList({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();

  const attentionItems = useMemo(() => {
    const items: Array<{
      campaign: Campaign;
      reason: string;
      severity: "warning" | "error";
    }> = [];

    campaigns.forEach((c) => {
      if (c.status !== "in_progress" && c.status !== "sending") return;

      const rate = getParticipationRate(c);
      if (rate < 30) {
        items.push({ campaign: c, reason: "Taxa de resposta muito baixa", severity: "error" });
      } else if (rate < 50) {
        items.push({ campaign: c, reason: "Taxa de resposta abaixo de 50%", severity: "warning" });
      }

      if (c.deadline) {
        const daysLeft = Math.ceil(
          (new Date(c.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 3 && daysLeft > 0) {
          items.push({
            campaign: c,
            reason: `Encerra em ${daysLeft} dia(s)`,
            severity: "error",
          });
        } else if (daysLeft <= 7 && daysLeft > 3) {
          items.push({
            campaign: c,
            reason: `Encerra em ${daysLeft} dias`,
            severity: "warning",
          });
        }
      }
    });

    return items;
  }, [campaigns]);

  if (attentionItems.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-brand-border">
      <div className="px-5 py-3 border-b border-brand-border flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="text-heading-4 text-brand-text">Campanhas que precisam de atencao</h3>
        <span className="ml-auto text-caption bg-warning-bg text-warning font-semibold px-2 py-0.5 rounded-full">
          {attentionItems.length}
        </span>
      </div>
      <div className="divide-y divide-brand-border">
        {attentionItems.map((item, i) => (
          <button
            key={`${item.campaign.id}-${i}`}
            onClick={() => router.push(`/campaigns/${item.campaign.id}`)}
            className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-brand-bg-subtle transition-colors"
          >
            {item.severity === "error" ? (
              <AlertTriangle className="w-4 h-4 text-error shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-warning shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-medium text-brand-text truncate">
                {item.campaign.name}
              </p>
              <p className="text-caption text-brand-muted">{item.reason}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-brand-muted shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Multi-Campaign Panel ───────────────────────────

export interface CampaignMultiPanelProps {
  campaigns: Campaign[];
  loading?: boolean;
  selectedCampaignId?: number | null;
  onCampaignSelect?: (id: number) => void;
}

export default function CampaignMultiPanel({
  campaigns,
  loading,
  selectedCampaignId: controlledSelectedId,
  onCampaignSelect,
}: CampaignMultiPanelProps) {
  const router = useRouter();

  // Active / recent campaigns for the selector (exclude cancelled)
  const relevantCampaigns = useMemo(
    () =>
      campaigns
        .filter((c) => c.status !== "cancelled")
        .sort((a, b) => {
          // Active first, then by start_date desc
          const statusOrder: Record<string, number> = {
            in_progress: 0,
            sending: 1,
            draft: 2,
            completed: 3,
          };
          const orderA = statusOrder[a.status] ?? 4;
          const orderB = statusOrder[b.status] ?? 4;
          if (orderA !== orderB) return orderA - orderB;
          return (
            new Date(b.start_date || b.created_at || "").getTime() -
            new Date(a.start_date || a.created_at || "").getTime()
          );
        }),
    [campaigns]
  );

  // Support controlled or uncontrolled mode
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(null);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const setSelectedId = (id: number) => {
    if (onCampaignSelect) {
      onCampaignSelect(id);
    } else {
      setInternalSelectedId(id);
    }
  };

  useEffect(() => {
    if (selectedId === null && relevantCampaigns.length > 0) {
      setSelectedId(relevantCampaigns[0].id);
    }
  }, [relevantCampaigns, selectedId]);

  const selectedCampaign = relevantCampaigns.find((c) => c.id === selectedId) || null;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-brand-border p-8 flex items-center justify-center">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-brand-border p-8 text-center">
        <Megaphone className="w-10 h-10 text-brand-muted mx-auto mb-3" />
        <p className="text-body font-medium text-brand-text">Nenhuma campanha cadastrada</p>
        <p className="text-body-sm text-brand-muted mt-1">
          Crie sua primeira campanha para acompanhar as avaliacoes.
        </p>
        <button
          onClick={() => router.push("/campaigns/new")}
          className="mt-4 btn btn-primary btn-sm"
        >
          Nova Campanha
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campaign Overview Summary */}
      <CampaignOverviewCards campaigns={campaigns} />

      {/* Selector + Campaign Card */}
      <div className="bg-white rounded-xl border border-brand-border">
        <div className="px-5 py-4 border-b border-brand-border flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Megaphone className="w-4 h-4 text-accent shrink-0" />
            <h2 className="text-heading-3 text-brand-text">Campanhas</h2>
            <span className="text-caption bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
              {relevantCampaigns.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CampaignSelector
              campaigns={relevantCampaigns}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <button
              onClick={() => router.push("/campaigns")}
              className="btn btn-sm btn-ghost"
            >
              Ver todas
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {selectedCampaign ? (
            <CampaignCard
              campaign={selectedCampaign}
              onViewResults={() =>
                router.push(`/campaigns/${selectedCampaign.id}/results`)
              }
              onSendReminders={() =>
                router.push(`/campaigns/${selectedCampaign.id}`)
              }
              onGeneratePGR={() => router.push("/pgr")}
            />
          ) : (
            <div className="text-center py-6">
              <p className="text-body-sm text-brand-muted">
                Selecione uma campanha para ver os detalhes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Attention List */}
      <AttentionList campaigns={campaigns} />
    </div>
  );
}
