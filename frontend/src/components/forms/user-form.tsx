"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import {
  User,
  UserCreate,
  UserUpdate,
  Company,
  PaginatedResponse,
  UserRole,
} from "@/types";
import { getCurrentUserFromToken, isSuperAdmin } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";

interface UserFormProps {
  user?: User;
  mode: "create" | "edit";
}

export default function UserForm({ user, mode }: UserFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const currentUser = getCurrentUserFromToken();
  const superAdmin = isSuperAdmin();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: user?.role || UserRole.VIEWER,
    company_id: user?.company_id?.toString() || "",
  });

  useEffect(() => {
    const loadCompanies = async () => {
      if (superAdmin) {
        try {
          const res = await api.get<PaginatedResponse<Company>>("/companies/", {
            page_size: 100,
          });
          setCompanies(res.data);
        } catch {
          // fallback silencioso
        }
      }
    };
    loadCompanies();
  }, [superAdmin]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "create") {
        const payload: UserCreate = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role as UserRole,
          company_id: form.company_id
            ? parseInt(form.company_id)
            : superAdmin
            ? null
            : currentUser?.company_id || null,
        };
        await api.post("/users/", payload);
        toast("success", "Usuário criado com sucesso.");
      } else {
        const payload: UserUpdate = {
          name: form.name,
          email: form.email,
          role: form.role as UserRole,
          company_id: form.company_id
            ? parseInt(form.company_id)
            : superAdmin
            ? null
            : currentUser?.company_id || null,
        };
        if (form.password) {
          payload.password = form.password;
        }
        await api.put(`/users/${user!.id}`, payload);
        toast("success", "Usuário atualizado com sucesso.");
      }
      router.push("/users");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar usuário."
      );
    } finally {
      setLoading(false);
    }
  };

  const getAvailableRoles = (): UserRole[] => {
    if (superAdmin) {
      return [
        UserRole.SUPER_ADMIN,
        UserRole.COMPANY_ADMIN,
        UserRole.MEDICAL_TECHNICAL,
        UserRole.VIEWER,
      ];
    }
    return [
      UserRole.COMPANY_ADMIN,
      UserRole.MEDICAL_TECHNICAL,
      UserRole.VIEWER,
    ];
  };

  const roleLabels: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: "Super Administrador",
    [UserRole.COMPANY_ADMIN]: "Administrador da Empresa",
    [UserRole.MEDICAL_TECHNICAL]: "Técnico Médico",
    [UserRole.VIEWER]: "Visualizador",
  };

  return (
    <div>
      <button
        onClick={() => router.push("/users")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para usuários
      </button>

      <div className="card-emotioncare max-w-3xl">
        <div className="card-body">
          <h2 className="text-heading-2 text-brand-text mb-6">
            {mode === "create" ? "Novo Usuário" : "Editar Usuário"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="section-title">Dados do Usuário</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Nome *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">E-mail *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">
                    {mode === "create" ? "Senha *" : "Nova Senha (deixe em branco para manter)"}
                  </label>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    required={mode === "create"}
                    className="input-emotioncare w-full"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Perfil *</label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                  >
                    {getAvailableRoles().map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </div>
                {superAdmin && (
                  <div>
                    <label className="label-emotioncare">Empresa</label>
                    <select
                      name="company_id"
                      value={form.company_id}
                      onChange={handleChange}
                      className="input-emotioncare w-full"
                    >
                      <option value="">Nenhuma (Super Admin)</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-brand-border">
              <button
                type="button"
                onClick={() => router.push("/users")}
                className="btn btn-secondary btn-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-md"
              >
                {loading && <div className="spinner-brand-white" />}
                {loading
                  ? "Salvando..."
                  : mode === "create"
                  ? "Criar Usuário"
                  : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
