"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { QuestionnaireConfig } from "@/types";
import QuestionnaireForm from "@/components/forms/questionnaire-form";
import { useToast } from "@/components/toast";

export default function EditQuestionnairePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuestionnaire = async () => {
      try {
        const id = parseInt(params.id as string);
        const data = await api.get<QuestionnaireConfig>(`/questionnaires/${id}`);
        setQuestionnaire(data);
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar questionário."
        );
        router.push("/questionnaires");
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      loadQuestionnaire();
    }
  }, [params.id, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!questionnaire) {
    return null;
  }

  return <QuestionnaireForm questionnaire={questionnaire} mode="edit" />;
}
