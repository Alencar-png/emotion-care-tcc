"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { Company, CompanyCreate, CompanyUpdate } from "@/types";
import {
  ArrowLeft,
  Building2,
  MapPin,
  UserCheck,
  Loader2,
} from "lucide-react";

interface CompanyFormProps {
  company?: Company;
  mode: "create" | "edit";
}

export default function CompanyForm({ company, mode }: CompanyFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: company?.name || "",
    trade_name: company?.trade_name || "",
    cnpj: company?.cnpj || "",
    email: company?.email || "",
    phone: company?.phone || "",
    address: company?.address || "",
    city: company?.city || "",
    state: company?.state || "",
    zip_code: company?.zip_code || "",
    responsible_name: company?.responsible_name || "",
    responsible_email: company?.responsible_email || "",
    responsible_phone: company?.responsible_phone || "",
    max_employees: company?.max_employees || 50,
    is_active: company?.is_active ?? true,
  });

  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
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

  const formatCEP = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    return digits.replace(/^(\d{5})(\d)/, "$1-$2");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    let formattedValue: string | number | boolean = value;
    if (name === "cnpj") formattedValue = formatCNPJ(value);
    else if (name === "phone" || name === "responsible_phone") formattedValue = formatPhone(value);
    else if (name === "zip_code") formattedValue = formatCEP(value);
    else if (type === "number") formattedValue = parseInt(value) || 0;
    else if (type === "checkbox") formattedValue = (e.target as HTMLInputElement).checked;

    setForm((prev) => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "create") {
        const payload: CompanyCreate = {
          name: form.name,
          trade_name: form.trade_name || undefined,
          cnpj: form.cnpj.replace(/\D/g, ""),
          email: form.email,
          phone: form.phone || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zip_code: form.zip_code?.replace(/\D/g, "") || undefined,
          responsible_name: form.responsible_name,
          responsible_email: form.responsible_email || undefined,
          responsible_phone: form.responsible_phone || undefined,
          max_employees: form.max_employees,
        };
        await api.post("/companies/", payload);
        toast("success", "Empresa criada com sucesso.");
      } else {
        const payload: CompanyUpdate = {};
        Object.entries(form).forEach(([key, value]) => {
          if (value !== "" && value !== null && value !== undefined) {
            (payload as Record<string, unknown>)[key] = value;
          }
        });
        if (payload.cnpj) {
          payload.cnpj = (payload.cnpj as string).replace(/\D/g, "");
        }
        if (payload.zip_code) {
          payload.zip_code = (payload.zip_code as string).replace(/\D/g, "");
        }
        await api.put(`/companies/${company!.id}`, payload);
        toast("success", "Empresa atualizada com sucesso.");
      }
      router.push("/companies");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar empresa."
      );
    } finally {
      setLoading(false);
    }
  };

  const states = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
    "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push("/companies")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para empresas
      </button>

      <div className="card-emotioncare">
        <div className="card-body">
          <h2 className="text-heading-2 text-brand-text mb-1">
            {mode === "create" ? "Nova Empresa" : "Editar Empresa"}
          </h2>
          <p className="text-body-sm text-brand-muted mb-6">
            {mode === "create"
              ? "Preencha os dados da empresa para cadastrá-la na plataforma."
              : "Atualize os dados da empresa conforme necessário."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* ─── Dados da empresa ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-heading-4 font-medium text-brand-text">Dados da Empresa</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                <div>
                  <label className="label-emotioncare">Razão Social <span className="text-red-400">*</span></label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Nome legal da empresa"
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Nome Fantasia</label>
                  <input
                    name="trade_name"
                    value={form.trade_name}
                    onChange={handleChange}
                    placeholder="Nome comercial"
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">CNPJ <span className="text-red-400">*</span></label>
                  <input
                    name="cnpj"
                    value={form.cnpj}
                    onChange={handleChange}
                    placeholder="00.000.000/0000-00"
                    required
                    maxLength={18}
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">E-mail <span className="text-red-400">*</span></label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="contato@empresa.com.br"
                    required
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
                  <label className="label-emotioncare">Limite de Funcionários <span className="text-red-400">*</span></label>
                  <input
                    name="max_employees"
                    type="number"
                    min={1}
                    value={form.max_employees}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                  />
                </div>
              </div>
            </section>

            {/* ─── Endereço ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
                <div className="p-1.5 rounded-md bg-blue-50">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-heading-4 font-medium text-brand-text">Endereço</h3>
                <span className="text-caption text-brand-muted ml-1">(opcional)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                <div className="md:col-span-2">
                  <label className="label-emotioncare">Endereço</label>
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Rua, número, complemento"
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Cidade</label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Cidade"
                    className="input-emotioncare w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-emotioncare">UF</label>
                    <select
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      className="input-emotioncare w-full"
                    >
                      <option value="">UF</option>
                      {states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-emotioncare">CEP</label>
                    <input
                      name="zip_code"
                      value={form.zip_code}
                      onChange={handleChange}
                      placeholder="00000-000"
                      maxLength={9}
                      className="input-emotioncare w-full"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ─── Responsável ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-border">
                <div className="p-1.5 rounded-md bg-amber-50">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-heading-4 font-medium text-brand-text">Responsável Técnico</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                <div className="md:col-span-2">
                  <label className="label-emotioncare">Nome do Responsável <span className="text-red-400">*</span></label>
                  <input
                    name="responsible_name"
                    value={form.responsible_name}
                    onChange={handleChange}
                    placeholder="Nome completo"
                    required
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">E-mail do Responsável</label>
                  <input
                    name="responsible_email"
                    type="email"
                    value={form.responsible_email}
                    onChange={handleChange}
                    placeholder="email@empresa.com.br"
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Telefone do Responsável</label>
                  <input
                    name="responsible_phone"
                    value={form.responsible_phone}
                    onChange={handleChange}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
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
                  <label className="text-body-sm font-medium text-brand-text">Empresa ativa</label>
                  <p className="text-caption text-brand-muted">Desmarque para desativar esta empresa</p>
                </div>
              </div>
            )}

            {/* ─── Botões ─── */}
            <div className="flex justify-end gap-3 pt-5 border-t border-brand-border">
              <button
                type="button"
                onClick={() => router.push("/companies")}
                className="btn btn-secondary btn-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-md min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : mode === "create" ? (
                  "Criar Empresa"
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
