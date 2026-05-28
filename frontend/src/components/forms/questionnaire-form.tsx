"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import {
  Instrument,
  Dimension,
  QuestionnaireConfig,
  QuestionnaireConfigCreate,
  QuestionnaireConfigUpdate,
  CustomQuestionCreate,
  PaginatedResponse,
} from "@/types";
import { getCurrentUserFromToken } from "@/lib/auth";
import { useCompanyId } from "@/lib/contexts/company-context";
import { ArrowLeft } from "lucide-react";

interface QuestionnaireFormProps {
  questionnaire?: QuestionnaireConfig;
  mode: "create" | "edit";
}

export default function QuestionnaireForm({
  questionnaire,
  mode,
}: QuestionnaireFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUserFromToken();
  const selectedCompanyId = useCompanyId();
  const [loading, setLoading] = useState(false);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<number | null>(
    questionnaire?.instrument_id || null
  );
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestionCreate[]>(
    []
  );

  const [form, setForm] = useState({
    instrument_id: questionnaire?.instrument_id || 0,
    name: questionnaire?.name || "",
    description: questionnaire?.description || "",
    periodicity: questionnaire?.periodicity || "annual",
    dimension_ids: [] as number[],
  });

  const loadDimensions = async (instrumentId: number) => {
    try {
      const res = await api.get<Dimension[]>(
        `/instruments/${instrumentId}/dimensions`
      );
      setDimensions(res);
      if (mode === "edit" && questionnaire) {
        // Manter seleções existentes
      }
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar dimensões."
      );
    }
  };

  const loadQuestionnaireDetails = async (id: number) => {
    try {
      const detail = await api.get<QuestionnaireConfig & {
        selected_dimensions: Dimension[];
        custom_questions: Array<{
          id: number;
          text: string;
          question_type: string;
          options: string[] | null;
          display_order: number;
          is_required: boolean;
        }>;
      }>(`/questionnaires/${id}`);
      setForm({
        instrument_id: detail.instrument_id,
        name: detail.name,
        description: detail.description || "",
        periodicity: detail.periodicity,
        dimension_ids: detail.selected_dimensions.map((d) => d.id),
      });
      setSelectedInstrument(detail.instrument_id);
      setDimensions(detail.selected_dimensions);
      setCustomQuestions(
        detail.custom_questions.map((cq) => ({
          text: cq.text,
          question_type: cq.question_type,
          options: cq.options || undefined,
          display_order: cq.display_order,
          is_required: cq.is_required,
        }))
      );
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar detalhes."
      );
    }
  };

  useEffect(() => {
    const loadInstruments = async () => {
      try {
        const res = await api.get<Instrument[]>("/instruments/");
        setInstruments(res);
        if (questionnaire && res.length > 0) {
          setSelectedInstrument(questionnaire.instrument_id);
          loadDimensions(questionnaire.instrument_id);
        }
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar instrumentos."
        );
      }
    };
    loadInstruments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (questionnaire && questionnaire.id) {
      loadQuestionnaireDetails(questionnaire.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire]);


  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const instrumentId = parseInt(e.target.value);
    setSelectedInstrument(instrumentId);
    setForm((prev) => ({ ...prev, instrument_id: instrumentId }));
    loadDimensions(instrumentId);
    setForm((prev) => ({ ...prev, dimension_ids: [] }));
  };

  const handleDimensionToggle = (dimensionId: number) => {
    setForm((prev) => {
      const newIds = prev.dimension_ids.includes(dimensionId)
        ? prev.dimension_ids.filter((id) => id !== dimensionId)
        : [...prev.dimension_ids, dimensionId];
      return { ...prev, dimension_ids: newIds };
    });
  };

  const handleAddCustomQuestion = () => {
    setCustomQuestions([
      ...customQuestions,
      {
        text: "",
        question_type: "open_text",
        display_order: customQuestions.length,
        is_required: false,
      },
    ]);
  };

  const handleCustomQuestionChange = (
    index: number,
    field: keyof CustomQuestionCreate,
    value: string | string[] | number | boolean
  ) => {
    setCustomQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveCustomQuestion = (index: number) => {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const companyId = selectedCompanyId || user?.company_id;
      if (!companyId || companyId === 0) {
        toast("error", "Selecione uma empresa para criar questionários.");
        setLoading(false);
        return;
      }

      if (mode === "create") {
        const payload: QuestionnaireConfigCreate = {
          company_id: companyId,
          instrument_id: form.instrument_id,
          name: form.name,
          description: form.description || undefined,
          periodicity: form.periodicity,
          dimension_ids: form.dimension_ids,
          custom_questions: customQuestions.filter((cq) => cq.text.trim() !== ""),
        };
        await api.post("/questionnaires/", payload);
        toast("success", "Questionário criado com sucesso.");
      } else {
        const payload: QuestionnaireConfigUpdate = {
          name: form.name,
          description: form.description || undefined,
          periodicity: form.periodicity,
          dimension_ids: form.dimension_ids,
          custom_questions: customQuestions.filter((cq) => cq.text.trim() !== ""),
        };
        await api.put(`/questionnaires/${questionnaire!.id}`, payload);
        toast("success", "Questionário atualizado com sucesso.");
      }
      router.push("/questionnaires");
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao salvar questionário."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => router.push("/questionnaires")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para questionários
      </button>

      <div className="card-emotioncare max-w-4xl">
        <div className="card-body">
          <h2 className="text-heading-2 text-brand-text mb-6">
            {mode === "create" ? "Novo Questionário" : "Editar Questionário"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="section-title">Informações Básicas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Instrumento *</label>
                  <select
                    name="instrument_id"
                    value={form.instrument_id}
                    onChange={handleInstrumentChange}
                    required
                    className="input-emotioncare w-full"
                    disabled={mode === "edit"}
                  >
                    <option value="0">Selecione um instrumento</option>
                    {instruments.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} {inst.version ? `(${inst.version})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-emotioncare">Periodicidade *</label>
                  <select
                    name="periodicity"
                    value={form.periodicity}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                  >
                    <option value="annual">Anual</option>
                    <option value="semiannual">Semestral</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label-emotioncare">Nome *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    className="input-emotioncare w-full"
                    placeholder="Ex: Avaliação de Saúde Mental Q1 2026"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label-emotioncare">Descrição</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    className="input-emotioncare w-full"
                    placeholder="Descreva o objetivo deste questionário..."
                  />
                </div>
              </div>
            </div>

            {selectedInstrument && dimensions.length > 0 && (
              <div>
                <h3 className="section-title">Dimensões</h3>
                <p className="text-body-sm text-brand-muted mb-4">
                  Selecione as dimensões que serão incluídas neste questionário:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-brand-border rounded-lg p-4">
                  {dimensions.map((dim) => (
                    <label
                      key={dim.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-brand-bg-subtle cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.dimension_ids.includes(dim.id)}
                        onChange={() => handleDimensionToggle(dim.id)}
                        className="checkbox-emotioncare mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-body font-medium text-brand-text">
                          {dim.name}
                        </p>
                        {dim.description && (
                          <p className="text-body-sm text-brand-muted mt-1">
                            {dim.description}
                          </p>
                        )}
                        <p className="text-caption text-brand-muted mt-1">
                          {dim.question_count || dim.questions?.length || 0}{" "}
                          questões
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">Questões Customizadas</h3>
                <button
                  type="button"
                  onClick={handleAddCustomQuestion}
                  className="btn btn-secondary btn-sm"
                >
                  + Adicionar Questão
                </button>
              </div>
              {customQuestions.length === 0 ? (
                <p className="text-body-sm text-brand-muted">
                  Nenhuma questão customizada adicionada.
                </p>
              ) : (
                <div className="space-y-4">
                  {customQuestions.map((cq, idx) => (
                    <div
                      key={idx}
                      className="border border-brand-border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-label-upper text-brand-muted">
                          Questão {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomQuestion(idx)}
                          className="text-error hover:text-error-hover text-sm"
                        >
                          Remover
                        </button>
                      </div>
                      <div>
                        <label className="label-emotioncare">Texto da Questão *</label>
                        <input
                          value={cq.text}
                          onChange={(e) =>
                            handleCustomQuestionChange(idx, "text", e.target.value)
                          }
                          className="input-emotioncare w-full"
                          placeholder="Digite a pergunta..."
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="label-emotioncare">Tipo *</label>
                          <select
                            value={cq.question_type}
                            onChange={(e) => {
                              const newType = e.target.value;
                              handleCustomQuestionChange(idx, "question_type", newType);
                              // Set default options when switching to a type that needs them
                              if (newType === "likert_scale") {
                                handleCustomQuestionChange(idx, "options", [
                                  "Discordo totalmente",
                                  "Discordo",
                                  "Neutro",
                                  "Concordo",
                                  "Concordo totalmente",
                                ]);
                              } else if (
                                newType === "multiple_choice" ||
                                newType === "single_choice"
                              ) {
                                if (!cq.options || cq.options.length === 0) {
                                  handleCustomQuestionChange(idx, "options", [
                                    "Opcao 1",
                                    "Opcao 2",
                                  ]);
                                }
                              } else {
                                handleCustomQuestionChange(idx, "options", undefined as unknown as string[]);
                              }
                            }}
                            className="input-emotioncare w-full"
                          >
                            <option value="open_text">Texto Aberto</option>
                            <option value="multiple_choice">Multipla Escolha</option>
                            <option value="single_choice">Escolha Unica</option>
                            <option value="likert_scale">Escala Likert</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <input
                            type="checkbox"
                            checked={cq.is_required}
                            onChange={(e) =>
                              handleCustomQuestionChange(
                                idx,
                                "is_required",
                                e.target.checked
                              )
                            }
                            className="checkbox-emotioncare"
                          />
                          <label className="text-body-sm text-brand-text-2">
                            Obrigatoria
                          </label>
                        </div>
                      </div>

                      {/* Options editor for choice-based and likert questions */}
                      {(cq.question_type === "multiple_choice" ||
                        cq.question_type === "single_choice" ||
                        cq.question_type === "likert_scale") && (
                        <div className="mt-3">
                          <label className="label-emotioncare">
                            {cq.question_type === "likert_scale"
                              ? "Escala (do menor ao maior)"
                              : "Opcoes de Resposta"}
                          </label>
                          <div className="space-y-2">
                            {(cq.options || []).map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <span className="text-caption text-brand-muted w-6 text-center">
                                  {optIdx + 1}.
                                </span>
                                <input
                                  value={opt}
                                  onChange={(e) => {
                                    const newOptions = [...(cq.options || [])];
                                    newOptions[optIdx] = e.target.value;
                                    handleCustomQuestionChange(
                                      idx,
                                      "options",
                                      newOptions
                                    );
                                  }}
                                  className="input-emotioncare flex-1"
                                  placeholder={`Opcao ${optIdx + 1}`}
                                />
                                {(cq.options || []).length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newOptions = (cq.options || []).filter(
                                        (_, i) => i !== optIdx
                                      );
                                      handleCustomQuestionChange(
                                        idx,
                                        "options",
                                        newOptions
                                      );
                                    }}
                                    className="text-error hover:text-error-hover text-sm px-1"
                                  >
                                    x
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const newOptions = [
                                  ...(cq.options || []),
                                  `Opcao ${(cq.options || []).length + 1}`,
                                ];
                                handleCustomQuestionChange(idx, "options", newOptions);
                              }}
                              className="text-primary hover:text-primary-hover text-sm font-medium mt-1"
                            >
                              + Adicionar opcao
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-brand-border">
              <button
                type="button"
                onClick={() => router.push("/questionnaires")}
                className="btn btn-secondary btn-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || form.dimension_ids.length === 0}
                className="btn btn-primary btn-md"
              >
                {loading && <div className="spinner-brand-white" />}
                {loading
                  ? "Salvando..."
                  : mode === "create"
                  ? "Criar Questionário"
                  : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
