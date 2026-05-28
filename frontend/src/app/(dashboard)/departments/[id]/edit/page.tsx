"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Department } from "@/types";
import DepartmentForm from "@/components/forms/department-form";

export default function EditDepartmentPage() {
  const params = useParams();
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Department>(`/departments/${params.id}`);
        setDepartment(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar setor."
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

  if (error || !department) {
    return (
      <div className="bg-error-bg text-error p-4 rounded-lg border border-error-border">
        {error || "Setor não encontrado."}
      </div>
    );
  }

  return <DepartmentForm department={department} mode="edit" />;
}
