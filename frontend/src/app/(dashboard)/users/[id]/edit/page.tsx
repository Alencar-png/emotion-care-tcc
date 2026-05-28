"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { User } from "@/types";
import UserForm from "@/components/forms/user-form";
import { useToast } from "@/components/toast";

export default function EditUserPage() {
  const params = useParams();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userId = parseInt(params.id as string);
        const data = await api.get<User>(`/users/${userId}`);
        setUser(data);
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar usuário."
        );
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [params.id, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner-emotioncare" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-error-bg text-error p-4 rounded-lg border border-error-border">
          Usuário não encontrado.
        </div>
      </div>
    );
  }

  return <UserForm user={user} mode="edit" />;
}
