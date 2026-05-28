"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { QuestionnairePreview } from "@/types";
import { useToast } from "@/components/toast";
import { ArrowLeft } from "lucide-react";

export default function PreviewQuestionnairePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState<QuestionnairePreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const id = parseInt(params.id as string);
        const data = await api.get<QuestionnairePreview>(
          `/questionnaires/${id}/preview`
        );
        setPreview(data);
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar preview."
        );
        router.push("/questionnaires");
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      loadPreview();
    }
  }, [params.id, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!preview) {
    return null;
  }

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
          <div className="mb-6">
            <h2 className="text-heading-2 text-brand-text">{preview.config_name}</h2>
            <p className="text-body-sm text-brand-muted mt-2">
              {preview.instrument_name} • {preview.total_questions} questões
            </p>
          </div>

          {preview.dimensions.map((dim, dimIdx) => (
            <div key={dimIdx} className="mb-8 last:mb-0">
              <h3 className="text-heading-3 text-brand-text mb-2">{dim.name}</h3>
              {dim.description && (
                <p className="text-body-sm text-brand-muted mb-4">{dim.description}</p>
              )}
              <div className="space-y-4">
                {dim.questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="border border-brand-border rounded-lg p-4 bg-brand-bg-subtle"
                  >
                    <p className="text-body font-medium text-brand-text mb-2">
                      {qIdx + 1}. {q.text}
                    </p>
                    {q.scale_type && q.scale_labels && q.scale_labels.length > 0 && (
                      <div className="mt-3">
                        <p className="text-body-sm text-brand-muted mb-2">
                          Escala: {q.scale_type.replace(/_/g, " ")}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {q.scale_labels.map((label: unknown, labelIdx: number) => {
                            const labelText = typeof label === "string"
                              ? label
                              : (label as { value?: number; label?: string })?.label || String(label);
                            const labelValue = typeof label === "string"
                              ? labelIdx + 1
                              : (label as { value?: number })?.value ?? labelIdx + 1;
                            return (
                              <span
                                key={labelIdx}
                                className="badge badge-neutral text-xs"
                              >
                                {labelValue}: {labelText}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {q.question_type && q.options && (
                      <div className="mt-3">
                        <p className="text-body-sm text-brand-muted mb-2">
                          Opções:
                        </p>
                        <div className="space-y-1">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className="text-body-sm text-brand-text-2 pl-4"
                            >
                              • {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {preview.custom_questions.length > 0 && (
            <div className="mt-8 pt-8 border-t border-brand-border">
              <h3 className="text-heading-3 text-brand-text mb-4">
                Questões Customizadas
              </h3>
              <div className="space-y-4">
                {preview.custom_questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="border border-brand-border rounded-lg p-4 bg-brand-bg-subtle"
                  >
                    <p className="text-body font-medium text-brand-text mb-2">
                      {preview.dimensions.length + qIdx + 1}. {q.text}
                    </p>
                    <p className="text-body-sm text-brand-muted">
                      Tipo: {q.question_type}
                    </p>
                    {q.options && (
                      <div className="mt-3">
                        <p className="text-body-sm text-brand-muted mb-2">
                          Opções:
                        </p>
                        <div className="space-y-1">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className="text-body-sm text-brand-text-2 pl-4"
                            >
                              • {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
