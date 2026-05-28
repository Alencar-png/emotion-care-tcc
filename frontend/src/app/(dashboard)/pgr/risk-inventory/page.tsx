"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PGRRisk, Campaign, PaginatedResponse } from "@/types";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { ArrowLeft, ShieldAlert, Trash2 } from "lucide-react";
import { isMedicalOrAbove } from "@/lib/auth";

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

const RISK_LEVEL_CLASSES: Record<string, string> = {
  low: "badge badge-success",
  medium: "bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-medium",
  high: "bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium",
  critical: "bg-red-200 text-red-900 px-2 py-0.5 rounded text-xs font-medium",
};

function getSeverityBadgeClass(value: number): string {
  if (value <= 2) return "badge badge-success";
  if (value === 3) return "bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-medium";
  return "bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium";
}

export default function RiskInventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();

  const [risks, setRisks] = useState<PGRRisk[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const canEdit = isMedicalOrAbove();

  const handleDeleteRisk = async (riskId: number) => {
    if (!confirm("Tem certeza que deseja remover este risco e seus planos de ação associados?")) return;
    try {
      await api.delete(`/pgr/risks/${riskId}`);
      toast("success", "Risco removido.");
      loadRisks();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao remover.");
    }
  };

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!companyId) return;
      setLoadingCampaigns(true);
      try {
        const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
          company_id: companyId,
          page_size: 100,
        });
        const filtered = res.data.filter(
          (c) => c.status === "completed" || c.status === "in_progress"
        );
        setCampaigns(filtered);
        if (filtered.length > 0) {
          setSelectedCampaignId(filtered[0].id);
        }
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar campanhas."
        );
      } finally {
        setLoadingCampaigns(false);
      }
    };
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Load risks when campaign changes
  const loadRisks = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setLoading(true);
    try {
      const res = await api.get<PGRRisk[]>(
        `/pgr/${companyId}/risk-inventory`,
        { campaign_id: selectedCampaignId }
      );
      setRisks(res);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao carregar inventário de riscos."
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedCampaignId]);

  useEffect(() => {
    loadRisks();
  }, [loadRisks]);

  return (
    <div>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/pgr")}
            className="btn btn-ghost btn-sm"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-heading-2 flex items-center gap-2">
              <ShieldAlert size={24} />
              Inventário de Riscos Psicossociais
            </h1>
          </div>
        </div>
      </div>

      {/* Campaign selector */}
      <div className="card-emotioncare mb-6">
        <div className="card-body py-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <label className="text-body-sm font-medium text-brand-text">
              Campanha:
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) =>
                setSelectedCampaignId(
                  e.target.value ? parseInt(e.target.value) : ""
                )
              }
              className="input-emotioncare text-sm h-9 min-w-[250px]"
              disabled={loadingCampaigns}
            >
              {loadingCampaigns ? (
                <option value="">Carregando campanhas...</option>
              ) : campaigns.length === 0 ? (
                <option value="">Nenhuma campanha disponível</option>
              ) : (
                campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-emotioncare">
        <div className="card-body overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner-emotioncare" />
            </div>
          ) : risks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-brand-muted">
              <ShieldAlert size={48} className="mb-3 opacity-40" />
              <p className="text-body-sm">
                Nenhum risco encontrado para esta campanha.
              </p>
              <p className="text-caption text-brand-disabled mt-1">
                Gere o PGR na página principal para criar o inventário.
              </p>
            </div>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b text-left text-brand-muted">
                  <th className="pb-3 pr-4 font-medium">Dimensão</th>
                  <th className="pb-3 pr-4 font-medium">Fonte</th>
                  <th className="pb-3 pr-4 font-medium">Danos Possíveis</th>
                  <th className="pb-3 pr-4 font-medium">Severidade</th>
                  <th className="pb-3 pr-4 font-medium">Probabilidade</th>
                  <th className="pb-3 pr-4 font-medium">Nível de Risco</th>
                  <th className="pb-3 font-medium">Medidas de Controle</th>
                  {canEdit && <th className="pb-3 font-medium text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {risks.map((risk) => (
                  <tr
                    key={risk.id}
                    className="border-b last:border-b-0 hover:bg-brand-bg-subtle transition-colors"
                  >
                    <td className="py-3 pr-4 font-semibold text-brand-text">
                      {risk.risk_axis}
                    </td>
                    <td className="py-3 pr-4 max-w-[180px]">
                      <span
                        className="block truncate text-brand-text"
                        title={risk.source || ""}
                      >
                        {risk.source || "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 max-w-[180px]">
                      <span
                        className="block truncate text-brand-text"
                        title={risk.possible_damages || ""}
                      >
                        {risk.possible_damages || "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block ${getSeverityBadgeClass(risk.severity)}`}
                      >
                        {risk.severity}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block ${getSeverityBadgeClass(risk.probability)}`}
                      >
                        {risk.probability}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block ${RISK_LEVEL_CLASSES[risk.risk_level] || "badge"}`}
                      >
                        {RISK_LEVEL_LABELS[risk.risk_level] || risk.risk_level}
                      </span>
                    </td>
                    <td className="py-3 text-brand-text max-w-[200px]">
                      <span className="block truncate" title={risk.control_measures || ""}>
                        {risk.control_measures || "—"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDeleteRisk(risk.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-brand-muted hover:text-red-600 transition-colors"
                          title="Remover risco"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
