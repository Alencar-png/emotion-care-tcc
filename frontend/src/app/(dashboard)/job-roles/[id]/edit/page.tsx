"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { JobRole } from "@/types";
import JobRoleForm from "@/components/forms/job-role-form";

export default function EditJobRolePage() {
  const params = useParams();
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<JobRole>(`/job-roles/${params.id}`);
        setJobRole(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar função."
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="spinner-emotioncare" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (error || !jobRole) {
    return (
      <div className="bg-error-bg text-error p-4 rounded-lg border border-error-border">
        {error || "Função não encontrada."}
      </div>
    );
  }

  return <JobRoleForm jobRole={jobRole} mode="edit" />;
}
