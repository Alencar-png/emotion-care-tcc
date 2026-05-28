"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useCompanyId } from "@/lib/contexts/company-context";
import { useToast } from "@/components/toast";
import { OnboardingStatusResponse, Department, PaginatedResponse } from "@/types";
import { cn } from "@/lib/utils";
import {
  PartyPopper,
  FolderTree,
  Users,
  Calendar,
  Rocket,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Building2,
} from "lucide-react";

const STEPS = [
  { label: "Boas-vindas", icon: PartyPopper },
  { label: "Setores / GHEs", icon: FolderTree },
  { label: "Colaboradores", icon: Users },
  { label: "Agendar Call", icon: Calendar },
  { label: "Proximos Passos", icon: Rocket },
] as const;

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-white",
                  isCurrent && "border-primary text-primary bg-primary/5",
                  !isCompleted && !isCurrent && "border-brand-border text-brand-muted"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  isCurrent ? "text-primary" : "text-brand-muted"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 mx-1 mt-[-18px]",
                  stepNum < currentStep ? "bg-primary" : "bg-brand-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingStatusResponse | null>(null);

  // Step 1 - Company data
  const [companyForm, setCompanyForm] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    responsible_name: "",
  });
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Step 2 - Departments
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [addingDept, setAddingDept] = useState(false);

  // Step 3 - Employees
  const [employeeCount, setEmployeeCount] = useState(0);
  const [maxEmployees, setMaxEmployees] = useState(50);

  // Step 4 - Call scheduled
  const [callScheduled, setCallScheduled] = useState(false);

  // Load onboarding status
  useEffect(() => {
    loadOnboardingStatus();
  }, []);

  const loadOnboardingStatus = async () => {
    try {
      const status = await api.get<OnboardingStatusResponse>("/onboarding/status/");
      setOnboardingData(status);
      setCurrentStep(status.onboarding_current_step || 1);
      setShowPasswordChange(status.must_change_password);

      // Load company data
      if (status.company_id) {
        try {
          const company = await api.get<any>(`/companies/${status.company_id}/`);
          setCompanyForm({
            name: company.name || "",
            cnpj: company.cnpj || "",
            email: company.email || "",
            phone: company.phone || "",
            responsible_name: company.responsible_name || "",
          });
          setMaxEmployees(company.max_employees || 50);
        } catch {}
      }
    } catch {
      toast("error", "Erro ao carregar status do onboarding");
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get<PaginatedResponse<Department>>("/departments/", {
        company_id: companyId,
        page_size: 100,
      });
      setDepartments(res.data || []);
    } catch {}
  }, [companyId]);

  const loadEmployeeCount = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get<PaginatedResponse<any>>("/employees/", {
        company_id: companyId,
        page_size: 1,
      });
      setEmployeeCount(res.total || 0);
    } catch {}
  }, [companyId]);

  useEffect(() => {
    if (currentStep === 2) loadDepartments();
    if (currentStep === 3) loadEmployeeCount();
  }, [currentStep, loadDepartments, loadEmployeeCount]);

  const saveStep = async (step: number, status?: string) => {
    try {
      await api.put("/onboarding/step/", { step, status });
    } catch {}
  };

  const goNext = async () => {
    const next = Math.min(currentStep + 1, 5);
    setCurrentStep(next);
    await saveStep(next);
  };

  const goBack = () => {
    setCurrentStep(Math.max(currentStep - 1, 1));
  };

  const handleCompanyUpdate = async () => {
    if (!onboardingData?.company_id) return;
    setSaving(true);
    try {
      await api.put(`/companies/${onboardingData.company_id}/`, companyForm);
      toast("success", "Dados da empresa atualizados!");
    } catch (err: any) {
      toast("error", err.message || "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast("error", "As senhas nao coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast("error", "Senha deve ter no minimo 6 caracteres");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<{ access_token: string }>("/onboarding/change-password/", {
        new_password: newPassword,
      });
      if (res.access_token) {
        setToken(res.access_token);
      }
      setPasswordChanged(true);
      setShowPasswordChange(false);
      toast("success", "Senha alterada com sucesso!");
    } catch (err: any) {
      toast("error", err.message || "Erro ao trocar senha");
    } finally {
      setSaving(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    setAddingDept(true);
    try {
      await api.post("/departments/", {
        name: newDeptName.trim(),
        description: newDeptDesc.trim() || undefined,
        company_id: companyId,
      });
      setNewDeptName("");
      setNewDeptDesc("");
      loadDepartments();
      toast("success", "Setor adicionado!");
    } catch (err: any) {
      toast("error", err.message || "Erro ao adicionar setor");
    } finally {
      setAddingDept(false);
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    try {
      await api.delete(`/departments/${id}/`);
      loadDepartments();
      toast("success", "Setor removido");
    } catch (err: any) {
      toast("error", err.message || "Erro ao remover setor");
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await api.post("/onboarding/complete/");
      toast("success", "Onboarding concluido! Bem-vindo ao Emotion Care.");
      sessionStorage.removeItem("onboarding_status");
      router.push("/dashboard");
    } catch (err: any) {
      toast("error", err.message || "Erro ao concluir onboarding");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg-subtle">
        <div className="spinner-emotioncare" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg-subtle flex items-start justify-center pt-8 pb-16 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-heading-lg text-brand-text font-semibold">
            Configuracao Inicial
          </h1>
          <p className="text-body-sm text-brand-muted mt-1">
            Vamos configurar sua plataforma em poucos passos
          </p>
        </div>

        <StepIndicator currentStep={currentStep} />

        {/* Card principal */}
        <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-6 sm:p-8">
          {/* Step 1: Boas-vindas + Dados da Empresa */}
          {currentStep === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <PartyPopper className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-heading-sm text-brand-text font-semibold">
                    Bem-vindo ao Emotion Care!
                  </h2>
                  <p className="text-body-sm text-brand-muted">
                    Verifique e complete os dados da sua empresa
                  </p>
                </div>
              </div>

              {/* Password change (if needed) */}
              {showPasswordChange && !passwordChanged && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800">
                      Troque sua senha temporaria
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Nova senha (min. 6 caracteres)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-10 px-3 pr-10 rounded-lg border border-amber-300 text-sm bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirme a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-amber-300 text-sm bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                    <button
                      onClick={handlePasswordChange}
                      disabled={saving || !newPassword || !confirmPassword}
                      className="w-full h-9 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Salvando..." : "Trocar Senha"}
                    </button>
                  </div>
                </div>
              )}

              {passwordChanged && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-6 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-700">Senha alterada com sucesso!</p>
                </div>
              )}

              {/* Company form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-brand-muted mb-1">Razao Social</label>
                  <input
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-brand-border text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-brand-muted mb-1">CNPJ</label>
                    <input
                      value={companyForm.cnpj}
                      onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-brand-border text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-muted mb-1">Telefone</label>
                    <input
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-brand-border text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-muted mb-1">Email</label>
                  <input
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-brand-border text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-muted mb-1">Nome do Responsavel</label>
                  <input
                    value={companyForm.responsible_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, responsible_name: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-brand-border text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <button
                  onClick={handleCompanyUpdate}
                  disabled={saving}
                  className="h-9 px-4 rounded-lg bg-brand-bg-subtle border border-brand-border text-sm font-medium text-brand-text hover:bg-brand-border/50 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Salvando..." : "Salvar Dados"}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Setores/GHEs */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FolderTree className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-heading-sm text-brand-text font-semibold">
                    Configure seus Setores (GHEs)
                  </h2>
                  <p className="text-body-sm text-brand-muted">
                    Grupos Homogeneos de Exposicao: agrupam colaboradores com condicoes de trabalho similares
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Dica:</strong> Exemplos de GHEs: Administrativo, Operacional, Gestao, Atendimento ao Publico, TI, Comercial, etc. Cada grupo precisa ter no minimo 3 respondentes.
                </p>
              </div>

              {/* Add department */}
              <div className="flex gap-2 mb-4">
                <input
                  placeholder="Nome do setor (ex: Administrativo)"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
                  className="flex-1 h-10 px-3 rounded-lg border border-brand-border text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
                <button
                  onClick={handleAddDepartment}
                  disabled={addingDept || !newDeptName.trim()}
                  className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {addingDept ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar
                </button>
              </div>

              {/* Department list */}
              <div className="space-y-2">
                {departments.length === 0 ? (
                  <p className="text-sm text-brand-muted text-center py-6">
                    Nenhum setor cadastrado ainda. Adicione seus primeiros setores acima.
                  </p>
                ) : (
                  departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-brand-border bg-brand-bg-subtle"
                    >
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-brand-muted" />
                        <span className="text-sm text-brand-text font-medium">{dept.name}</span>
                        {dept.description && (
                          <span className="text-xs text-brand-muted">- {dept.description}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteDepartment(dept.id)}
                        className="p-1.5 rounded-md text-brand-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {departments.length > 0 && (
                <p className="text-xs text-brand-muted mt-3">
                  {departments.length} setor(es) cadastrado(s). Voce pode adicionar mais a qualquer momento.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Colaboradores */}
          {currentStep === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-heading-sm text-brand-text font-semibold">
                    Importe seus Colaboradores
                  </h2>
                  <p className="text-body-sm text-brand-muted">
                    Cadastre os colaboradores CLT que participarao da avaliacao
                  </p>
                </div>
              </div>

              <div className="bg-brand-bg-subtle border border-brand-border rounded-xl p-5 mb-6 text-center">
                <Users className="h-8 w-8 text-brand-muted mx-auto mb-2" />
                <p className="text-2xl font-bold text-brand-text">{employeeCount}</p>
                <p className="text-sm text-brand-muted">
                  colaborador(es) cadastrado(s) de {maxEmployees} permitidos
                </p>
                <div className="w-full bg-brand-border rounded-full h-2 mt-3">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{ width: `${Math.min((employeeCount / maxEmployees) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => router.push("/employees")}
                  className="p-4 rounded-xl border border-brand-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                >
                  <Users className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-medium text-brand-text">Cadastro Manual</p>
                  <p className="text-xs text-brand-muted mt-0.5">Adicionar colaboradores um a um</p>
                </button>
                <button
                  onClick={() => router.push("/employees")}
                  className="p-4 rounded-xl border border-brand-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                >
                  <Download className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-medium text-brand-text">Importar Planilha</p>
                  <p className="text-xs text-brand-muted mt-0.5">Upload de CSV ou Excel</p>
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                <p className="text-sm text-blue-800">
                  <strong>Importante:</strong> Cada colaborador precisa ter pelo menos nome e email. O setor e a funcao sao opcionais mas recomendados para uma melhor analise por GHE.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Agendar Call */}
          {currentStep === 4 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-heading-sm text-brand-text font-semibold">
                    Agende sua Call de Kick-off
                  </h2>
                  <p className="text-body-sm text-brand-muted">
                    Reuniao de 45 minutos para apresentar a plataforma e tirar duvidas
                  </p>
                </div>
              </div>

              <div className="bg-brand-bg-subtle border border-brand-border rounded-xl p-6 text-center mb-6">
                <Calendar className="h-10 w-10 text-primary mx-auto mb-3" />
                <p className="text-sm text-brand-text mb-4">
                  Nessa reuniao nossa equipe apresenta a plataforma, orienta a configuracao dos GHEs e colaboradores, e tira todas as duvidas para que voce saia pronto para comecar.
                </p>
                <a
                  href="https://calendly.com/emotioncare-emotioncarelab/onboarding-emotion-care"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setCallScheduled(true)}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Agendar no Calendly
                </a>
              </div>

              <div className="border-t border-brand-border pt-4">
                <p className="text-sm text-brand-muted mb-3">Precisa de ajuda antes da call?</p>
                <a
                  href="mailto:emotioncare@emotioncarelab.com.br"
                  className="flex items-center gap-2 p-3 rounded-lg border border-brand-border hover:border-blue-300 hover:bg-blue-50 transition-colors w-full"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-brand-text">Email</p>
                    <p className="text-xs text-brand-muted">emotioncare@emotioncarelab.com.br</p>
                  </div>
                </a>
              </div>

              {callScheduled && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-4 flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-700">Otimo! Voce sera notificado por email com a confirmacao.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Proximos Passos */}
          {currentStep === 5 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-heading-sm text-brand-text font-semibold">
                    Tudo pronto!
                  </h2>
                  <p className="text-body-sm text-brand-muted">
                    Voce ja pode comecar a usar o Emotion Care
                  </p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 mb-6">
                <h3 className="text-sm font-semibold text-brand-text mb-3">Proximos passos na plataforma:</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-brand-text">
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center mt-0.5 flex-shrink-0">1</span>
                    Selecione o questionario e as dimensoes que deseja mapear
                  </li>
                  <li className="flex items-start gap-2 text-sm text-brand-text">
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center mt-0.5 flex-shrink-0">2</span>
                    Crie uma campanha e envie o questionario para seus colaboradores
                  </li>
                  <li className="flex items-start gap-2 text-sm text-brand-text">
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center mt-0.5 flex-shrink-0">3</span>
                    Acompanhe as respostas e a taxa de adesao em tempo real
                  </li>
                  <li className="flex items-start gap-2 text-sm text-brand-text">
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center mt-0.5 flex-shrink-0">4</span>
                    Gere automaticamente o inventario, laudo tecnico e plano de acao 5W2H
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl border border-brand-border bg-brand-bg-subtle mb-6">
                <Download className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-brand-text">Cartilha de Implantacao</p>
                  <p className="text-xs text-brand-muted">Guia completo com tudo que voce precisa saber</p>
                </div>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4200/api"}/onboarding/cartilha/`.replace(/([^:]\/)\/+/g, "$1")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
              </div>

              <div className="border-t border-brand-border pt-4">
                <p className="text-xs text-brand-muted text-center">
                  Prazo legal de adequacao: 26 de maio de 2026 (Portaria MTE no. 765/2025)
                </p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-brand-border">
            <div>
              {currentStep > 1 && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm text-brand-muted hover:text-brand-text hover:bg-brand-bg-subtle transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="h-9 px-4 rounded-lg text-sm text-brand-muted hover:text-brand-text hover:bg-brand-bg-subtle transition-colors"
              >
                Pular
              </button>
              {currentStep < 5 ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Proximo
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  Ir para o Painel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
