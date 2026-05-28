"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getApiBase } from "@/lib/api";
import { useCompanyId } from "@/lib/contexts/company-context";
import { useToast } from "@/components/toast";
import { PGRVersion } from "@/types";
import { ArrowLeft, Download, History, FileText, Filter } from "lucide-react";

export default function PGRHistoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [versions, setVersions] = useState<PGRVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVersions = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await api.get<PGRVersion[]>(`/pgr/${companyId}/versions`);
      setVersions(data);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleDownloadPdf = async (version: PGRVersion) => {
    if (!companyId) return;
    try {
      const token = localStorage.getItem("access_token");
      const base = getApiBase().replace(/\/+$/, "");

      let url: string;
      let filename: string;

      if (version.granular_mode && version.group_name) {
        // NC_PGR_FILTER: download granular
        const params = new URLSearchParams({
          campaign_id: String(version.campaign_id),
          group_name: version.group_name,
          granular_mode: version.granular_mode,
        });
        url = `${base}/pgr/${companyId}/export-pdf-granular?${params}`;
        const safeName = version.group_name.replace(/\s+/g, "_").replace(/\//g, "-");
        filename = `PGR_NR01_${companyId}_${version.campaign_id}_${safeName}.pdf`;
      } else {
        url = `${base}/pgr/${companyId}/export-pdf?campaign_id=${version.campaign_id}`;
        filename = `PGR_NR01_${companyId}_${version.campaign_id}.pdf`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Erro ao gerar PDF (${response.status})`);
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("PDF vazio retornado pelo servidor.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao baixar PDF.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner-emotioncare" />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/pgr")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para PGR
      </button>

      <div className="space-y-6">
        <div>
          <h2 className="text-heading-2 text-brand-text">Histórico de Versões do PGR</h2>
          <p className="text-body-sm text-brand-muted mt-1">
            Rastreabilidade de todas as versões geradas do PGR.
          </p>
        </div>

        <div className="card-emotioncare">
          <div className="card-body">
            {versions.length === 0 ? (
              <div className="text-center py-12">
                <History size={48} className="mx-auto text-brand-muted/30 mb-4" />
                <p className="text-body text-brand-muted">Nenhuma versão do PGR foi gerada ainda.</p>
                <button
                  onClick={() => router.push("/pgr")}
                  className="btn btn-primary btn-md mt-4"
                >
                  Gerar primeiro PGR
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-bg-subtle">
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">Versão</th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">Campanha</th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">Tipo</th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">Data de Geração</th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">Gerado por</th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">Observações</th>
                      <th className="text-left text-label-upper text-brand-muted px-4 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {versions.map((version) => (
                      <tr key={version.id} className="hover:bg-brand-bg-subtle">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-primary" />
                            <span className="text-body font-semibold text-brand-text">
                              v{version.version_number}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text">
                          {version.campaign_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {version.granular_mode && version.group_name ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                <Filter size={10} />
                                Granular
                              </span>
                              <p className="text-xs text-brand-muted mt-0.5">{version.group_name}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-bg-subtle text-brand-muted">
                              Consolidado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text-2">
                          {version.generated_at
                            ? new Date(version.generated_at).toLocaleString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text-2">
                          {version.generator_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text-2">
                          {version.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDownloadPdf(version)}
                            className="btn btn-secondary btn-sm"
                            title="Baixar PDF"
                          >
                            <Download size={14} />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
