"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Campaign, PaginatedResponse } from "@/types";
import DataTable, { Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isMedicalOrAbove, isCompanyAdminOrAbove } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { usePageSize } from "@/hooks/use-page-size";
import {
  Pencil,
  Trash2,
  Eye,
  BarChart3,
  Lock,
  Unlock,
  Calendar,
  Users,
  TrendingUp,
  Megaphone,
} from "lucide-react";

// ─── Filter types ────────────────────────────────────────

type StatusFilter = "all" | "in_progress" | "completed" | "draft" | "cancelled";
type PeriodFilter = "all" | "last_month" | "last_3_months" | "this_year";

const statusTabs: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "in_progress", label: "Ativas" },
  { key: "completed", label: "Encerradas" },
  { key: "draft", label: "Rascunho" },
];

const periodOptions: Array<{ key: PeriodFilter; label: string }> = [
  { key: "all", label: "Qualquer periodo" },
  { key: "last_month", label: "Ultimo mes" },
  { key: "last_3_months", label: "Ultimos 3 meses" },
  { key: "this_year", label: "Este ano" },
];

function getDateFilterRange(period: PeriodFilter): { from?: string; to?: string } {
  if (period === "all") return {};
  const now = new Date();
  let from: Date;
  switch (period) {
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case "last_3_months":
      from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case "this_year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return {};
  }
  return { from: from.toISOString().split("T")[0] };
}

// ─── Summary Cards ───────────────────────────────────────

