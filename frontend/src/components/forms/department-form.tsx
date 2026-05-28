"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Department, DepartmentCreate, DepartmentUpdate } from "@/types";
import { getCurrentUserFromToken } from "@/lib/auth";
import { useCompanyId } from "@/lib/contexts/company-context";
import { ArrowLeft, FolderTree, Loader2 } from "lucide-react";

interface DepartmentFormProps {
  department?: Department;
  mode: "create" | "edit";
}

export default function DepartmentForm({
  department,
  mode,
}: DepartmentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUserFromToken();
  const selectedCompanyId = useCompanyId();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: department?.name || "",
    description: department?.description || "",
    is_active: department?.is_active ?? true,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "create") {
        const payload: DepartmentCreate = {
          name: form.name,
          description: form.description || undefined,
          company_id: selectedCompanyId || user?.company_id || 0,
        };
        await api.post("/departments/", payload);
        toast("success", "Setor criado com sucesso.");
      } else {
        const payload: DepartmentUpdate = {
          name: form.name,
          description: form.description || undefined,
          is_active: form.is_active,
        };
        await api.put(`/departments/${department!.id}`, payload);
        toast("success", "Setor atualizado com sucesso.");
      }
      router.push("/departments");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar setor."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <button
        onClick={() => router.push("/departments")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para setores
      </button>

      <div className="card-emotioncare">
        <div className="card-body">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <FolderTree className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-heading-2 text-brand-text">
              {mode === "create" ? "Novo Setor" : "Editar Setor"}
            </h2>
          </div>
          <p className="text-body-sm text-brand-muted mb-6 ml-[52px]">
            {mode === "create"
              ? "Cadastre um novo setor para organizar os colaboradores."
              : "Atualize as informações do setor."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-emotioncare">Nome do Setor <span className="text-red-400">*</span></label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Ex: Recursos Humanos"
                className="input-emotioncare w-full"
              />
            </div>

            <div>
              <label className="label-emotioncare">Descrição</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Descreva brevemente as atividades deste setor..."
                className="input-emotioncare w-full"
              />
            </div>

            {mode === "edit" && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-bg-subtle border border-brand-border">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                  className="checkbox-emotioncare w-4 h-4"
                />
                <div>
                  <label className="text-body-sm font-medium text-brand-text">Setor ativo</label>
                  <p className="text-caption text-brand-muted">Desmarque para desativar este setor</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-brand-border">
              <button
                type="button"
                onClick={() => router.push("/departments")}
                className="btn btn-secondary btn-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-md min-w-[120px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : mode === "create" ? (
                  "Criar Setor"
                ) : (
                  "Salvar"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
