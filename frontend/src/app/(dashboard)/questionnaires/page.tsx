"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { QuestionnaireConfig, PaginatedResponse } from "@/types";
import DataTable, { Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isMedicalOrAbove, isCompanyAdminOrAbove } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { usePageSize } from "@/hooks/use-page-size";
import { Pencil, Trash2, Eye } from "lucide-react";

export default function QuestionnairesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const canEdit = isMedicalOrAbove();
  const canDelete = isCompanyAdminOrAbove();
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize("questionnaires");
  const [data, setData] = useState<QuestionnaireConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<QuestionnaireConfig>>(
        "/questionnaires/",
        {
          page,
          page_size: pageSize,
          search: search || undefined,
          company_id: companyId || undefined,
        }
      );
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar questionários."
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmAction = useConfirm();
  const handleDelete = async (id: number) => {
    try {
      const impact = await api.get<{
        campaign_count: number;
        participant_count: number;
        response_count: number;
        campaigns: { id: number; name: string; status: string }[];
      }>(`/questionnaires/${id}/deletion-impact`);

      let message: string;
      let force = false;

      if (impact.campaign_count > 0) {
        force = true;
        const campaignNames = impact.campaigns.map((c) => `• ${c.name}`).join("\n");
        message =
          `Este questionário possui ${impact.campaign_count} campanha(s) vinculada(s), ` +
          `${impact.participant_count} participante(s) e ${impact.response_count} resposta(s).\n\n` +
          `Campanhas que serão excluídas:\n${campaignNames}\n\n` +
          `Todos os dados associados serão permanentemente removidos. Deseja continuar?`;
      } else {
        message = "Tem certeza que deseja excluir este questionário?";
      }

      await confirmAction({
        title: "Excluir questionário",
        message,
        variant: "danger",
        confirmLabel: "Excluir tudo",
        onConfirm: async () => {
          try {
            await api.delete(`/questionnaires/${id}`, { force });
            toast("success", "Questionário excluído com sucesso.");
            loadData();
          } catch (err: unknown) {
            toast("error", err instanceof Error ? err.message : "Erro ao excluir questionário.");
          }
        },
      });
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao excluir questionário."
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: "Rascunho", className: "badge badge-neutral" },
      active: { label: "Ativo", className: "badge badge-success" },
      archived: { label: "Arquivado", className: "badge badge-neutral" },
    };
    const statusInfo = statusMap[status] || statusMap.draft;
    return <span className={statusInfo.className}>{statusInfo.label}</span>;
  };

  const columns: Column<QuestionnaireConfig>[] = [
    { key: "name", label: "Nome" },
    { key: "instrument_name", label: "Instrumento", mobileHidden: true },
    {
      key: "periodicity",
      label: "Periodicidade",
      render: (item) => {
        const periodicityMap: Record<string, string> = {
          annual: "Anual",
          semiannual: "Semestral",
          quarterly: "Trimestral",
          monthly: "Mensal",
        };
        return periodicityMap[item.periodicity] || item.periodicity;
      },
      mobileHidden: true,
    },
    {
      key: "status",
      label: "Status",
      render: (item) => getStatusBadge(item.status),
    },
    {
      key: "dimension_count",
      label: "Dimensões",
      render: (item) => item.dimension_count || 0,
      mobileHidden: true,
    },
  ];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Questionários</h1>
          <p className="page-subtitle">
            Gerencie as configurações de questionários de saúde mental.
          </p>
        </div>
      </div>

      <DataTable
        title="Questionários cadastrados"
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchPlaceholder="Buscar por nome ou instrumento..."
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
        onAdd={canEdit ? () => router.push("/questionnaires/new") : undefined}
        addLabel="Novo Questionário"
        actions={(item) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => router.push(`/questionnaires/${item.id}/preview`)}
              className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
              title="Visualizar"
            >
              <Eye size={16} />
            </button>
            {canEdit && (
              <button
                onClick={() => router.push(`/questionnaires/${item.id}/edit`)}
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
        onRowClick={(item) => router.push(`/questionnaires/${item.id}/preview`)}
        emptyMessage="Nenhum questionário cadastrado."
      />
    </div>
  );
}
