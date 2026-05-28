"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { getCurrentUserFromToken } from "@/lib/auth";
import { User, UserRole } from "@/types";
import { CircleUser, Mail, Shield, Building2, Save } from "lucide-react";

const roleLabels: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super Administrador",
  [UserRole.COMPANY_ADMIN]: "Administrador da Empresa",
  [UserRole.MEDICAL_TECHNICAL]: "Técnico Médico",
  [UserRole.VIEWER]: "Visualizador",
};

const roleBadges: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "badge badge-primary",
  [UserRole.COMPANY_ADMIN]: "badge badge-info",
  [UserRole.MEDICAL_TECHNICAL]: "badge badge-success",
  [UserRole.VIEWER]: "badge badge-neutral",
};

export default function AccountPage() {
  const { toast } = useToast();
  const tokenUser = getCurrentUserFromToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);

  // Campos editáveis
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Carrega dados do usuário logado
  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      try {
        // Buscar dados completos do usuário via API /users/me/
        const user = await api.get<User>("/users/me/");
        setUserData(user);
        setName(user.name);
        setEmail(user.email);
      } catch {
        // Fallback: usar dados do token
        if (tokenUser) {
          setEmail(tokenUser.email);
        }
      } finally {
        setLoading(false);
      }
    };
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData) {
      toast("error", "Dados do usuário não carregados.");
      return;
    }

    if (name === userData.name && email === userData.email) {
      toast("info", "Nenhuma alteração foi feita.");
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        name: name || userData.name,
        email: email || userData.email,
        role: userData.role,
        company_id: userData.company_id,
      };

      const updated = await api.put<User>(
        `/users/${userData.id}`,
        payload
      );
      setUserData(updated);
      toast("success", "Perfil atualizado com sucesso.");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao atualizar perfil."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData) {
      toast("error", "Dados do usuário não carregados.");
      return;
    }

    if (!newPassword) {
      toast("error", "Informe a nova senha.");
      return;
    }

    if (newPassword.length < 6) {
      toast("error", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast("error", "As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      await api.put(`/users/${userData.id}`, {
        name: userData.name,
        email: userData.email,
        password: newPassword,
        role: userData.role,
        company_id: userData.company_id,
      });
      toast("success", "Senha alterada com sucesso.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao alterar senha."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <div className="spinner-emotioncare" />
          <span className="text-body-sm text-brand-muted">
            Carregando dados da conta...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Minha Conta</h1>
        <p className="page-subtitle">
          Visualize e edite suas informações pessoais.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* ─── Card de Informações ─── */}
        <div className="card-emotioncare">
          <div className="card-header">
            <h2 className="text-heading-3 text-brand-text">
              Informações da Conta
            </h2>
          </div>
          <div className="card-body">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary-light border-2 border-primary-border shrink-0">
                <CircleUser className="w-10 h-10 text-primary" />
              </div>

              {/* Info resumo */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <h3 className="text-heading-2 text-brand-text truncate">
                    {userData?.name || "—"}
                  </h3>
                  {userData?.role && (
                    <span className={roleBadges[userData.role]}>
                      {roleLabels[userData.role]}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-body-sm text-brand-text-2">
                    <Mail className="h-4 w-4 text-brand-muted shrink-0" />
                    <span className="truncate">
                      {userData?.email || tokenUser?.email || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-body-sm text-brand-text-2">
                    <Shield className="h-4 w-4 text-brand-muted shrink-0" />
                    <span>
                      {userData?.role
                        ? roleLabels[userData.role]
                        : tokenUser?.role
                          ? roleLabels[tokenUser.role]
                          : "—"}
                    </span>
                  </div>
                  {userData?.company_name && (
                    <div className="flex items-center gap-2 text-body-sm text-brand-text-2">
                      <Building2 className="h-4 w-4 text-brand-muted shrink-0" />
                      <span className="truncate">{userData.company_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Editar Perfil ─── */}
        <div className="card-emotioncare">
          <div className="card-header">
            <h2 className="text-heading-3 text-brand-text">Editar Perfil</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-emotioncare w-full"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-emotioncare w-full"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-md w-full sm:w-auto"
                >
                  {saving ? (
                    <div className="spinner-brand-white" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ─── Alterar Senha ─── */}
        <div className="card-emotioncare">
          <div className="card-header">
            <h2 className="text-heading-3 text-brand-text">Alterar Senha</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Nova Senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-emotioncare w-full"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-emotioncare w-full"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <p className="text-caption text-brand-muted">
                A senha deve ter pelo menos 6 caracteres.
              </p>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-md w-full sm:w-auto"
                >
                  {saving ? (
                    <div className="spinner-brand-white" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? "Salvando..." : "Alterar Senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
