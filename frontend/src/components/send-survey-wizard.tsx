"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useCompanyId } from "@/lib/contexts/company-context";
import { useToast } from "@/components/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import {
  Employee,
  QuestionnaireConfig,
  Campaign,
  CampaignDetail,
  CampaignParticipant,
  PaginatedResponse,
} from "@/types";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Copy,
  Mail,
  Loader2,
  AlertCircle,
  ClipboardList,
  Megaphone,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SendSurveyWizardProps {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { label: "Questionário", icon: ClipboardList },
  { label: "Campanha", icon: Megaphone },
  { label: "Enviar Link", icon: Link2 },
] as const;

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
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
                  "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-white",
                  isCurrent && "border-primary text-primary bg-primary/5",
                  !isCompleted && !isCurrent && "border-brand-border text-brand-muted"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
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
                  "w-12 h-0.5 mx-1 mb-5",
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

export default function SendSurveyWizard({
  employee,
  open,
  onOpenChange,
}: SendSurveyWizardProps) {
  const { toast } = useToast();
  const companyId = useCompanyId();

  const [step, setStep] = useState(1);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireConfig[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [participant, setParticipant] = useState<CampaignParticipant | null>(null);
  const [surveyLink, setSurveyLink] = useState<string | null>(null);
  const [notInCampaign, setNotInCampaign] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedConfigId(null);
      setSelectedCampaignId(null);
      setParticipant(null);
      setSurveyLink(null);
      setNotInCampaign(false);
      setCopied(false);
      setCampaigns([]);
    }
  }, [open]);

  // Load questionnaires on mount
  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<PaginatedResponse<QuestionnaireConfig>>(
          "/questionnaires/",
          { company_id: companyId, page_size: 100 }
        );
        if (!cancelled) setQuestionnaires(res.data || []);
      } catch {
        if (!cancelled) toast("error", "Erro ao carregar questionários.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  // Load campaigns when moving to step 2
  const loadCampaigns = useCallback(async () => {
    if (!companyId || !selectedConfigId) return;
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Campaign>>(
        "/campaigns/",
        { company_id: companyId, page_size: 100 }
      );
      const filtered = (res.data || []).filter(
        (c) =>
          c.config_id === selectedConfigId &&
          (c.status === "draft" || c.status === "in_progress")
      );
      setCampaigns(filtered);
    } catch {
      toast("error", "Erro ao carregar campanhas.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedConfigId]);

  // Load participant when moving to step 3 — auto-adds if not in campaign
  const loadParticipant = useCallback(async () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    setNotInCampaign(false);
    try {
      const detail = await api.get<CampaignDetail>(
        `/campaigns/${selectedCampaignId}`
      );
      let found = detail.participants.find(
        (p) => p.employee_id === employee.id
      );

      if (!found) {
        // Auto-add employee as participant
        const added = await api.post<{
          id: number;
          campaign_id: number;
          employee_id: number;
          token: string;
          status: string;
          already_existed: boolean;
        }>(`/campaigns/${selectedCampaignId}/participants`, {
          employee_id: employee.id,
        });
        found = {
          id: added.id,
          campaign_id: added.campaign_id,
          employee_id: added.employee_id,
          token: added.token,
          status: added.status,
          channel: "link",
          sent_at: null,
          opened_at: null,
          started_at: null,
          completed_at: null,
          resend_count: 0,
          employee_name: employee.name,
          employee_email: employee.email || null,
          employee_department: null,
        } as CampaignParticipant;
      }

      setParticipant(found);
      setSurveyLink(`${window.location.origin}/respond/${found.token}`);
    } catch {
      toast("error", "Erro ao carregar dados da campanha.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId, employee.id]);

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
      await loadCampaigns();
    } else if (step === 2) {
      setStep(3);
      await loadParticipant();
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSelectedCampaignId(null);
      setCampaigns([]);
    } else if (step === 3) {
      setStep(2);
      setParticipant(null);
      setSurveyLink(null);
      setNotInCampaign(false);
      setCopied(false);
    }
  };

  const handleCopy = async () => {
    if (!surveyLink) return;
    try {
      await navigator.clipboard.writeText(surveyLink);
      setCopied(true);
      toast("success", "Link copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("error", "Erro ao copiar link.");
    }
  };

  const handleSendEmail = async () => {
    if (!selectedCampaignId || !participant) return;
    setSending(true);
    try {
      await api.post(`/campaigns/${selectedCampaignId}/send`, {
        channel: "email",
        participant_ids: [participant.id],
      });
      toast("success", `E-mail sendo enviado para ${employee.name}...`);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao enviar e-mail."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Enviar Questionário</ModalTitle>
          <ModalDescription>
            Gerar link do formulário para{" "}
            <span className="font-medium text-brand-text">{employee.name}</span>
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <StepIndicator currentStep={step} />

          {/* Step 1: Select questionnaire */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-brand-text">
                Selecione o questionário
              </label>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : questionnaires.length === 0 ? (
                <div className="text-center py-8 text-brand-muted text-sm">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-brand-muted/50" />
                  Nenhum questionário disponível.
                </div>
              ) : (
                <select
                  value={selectedConfigId ?? ""}
                  onChange={(e) =>
                    setSelectedConfigId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="input-emotioncare w-full"
                >
                  <option value="">Selecione...</option>
                  {questionnaires.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Step 2: Select campaign */}
          {step === 2 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-brand-text">
                Selecione a campanha
              </label>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8 text-brand-muted text-sm">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-brand-muted/50" />
                  Nenhuma campanha encontrada para este questionário.
                </div>
              ) : (
                <select
                  value={selectedCampaignId ?? ""}
                  onChange={(e) =>
                    setSelectedCampaignId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="input-emotioncare w-full"
                >
                  <option value="">Selecione...</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status === "draft" ? "Rascunho" : "Em andamento"})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Step 3: Survey link */}
          {step === 3 && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : notInCampaign ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        Erro ao adicionar participante
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        Não foi possível adicionar <span className="font-medium">{employee.name}</span> a esta campanha. Tente novamente.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-brand-text mb-1.5">
                      Link do formulário
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={surveyLink || ""}
                        className="input-emotioncare w-full text-sm font-mono bg-brand-bg-muted"
                      />
                      <button
                        onClick={handleCopy}
                        className={cn(
                          "btn btn-md shrink-0",
                          copied ? "btn-primary" : "btn-secondary"
                        )}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-brand-border pt-4">
                    <button
                      onClick={handleSendEmail}
                      disabled={sending || !employee.email}
                      className="btn btn-primary btn-md w-full"
                      title={
                        !employee.email
                          ? "Colaborador não possui e-mail cadastrado"
                          : undefined
                      }
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      {sending ? "Enviando..." : "Enviar por E-mail"}
                    </button>
                    {!employee.email && (
                      <p className="text-xs text-brand-muted mt-1.5 text-center">
                        Este colaborador não possui e-mail cadastrado.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {step > 1 && (
            <button onClick={handleBack} className="btn btn-secondary btn-md">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>
          )}
          {step < 3 && (
            <button
              onClick={handleNext}
              disabled={
                loading ||
                (step === 1 && !selectedConfigId) ||
                (step === 2 && !selectedCampaignId)
              }
              className="btn btn-primary btn-md"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => onOpenChange(false)}
              className="btn btn-secondary btn-md"
            >
              Fechar
            </button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
