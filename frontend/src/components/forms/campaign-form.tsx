"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import {
  Campaign,
  CampaignCreate,
  CampaignDetail,
  CampaignUpdate,
  QuestionnaireConfig,
  Employee,
  PaginatedResponse,
} from "@/types";
import { getCurrentUserFromToken } from "@/lib/auth";
import { useCompanyId } from "@/lib/contexts/company-context";
import { ArrowLeft, Search } from "lucide-react";

interface CampaignFormProps {
  campaign?: Campaign | CampaignDetail;
  mode: "create" | "edit";
}

type Step = 1 | 2 | 3;

export default function CampaignForm({
  campaign,
  mode,
}: CampaignFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUserFromToken();
  const selectedCompanyId = useCompanyId();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireConfig[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);

  const [employeeSearch, setEmployeeSearch] = useState("");

  const [form, setForm] = useState({
    config_id: campaign?.config_id || 0,
    name: campaign?.name || "",
    description: campaign?.description || "",
    start_date: campaign?.start_date
      ? new Date(campaign.start_date).toISOString().slice(0, 16)
      : "",
    deadline: campaign?.deadline
      ? new Date(campaign.deadline).toISOString().slice(0, 16)
      : "",
    channels: campaign?.channels || ["email"],
    employee_ids: (campaign && "participants" in campaign
      ? campaign.participants.map((p) => p.employee_id)
      : []) as number[],
    auto_resend_enabled: campaign?.auto_resend_enabled || false,
    auto_resend_interval_days: campaign?.auto_resend_interval_days || 7,
    anonymization_threshold: campaign?.anonymization_threshold || 5,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [questionnairesRes, employeesRes, channelsRes] = await Promise.all([
          api.get<PaginatedResponse<QuestionnaireConfig>>(
            "/questionnaires/",
            { page_size: 100, company_id: selectedCompanyId || undefined }
          ),
          api.get<PaginatedResponse<Employee>>("/employees/", {
            page_size: 100,
            company_id: selectedCompanyId || undefined,
          }),
          api.get<string[]>("/campaigns/channels"),
        ]);
        setQuestionnaires(questionnairesRes.data);
        setEmployees(employeesRes.data);
        setAvailableChannels(channelsRes);
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar dados."
        );
      }
    };
    loadData();
  }, [toast]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : type === "number"
          ? parseInt(value) || 0
          : value,
    }));
  };

  const handleChannelToggle = (channel: string) => {
    setForm((prev) => {
      const channels = prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels };
    });
  };

  const handleEmployeeToggle = (employeeId: number) => {
    setForm((prev) => {
      const employee_ids = prev.employee_ids.includes(employeeId)
        ? prev.employee_ids.filter((id) => id !== employeeId)
        : [...prev.employee_ids, employeeId];
      return { ...prev, employee_ids };
    });
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.department_name?.toLowerCase().includes(q) ||
      emp.job_role_title?.toLowerCase().includes(q)
    );
  });

  const handleSelectAllEmployees = () => {
    const targetIds = filteredEmployees.map((e) => e.id);
    const allSelected = targetIds.every((id) => form.employee_ids.includes(id));
    if (allSelected) {
      setForm((prev) => ({
        ...prev,
        employee_ids: prev.employee_ids.filter((id) => !targetIds.includes(id)),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        employee_ids: Array.from(new Set([...prev.employee_ids, ...targetIds])),
      }));
    }
  };

  const validateStep = (step: Step): boolean => {
    switch (step) {
      case 1:
        return form.config_id > 0 && form.name.trim() !== "";
      case 2:
        return form.employee_ids.length > 0;
      case 3:
        return form.channels.length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 3) {
        setCurrentStep((prev) => (prev + 1) as Step);
      }
    } else {
      toast("error", "Preencha todos os campos obrigatórios antes de continuar.");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) return;
    if (!validateStep(3)) {
      toast("error", "Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const companyId = selectedCompanyId || user?.company_id;
      if (!companyId || companyId === 0) {
        toast(
          "error",
          "Selecione uma empresa para criar campanhas."
        );
        setLoading(false);
        return;
      }

      const payload: CampaignCreate = {
        company_id: companyId,
        config_id: form.config_id,
        name: form.name,
        description: form.description || undefined,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        channels: form.channels,
        employee_ids: form.employee_ids,
        auto_resend_enabled: form.auto_resend_enabled,
        auto_resend_interval_days: form.auto_resend_interval_days,
        anonymization_threshold: form.anonymization_threshold,
      };

      if (mode === "create") {
        await api.post("/campaigns/", payload);
        toast("success", "Campanha criada com sucesso.");
      } else {
        const updatePayload: CampaignUpdate = {
          name: form.name,
          description: form.description || undefined,
          start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
          channels: form.channels,
          employee_ids: form.employee_ids,
          auto_resend_enabled: form.auto_resend_enabled,
          auto_resend_interval_days: form.auto_resend_interval_days,
          anonymization_threshold: form.anonymization_threshold,
        };
        await api.put(`/campaigns/${campaign!.id}`, updatePayload);
        toast("success", "Campanha atualizada com sucesso.");
      }
      router.push("/campaigns");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar campanha."
      );
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Configuração Básica" },
    { number: 2, title: "Participantes" },
    { number: 3, title: "Canais de Envio" },
  ];

  return (
    <div>
      <button
        onClick={() => router.push("/campaigns")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para campanhas
      </button>

      <div className="card-emotioncare max-w-4xl">
        <div className="card-body">
          <h2 className="text-heading-2 text-brand-text mb-6">
            {mode === "create" ? "Nova Campanha" : "Editar Campanha"}
          </h2>

          {/* Steps indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, idx) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        currentStep >= step.number
                          ? "bg-primary text-white"
                          : "bg-brand-bg-muted text-brand-muted"
                      }`}
                    >
                      {step.number}
                    </div>
                    <span
                      className={`text-xs mt-2 text-center ${
                        currentStep >= step.number
                          ? "text-brand-text"
                          : "text-brand-muted"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        currentStep > step.number
                          ? "bg-primary"
                          : "bg-brand-bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === "Enter" && currentStep < 3) e.preventDefault(); }} className="space-y-6">
            {/* Step 1: Basic Configuration */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="label-emotioncare">Questionário *</label>
                  <select
                    name="config_id"
                    value={form.config_id}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                    disabled={mode === "edit"}
                  >
                    <option value="0">Selecione um questionário</option>
                    {questionnaires.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name} ({q.instrument_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-emotioncare">Nome da Campanha *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                    placeholder="Ex: Avaliação Q1 2026"
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Descrição</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    className="input-emotioncare w-full"
                    placeholder="Descreva o objetivo desta campanha..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-emotioncare">Data de Início</label>
                    <input
                      name="start_date"
                      type="datetime-local"
                      value={form.start_date}
                      onChange={handleChange}
                      className="input-emotioncare w-full"
                    />
                  </div>
                  <div>
                    <label className="label-emotioncare">Prazo Final</label>
                    <input
                      name="deadline"
                      type="datetime-local"
                      value={form.deadline}
                      onChange={handleChange}
                      className="input-emotioncare w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Participants */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="label-emotioncare">
                    Selecionar Participantes * ({form.employee_ids.length}{" "}
                    selecionados)
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllEmployees}
                    className="btn btn-secondary btn-sm"
                  >
                    {filteredEmployees.length > 0 &&
                    filteredEmployees.every((e) => form.employee_ids.includes(e.id))
                      ? "Desmarcar Todos"
                      : "Selecionar Todos"}
                  </button>
                </div>
                {/* Search filter */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Buscar por nome, e-mail, setor ou função..."
                    className="input-emotioncare w-full pl-9"
                  />
                </div>
                <div className="border border-brand-border rounded-lg p-4 max-h-96 overflow-y-auto">
                  {employees.length === 0 ? (
                    <p className="text-body-sm text-brand-muted text-center py-8">
                      Nenhum colaborador cadastrado.
                    </p>
                  ) : filteredEmployees.length === 0 ? (
                    <p className="text-body-sm text-brand-muted text-center py-8">
                      Nenhum colaborador encontrado para &ldquo;{employeeSearch}&rdquo;.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredEmployees.map((emp) => (
                        <label
                          key={emp.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-brand-bg-subtle cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={form.employee_ids.includes(emp.id)}
                            onChange={() => handleEmployeeToggle(emp.id)}
                            className="checkbox-emotioncare"
                          />
                          <div className="flex-1">
                            <p className="text-body font-medium text-brand-text">
                              {emp.name}
                            </p>
                            <p className="text-body-sm text-brand-muted">
                              {emp.email || "Sem e-mail"} • {emp.department_name || "Sem setor"}
                              {emp.job_role_title ? ` • ${emp.job_role_title}` : ""}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Channels */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <label className="label-emotioncare">
                  Canais de Envio * ({form.channels.length} selecionados)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableChannels
                    .filter((channel) => channel !== "link")
                    .map((channel) => (
                    <label
                      key={channel}
                      className="flex items-center gap-3 p-4 border border-brand-border rounded-lg hover:bg-brand-bg-subtle cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.channels.includes(channel)}
                        onChange={() => handleChannelToggle(channel)}
                        className="checkbox-emotioncare"
                      />
                      <div>
                        <p className="text-body font-medium text-brand-text capitalize">
                          {channel === "email" ? "E-mail" : channel}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between gap-3 pt-4 border-t border-brand-border">
              <button
                type="button"
                onClick={currentStep === 1 ? () => router.push("/campaigns") : handleBack}
                className="btn btn-secondary btn-md"
              >
                {currentStep === 1 ? "Cancelar" : "Voltar"}
              </button>
              <div className="flex gap-3">
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="btn btn-primary btn-md"
                  >
                    Próximo
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary btn-md"
                  >
                    {loading && <div className="spinner-brand-white" />}
                    {loading
                      ? "Salvando..."
                      : mode === "create"
                      ? "Criar Campanha"
                      : "Salvar"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
