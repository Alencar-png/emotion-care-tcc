"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Company } from "@/types";
import CompanyForm from "@/components/forms/company-form";

export default function EditCompanyPage() {
  const params = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Company>(`/companies/${params.id}`);
        setCompany(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar empresa."
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

  if (error || !company) {
    return (
      <div className="bg-error-bg text-error p-4 rounded-lg border border-error-border">
        {error || "Empresa não encontrada."}
      </div>
    );
  }

  return <CompanyForm company={company} mode="edit" />;
}
