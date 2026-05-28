"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { JobRole, PaginatedResponse } from "@/types";
import DataTable, { Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isCompanyAdminOrAbove } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { usePageSize } from "@/hooks/use-page-size";
import { Pencil, Trash2 } from "lucide-react";

export default function JobRolesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const canEdit = isCompanyAdminOrAbove();
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize("job-roles");
  const [data, setData] = useState<JobRole[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<JobRole>>("/job-roles/", {
        page,
        page_size: pageSize,
        search: search || undefined,
        company_id: companyId || undefined,
      });
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao carregar funções.");
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
    await confirmAction({
      message: "Tem certeza que deseja excluir esta função?",
      variant: "danger",
      confirmLabel: "Excluir",
      onConfirm: async () => {
        try {
          await api.delete(`/job-roles/${id}`);
          toast("success", "Função excluída com sucesso.");
          loadData();
        } catch (err: unknown) {
          toast("error", err instanceof Error ? err.message : "Erro ao excluir função.");
        }
      },
    });
  };

  const columns: Column<JobRole>[] = [
    { key: "title", label: "Título" },
    { key: "description", label: "Descrição" },
    {
      key: "is_active",
      label: "Status",
      render: (item) => (
        <span className={item.is_active ? "badge badge-success" : "badge badge-neutral"}>
          {item.is_active ? "Ativa" : "Inativa"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Funções / Cargos</h1>
        <p className="page-subtitle">
          Gerencie as funções e cargos da sua empresa.
        </p>
      </div>

      <DataTable
        title="Funções cadastradas"
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchPlaceholder="Buscar funções..."
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
        onAdd={canEdit ? () => router.push("/job-roles/new") : undefined}
        addLabel="Nova Função"
        actions={
          canEdit
            ? (item) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => router.push(`/job-roles/${item.id}/edit`)}
                    className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-md hover:bg-error-bg text-brand-muted hover:text-error transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            : undefined
        }
        onRowClick={(item) => router.push(`/job-roles/${item.id}/edit`)}
        emptyMessage="Nenhuma função cadastrada."
      />
    </div>
  );
}