function CampaignSummaryCards({ campaigns }: { campaigns: Campaign[] }) {
  const active = campaigns.filter(
    (c) => c.status === "in_progress" || c.status === "sending"
  ).length;
  const totalResponses = campaigns.reduce(
    (sum, c) => sum + (c.total_responses || 0),
    0
  );
  const avgRate =
    campaigns.length > 0
      ? Math.round(
          campaigns.reduce((sum, c) => sum + (c.response_rate || 0), 0) /
            campaigns.length
        )
      : 0;

  const items = [
    {
      label: "Campanhas Ativas",
      value: active,
      icon: Megaphone,
      color: "bg-accent/10 text-accent",
    },
    {
      label: "Total de Campanhas",
      value: campaigns.length,
      icon: Calendar,
      color: "bg-primary-light text-primary",
    },
    {
      label: "Respostas Totais",
      value: totalResponses,
      icon: Users,
      color: "bg-info-bg text-info",
    },
    {
      label: "Taxa Media",
      value: `${avgRate}%`,
      icon: TrendingUp,
      color:
        avgRate >= 80
          ? "bg-green-50 text-green-600"
          : avgRate >= 50
          ? "bg-yellow-50 text-yellow-600"
          : "bg-red-50 text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-brand-border p-3 flex items-center gap-3"
        >
          <div className={`p-2 rounded-lg ${item.color}`}>
            <item.icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-caption text-brand-muted">{item.label}</p>
            <p className="text-heading-3 text-brand-text">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const canEdit = isMedicalOrAbove();
  const canDelete = isCompanyAdminOrAbove();
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize("campaigns");
  const [data, setData] = useState<Campaign[]>([]);
  const [allData, setAllData] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
        search: search || undefined,
        company_id: companyId || undefined,
      };

      // Add status filter
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      // Add period filter
      const dateRange = getDateFilterRange(periodFilter);
      if (dateRange.from) {
        params.start_date_from = dateRange.from;
      }

      const res = await api.get<PaginatedResponse<Campaign>>(
        "/campaigns/",
        params
      );
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar campanhas."
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, companyId, statusFilter, periodFilter]);

  // Load all campaigns for summary (without filters)
  const loadAllData = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
        page: 1,
        page_size: 100,
        company_id: companyId,
      });
      setAllData(res.data);
    } catch {
      // Silent
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const confirmAction = useConfirm();
  const handleDelete = async (id: number) => {
    await confirmAction({
      message: "Tem certeza que deseja excluir esta campanha?",
      variant: "danger",
      confirmLabel: "Excluir",
      onConfirm: async () => {
        try {
          await api.delete(`/campaigns/${id}`);
          toast("success", "Campanha excluida com sucesso.");
          loadData();
          loadAllData();
        } catch (err: unknown) {
          toast(
            "error",
            err instanceof Error ? err.message : "Erro ao excluir campanha."
          );
        }
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: "Rascunho", className: "badge badge-neutral" },
      sending: { label: "Enviando", className: "badge badge-info" },
      in_progress: {
        label: "Em Andamento",
        className: "badge badge-success",
      },
      completed: { label: "Concluida", className: "badge badge-neutral" },
      cancelled: { label: "Cancelada", className: "badge badge-error" },
    };
    const statusInfo = statusMap[status] || statusMap.draft;
    return <span className={statusInfo.className}>{statusInfo.label}</span>;
  };

  const columns: Column<Campaign>[] = [
    { key: "name", label: "Nome" },
    { key: "config_name", label: "Questionario", mobileHidden: true },
    {
      key: "status",
      label: "Status",
      render: (item) => getStatusBadge(item.status),
    },
    {
      key: "start_date",
      label: "Periodo",
      mobileHidden: true,
      render: (item) => {
        const start = item.start_date
          ? new Date(item.start_date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })
          : "--";
        const end = item.deadline
          ? new Date(item.deadline).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })
          : "--";
        return (
          <span className="text-body-sm text-brand-text">
            {start} - {end}
          </span>
        );
      },
    },
    {
      key: "total_participants",
      label: "Respostas",
      render: (item) => {
        const responses = item.total_responses || 0;
        const participants = item.total_participants || 0;
        return (
          <span className="text-body-sm tabular-nums">
            {responses}/{participants}
          </span>
        );
      },
      mobileHidden: true,
    },
    {
      key: "response_rate",
      label: "Participacao",
      render: (item) => {
        const rate = item.response_rate || 0;
        const barColor =
          rate >= 80
            ? "bg-green-500"
            : rate >= 50
            ? "bg-yellow-500"
            : "bg-red-500";
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <span className="text-caption text-brand-text tabular-nums w-8 text-right">
              {rate}%
            </span>
          </div>
        );
      },
      mobileHidden: true,
    },
    {
      key: "total_responses",
      label: "Score",
      mobileHidden: true,
      render: (item) => {
        const available = (item.total_responses || 0) >= 4;
        return available ? (
          <span className="inline-flex items-center gap-1 text-caption text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
            <Unlock className="w-3 h-3" />
            Liberado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-caption text-brand-muted bg-brand-bg-muted px-1.5 py-0.5 rounded-full">
            <Lock className="w-3 h-3" />
            Bloqueado
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Campanhas</h1>
          <p className="page-subtitle">
            Gerencie as campanhas de avaliacao de saude mental.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {allData.length > 0 && <CampaignSummaryCards campaigns={allData} />}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-brand-border p-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-brand-bg-muted rounded-lg p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors ${
                  statusFilter === tab.key
                    ? "bg-white text-brand-text shadow-xs"
                    : "text-brand-muted hover:text-brand-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Period Filter */}
          <select
            value={periodFilter}
            onChange={(e) => {
              setPeriodFilter(e.target.value as PeriodFilter);
              setPage(1);
            }}
            className="input-emotioncare h-[36px] text-body-sm w-auto"
          >
            {periodOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Active filter indicators */}
          {(statusFilter !== "all" || periodFilter !== "all") && (
            <button
              onClick={() => {
                setStatusFilter("all");
                setPeriodFilter("all");
                setPage(1);
              }}
              className="text-caption text-accent hover:text-accent-hover font-medium transition-colors ml-auto"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <DataTable
        title="Campanhas cadastradas"
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchPlaceholder="Buscar por nome..."
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={pageSizeOptions}
        onAdd={canEdit ? () => router.push("/campaigns/new") : undefined}
        addLabel="Nova Campanha"
        actions={(item) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => router.push(`/campaigns/${item.id}`)}
              className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
              title="Ver Detalhes"
            >
              <Eye size={16} />
            </button>
            {(item.status === "completed" ||
              (item.total_responses || 0) >= 4) && (
              <button
                onClick={() => router.push(`/campaigns/${item.id}/results`)}
                className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
                title="Ver Resultados"
              >
                <BarChart3 size={16} />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => router.push(`/campaigns/${item.id}/edit`)}
                className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
                title="Editar"
              >
                <Pencil size={16} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(item.id)}
                className="p-1.5 rounded-md hover:bg-error-bg text-brand-muted hover:text-error transition-colors"
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
        onRowClick={(item) => router.push(`/campaigns/${item.id}`)}
        emptyMessage="Nenhuma campanha cadastrada."
      />
    </div>
  );
}
