"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AdminResponseDetail, AdminResponseAnswer } from "@/types";
import { useToast } from "@/components/toast";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  User,
  Building2,
  Briefcase,
  Mail,
  Megaphone,
  ClipboardList,
  Calendar,
  MessageSquare,
  Hash,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { isCompanyAdminOrAbove, isSuperAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";

// ─── Labels padrão das escalas ────────────────────────
const SCALE_LABELS: Record<string, string[]> = {
  likert_5_frequency: [
    "Sempre",
    "Frequentemente",
    "Às vezes",
    "Raramente",
    "Nunca",
  ],
  likert_5_intensity: [
    "Em grande medida",
    "Em boa medida",
    "Em certa medida",
    "Em pequena medida",
    "Em nenhuma medida",
  ],
  likert_5_satisfaction: [
    "Muito satisfeito",
    "Satisfeito",
    "Nem satisfeito, nem insatisfeito",
    "Insatisfeito",
    "Muito insatisfeito",
  ],
  likert_5_agreement: [
    "Concordo totalmente",
    "Concordo",
    "Nem concordo, nem discordo",
    "Discordo",
    "Discordo totalmente",
  ],
  likert_5_health: [
    "Excelente",
    "Muito boa",
    "Boa",
    "Razoável",
    "Deficiente",
  ],
  likert_5_amount: [
    "Enormemente",
    "Muito",
    "Um pouco",
    "Quase nada",
    "Nada",
  ],
};

function getScaleLabel(
  scaleType: string | null,
  scaleLabels: Array<string | { value: number; label: string }> | null,
  value: number | null
): string {
  if (value === null || value === undefined) return "—";
  if (scaleLabels) {
    for (const sl of scaleLabels) {
      if (typeof sl === "string") continue;
      if (sl.value === value) return sl.label;
    }
  }
  const fallback = scaleType ? SCALE_LABELS[scaleType] : null;
  if (fallback && value >= 0 && value < fallback.length) {
    return fallback[value];
  }
  return `${value}`;
}

function getScoreColor(value: number | null, total: number = 5): string {
  if (value === null) return "bg-gray-200";
  const pct = (value / (total - 1)) * 100;
  if (pct <= 33) return "bg-green-500";
  if (pct <= 66) return "bg-yellow-500";
  return "bg-red-500";
}

// ─── Agrupamento por dimensão ─────────────────────────
interface DimensionGroup {
  name: string;
  answers: AdminResponseAnswer[];
}

function groupByDimension(
  answers: AdminResponseAnswer[]
): { dimensions: DimensionGroup[]; customAnswers: AdminResponseAnswer[] } {
  const dimMap = new Map<string, AdminResponseAnswer[]>();
  const customAnswers: AdminResponseAnswer[] = [];

  for (const a of answers) {
    if (a.is_custom) {
      customAnswers.push(a);
    } else if (a.dimension_name) {
      const existing = dimMap.get(a.dimension_name) || [];
      existing.push(a);
      dimMap.set(a.dimension_name, existing);
    } else {
      // Sem dimensão — tratar como "Outras"
      const existing = dimMap.get("Outras") || [];
      existing.push(a);
      dimMap.set("Outras", existing);
    }
  }

  const dimensions: DimensionGroup[] = [];
  dimMap.forEach((ans, name) => {
    dimensions.push({ name, answers: ans });
  });

  return { dimensions, customAnswers };
}

// ─── Componente AnswerCard ────────────────────────────
function AnswerCard({ answer, index }: { answer: AdminResponseAnswer; index: number }) {
  const isLikert = answer.numeric_value !== null && !answer.is_custom;
  // Normalize labels with their values for rendering
  const scaleItems: { label: string; value: number }[] | null = answer.scale_labels
    ? answer.scale_labels.map((sl, i) =>
        typeof sl === "string"
          ? { label: sl, value: i }
          : { label: sl.label, value: sl.value }
      )
    : answer.scale_type && SCALE_LABELS[answer.scale_type]
      ? SCALE_LABELS[answer.scale_type].map((label, i) => ({ label, value: i }))
      : null;
  const totalOptions = scaleItems ? scaleItems.length : 5;

  return (
    <div className="border border-brand-border rounded-lg p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-2">
            {answer.is_reverse_scored && (
              <span
                className="flex-shrink-0 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium"
                title="Pontuação invertida"
              >
                <AlertTriangle size={10} className="inline mr-0.5" />
                Invertida
              </span>
            )}
          </div>
          <p className="text-body-sm text-brand-text mb-3">
            {answer.question_text || "Pergunta não encontrada"}
          </p>

          {/* Resposta Likert */}
          {isLikert && scaleItems && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex gap-1">
                    {scaleItems.map((item, i) => {
                      const isSelected = item.value === answer.numeric_value;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded flex items-center justify-center text-xs font-medium transition-all ${
                            isSelected
                              ? `${getScoreColor(i, totalOptions)} text-white shadow-md ring-2 ring-offset-2 ring-primary/40 py-2.5 scale-105 z-10`
                              : "bg-brand-bg-subtle text-brand-muted/60 py-2"
                          }`}
                          title={item.label}
                        >
                          <span className="truncate px-1">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <p className="text-xs text-brand-muted flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-primary" />
                Resposta:{" "}
                <span className="font-semibold text-primary">
                  {getScaleLabel(answer.scale_type, answer.scale_labels, answer.numeric_value)}
                </span>
                <span className="text-brand-disabled">({answer.numeric_value})</span>
              </p>
            </div>
          )}

          {/* Resposta Likert sem labels */}
          {isLikert && !scaleItems && (
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-brand-muted" />
              <span className="text-body-sm font-semibold text-brand-text">
                {answer.numeric_value}
              </span>
            </div>
          )}

          {/* Resposta customizada - texto */}
          {answer.is_custom && answer.text_value && (
            <div className="flex items-start gap-2 bg-brand-bg-subtle rounded-lg p-3">
              <MessageSquare size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-body-sm text-brand-text whitespace-pre-wrap">
                {answer.text_value}
              </p>
            </div>
          )}

          {/* Resposta customizada - numérica */}
          {answer.is_custom && answer.numeric_value !== null && !answer.text_value && (
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-primary" />
              <span className="text-body-sm font-semibold text-brand-text">
                {answer.numeric_value}
              </span>
              {answer.options && answer.numeric_value < answer.options.length && (
                <span className="text-body-sm text-brand-muted">
                  — {answer.options[answer.numeric_value]}
                </span>
              )}
            </div>
          )}

          {/* Sem resposta */}
          {answer.numeric_value === null && !answer.text_value && (
            <p className="text-body-sm text-brand-muted italic">
              Sem resposta
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente DimensionSection (colapsável) ────────
function DimensionSection({
  dim,
  dimIndex,
  defaultOpen = true,
}: {
  dim: DimensionGroup;
  dimIndex: number;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card-emotioncare">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full card-body flex items-center gap-3 cursor-pointer hover:bg-brand-bg-subtle/50 transition-colors"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <span className="text-primary font-bold text-sm">
            {dimIndex + 1}
          </span>
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-heading-3 text-brand-text">
            {dim.name}
          </h3>
          <p className="text-xs text-brand-muted">
            {dim.answers.length} pergunta{dim.answers.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isOpen ? (
          <ChevronDown size={20} className="text-brand-muted" />
        ) : (
          <ChevronRight size={20} className="text-brand-muted" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6">
          <div className="space-y-3">
            {dim.answers.map((answer, ansIndex) => (
              <AnswerCard
                key={answer.id}
                answer={answer}
                index={ansIndex}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────
export default function ResponseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const superAdmin = isSuperAdmin();
  const canDelete = isCompanyAdminOrAbove();
  const [response, setResponse] = useState<AdminResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirecionar se não for super admin
  useEffect(() => {
    if (!superAdmin) {
      router.push("/dashboard");
    }
  }, [superAdmin, router]);

  useEffect(() => {
    const loadResponse = async () => {
      try {
        const id = parseInt(params.id as string);
        const data = await api.get<AdminResponseDetail>(
          `/admin/responses/${id}`
        );
        setResponse(data);
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar resposta."
        );
        router.push("/responses");
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      loadResponse();
    }
  }, [params.id, router, toast]);

  const confirmAction = useConfirm();
  const handleDelete = async () => {
    if (!response) return;
    if (
      !(await confirmAction({
        message: "Tem certeza que deseja excluir esta resposta? Esta ação não pode ser desfeita.",
        variant: "danger",
        confirmLabel: "Excluir",
      }))
    )
      return;
    try {
      await api.delete(`/admin/responses/${response.id}`);
      toast("success", "Resposta excluída com sucesso.");
      router.push("/responses");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao excluir resposta."
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!response) {
    return null;
  }

  const { dimensions, customAnswers } = groupByDimension(response.answers);

  return (
    <div>
      <button
        onClick={() => router.push("/responses")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para respostas
      </button>

      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="card-emotioncare">
          <div className="card-body">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-heading-2 text-brand-text">
                    Resposta
                  </h2>
                  {response.is_complete ? (
                    <span className="badge badge-success inline-flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Completa
                    </span>
                  ) : (
                    <span className="badge badge-neutral inline-flex items-center gap-1">
                      <Clock size={12} />
                      Parcial
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-brand-muted">
                  {response.total_answers} respostas individuais registradas
                </p>
              </div>
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="btn btn-sm text-error hover:bg-error-bg border border-error/20"
                >
                  <Trash2 size={14} />
                  Excluir Resposta
                </button>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Participante */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-bg-subtle">
                <User
                  size={18}
                  className="text-primary mt-0.5 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs text-brand-muted uppercase tracking-wider mb-0.5">
                    Participante
                  </p>
                  <p className="text-body-sm font-medium text-brand-text truncate">
                    {response.employee_name || "—"}
                  </p>
                  {response.employee_email && (
                    <p className="text-xs text-brand-muted flex items-center gap-1 mt-0.5">
                      <Mail size={10} />
                      {response.employee_email}
                    </p>
                  )}
                </div>
              </div>

              {/* Setor & Cargo */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-bg-subtle">
                <Building2
                  size={18}
                  className="text-primary mt-0.5 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs text-brand-muted uppercase tracking-wider mb-0.5">
                    Setor / Cargo
                  </p>
                  <p className="text-body-sm font-medium text-brand-text truncate">
                    {response.department_name || "—"}
                  </p>
                  {response.job_role_title && (
                    <p className="text-xs text-brand-muted flex items-center gap-1 mt-0.5">
                      <Briefcase size={10} />
                      {response.job_role_title}
                    </p>
                  )}
                </div>
              </div>

              {/* Campanha */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-bg-subtle">
                <Megaphone
                  size={18}
                  className="text-primary mt-0.5 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs text-brand-muted uppercase tracking-wider mb-0.5">
                    Campanha
                  </p>
                  <p className="text-body-sm font-medium text-brand-text truncate">
                    {response.campaign_name || "—"}
                  </p>
                  {response.instrument_name && (
                    <p className="text-xs text-brand-muted flex items-center gap-1 mt-0.5">
                      <ClipboardList size={10} />
                      {response.instrument_name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Datas */}
            <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-brand-border">
              <div className="flex items-center gap-2 text-body-sm">
                <Calendar size={14} className="text-brand-muted" />
                <span className="text-brand-muted">Iniciado em:</span>
                <span className="text-brand-text font-medium">
                  {response.started_at
                    ? new Date(response.started_at).toLocaleString("pt-BR")
                    : "—"}
                </span>
              </div>
              {response.completed_at && (
                <div className="flex items-center gap-2 text-body-sm">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span className="text-brand-muted">Concluído em:</span>
                  <span className="text-brand-text font-medium">
                    {new Date(response.completed_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Respostas por Dimensão */}
        {dimensions.map((dim, dimIndex) => (
          <DimensionSection
            key={dimIndex}
            dim={dim}
            dimIndex={dimIndex}
            defaultOpen={dimIndex === 0}
          />
        ))}

        {/* Perguntas Customizadas */}
        {customAnswers.length > 0 && (
          <DimensionSection
            dim={{ name: "Perguntas Personalizadas", answers: customAnswers }}
            dimIndex={dimensions.length}
            defaultOpen={false}
          />
        )}

        {/* Sem respostas */}
        {response.answers.length === 0 && (
          <div className="card-emotioncare">
            <div className="card-body text-center py-12">
              <MessageSquare
                size={40}
                className="text-brand-muted mx-auto mb-3"
              />
              <p className="text-body text-brand-muted">
                Nenhuma resposta individual registrada.
              </p>
              <p className="text-body-sm text-brand-muted mt-1">
                O participante pode ter acessado o formulário sem responder.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
