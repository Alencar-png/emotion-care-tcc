"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ActionPlan,
  ActionPlan5W2HUpdate,
  ActionPlanVersion,
  Campaign,
  PaginatedResponse,
} from "@/types";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import { isMedicalOrAbove } from "@/lib/auth";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import {
  ArrowLeft,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Filter,
  Trash2,
  History,
  Bot,
} from "lucide-react";

type StatusFilter = "all" | "pending" | "in_progress" | "completed";

export default function ActionPlanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const canEdit = isMedicalOrAbove();

  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null);
  const [editForm, setEditForm] = useState<ActionPlan5W2HUpdate>({});

  // Version history modal
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versions, setVersions] = useState<ActionPlanVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionPlanId, setVersionPlanId] = useState<number | null>(null);

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
          page_size: 100,
          company_id: companyId || undefined,
        });
        setCampaigns(res.data);
        if (res.data.length > 0 && !selectedCampaign) {
          setSelectedCampaign(String(res.data[0].id));
        }
      } catch (err: unknown) {
        toast(
          "error",
          err instanceof Error ? err.message : "Erro ao carregar campanhas."
        );
      }
    };
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Load action plans
  const loadPlans = useCallback(async () => {
    if (!companyId || !selectedCampaign) {
      setPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<ActionPlan[]>(
        `/pgr/${companyId}/action-plans`,
        { campaign_id: selectedCampaign }
      );
      setPlans(res);
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error
          ? err.message
          : "Erro ao carregar plano de ação."
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedCampaign]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Filtered plans
  const filteredPlans =
    statusFilter === "all"
      ? plans
      : plans.filter((p) => p.status === statusFilter);

  // Helpers
  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const isOverdue = (deadline: string | null, status: string) => {
    if (!deadline || status === "completed") return false;
    return new Date(deadline) < new Date();
  };

  const isNearDeadline = (deadline: string | null, status: string) => {
    if (!deadline || status === "completed") return false;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  };

  const getRiskBadge = (level: string | undefined) => {
    if (!level) return null;
    const map: Record<string, { label: string; className: string }> = {
      low: { label: "Baixo", className: "badge badge-success" },
      medium: { label: "Médio", className: "badge badge-warning" },
      high: { label: "Alto", className: "badge badge-error" },
      critical: { label: "Crítico", className: "badge badge-error" },
    };
    const info = map[level.toLowerCase()] || { label: level, className: "badge badge-neutral" };
    return (
      <span className={info.className}>
        {info.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: "Pendente", className: "badge badge-neutral" },
      in_progress: {
        label: "Em Andamento",
        className: "badge badge-warning",
      },
      completed: { label: "Concluído", className: "badge badge-success" },
    };
    const info = statusMap[status] || statusMap.pending;
    return <span className={info.className}>{info.label}</span>;
  };

  // Edit modal
  const openEditModal = (plan: ActionPlan) => {
    setEditingPlan(plan);
    let deadlineValue = "";
    if (plan.deadline) {
      try {
        deadlineValue = new Date(plan.deadline).toISOString().slice(0, 10);
      } catch {
        deadlineValue = String(plan.deadline).slice(0, 10);
      }
    }
    setEditForm({
      measure: plan.measure,
      responsible_person: plan.responsible_person || "",
      deadline: deadlineValue,
      status: plan.status,
      classification: plan.classification || "",
      notes: plan.notes || "",
      what_action: plan.what_action || "",
      why_action: plan.why_action || "",
      who_responsible: plan.who_responsible || "",
      where_action: plan.where_action || "",
      when_action: plan.when_action || "",
      how_action: plan.how_action || "",
      how_much: plan.how_much || "",
      indicator: plan.indicator || "",
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      await api.put(`/pgr/action-plans/${editingPlan.id}/5w2h`, editForm);
      toast("success", "Plano de ação atualizado com sucesso.");
      setEditModalOpen(false);
      setEditingPlan(null);
      loadPlans();
    } catch (err: unknown) {
      toast(
        "error",
        err instanceof Error
          ? err.message
          : "Erro ao atualizar plano de ação."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleViewVersions = async (planId: number) => {
    setVersionPlanId(planId);
    setLoadingVersions(true);
    setVersionModalOpen(true);
    try {
      const v = await api.get<ActionPlanVersion[]>(
        `/pgr/action-plans/${planId}/versions`
      );
      setVersions(v);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDelete = async (planId: number) => {
    if (!confirm("Tem certeza que deseja remover este plano de ação?")) return;
    try {
      await api.delete(`/pgr/action-plans/${planId}`);
      toast("success", "Plano de ação removido.");
      loadPlans();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao remover.");
    }
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendentes" },
    { key: "in_progress", label: "Em Andamento" },
    { key: "completed", label: "Concluídas" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/pgr")}
            className="btn btn-ghost btn-sm"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-heading-2">Plano de Ação</h1>
            <p className="text-body-sm text-brand-muted">
              Gerencie as medidas de controle e ações corretivas do PGR.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-emotioncare mb-6">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Campaign selector */}
            <div className="flex-1 min-w-[200px]">
              <label className="label-emotioncare">Campanha</label>
              <select
                className="input-emotioncare"
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
              >
                <option value="">Selecione uma campanha</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="label-emotioncare flex items-center gap-1">
                <Filter size={14} />
                Status
              </label>
              <div className="flex gap-1">
                {statusFilters.map((sf) => (
                  <button
                    key={sf.key}
                    onClick={() => setStatusFilter(sf.key)}
                    className={`btn btn-sm ${
                      statusFilter === sf.key
                        ? "btn-primary"
                        : "btn-secondary"
                    }`}
                  >
                    {sf.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="spinner-emotioncare" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="card-emotioncare">
          <div className="card-body flex flex-col items-center justify-center py-16 text-center">
            <FileText size={48} className="text-brand-muted mb-4" />
            <p className="text-brand-text font-medium mb-1">
              Nenhum plano de ação encontrado
            </p>
            <p className="text-body-sm text-brand-muted">
              {!selectedCampaign
                ? "Selecione uma campanha para visualizar os planos de ação."
                : "Não há planos de ação para os filtros selecionados."}
            </p>
          </div>
        </div>
      ) : (
        <div className="card-emotioncare overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left px-4 py-3 text-body-sm text-brand-muted font-medium">
                  Dimensão
                </th>
                <th className="text-left px-4 py-3 text-body-sm text-brand-muted font-medium">
                  Medida
                </th>
                <th className="text-left px-4 py-3 text-body-sm text-brand-muted font-medium">
                  Responsável
                </th>
                <th className="text-left px-4 py-3 text-body-sm text-brand-muted font-medium">
                  Prazo
                </th>
                <th className="text-left px-4 py-3 text-body-sm text-brand-muted font-medium">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-body-sm text-brand-muted font-medium">
                  Origem
                </th>
                <th className="text-right px-4 py-3 text-body-sm text-brand-muted font-medium">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-brand-border last:border-b-0 hover:bg-brand-bg-muted/50 transition-colors"
                >
                  {/* Dimensão */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-body-sm text-brand-text">
                        {plan.risk_axis || "—"}
                      </span>
                      {getRiskBadge(plan.original_risk_level)}
                    </div>
                  </td>

                  {/* Medida */}
                  <td className="px-4 py-3">
                    <span className="text-body-sm text-brand-text">
                      {plan.measure}
                    </span>
                  </td>

                  {/* Responsável */}
                  <td className="px-4 py-3">
                    <span
                      className={`text-body-sm ${
                        plan.responsible_person
                          ? "text-brand-text"
                          : "text-brand-muted italic"
                      }`}
                    >
                      {plan.responsible_person || "A definir"}
                    </span>
                  </td>

                  {/* Prazo */}
                  <td className="px-4 py-3">
                    <span
                      className={`text-body-sm flex items-center gap-1 ${
                        isOverdue(plan.deadline, plan.status)
                          ? "text-red-600 font-medium"
                          : isNearDeadline(plan.deadline, plan.status)
                          ? "text-yellow-600 font-medium"
                          : "text-brand-text"
                      }`}
                    >
                      {isOverdue(plan.deadline, plan.status) && (
                        <AlertTriangle size={14} />
                      )}
                      {isNearDeadline(plan.deadline, plan.status) && (
                        <Clock size={14} />
                      )}
                      {plan.status === "completed" && (
                        <CheckCircle size={14} className="text-green-600" />
                      )}
                      {formatDate(plan.deadline)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">{getStatusBadge(plan.status)}</td>

                  {/* Origem */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {plan.last_edited_by ? (
                        <>
                          <span className="text-xs text-brand-muted flex items-center gap-1">
                            <Edit size={10} />
                            Editado
                          </span>
                          {plan.editor_name && (
                            <span className="text-xs text-brand-muted">
                              por {plan.editor_name}
                            </span>
                          )}
                          {plan.last_edited_at && (
                            <span className="text-xs text-brand-muted">
                              {formatDateTime(plan.last_edited_at)}
                            </span>
                          )}
                        </>
                      ) : plan.what_action ? (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Bot size={10} />
                          IA Original
                        </span>
                      ) : (
                        <span className="text-xs text-brand-muted">-</span>
                      )}
                    </div>
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(plan)}
                          className="p-1.5 rounded-md hover:bg-primary-light text-brand-muted hover:text-primary transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleViewVersions(plan.id)}
                          className="p-1.5 rounded-md hover:bg-blue-50 text-brand-muted hover:text-blue-600 transition-colors"
                          title="Histórico de versões"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(plan.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-brand-muted hover:text-red-600 transition-colors"
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={editModalOpen} onOpenChange={setEditModalOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Editar Plano de Ação</ModalTitle>
            {editingPlan && (
              <p className="text-body-sm text-brand-muted mt-1">
                {editingPlan.risk_axis}
                {editingPlan.last_edited_by && editingPlan.editor_name && (
                  <span className="ml-2 text-xs italic">
                    (Editado por {editingPlan.editor_name} em {formatDateTime(editingPlan.last_edited_at ?? null)})
                  </span>
                )}
              </p>
            )}
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Medida / O quê */}
              <div>
                <label className="label-emotioncare">Medida de Controle / O quê</label>
                <textarea
                  className="input-emotioncare w-full min-h-[80px]"
                  value={editForm.what_action || editForm.measure || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, what_action: e.target.value, measure: e.target.value })
                  }
                />
              </div>

              {/* Por quê */}
              <div>
                <label className="label-emotioncare">Por quê</label>
                <textarea
                  className="input-emotioncare w-full min-h-[60px]"
                  placeholder="Justificativa da ação..."
                  value={editForm.why_action || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, why_action: e.target.value })
                  }
                />
              </div>

              {/* Responsável + Quem + Prazo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Quem (Responsável)</label>
                  <input
                    type="text"
                    className="input-emotioncare w-full"
                    placeholder="Nome do responsável"
                    value={editForm.who_responsible || editForm.responsible_person || ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        who_responsible: e.target.value,
                        responsible_person: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Prazo</label>
                  <input
                    type="date"
                    className="input-emotioncare w-full"
                    value={editForm.deadline ? editForm.deadline.slice(0, 10) : ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, deadline: e.target.value ? e.target.value + "T23:59:00" : "" })
                    }
                  />
                </div>
              </div>

              {/* Onde + Quando */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Onde</label>
                  <input
                    type="text"
                    className="input-emotioncare w-full"
                    placeholder="Local de aplicação"
                    value={editForm.where_action || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, where_action: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Quando</label>
                  <input
                    type="text"
                    className="input-emotioncare w-full"
                    placeholder="Ex: Imediato, 30 dias..."
                    value={editForm.when_action || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, when_action: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Como */}
              <div>
                <label className="label-emotioncare">Como</label>
                <textarea
                  className="input-emotioncare w-full min-h-[60px]"
                  placeholder="Descrição de como a ação será executada..."
                  value={editForm.how_action || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, how_action: e.target.value })
                  }
                />
              </div>

              {/* Quanto + Indicador */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Quanto</label>
                  <input
                    type="text"
                    className="input-emotioncare w-full"
                    placeholder="Custo estimado"
                    value={editForm.how_much || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, how_much: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Indicador</label>
                  <input
                    type="text"
                    className="input-emotioncare w-full"
                    placeholder="Indicador de acompanhamento"
                    value={editForm.indicator || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, indicator: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Status + Classificação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Status</label>
                  <select
                    className="input-emotioncare w-full"
                    value={editForm.status || "pending"}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value })
                    }
                  >
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="completed">Concluído</option>
                  </select>
                </div>
                <div>
                  <label className="label-emotioncare">Classificação</label>
                  <input
                    type="text"
                    className="input-emotioncare w-full"
                    placeholder="Ex: Organizacional"
                    value={editForm.classification || ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        classification: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="label-emotioncare">Observações</label>
                <textarea
                  className="input-emotioncare w-full min-h-[80px]"
                  placeholder="Notas adicionais..."
                  value={editForm.notes || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary btn-md"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <div className="spinner-brand-white" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Version History Modal */}
      <Modal open={versionModalOpen} onOpenChange={setVersionModalOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Histórico de Versões</ModalTitle>
          </ModalHeader>
          <ModalBody>
            {loadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner-emotioncare" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-brand-muted">
                <History size={32} className="mx-auto mb-2 opacity-50" />
                <p>Nenhum histórico de versões disponível.</p>
                <p className="text-xs mt-1">O histórico será criado quando o plano for editado.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {versions.map((version) => (
                  <div key={version.id} className="border border-brand-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`badge text-xs ${
                            version.version_type === "ai_original"
                              ? "badge-primary"
                              : "badge-warning"
                          }`}
                        >
                          {version.version_type === "ai_original" ? "IA Original" : "Edição Manual"}
                        </span>
                        {version.editor_name && (
                          <span className="text-xs text-brand-muted">
                            por {version.editor_name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-brand-muted">
                        {formatDateTime(version.edited_at)}
                      </span>
                    </div>
                    {version.notes && (
                      <p className="text-xs text-brand-muted">{version.notes}</p>
                    )}
                    {version.data_json && (
                      <details className="mt-2">
                        <summary className="text-xs text-primary cursor-pointer hover:underline">
                          Ver dados da versão
                        </summary>
                        <div className="mt-2 bg-brand-bg-subtle rounded p-2 text-xs font-mono overflow-x-auto">
                          {Object.entries(version.data_json).filter(([, val]) => !!val).map(([key, val]) => (
                            <div key={key} className="mb-1">
                              <span className="font-medium text-brand-muted">{key}:</span>{" "}
                              <span className="text-brand-text">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setVersionModalOpen(false)}
            >
              Fechar
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
