"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CampaignDetail, CampaignParticipant, CampaignSendRequest } from "@/types";
import { useToast } from "@/components/toast";
import { isMedicalOrAbove } from "@/lib/auth";
import { useConfirm } from "@/components/confirm-modal";
import { ArrowLeft, Send, RefreshCw, CheckCircle, XCircle, Mail, Users, PlayCircle, StopCircle, Pencil } from "lucide-react";

interface SendJobStatus {
  job_id: string;
  campaign_id: number;
  channel: string;
  status: "queued" | "processing" | "completed" | "failed";
  total_participants: number;
  total_sent: number;
  total_failed: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const canSend = isMedicalOrAbove();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<SendJobStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCampaign = useCallback(async () => {
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
  }, [params.id, router, toast]);

  useEffect(() => {
    if (params.id) {
      loadCampaign();
    }
  }, [params.id, loadCampaign]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollJobStatus = useCallback(
    (campaignId: number, jobId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const status = await api.get<SendJobStatus>(
            `/campaigns/${campaignId}/send/status`,
            { job_id: jobId }
          );
          setSendProgress(status);

          if (status.status === "completed" || status.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setSending(false);

            if (status.status === "completed") {
              toast(
                "success",
                `Envio concluído: ${status.total_sent} enviados${
                  status.total_failed > 0
                    ? `, ${status.total_failed} falharam`
                    : ""
                }.`
              );
            } else {
              toast("error", status.error || "Erro no envio dos questionários.");
            }

            // Reload campaign data
            await loadCampaign();
          }
        } catch {
          // Silently retry on network errors
        }
      }, 2000);
    },
    [toast, loadCampaign]
  );

  const confirmAction = useConfirm();
  const handleStatusChange = async (newStatus: string) => {
    if (!campaign) return;
    const labels: Record<string, string> = {
      in_progress: "reabrir",
      completed: "concluir",
      cancelled: "cancelar",
    };
    if (!(await confirmAction({
      message: `Tem certeza que deseja ${labels[newStatus] || "alterar"} esta campanha?`,
      variant: newStatus === "cancelled" ? "danger" : "warning",
      confirmLabel: labels[newStatus] ? labels[newStatus].charAt(0).toUpperCase() + labels[newStatus].slice(1) : "Confirmar",
    }))) return;
    try {
      await api.put(`/campaigns/${campaign.id}`, { status: newStatus });
      toast("success", `Campanha ${newStatus === "completed" ? "concluída" : newStatus === "in_progress" ? "reaberta" : "atualizada"} com sucesso.`);
      await loadCampaign();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao alterar status.");
    }
  };

  const handleSend = async (channel: string = "email") => {
    if (!campaign) return;
    setSending(true);
    setSendProgress(null);
    try {
      const payload: CampaignSendRequest = { channel };
      const result = await api.post<{ job_id: string; campaign_id: number }>(
        `/campaigns/${campaign.id}/send`,
        payload
      );
      toast("success", "Envio iniciado em background...");
      pollJobStatus(campaign.id, result.job_id);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error ? err.message : "Erro ao iniciar envio."
      );
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "badge badge-neutral" },
      sent: { label: "Enviado", className: "badge badge-success" },
      opened: { label: "Aberto", className: "badge badge-success" },
      started: { label: "Iniciado", className: "badge badge-success" },
      completed: { label: "Concluído", className: "badge badge-success" },
      expired: { label: "Expirado", className: "badge badge-neutral" },
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    return <span className={statusInfo.className}>{statusInfo.label}</span>;
  };

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

  return (
    <div>
      <button
        onClick={() => router.push("/campaigns")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para campanhas
      </button>

      <div className="space-y-6">
        {/* Campaign Info */}
        <div className="card-emotioncare">
          <div className="card-body">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-heading-2 text-brand-text">{campaign.name}</h2>
                <p className="text-body-sm text-brand-muted mt-1">
                  {campaign.config_name} • {campaign.instrument_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canSend && campaign.status === "sending" && (
                  <span className="flex items-center gap-2 text-body-sm text-brand-muted">
                    <RefreshCw size={16} className="animate-spin text-primary" />
                    Envio em andamento...
                  </span>
                )}
                {canSend && (
                  <button
                    onClick={() => router.push(`/campaigns/${campaign.id}/edit`)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                )}
                {canSend && (campaign.status === "in_progress" || campaign.status === "draft") && (
                  <button
                    onClick={() => handleStatusChange("completed")}
                    className="btn btn-sm bg-success text-white hover:bg-success/90"
                  >
                    <StopCircle size={14} />
                    Concluir Campanha
                  </button>
                )}
                {canSend && campaign.status === "completed" && (
                  <button
                    onClick={() => handleStatusChange("in_progress")}
                    className="btn btn-primary btn-sm"
                  >
                    <PlayCircle size={14} />
                    Reabrir Campanha
                  </button>
                )}
              </div>
            </div>
            {campaign.description && (
              <p className="text-body text-brand-text-2 mb-4">{campaign.description}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-body-sm text-brand-muted">Status</p>
                <p className="text-body font-medium text-brand-text mt-1">
                  {campaign.status === "draft"
                    ? "Rascunho"
                    : campaign.status === "sending"
                    ? "Enviando..."
                    : campaign.status === "in_progress"
                    ? "Em Andamento"
                    : campaign.status === "completed"
                    ? "Concluída"
                    : "Cancelada"}
                </p>
              </div>
              <div>
                <p className="text-body-sm text-brand-muted">Participantes</p>
                <p className="text-body font-medium text-brand-text mt-1">
                  {campaign.total_participants || 0}
                </p>
              </div>
              <div>
                <p className="text-body-sm text-brand-muted">Taxa de Resposta</p>
                <p className="text-body font-medium text-brand-text mt-1">
                  {campaign.response_rate || 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Send Actions */}
        {canSend && (campaign.status === "draft" || campaign.status === "in_progress") && !sending && (
          <div className="card-emotioncare border-primary/20 bg-primary/[0.02]">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-heading-3 text-brand-text">
                      {campaign.status === "draft"
                        ? "Enviar Questionários"
                        : "Reenviar para Pendentes"}
                    </h3>
                    <p className="text-body-sm text-brand-muted">
                      {campaign.status === "draft"
                        ? `Enviar e-mail para todos os ${campaign.total_participants} participantes`
                        : `Reenviar para participantes que ainda não responderam`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleSend("email")}
                  disabled={sending}
                  className="btn btn-primary btn-md"
                >
                  <Send size={16} />
                  {campaign.status === "draft" ? "Enviar E-mails" : "Reenviar E-mails"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send Progress */}
        {sending && sendProgress && (
          <div className="card-emotioncare">
            <div className="card-body">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-heading-3 text-brand-text">Progresso do Envio</h3>
                <span className="text-body-sm text-brand-muted">
                  {sendProgress.total_sent + sendProgress.total_failed} / {sendProgress.total_participants}
                </span>
              </div>
              <div className="w-full bg-brand-bg-muted rounded-full h-2.5 mb-3">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      sendProgress.total_participants > 0
                        ? ((sendProgress.total_sent + sendProgress.total_failed) /
                            sendProgress.total_participants) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex gap-4 text-body-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle size={14} />
                  {sendProgress.total_sent} enviados
                </span>
                {sendProgress.total_failed > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle size={14} />
                    {sendProgress.total_failed} falharam
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Participants */}
        <div className="card-emotioncare">
          <div className="card-body">
            <h3 className="text-heading-3 text-brand-text mb-4">Participantes</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-bg-subtle">
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                      Nome
                    </th>
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                      E-mail
                    </th>
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                      Setor
                    </th>
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                      Status
                    </th>
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                      Enviado em
                    </th>
                    <th className="text-left text-label-upper text-brand-muted px-4 py-2">
                      Concluído em
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {campaign.participants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-body-sm text-brand-muted">
                        Nenhum participante cadastrado.
                      </td>
                    </tr>
                  ) : (
                    campaign.participants.map((participant) => (
                      <tr key={participant.id} className="hover:bg-brand-bg-subtle">
                        <td className="px-4 py-3 text-body-sm text-brand-text">
                          {participant.employee_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text-2">
                          {participant.employee_email || "—"}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text-2">
                          {participant.employee_department || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(participant.status)}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text-2">
                          {participant.sent_at
                            ? new Date(participant.sent_at).toLocaleString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-body-sm text-brand-text-2">
                          {participant.completed_at
                            ? new Date(participant.completed_at).toLocaleString("pt-BR")
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
