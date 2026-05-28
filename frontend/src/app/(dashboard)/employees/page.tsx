"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Employee, PaginatedResponse } from "@/types";
import DataTable, { Column } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isMedicalOrAbove, isCompanyAdminOrAbove } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { usePageSize } from "@/hooks/use-page-size";
import { Pencil, Trash2, Upload, Send } from "lucide-react";
import SendSurveyWizard from "@/components/send-survey-wizard";

export default function EmployeesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const canEdit = isMedicalOrAbove();
  const canDelete = isCompanyAdminOrAbove();
  const canImport = isMedicalOrAbove();
  const { pageSize, setPageSize, pageSizeOptions } = usePageSize("employees");
  const [data, setData] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [surveyEmployee, setSurveyEmployee] = useState<Employee | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Employee>>("/employees/", {
        page,
        page_size: pageSize,
        search: search || undefined,
        company_id: companyId || undefined,
      });
      setData(res.data);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao carregar colaboradores.");
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
      message: "Tem certeza que deseja excluir este colaborador?",
      variant: "danger",
      confirmLabel: "Excluir",
      onConfirm: async () => {
        try {
          await api.delete(`/employees/${id}`);
          toast("success", "Colaborador excluído com sucesso.");
          loadData();
        } catch (err: unknown) {
          toast("error", err instanceof Error ? err.message : "Erro ao excluir colaborador.");
        }
      },
    });
  };

  const columns: Column<Employee>[] = [
    { key: "name", label: "Nome" },
    { key: "email", label: "E-mail", mobileHidden: true },
    { key: "department_name", label: "Setor" },
    { key: "job_role_title", label: "Função" },
    { key: "location", label: "Localidade", mobileHidden: true },
    {
      key: "is_active",
      label: "Status",
      render: (item) => (
        <span className={item.is_active ? "badge badge-success" : "badge badge-neutral"}>
          {item.is_active ? "Ativo" : "Inativo"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Colaboradores</h1>
          <p className="page-subtitle">
            Gerencie os colaboradores da sua empresa.
          </p>
        </div>
        {canImport && (
          <button
            onClick={() => router.push("/employees/import")}
            className="btn btn-secondary btn-md w-full sm:w-auto"
          >
            <Upload size={16} />
            Importar CSV/XLSX
          </button>
        )}
      </div>

      <DataTable
        title="Colaboradores cadastrados"
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchPlaceholder="Buscar por nome, e-mail ou CPF..."
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
        onAdd={canEdit ? () => router.push("/employees/new") : undefined}
        addLabel="Novo Colaborador"
        actions={(item) => (
          <div className="flex items-center justify-end gap-1">
            {canEdit && (
              <button
                onClick={() => setSurveyEmployee(item)}
                className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
                title="Enviar Questionário"
              >
                <Send size={16} />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => router.push(`/employees/${item.id}/edit`)}
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
        onRowClick={(item) => router.push(`/employees/${item.id}/edit`)}
        emptyMessage="Nenhum colaborador cadastrado."
      />

      {surveyEmployee && (
        <SendSurveyWizard
          employee={surveyEmployee}
          open={!!surveyEmployee}
          onOpenChange={(open) => {
            if (!open) setSurveyEmployee(null);
          }}
        />
      )}
    </div>
  );
}
