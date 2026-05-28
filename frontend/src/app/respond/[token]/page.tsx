"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  PublicQuestionnaireForm,
  PublicQuestionnaireInfo,
  AnswerSubmit,
  ResponseSubmit,
} from "@/types";
import { useToast } from "@/components/toast";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Shield,
  ClipboardList,
  Loader2,
} from "lucide-react";

// ─── Tipos internos ─────────────────────────────────────
interface DimensionStep {
  type: "dimension";
  index: number;
  name: string;
  description: string | null;
  questions: Array<{
    id: number;
    code: string;
    text: string;
    scale_type: string;
    scale_labels: Array<{ value: number; label: string }> | null;
    is_reverse_scored: boolean;
  }>;
}

interface CustomStep {
  type: "custom";
  questions: Array<{
    id: number;
    text: string;
    question_type: string;
    options: string[] | null;
    is_required: boolean;
  }>;
}

type FormStep = DimensionStep | CustomStep;

// ─── Página Principal ───────────────────────────────────
export default function RespondPage() {
  const params = useParams();
  const { toast } = useToast();
  const token = params.token as string;

  // Verificação de código de acesso
  const [codeVerified, setCodeVerified] = useState(false);
  const [codeInput, setCodeInput] = useState(["", "", "", "", "", ""]);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const codeRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...codeInput];
    newCode[index] = digit;
    setCodeInput(newCode);
    setCodeError(null);
    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !codeInput[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...codeInput];
      for (let i = 0; i < 6; i++) {
        newCode[i] = pasted[i] || "";
      }
      setCodeInput(newCode);
      setCodeError(null);
      codeRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = codeInput.join("");
    if (fullCode.length !== 6) {
      setCodeError("Digite o código completo de 6 dígitos.");
      return;
    }
    setVerifying(true);
    setCodeError(null);
    try {
      const res = await api.post<{ token: string; valid: boolean }>(
        `/respond/${token}/verify-code`,
        { code: fullCode }
      );
      if (res.valid) {
        setCodeVerified(true);
      } else {
        setCodeError("Código incorreto. Verifique o código recebido por e-mail.");
      }
    } catch {
      setCodeError("Código inválido. Verifique o código recebido por e-mail.");
    } finally {
      setVerifying(false);
    }
  };

  // Estados de carregamento
  const [info, setInfo] = useState<PublicQuestionnaireInfo | null>(null);
  const [form, setForm] = useState<PublicQuestionnaireForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Estado do formulário
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro
  const [answers, setAnswers] = useState<Record<string, AnswerSubmit>>({});

  // Carregar dados somente após código verificado
  useEffect(() => {
    if (!codeVerified) return;
    const loadQuestionnaire = async () => {
      try {
        const infoData = await api.get<PublicQuestionnaireInfo>(
          `/respond/${token}/info`
        );
        setInfo(infoData);

        if (!infoData.is_expired && !infoData.is_already_completed) {
          const formData = await api.get<PublicQuestionnaireForm>(
            `/respond/${token}/form`
          );
          setForm(formData);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erro ao carregar questionário.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      loadQuestionnaire();
    }
  }, [token, codeVerified]);

  // Montar os steps (dimensões + custom)
  const steps: FormStep[] = useMemo(() => {
    if (!form) return [];

    const s: FormStep[] = form.dimensions.map((dim, idx) => ({
      type: "dimension" as const,
      index: idx,
      name: dim.name,
      description: dim.description,
      questions: dim.questions,
    }));

    if (form.custom_questions.length > 0) {
      s.push({
        type: "custom" as const,
        questions: form.custom_questions,
      });
    }

    return s;
  }, [form]);

  // Total de steps: intro(1) + form steps + review(1)
  const totalSteps = steps.length + 2; // +1 intro, +1 review

  // Contar perguntas respondidas
  const totalQuestions = form?.total_questions || 0;
  const answeredCount = Object.keys(answers).length;
  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Verificar se o step atual está completo
  const isCurrentStepComplete = useCallback((): boolean => {
    if (currentStep === 0) return true; // Intro sempre completo
    if (currentStep === steps.length + 1) return true; // Review sempre completo

    const step = steps[currentStep - 1];
    if (!step) return false;

    if (step.type === "dimension") {
      return step.questions.every((q) => answers[`q_${q.id}`] !== undefined);
    }

    if (step.type === "custom") {
      return step.questions
        .filter((q) => q.is_required)
        .every((q) => answers[`cq_${q.id}`] !== undefined);
    }

    return false;
  }, [currentStep, steps, answers]);

  // Handler de respostas
  // Para custom questions do tipo likert_scale/single_choice, persistimos tanto o
  // numeric_value (index 1-based) quanto o text_value (rotulo), habilitando a tabulacao.
  // Para multiple_choice o text_value agrega multiplas opcoes separadas por "|".
  const handleAnswerChange = (
    questionId: number | null,
    customQuestionId: number | null,
    value: number | string,
    customQuestion?: { question_type: string; options?: string[] | null }
  ) => {
    const key = questionId ? `q_${questionId}` : `cq_${customQuestionId}`;

    let numericValue: number | undefined;
    let textValue: string | undefined;

    if (questionId) {
      numericValue = typeof value === "number" ? value : undefined;
      textValue = typeof value === "string" ? value : undefined;
    } else if (customQuestion) {
      const qt = customQuestion.question_type;
      const opts = customQuestion.options || [];

      if (qt === "open_text") {
        textValue = typeof value === "string" ? value : undefined;
      } else if (qt === "likert_scale" || qt === "single_choice") {
        const strVal = typeof value === "string" ? value : String(value);
        const idx = opts.findIndex((o) => o === strVal);
        numericValue = idx >= 0 ? idx + 1 : undefined;
        textValue = strVal;
      } else if (qt === "multiple_choice") {
        // Toggle selecao em multiplas opcoes usando text_value como lista "|"
        setAnswers((prev) => {
          const existing = prev[key];
          const current = (existing?.text_value || "")
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);
          const strVal = typeof value === "string" ? value : String(value);
          const idx = current.indexOf(strVal);
          if (idx >= 0) current.splice(idx, 1);
          else current.push(strVal);
          return {
            ...prev,
            [key]: {
              question_id: undefined,
              custom_question_id: customQuestionId || undefined,
              numeric_value: undefined,
              text_value: current.join(" | "),
            },
          };
        });
        return;
      }
    } else {
      numericValue = typeof value === "number" ? value : undefined;
      textValue = typeof value === "string" ? value : undefined;
    }

    setAnswers((prev) => ({
      ...prev,
      [key]: {
        question_id: questionId || undefined,
        custom_question_id: customQuestionId || undefined,
        numeric_value: numericValue,
        text_value: textValue,
      },
    }));
  };

  // Navegação
  const goNext = () => {
    if (!isCurrentStepComplete()) {
      toast("error", "Responda todas as perguntas obrigatórias antes de continuar.");
      return;
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Submissão
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: ResponseSubmit = {
        answers: Object.values(answers),
        is_complete: true,
      };
      await api.post(`/respond/${token}/submit`, payload);
      setSubmitted(true);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao enviar respostas."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Tela de verificação de código ─────────────────────
  if (!codeVerified) {
    const fullCode = codeInput.join("");
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
              <Shield className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Emotion Care</h1>
            <p className="text-gray-500 mt-1">Saúde Mental no Trabalho</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Código de Acesso</h2>
              <p className="text-sm text-gray-500 mt-1">
                Digite o código de 6 dígitos recebido por e-mail
              </p>
            </div>
            <form onSubmit={handleCodeSubmit}>
              <div className="flex justify-center gap-2 mb-6" onPaste={handleCodePaste}>
                {codeInput.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { codeRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      codeError ? "border-red-300 bg-red-50" : digit ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"
                    }`}
                    autoFocus={index === 0}
                  />
                ))}
              </div>
              {codeError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3 mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={fullCode.length !== 6 || verifying}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Validando...</>
                ) : (
                  <>Acessar Avaliação</>
                )}
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            Suas respostas são <strong>anônimas</strong> e protegidas.
          </p>
        </div>
      </div>
    );
  }

  // ─── Tela de loading ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#10b981] animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Carregando questionário...</p>
        </div>
      </div>
    );
  }

  // ─── Tela de erro ─────────────────────────────────────
  if (loadError || !info) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Link Inválido
          </h2>
          <p className="text-gray-500 text-sm">
            {loadError || "O link que você acessou é inválido ou expirou."}
          </p>
        </div>
      </div>
    );
  }

  // ─── Tela de expirado ─────────────────────────────────
  if (info.is_expired) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Prazo Encerrado
          </h2>
          <p className="text-gray-500 text-sm">
            O prazo para responder este questionário já encerrou.
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Campanha
            </p>
            <p className="text-sm font-medium text-gray-700">
              {info.campaign_name}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Tela de já respondido ────────────────────────────
  if (info.is_already_completed) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Já Respondido
          </h2>
          <p className="text-gray-500 text-sm">
            Você já respondeu este questionário. Obrigado pela sua participação!
          </p>
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Campanha
            </p>
            <p className="text-sm font-medium text-gray-700">
              {info.campaign_name}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Tela de agradecimento (pós-envio) ────────────────
  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-lg w-full text-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-100 rounded-full animate-ping opacity-30" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Obrigado pela sua participação!
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Suas respostas foram registradas com sucesso. Elas são fundamentais
            para melhorarmos o ambiente de trabalho e cuidar da saúde mental de
            todos os colaboradores.
          </p>
          <div className="bg-gradient-to-r from-[#f0fdf4] to-[#ecfdf5] rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 justify-center">
              <Shield className="w-5 h-5 text-[#10b981]" />
              <p className="text-sm font-medium text-[#10b981]">
                Suas respostas são confidenciais e anônimas
              </p>
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Campanha
            </p>
            <p className="text-sm font-medium text-gray-700">
              {info.campaign_name}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {info.company_name}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!form) return null;

  // ─── Barra de progresso fixa ──────────────────────────
  const ProgressBar = () => (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#10b981] to-[#047857] flex items-center justify-center">
              <ClipboardList className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-800 hidden sm:inline">
              {form.campaign_name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {answeredCount}/{totalQuestions} respondidas
            </span>
            <span className="text-xs font-bold text-[#10b981]">
              {progressPercent}%
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#10b981] to-[#10b981] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );

  // ─── Tela de introdução (Step 0) ──────────────────────
  const IntroScreen = () => (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-32">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-[#10b981] to-[#10b981] px-8 py-10 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {form.campaign_name}
          </h1>
          <p className="text-white/80 text-sm">
            {form.company_name} • {form.instrument_name}
          </p>
        </div>

        {/* Corpo */}
        <div className="p-8">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {form.dimensions.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">Dimensões</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {totalQuestions}
              </p>
              <p className="text-xs text-gray-500 mt-1">Questões</p>
            </div>
          </div>

          {form.deadline && (
            <div className="flex items-center gap-3 bg-orange-50 rounded-xl p-4 mb-6">
              <Clock className="w-5 h-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800">
                  Prazo para responder
                </p>
                <p className="text-xs text-orange-600">
                  Até{" "}
                  {new Date(form.deadline).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 bg-[#f0fdf4] rounded-xl p-4 mb-6">
            <Shield className="w-5 h-5 text-[#10b981] shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#10b981]">
                Respostas confidenciais
              </p>
              <p className="text-xs text-green-700">
                Suas respostas são anônimas e protegidas. Nenhum gestor terá acesso às suas respostas individuais.
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Dimensões avaliadas:
            </h3>
            {form.dimensions.map((dim, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#10b981]/10 flex items-center justify-center text-xs font-bold text-[#10b981]">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {dim.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {dim.questions.length} questões
                  </p>
                </div>
              </div>
            ))}
            {form.custom_questions.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-xs font-bold text-purple-600">
                  +
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Questões Adicionais
                  </p>
                  <p className="text-xs text-gray-400">
                    {form.custom_questions.length} questões
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={goNext}
            className="w-full bg-gradient-to-r from-[#10b981] to-[#047857] hover:from-[#047857] hover:to-[#022c22] text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
          >
            Começar Questionário
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Tela de revisão (último step) ────────────────────
  const ReviewScreen = () => {
    const unanswered = totalQuestions - answeredCount;

    return (
      <div className="max-w-2xl mx-auto px-4 pt-24 pb-32">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#f0fdf4] rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-7 h-7 text-[#10b981]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Revisar e Enviar
            </h2>
            <p className="text-sm text-gray-500">
              Confira o resumo das suas respostas antes de enviar.
            </p>
          </div>

          {/* Resumo por dimensão */}
          <div className="space-y-3 mb-8">
            {steps.map((step, idx) => {
              let stepName: string;
              let stepQuestionCount: number;
              let stepAnsweredCount: number;

              if (step.type === "dimension") {
                stepName = step.name;
                stepQuestionCount = step.questions.length;
                stepAnsweredCount = step.questions.filter(
                  (q) => answers[`q_${q.id}`] !== undefined
                ).length;
              } else {
                stepName = "Questões Adicionais";
                stepQuestionCount = step.questions.length;
                stepAnsweredCount = step.questions.filter(
                  (q) => answers[`cq_${q.id}`] !== undefined
                ).length;
              }

              const isComplete = stepAnsweredCount === stepQuestionCount;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    isComplete
                      ? "border-green-200 bg-green-50/50"
                      : "border-orange-200 bg-orange-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {stepName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {stepAnsweredCount}/{stepQuestionCount} respondidas
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentStep(idx + 1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-xs font-medium text-[#10b981] hover:underline"
                  >
                    {isComplete ? "Revisar" : "Completar"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Alertas */}
          {unanswered > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <p className="text-sm text-orange-700">
                  Você ainda tem <strong>{unanswered}</strong> questões sem resposta.
                </p>
              </div>
            </div>
          )}

          {/* Aviso de confidencialidade */}
          <div className="bg-[#f0fdf4] rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#10b981]" />
              <p className="text-xs text-green-700">
                Suas respostas são anônimas e confidenciais. Após o envio, não
                será possível alterá-las.
              </p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={goBack}
              className="flex-1 py-3.5 px-6 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-[#10b981] to-[#047857] hover:from-[#047857] hover:to-[#022c22] text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Respostas
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Tela de questões (dimensão ou custom) ────────────
  const QuestionScreen = () => {
    const step = steps[currentStep - 1];
    if (!step) return null;

    const isDimension = step.type === "dimension";
    const stepTitle = isDimension ? step.name : "Questões Adicionais";
    const stepDescription = isDimension ? step.description : null;
    const stepNumber = currentStep;

    return (
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-32">
        {/* Header da dimensão */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#10b981]/5 to-[#10b981]/5 px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">
                {isDimension
                  ? `Dimensão ${stepNumber} de ${form.dimensions.length}`
                  : "Questões Extras"}
              </span>
              <span className="text-xs text-gray-400">
                Etapa {currentStep}/{steps.length}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{stepTitle}</h2>
            {stepDescription && (
              <p className="text-sm text-gray-500 mt-2">{stepDescription}</p>
            )}
          </div>

          {/* Step indicator */}
          <div className="px-6 py-3 bg-gray-50/50">
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    idx < currentStep
                      ? "bg-[#10b981]"
                      : idx === currentStep - 1
                      ? "bg-[#10b981]"
                      : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Questões */}
        <div className="space-y-4">
          {isDimension &&
            step.questions.map((q, qIdx) => {
              const answerKey = `q_${q.id}`;
              const currentAnswer = answers[answerKey];

              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 ${
                    currentAnswer
                      ? "border-green-200 shadow-green-50"
                      : "border-gray-100"
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          currentAnswer
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {qIdx + 1}
                      </div>
                      <p className="text-sm font-medium text-gray-800 leading-relaxed pt-0.5">
                        {q.text}
                      </p>
                    </div>

                    {q.scale_type && q.scale_labels ? (
                      <div className="space-y-2 ml-10">
                        {q.scale_labels.map((scaleOption, labelIdx) => {
                          const value = scaleOption.value;
                          const isSelected =
                            currentAnswer?.numeric_value === value;

                          return (
                            <label
                              key={labelIdx}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? "border-[#10b981] bg-[#f0fdf4] shadow-sm"
                                  : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                              }`}
                              onClick={() =>
                                handleAnswerChange(q.id, null, value)
                              }
                            >
                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected
                                    ? "border-[#10b981] bg-[#10b981]"
                                    : "border-gray-300"
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                              <span
                                className={`text-sm ${
                                  isSelected
                                    ? "text-[#10b981] font-medium"
                                    : "text-gray-600"
                                }`}
                              >
                                {scaleOption.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="ml-10">
                        <textarea
                          value={currentAnswer?.text_value || ""}
                          onChange={(e) =>
                            handleAnswerChange(q.id, null, e.target.value)
                          }
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all resize-none"
                          rows={3}
                          placeholder="Digite sua resposta..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {!isDimension &&
            step.questions.map((cq, cqIdx) => {
              const answerKey = `cq_${cq.id}`;
              const currentAnswer = answers[answerKey];

              return (
                <div
                  key={cq.id}
                  className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 ${
                    currentAnswer
                      ? "border-green-200 shadow-green-50"
                      : "border-gray-100"
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          currentAnswer
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {cqIdx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800 leading-relaxed pt-0.5">
                          {cq.text}
                        </p>
                        {!cq.is_required && (
                          <span className="text-xs text-gray-400 mt-1 inline-block">
                            (opcional)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-10">
                      {cq.question_type === "open_text" ? (
                        <textarea
                          value={currentAnswer?.text_value || ""}
                          onChange={(e) =>
                            handleAnswerChange(null, cq.id, e.target.value, cq)
                          }
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all resize-none"
                          rows={3}
                          placeholder="Digite sua resposta..."
                        />
                      ) : cq.options ? (
                        <div className="space-y-2">
                          {cq.options.map((opt, optIdx) => {
                            const isRadio =
                              cq.question_type !== "multiple_choice";
                            const selectedList =
                              cq.question_type === "multiple_choice"
                                ? (currentAnswer?.text_value || "")
                                    .split("|")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                : [];
                            const isSelected =
                              cq.question_type === "multiple_choice"
                                ? selectedList.includes(opt)
                                : currentAnswer?.text_value === opt;

                            return (
                              <label
                                key={optIdx}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? "border-[#10b981] bg-[#f0fdf4] shadow-sm"
                                    : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                {isRadio ? (
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                      isSelected
                                        ? "border-[#10b981] bg-[#10b981]"
                                        : "border-gray-300"
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                      isSelected
                                        ? "border-[#10b981] bg-[#10b981]"
                                        : "border-gray-300"
                                    }`}
                                  >
                                    {isSelected && (
                                      <CheckCircle2 className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                )}
                                <input
                                  type={isRadio ? "radio" : "checkbox"}
                                  name={`cq_${cq.id}`}
                                  value={opt}
                                  checked={isSelected}
                                  onChange={() =>
                                    handleAnswerChange(null, cq.id, opt, cq)
                                  }
                                  className="sr-only"
                                />
                                <span
                                  className={`text-sm ${
                                    isSelected
                                      ? "text-[#10b981] font-medium"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {opt}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea
                          value={currentAnswer?.text_value || ""}
                          onChange={(e) =>
                            handleAnswerChange(null, cq.id, e.target.value, cq)
                          }
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all resize-none"
                          rows={3}
                          placeholder="Digite sua resposta..."
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Navegação fixa no rodapé */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={goBack}
              className="py-2.5 px-5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            <div className="text-xs text-gray-400 hidden sm:block">
              {isDimension
                ? `${step.questions.filter((q) => answers[`q_${q.id}`]).length}/${step.questions.length} nesta seção`
                : `${step.questions.filter((q) => answers[`cq_${q.id}`]).length}/${step.questions.length} nesta seção`}
            </div>

            <button
              onClick={goNext}
              className="bg-gradient-to-r from-[#10b981] to-[#047857] hover:from-[#047857] hover:to-[#022c22] text-white font-semibold py-2.5 px-5 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg shadow-green-900/10"
            >
              {currentStep === steps.length ? "Revisar" : "Próxima"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render principal ─────────────────────────────────
  return (
    <>
      {currentStep > 0 && <ProgressBar />}
      {currentStep === 0 && IntroScreen()}
      {currentStep > 0 && currentStep <= steps.length && QuestionScreen()}
      {currentStep === steps.length + 1 && ReviewScreen()}
    </>
  );
}
