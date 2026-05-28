"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Campaign, PaginatedResponse, ActionPlanVersion } from "@/types";
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
  Bot,
  RefreshCw,
  Check,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  History,
  AlertTriangle,
  Edit3,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Plan5W2H {
  dimensao: string;
  classificacao: string;
  o_que: string;
  por_que: string;
  quem: string;
  onde: string;
  quando: string;
  como: string;
  quanto: string;
  indicador: string;
  // Campos de edição local
  _edited?: boolean;
  _editedBy?: string;
  _editedAt?: string;
}

interface Draft5W2H {
  id: number;
  company_id: number;
  campaign_id: number;
  plans: Plan5W2H[];
  status: string;
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  o_que: "O que",
  por_que: "Por que",
  quem: "Quem",
  onde: "Onde",
  quando: "Quando",
  como: "Como",
  quanto: "Quanto",
  indicador: "Indicador",
};

const FIELD_KEYS = Object.keys(FIELD_LABELS);

export default function ActionPlan5W2HPage() {
  const router = useRouter();
  const { toast } = useToast();
  const companyId = useCompanyId();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft5W2H | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Add action modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<Plan5W2H>({
    dimensao: "",
    classificacao: "Amarelo",
    o_que: "",
    por_que: "",
    quem: "",
    onde: "",
    quando: "",
    como: "",
    quanto: "",
    indicador: "",
  });

  // Regenerate confirmation
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);

  // Version history modal
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versions, setVersions] = useState<ActionPlanVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Delete confirmation
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const hasPermission = isMedicalOrAbove();

  const loadCampaigns = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get<PaginatedResponse<Campaign>>("/campaigns/", {
        company_id: companyId,
        page_size: 100,
      });
      setCampaigns(res.data.filter((c) => c.status === "completed" || c.status === "in_progress"));
    } catch {
      // silencioso
    }
  }, [companyId]);

  const loadDraft = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setLoading(true);
    try {
      const res = await api.get<{ draft: Draft5W2H | null }>(
        `/ai/${companyId}/action-plan-5w2h/draft`,
        { campaign_id: selectedCampaignId }
      );
      setDraft(res.draft);
      setHasUnsavedChanges(false);
    } catch {
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedCampaignId]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => { if (selectedCampaignId) loadDraft(); }, [selectedCampaignId, loadDraft]);

  // ========================
  // Handlers
  // ========================

  const handleGenerate = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setGenerating(true);
    try {
      await api.post(`/ai/${companyId}/action-plan-5w2h/generate`, {
        campaign_id: selectedCampaignId,
        texto_inventario_aprovado: "",
      });
      toast("success", "Plano de acao 5W2H gerado com sucesso!");
      await loadDraft();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao gerar plano.");
    } finally {
      setGenerating(false);
    }
  }, [companyId, selectedCampaignId, toast, loadDraft]);

  const handleRegenerate = useCallback(async () => {
    setRegenConfirmOpen(false);
    await handleGenerate();
  }, [handleGenerate]);

  const handleApprove = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setApproving(true);
    try {
      await api.post(`/ai/${companyId}/action-plan-5w2h/approve`, {
        campaign_id: selectedCampaignId,
      });
      toast("success", "Plano de acao aprovado!");
      await loadDraft();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao aprovar.");
    } finally {
      setApproving(false);
    }
  }, [companyId, selectedCampaignId, toast, loadDraft]);

  const handleFieldChange = (planIndex: number, field: string, value: string) => {
    if (!draft) return;
    const updatedPlans = [...draft.plans];
    const plan = { ...updatedPlans[planIndex] };
    (plan as unknown as Record<string, string>)[field] = value;
    plan._edited = true;
    plan._editedAt = new Date().toISOString();
    updatedPlans[planIndex] = plan;
    setDraft({ ...draft, plans: updatedPlans });
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = useCallback(async () => {
    if (!draft || !companyId || !selectedCampaignId) return;
    setSaving(true);
    try {
      // Salvar o draft atualizado no backend (atualiza plans_json)
      await api.put(`/ai/${companyId}/action-plan-5w2h/draft`, {
        campaign_id: selectedCampaignId,
        plans: draft.plans.map((p) => ({
          dimensao: p.dimensao,
          classificacao: p.classificacao,
          o_que: p.o_que,
          por_que: p.por_que,
          quem: p.quem,
          onde: p.onde,
          quando: p.quando,
          como: p.como,
          quanto: p.quanto,
          indicador: p.indicador,
        })),
      });
      toast("success", "Alteracoes salvas com sucesso!");
      setHasUnsavedChanges(false);
      // Marcar todos os plans como nao-editados
      const cleanPlans = draft.plans.map((p) => ({ ...p, _edited: false }));
      setDraft({ ...draft, plans: cleanPlans });
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao salvar alteracoes.");
    } finally {
      setSaving(false);
    }
  }, [draft, companyId, selectedCampaignId, toast]);

  const handleAddPlan = () => {
    if (!draft) return;
    if (!newPlan.dimensao || !newPlan.o_que) {
      toast("error", "Preencha pelo menos a dimensao e O que.");
      return;
    }
    const updatedPlans = [...draft.plans, { ...newPlan, _edited: true, _editedAt: new Date().toISOString() }];
    setDraft({ ...draft, plans: updatedPlans });
    setHasUnsavedChanges(true);
    setAddModalOpen(false);
    setNewPlan({
      dimensao: "",
      classificacao: "Amarelo",
      o_que: "",
      por_que: "",
      quem: "",
      onde: "",
      quando: "",
      como: "",
      quanto: "",
      indicador: "",
    });
    toast("success", "Acao adicionada. Salve as alteracoes para persistir.");
  };

  const handleRemovePlan = (index: number) => {
    if (!draft) return;
    const updatedPlans = draft.plans.filter((_, i) => i !== index);
    setDraft({ ...draft, plans: updatedPlans });
    setHasUnsavedChanges(true);
    setDeleteIndex(null);
    toast("success", "Acao removida. Salve as alteracoes para persistir.");
  };

  const handleViewVersions = useCallback(async () => {
    if (!companyId || !selectedCampaignId) return;
    setLoadingVersions(true);
    setVersionModalOpen(true);
    try {
      // Buscar versoes dos action plans desta campanha
      const plans = await api.get<Array<{ id: number }>>(
        `/pgr/${companyId}/action-plans`,
        { campaign_id: selectedCampaignId }
      );
      const allVersions: ActionPlanVersion[] = [];
      for (const plan of plans.slice(0, 10)) {
        try {
          const v = await api.get<ActionPlanVersion[]>(
            `/pgr/action-plans/${plan.id}/versions`
          );
          allVersions.push(...v);
        } catch {
          // silencioso
        }
      }
      allVersions.sort((a, b) => {
        const dateA = a.edited_at ? new Date(a.edited_at).getTime() : 0;
        const dateB = b.edited_at ? new Date(b.edited_at).getTime() : 0;
        return dateB - dateA;
      });
      setVersions(allVersions);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }, [companyId, selectedCampaignId]);

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const startEditing = (index: number, field: string) => {
    setEditingIndex(index);
    setEditingField(field);
  };

  const stopEditing = () => {
    setEditingIndex(null);
    setEditingField(null);
  };

  // ========================
  // Render
  // ========================

  if (!hasPermission) {
    return (
      <div className="text-center py-12">
        <p className="text-body text-brand-muted">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px]">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/pgr")} className="btn btn-ghost btn-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="page-title text-heading-2 text-brand-text flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              Plano de Acao 5W2H com IA
            </h1>
            <p className="text-body-sm text-brand-muted mt-1">
              Gere e edite planos de acao estruturados para cada risco identificado.
            </p>
          </div>
        </div>
      </div>

      {/* Campaign selector */}
      <div className="card-emotioncare mb-6">
        <div className="card-body">
          <label className="text-body-sm text-brand-text font-medium mb-2 block">Campanha</label>
          <select
            className="input-emotioncare w-full sm:w-80"
            value={selectedCampaignId ?? ""}
            onChange={(e) => setSelectedCampaignId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Selecione uma campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status === "completed" ? "Concluida" : "Em andamento"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedCampaignId && (
        <div className="text-center py-12 text-brand-muted">
          Selecione uma campanha para continuar.
        </div>
      )}

      {selectedCampaignId && !draft && !loading && (
        <div className="card-emotioncare">
          <div className="card-body text-center py-12">
            <Bot className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-heading-3 text-brand-text mb-2">Gerar Plano 5W2H com IA</h2>
            <p className="text-body-sm text-brand-muted mb-6 max-w-lg mx-auto">
              A IA analisara os riscos identificados e gerara um plano de acao completo no
              formato 5W2H (O que, Por que, Quem, Onde, Quando, Como, Quanto) para cada dimensao.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn btn-primary btn-md inline-flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="spinner-emotioncare w-4 h-4" />
                  Gerando plano...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  Gerar Plano 5W2H
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {loading && selectedCampaignId && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="spinner-emotioncare" />
        </div>
      )}

      {/* Plans review and editing */}
      {draft && !loading && (
        <div>
          {/* Status bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`badge ${
                  draft.status === "aprovado" ? "badge-success" : "badge-warning"
                }`}
              >
                {draft.status === "aprovado" ? "Aprovado" : "Aguardando Revisao"}
              </span>
              <span className="text-xs text-brand-muted">
                {draft.plans.length} plano{draft.plans.length > 1 ? "s" : ""} gerado{draft.plans.length > 1 ? "s" : ""}
              </span>
              {hasUnsavedChanges && (
                <span className="badge badge-warning text-xs">
                  Alteracoes nao salvas
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {hasUnsavedChanges && (
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="btn btn-primary btn-sm flex items-center gap-1"
                >
                  {saving ? <div className="spinner-emotioncare w-3 h-3" /> : <Save className="w-3 h-3" />}
                  Salvar Alteracoes
                </button>
              )}
              <button
                onClick={() => setAddModalOpen(true)}
                className="btn btn-secondary btn-sm flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Adicionar Acao
              </button>
              <button
                onClick={handleViewVersions}
                className="btn btn-secondary btn-sm flex items-center gap-1"
              >
                <History className="w-3 h-3" />
                Historico
              </button>
              <button
                onClick={() => setRegenConfirmOpen(true)}
                disabled={generating}
                className="btn btn-secondary btn-sm flex items-center gap-1"
              >
                {generating ? <div className="spinner-emotioncare w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                Regenerar com IA
              </button>
              {draft.status !== "aprovado" && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="btn btn-primary btn-sm flex items-center gap-1"
                >
                  {approving ? <div className="spinner-emotioncare w-3 h-3" /> : <Check className="w-3 h-3" />}
                  Aprovar Plano
                </button>
              )}
            </div>
          </div>

          {/* Plan cards with inline editing */}
          <div className="space-y-4">
            {draft.plans.map((plan, idx) => (
              <div key={idx} className={`card-emotioncare ${plan._edited ? "ring-2 ring-primary/30" : ""}`}>
                <div className="card-body">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`badge ${
                          plan.classificacao === "Vermelho" ? "badge-error" : "badge-warning"
                        }`}
                      >
                        {plan.classificacao}
                      </span>
                      <h3 className="text-heading-3 text-brand-text">{plan.dimensao}</h3>
                      {plan._edited && (
                        <span className="text-xs text-primary italic">
                          Editado
                          {plan._editedAt && ` em ${formatDate(plan._editedAt)}`}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteIndex(idx)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-brand-muted hover:text-red-600 transition-colors"
                      title="Remover acao"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fields grid - inline editable */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FIELD_KEYS.map((field) => {
                      const isEditing = editingIndex === idx && editingField === field;
                      const value = (plan as unknown as Record<string, string>)[field] || "";

                      return (
                        <div key={field} className={field === "como" ? "sm:col-span-2" : ""}>
                          <p className="text-xs font-medium text-brand-muted mb-1">{FIELD_LABELS[field]}</p>
                          {isEditing ? (
                            <div className="relative">
                              {field === "como" || field === "o_que" || field === "por_que" ? (
                                <textarea
                                  className="input-emotioncare w-full min-h-[80px] text-body-sm"
                                  value={value}
                                  onChange={(e) => handleFieldChange(idx, field, e.target.value)}
                                  onBlur={stopEditing}
                                  autoFocus
                                />
                              ) : (
                                <input
                                  type="text"
                                  className="input-emotioncare w-full text-body-sm"
                                  value={value}
                                  onChange={(e) => handleFieldChange(idx, field, e.target.value)}
                                  onBlur={stopEditing}
                                  onKeyDown={(e) => { if (e.key === "Enter") stopEditing(); }}
                                  autoFocus
                                />
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={() => startEditing(idx, field)}
                              className="text-body-sm text-brand-text bg-brand-bg-subtle rounded-lg p-3 cursor-pointer hover:bg-brand-bg-muted/70 transition-colors group relative min-h-[44px]"
                              title="Clique para editar"
                            >
                              {value || <span className="text-brand-muted italic">Clique para preencher</span>}
                              <Edit3 className="w-3 h-3 text-brand-muted opacity-0 group-hover:opacity-100 absolute top-2 right-2 transition-opacity" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regenerate Confirmation Modal */}
      <Modal open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Regenerar Plano com IA</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-body-sm text-brand-text font-medium mb-2">
                  Atencao: esta acao ira sobrescrever todas as edicoes manuais.
                </p>
                <p className="text-body-sm text-brand-muted">
                  O plano de acao 5W2H sera regenerado pela IA com base nos riscos atuais.
                  Todas as alteracoes manuais feitas nos campos serao perdidas.
                  O historico de versoes anteriores sera mantido.
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setRegenConfirmOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary btn-md"
              onClick={handleRegenerate}
            >
              Confirmar Regeneracao
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={deleteIndex !== null} onOpenChange={() => setDeleteIndex(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Remover Acao</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-body-sm text-brand-text">
              Tem certeza que deseja remover esta acao do plano?
              {deleteIndex !== null && draft?.plans[deleteIndex] && (
                <span className="font-medium block mt-1">
                  {draft.plans[deleteIndex].dimensao} - {draft.plans[deleteIndex].o_que.slice(0, 80)}
                  {draft.plans[deleteIndex].o_que.length > 80 ? "..." : ""}
                </span>
              )}
            </p>
          </ModalBody>
          <ModalFooter>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setDeleteIndex(null)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary btn-md bg-red-600 hover:bg-red-700"
              onClick={() => deleteIndex !== null && handleRemovePlan(deleteIndex)}
            >
              Remover
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Action Modal */}
      <Modal open={addModalOpen} onOpenChange={setAddModalOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Adicionar Nova Acao</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-emotioncare">Dimensao *</label>
                  <input
                    type="text"
                    className="input-emotioncare w-full"
                    placeholder="Ex: Exigencias Quantitativas"
                    value={newPlan.dimensao}
                    onChange={(e) => setNewPlan({ ...newPlan, dimensao: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-emotioncare">Classificacao</label>
                  <select
                    className="input-emotioncare w-full"
                    value={newPlan.classificacao}
                    onChange={(e) => setNewPlan({ ...newPlan, classificacao: e.target.value })}
                  >
                    <option value="Vermelho">Vermelho</option>
                    <option value="Amarelo">Amarelo</option>
                  </select>
                </div>
              </div>
              {FIELD_KEYS.map((field) => (
                <div key={field}>
                  <label className="label-emotioncare">{FIELD_LABELS[field]} {field === "o_que" ? "*" : ""}</label>
                  {field === "como" || field === "o_que" || field === "por_que" ? (
                    <textarea
                      className="input-emotioncare w-full min-h-[60px]"
                      value={(newPlan as unknown as Record<string, string>)[field] || ""}
                      onChange={(e) => setNewPlan({ ...newPlan, [field]: e.target.value })}
                    />
                  ) : (
                    <input
                      type="text"
                      className="input-emotioncare w-full"
                      value={(newPlan as unknown as Record<string, string>)[field] || ""}
                      onChange={(e) => setNewPlan({ ...newPlan, [field]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setAddModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary btn-md"
              onClick={handleAddPlan}
            >
              Adicionar
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Version History Modal */}
      <Modal open={versionModalOpen} onOpenChange={setVersionModalOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Historico de Versoes</ModalTitle>
          </ModalHeader>
          <ModalBody>
            {loadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner-emotioncare" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-brand-muted">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum historico de versoes disponivel.</p>
                <p className="text-xs mt-1">O historico sera criado quando o plano for editado.</p>
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
                          {version.version_type === "ai_original" ? "IA Original" : "Edicao Manual"}
                        </span>
                        {version.editor_name && (
                          <span className="text-xs text-brand-muted">
                            por {version.editor_name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-brand-muted">
                        {formatDate(version.edited_at)}
                      </span>
                    </div>
                    {version.notes && (
                      <p className="text-xs text-brand-muted">{version.notes}</p>
                    )}
                    {version.data_json && (
                      <details className="mt-2">
                        <summary className="text-xs text-primary cursor-pointer hover:underline">
                          Ver dados da versao
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
