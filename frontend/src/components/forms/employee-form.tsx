"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  Department,
  JobRole,
  PaginatedResponse,
} from "@/types";
import { getCurrentUserFromToken } from "@/lib/auth";
import { useCompanyId } from "@/lib/contexts/company-context";
import { ArrowLeft, User, Briefcase, Loader2 } from "lucide-react";

interface EmployeeFormProps {
  employee?: Employee;
  mode: "create" | "edit";
}

export default function EmployeeForm({ employee, mode }: EmployeeFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUserFromToken();
  const selectedCompanyId = useCompanyId();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);

  const [form, setForm] = useState({
    name: employee?.name || "",
    email: employee?.email || "",
    cpf: employee?.cpf || "",
    phone: employee?.phone || "",
    department_id: employee?.department_id?.toString() || "",
    job_role_id: employee?.job_role_id?.toString() || "",
    location: employee?.location || "",
    is_active: employee?.is_active ?? true,
  });

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [depts, roles] = await Promise.all([
          api.get<PaginatedResponse<Department>>("/departments/", {
            page_size: 100,
            company_id: selectedCompanyId || undefined,
          }),
          api.get<PaginatedResponse<JobRole>>("/job-roles/", {
            page_size: 100,
            company_id: selectedCompanyId || undefined,
          }),
        ]);
        setDepartments(depts.data);
        setJobRoles(roles.data);
      } catch {
        // fallback silencioso
      }
    };
    loadOptions();
  }, []);

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    let formattedValue: string | boolean = value;
    if (name === "cpf") formattedValue = formatCPF(value);
    else if (name === "phone") formattedValue = formatPhone(value);
    else if (type === "checkbox") formattedValue = (e.target as HTMLInputElement).checked;

    setForm((prev) => ({ ...prev, [name]: formattedValue }));
  };

  const effectiveCompanyId = selectedCompanyId || user?.company_id || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "create" && !effectiveCompanyId) {
      toast("error", "Selecione uma empresa antes de criar um colaborador.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "create") {
        const payload: EmployeeCreate = {
          name: form.name,
          email: form.email || undefined,
          cpf: form.cpf?.replace(/\D/g, "") || undefined,
          phone: form.phone || undefined,
          company_id: effectiveCompanyId!,
          department_id: form.department_id
            ? parseInt(form.department_id)
            : undefined,
          job_role_id: form.job_role_id
            ? parseInt(form.job_role_id)
            : undefined,
          location: form.location || undefined,
        };
        await api.post("/employees/", payload);
        toast("success", "Colaborador criado com sucesso.");
      } else {
        const payload: EmployeeUpdate = {
          name: form.name,
          email: form.email || undefined,
          cpf: form.cpf?.replace(/\D/g, "") || undefined,
          phone: form.phone || undefined,
          department_id: form.department_id
            ? parseInt(form.department_id)
            : undefined,
          job_role_id: form.job_role_id
            ? parseInt(form.job_role_id)
            : undefined,
          location: form.location || undefined,
          is_active: form.is_active,
        };
        await api.put(`/employees/${employee!.id}`, payload);
        toast("success", "Colaborador atualizado com sucesso.");
      }
      router.push("/employees");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar colaborador."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push("/employees")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para colaboradores
      </button>

      <div className="card-emotioncare">
        <div className="card-body">
          <h2 className="text-heading-2 text-brand-text mb-1">
            {mode === "create" ? "Novo Colaborador" : "Editar Colaborador"}
          </h2>
          <p className="text-body-sm text-brand-muted mb-6">
            {mode === "create"
              ? "Cadastre um novo colaborador para participar das avaliações."
              : "Atualize os dados do colaborador."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* ─── Dados Pessoais ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-heading-4 font-medium text-brand-text">Dados Pessoais</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                <div className="md:col-span-2">
                  <label className="label-emotioncare">Nome Completo <span className="text-red-400">*</span></label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Nome do colaborador"
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">E-mail</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="email@empresa.com.br"
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Telefone</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">CPF</label>
                  <input
                    name="cpf"
                    value={form.cpf}
                    onChange={handleChange}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="input-emotioncare w-full"
                  />
                </div>
              </div>
            </section>

            {/* ─── Vínculo ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
                <div className="p-1.5 rounded-md bg-blue-50">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-heading-4 font-medium text-brand-text">Vínculo</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <label className="label-emotioncare">Setor</label>
                  <select
                    name="department_id"
                    value={form.department_id}
                    onChange={handleChange}
                    className="input-emotioncare w-full"
                  >
                    <option value="">Selecione um setor</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-emotioncare">Função / Cargo</label>
                  <select
                    name="job_role_id"
                    value={form.job_role_id}
                    onChange={handleChange}
                    className="input-emotioncare w-full"
                  >
                    <option value="">Selecione uma função</option>
                    {jobRoles.map((jr) => (
                      <option key={jr.id} value={jr.id}>
                        {jr.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-emotioncare">Localidade / Unidade</label>
                  <input
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Ex: São Paulo - SP"
                    className="input-emotioncare w-full"
                  />
                </div>
              </div>
            </section>

            {/* Status (somente em edição) */}
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
                  <label className="text-body-sm font-medium text-brand-text">Colaborador ativo</label>
                  <p className="text-caption text-brand-muted">Desmarque para desativar este colaborador</p>
                </div>
              </div>
            )}

            {/* ─── Botões ─── */}
            <div className="flex justify-end gap-3 pt-5 border-t border-brand-border">
              <button
                type="button"
                onClick={() => router.push("/employees")}
                className="btn btn-secondary btn-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-md min-w-[160px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : mode === "create" ? (
                  "Criar Colaborador"
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
