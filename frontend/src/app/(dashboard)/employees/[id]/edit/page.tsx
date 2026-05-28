"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Employee } from "@/types";
import EmployeeForm from "@/components/forms/employee-form";

export default function EditEmployeePage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Employee>(`/employees/${params.id}`);
        setEmployee(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar colaborador."
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

  if (error || !employee) {
    return (
      <div className="bg-error-bg text-error p-4 rounded-lg border border-error-border">
        {error || "Colaborador não encontrado."}
      </div>
    );
  }

  return <EmployeeForm employee={employee} mode="edit" />;
}
