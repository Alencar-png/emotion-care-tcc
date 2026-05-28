"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  AdminResponseListItem,
  PaginatedResponse,
  CampaignFilterItem,
} from "@/types";
import DataTable, { Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isCompanyAdminOrAbove, isSuperAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { usePageSize } from "@/hooks/use-page-size";
import { Eye, Trash2, CheckCircle2, Clock, Filter } from "lucide-react";

export default function ResponsesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const superAdmin = isSuperAdmin();
  const canDelete = isCompanyAdminOrAbove();
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize("responses");
  const [data, setData] = useState<AdminResponseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [campaigns, setCampaigns] = useState<CampaignFilterItem[]>([]);

  // Redirecionar se não for super admin
  useEffect(() => {
    if (!superAdmin) {
      router.push("/dashboard");
    }
  }, [superAdmin, router]);

  // Carregar lista de campanhas para filtro
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const res = await api.get<CampaignFilterItem[]>(
          "/admin/responses/campaigns/list",
          { company_id: companyId || undefined }
        );
        setCampaigns(res);
      } catch {
        // silencioso
      }
    };
    loadCampaigns();
  }, [companyId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;
      if (campaignFilter) params.campaign_id = campaignFilter;
      if (statusFilter) params.status = statusFilter;
      if (companyId) params.company_id = companyId;

      const res = await api.get<PaginatedResponse<AdminResponseListItem>>(
        "/admin/responses/",
        params
      );
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar respostas."
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, campaignFilter, statusFilter, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmAction = useConfirm();
  const handleDelete = async (id: number) => {
    await confirmAction({
      message: "Tem certeza que deseja excluir esta resposta? Esta ação não pode ser desfeita.",
      variant: "danger",
      confirmLabel: "Excluir",
      onConfirm: async () => {
        try {
          await api.delete(`/admin/responses/${id}`);
          toast("success", "Resposta excluída com sucesso.");
          loadData();
        } catch (err: unknown) {
          toast("error", err instanceof Error ? err.message : "Erro ao excluir resposta.");
        }
      },
    });
  };

  const getStatusBadge = (isComplete: boolean) => {
    if (isComplete) {
      return (
        <span className="badge badge-success inline-flex items-center gap-1">
          <CheckCircle2 size={12} />
          Completa
        </span>
      );
    }
    return (
      <span className="badge badge-neutral inline-flex items-center gap-1">
        <Clock size={12} />
        Parcial
      </span>
    );
  };

  const columns: Column<AdminResponseListItem>[] = [
    {
      key: "employee_name",
      label: "Participante",
      render: (item) => (
        <div>
          <p className="text-body-sm font-medium text-brand-text">
            {item.employee_name || "—"}
          </p>
          <p className="text-xs text-brand-muted">{item.employee_email || ""}</p>
        </div>
      ),
    },
    {
      key: "campaign_name",
      label: "Campanha",
      mobileHidden: true,
    },
    {
      key: "department_name",
      label: "Setor",
      render: (item) => item.department_name || "—",
      mobileHidden: true,
    },
    {
      key: "is_complete",
      label: "Status",
      render: (item) => getStatusBadge(item.is_complete),
    },
    {
      key: "total_answers",
      label: "Respostas",
      render: (item) => `${item.total_answers} itens`,
      mobileHidden: true,
    },
    {
      key: "completed_at",
      label: "Data",
      render: (item) => {
        const date = item.completed_at || item.started_at;
        return date ? new Date(date).toLocaleString("pt-BR") : "—";
      },
      mobileHidden: true,
    },
  ];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Respostas</h1>
          <p className="page-subtitle">
            Visualize todas as respostas dos formulários de avaliação.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-emotioncare mb-4">
        <div className="card-body py-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 text-brand-muted">
              <Filter size={16} />
              <span className="text-body-sm font-medium">Filtros:</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <select
                value={campaignFilter}
                onChange={(e) => {
                  setCampaignFilter(
                    e.target.value ? parseInt(e.target.value) : ""
                  );
                  setPage(1);
                }}
                className="input-emotioncare text-sm h-9 min-w-[200px]"
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="input-emotioncare text-sm h-9 min-w-[160px]"
              >
                <option value="">Todos os status</option>
                <option value="complete">Completas</option>
                <option value="incomplete">Parciais</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        title="Respostas recebidas"
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchPlaceholder="Buscar por participante..."
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
        actions={(item) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => router.push(`/responses/${item.id}`)}
              className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
              title="Ver Detalhes"
            >
              <Eye size={16} />
            </button>
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
        onRowClick={(item) => router.push(`/responses/${item.id}`)}
        emptyMessage="Nenhuma resposta encontrada."
      />
    </div>
  );
}
