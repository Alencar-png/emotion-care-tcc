"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { User, UserRole } from "@/types";
import DataTable, { Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { isSuperAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { usePageSize } from "@/hooks/use-page-size";
import { Pencil, Trash2 } from "lucide-react";

export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Proteger página - apenas SUPER_ADMIN
  useEffect(() => {
    if (!isSuperAdmin()) {
      router.replace("/");
    }
  }, [router]);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize("users");
  const [data, setData] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<User[]>("/users/");
      const filtered = search
        ? res.filter(
            (u) =>
              u.name.toLowerCase().includes(search.toLowerCase()) ||
              u.email.toLowerCase().includes(search.toLowerCase())
          )
        : res;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      setData(filtered.slice(start, end));
      setTotal(filtered.length);
      setTotalPages(Math.ceil(filtered.length / pageSize));
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao carregar usuários.");
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
      message: "Tem certeza que deseja excluir este usuário?",
      variant: "danger",
      confirmLabel: "Excluir",
      onConfirm: async () => {
        try {
          await api.delete(`/users/${id}`);
          toast("success", "Usuário excluído com sucesso.");
          loadData();
        } catch (err: unknown) {
          toast("error", err instanceof Error ? err.message : "Erro ao excluir usuário.");
        }
      },
    });
  };

  const roleLabels: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: "Super Admin",
    [UserRole.COMPANY_ADMIN]: "Admin",
    [UserRole.MEDICAL_TECHNICAL]: "Técnico",
    [UserRole.VIEWER]: "Visualizador",
  };

  const roleBadges: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: "badge badge-primary",
    [UserRole.COMPANY_ADMIN]: "badge badge-info",
    [UserRole.MEDICAL_TECHNICAL]: "badge badge-success",
    [UserRole.VIEWER]: "badge badge-neutral",
  };

  const columns: Column<User>[] = [
    { key: "name", label: "Nome" },
    { key: "email", label: "E-mail" },
    {
      key: "role",
      label: "Perfil",
      render: (item) => (
        <span className={roleBadges[item.role]}>
          {roleLabels[item.role]}
        </span>
      ),
    },
    {
      key: "company_name",
      label: "Empresa",
      render: (item) => item.company_name || "—",
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Usuários</h1>
        <p className="page-subtitle">
          Gerencie os usuários do sistema.
        </p>
      </div>

      <DataTable
        title="Usuários cadastrados"
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchPlaceholder="Buscar por nome ou e-mail..."
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
        onAdd={() => router.push("/users/new")}
        addLabel="Novo Usuário"
        actions={(item) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => router.push(`/users/${item.id}/edit`)}
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
        onRowClick={(item) => router.push(`/users/${item.id}/edit`)}
        emptyMessage="Nenhum usuário cadastrado."
      />
    </div>
  );
}
