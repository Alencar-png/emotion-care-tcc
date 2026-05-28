"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Company, PaginatedResponse } from "@/types";
import DataTable, { Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { isSuperAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { usePageSize } from "@/hooks/use-page-size";
import { Pencil, Trash2 } from "lucide-react";

export default function CompaniesPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Proteger página - apenas SUPER_ADMIN
  useEffect(() => {
    if (!isSuperAdmin()) {
      router.replace("/");
    }
  }, [router]);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize("companies");
  const [data, setData] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Company>>("/companies/", {
        page,
        page_size: pageSize,
        search: search || undefined,
      });
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao carregar empresas.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmAction = useConfirm();
  const handleDelete = async (id: number) => {
    await confirmAction({
      message: "Tem certeza que deseja excluir esta empresa?",
      variant: "danger",
      confirmLabel: "Excluir",
      onConfirm: async () => {
        try {
          await api.delete(`/companies/${id}`);
          toast("success", "Empresa excluída com sucesso.");
          loadData();
        } catch (err: unknown) {
          toast("error", err instanceof Error ? err.message : "Erro ao excluir empresa.");
        }
      },
    });
  };

  const columns: Column<Company>[] = [
    { key: "name", label: "Razão Social" },
    { key: "trade_name", label: "Nome Fantasia" },
    {
      key: "cnpj",
      label: "CNPJ",
      render: (item) => formatCnpj(item.cnpj),
    },
    { key: "email", label: "E-mail", mobileHidden: true },
    { key: "responsible_name", label: "Responsável", mobileHidden: true },
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
        <h1 className="page-title">Empresas</h1>
        <p className="page-subtitle">
          Gerencie as empresas contratantes da plataforma.
        </p>
      </div>

      <DataTable
        title="Empresas cadastradas"
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchPlaceholder="Buscar por nome, CNPJ ou e-mail..."
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
        onAdd={() => router.push("/companies/new")}
        addLabel="Nova Empresa"
        actions={(item) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => router.push(`/companies/${item.id}/edit`)}
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
        )}
        onRowClick={(item) => router.push(`/companies/${item.id}/edit`)}
        emptyMessage="Nenhuma empresa cadastrada."
      />
    </div>
  );
}

function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
