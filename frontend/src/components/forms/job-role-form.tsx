"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { JobRole, JobRoleCreate, JobRoleUpdate } from "@/types";
import { getCurrentUserFromToken } from "@/lib/auth";
import { useCompanyId } from "@/lib/contexts/company-context";
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react";

interface JobRoleFormProps {
  jobRole?: JobRole;
  mode: "create" | "edit";
}

export default function JobRoleForm({ jobRole, mode }: JobRoleFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUserFromToken();
  const selectedCompanyId = useCompanyId();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: jobRole?.title || "",
    description: jobRole?.description || "",
    is_active: jobRole?.is_active ?? true,
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
        const payload: JobRoleCreate = {
          title: form.title,
          description: form.description || undefined,
          company_id: selectedCompanyId || user?.company_id || 0,
        };
        await api.post("/job-roles/", payload);
        toast("success", "Função criada com sucesso.");
      } else {
        const payload: JobRoleUpdate = {
          title: form.title,
          description: form.description || undefined,
          is_active: form.is_active,
        };
        await api.put(`/job-roles/${jobRole!.id}`, payload);
        toast("success", "Função atualizada com sucesso.");
      }
      router.push("/job-roles");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar função."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <button
        onClick={() => router.push("/job-roles")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para funções
      </button>

      <div className="card-emotioncare">
        <div className="card-body">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-heading-2 text-brand-text">
              {mode === "create" ? "Nova Função" : "Editar Função"}
            </h2>
          </div>
          <p className="text-body-sm text-brand-muted mb-6 ml-[52px]">
            {mode === "create"
              ? "Cadastre uma nova função ou cargo na empresa."
              : "Atualize as informações da função."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-emotioncare">Título da Função <span className="text-red-400">*</span></label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="Ex: Analista de Sistemas"
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
                placeholder="Descreva as responsabilidades desta função..."
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
                  <label className="text-body-sm font-medium text-brand-text">Função ativa</label>
                  <p className="text-caption text-brand-muted">Desmarque para desativar esta função</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-brand-border">
              <button
                type="button"
                onClick={() => router.push("/job-roles")}
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
                  "Criar Função"
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
