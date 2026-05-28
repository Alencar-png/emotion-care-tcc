"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CampaignDetail } from "@/types";
import CampaignForm from "@/components/forms/campaign-form";
import { useToast } from "@/components/toast";

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCampaign = async () => {
      try {
        const id = parseInt(params.id as string);
        const data = await api.get<CampaignDetail>(`/campaigns/${id}`);
        setCampaign(data);
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar campanha."
        );
        router.push("/campaigns");
      } finally {
        setLoading(false);
      }
    };
    if (params.id) {
      loadCampaign();
    }
  }, [params.id, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  return <CampaignForm campaign={campaign} mode="edit" />;
}
