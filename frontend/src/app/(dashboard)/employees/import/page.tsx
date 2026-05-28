"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { getCurrentUserFromToken } from "@/lib/auth";
import { useCompanyId } from "@/lib/contexts/company-context";
import { ImportPreview, ImportRow } from "@/types";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  X,
  Download,
} from "lucide-react";

type Step = "upload" | "preview" | "result";

export default function ImportEmployeesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = getCurrentUserFromToken();
  const selectedCompanyId = useCompanyId();
  const companyId = selectedCompanyId || user?.company_id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    created_count: number;
    error_count: number;
    errors: { row: number; name: string; error: string }[];
    message: string;
  } | null>(null);

  const handleDownloadTemplate = () => {
    import("xlsx").then((XLSX) => {
      const data = [
        ["Nome", "Email", "CPF", "Telefone", "Setor", "Cargo", "Localidade"],
        ["João da Silva", "joao@empresa.com", "12345678901", "11999999999", "Tecnologia", "Desenvolvedor", "São Paulo"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [
        { wch: 25 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
      XLSX.writeFile(wb, "modelo_importacao_colaboradores.xls", { bookType: "xls" });
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      toast("error", "Formato não suportado. Use arquivos CSV ou XLSX.");
      return;
    }

    setFile(selectedFile);
  };

  const handlePreview = async () => {
    if (!file || !companyId) {
      toast("error", "Selecione uma empresa antes de importar.");
      return;
    }
    setLoading(true);

    try {
      const data = await api.uploadFile<ImportPreview>(
        "/employees/import/preview",
        file,
        { company_id: companyId }
      );
      setPreview(data);
      setStep("preview");
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao processar arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || !companyId) return;
    setLoading(true);

    try {
      const rows: ImportRow[] = preview.rows
        .filter((r) => r._valid !== false)
        .map((r) => ({
          name: r.name || "",
          email: r.email || undefined,
          cpf: r.cpf || undefined,
          phone: r.phone || undefined,
          department_name: r.department_name || undefined,
          job_role_title: r.job_role_title || undefined,
          location: r.location || undefined,
        }));

      const res = await api.post<{
        created_count: number;
        error_count: number;
        errors: { row: number; name: string; error: string }[];
        message: string;
      }>(`/employees/import/confirm?company_id=${companyId}`, {
        rows,
      });

      setResult(res);
      setStep("result");
      toast("success", res.message);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao importar colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => router.push("/employees")}
        className="btn btn-ghost btn-sm mb-4 text-brand-muted hover:text-primary"
      >
        <ArrowLeft size={16} />
        Voltar para colaboradores
      </button>

      <div className="page-header">
        <h1 className="page-title">Importar Colaboradores</h1>
        <p className="page-subtitle">
          Importe colaboradores em massa via arquivo CSV ou XLSX.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["Upload", "Preview", "Resultado"].map((label, i) => {
          const stepNames: Step[] = ["upload", "preview", "result"];
          const currentIdx = stepNames.indexOf(step);
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;

          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-[2px] ${
                    isDone ? "bg-primary" : "bg-brand-border"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 text-body-sm font-medium ${
                  isActive
                    ? "text-primary"
                    : isDone
                    ? "text-success"
                    : "text-brand-disabled"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    isActive
                      ? "bg-primary-light text-primary"
                      : isDone
                      ? "bg-success-bg text-success"
                      : "bg-brand-bg-muted text-brand-disabled"
                  }`}
                >
                  {isDone ? <Check size={12} /> : i + 1}
                </div>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="card-emotioncare">
          <div className="card-body">
            <div className="max-w-lg mx-auto text-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-brand-border rounded-xl p-12 cursor-pointer hover:border-primary-border hover:bg-primary-lighter transition-all"
              >
                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet
                      className="text-primary"
                      size={40}
                    />
                    <p className="text-body font-medium text-brand-text">
                      {file.name}
                    </p>
                    <p className="text-caption text-brand-muted">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="text-brand-disabled" size={40} />
                    <p className="text-body-sm text-brand-text-2">
                      Clique para selecionar ou arraste um arquivo
                    </p>
                    <p className="text-caption text-brand-muted">CSV ou XLSX</p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="mt-6 p-4 bg-brand-bg-muted rounded-lg text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-caption font-medium text-brand-text-2 mb-2">
                      Formato esperado do arquivo:
                    </p>
                    <p className="text-caption text-brand-muted">
                      Colunas: <code className="bg-brand-bg-subtle border border-brand-border px-1 rounded text-primary">Nome</code>,{" "}
                      <code className="bg-brand-bg-subtle border border-brand-border px-1 rounded text-primary">Email</code>,{" "}
                      <code className="bg-brand-bg-subtle border border-brand-border px-1 rounded text-primary">CPF</code>,{" "}
                      <code className="bg-brand-bg-subtle border border-brand-border px-1 rounded text-primary">Telefone</code>,{" "}
                      <code className="bg-brand-bg-subtle border border-brand-border px-1 rounded text-primary">Setor</code>,{" "}
                      <code className="bg-brand-bg-subtle border border-brand-border px-1 rounded text-primary">Cargo</code>,{" "}
                      <code className="bg-brand-bg-subtle border border-brand-border px-1 rounded text-primary">Localidade</code>
                    </p>
                    <p className="text-caption text-brand-disabled mt-1">
                      Separador: ponto e vírgula (;) para CSV
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn btn-secondary btn-sm flex-shrink-0"
                  >
                    <Download size={14} />
                    Baixar Modelo
                  </button>
                </div>
              </div>

              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="btn btn-primary btn-md w-full mt-6"
              >
                {loading && <div className="spinner-brand-white" />}
                {loading ? "Processando..." : "Visualizar dados"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-emotioncare p-4">
              <p className="text-body-sm text-brand-muted">Total de linhas</p>
              <p className="text-heading-1 text-brand-text mt-1">
                {preview.total_rows}
              </p>
            </div>
            <div className="card-emotioncare p-4 !border-success-border">
              <p className="text-body-sm text-success">Linhas válidas</p>
              <p className="text-heading-1 text-success mt-1">
                {preview.valid_rows}
              </p>
            </div>
            <div className="card-emotioncare p-4 !border-error-border">
              <p className="text-body-sm text-error">Com erros</p>
              <p className="text-heading-1 text-error mt-1">
                {preview.invalid_rows}
              </p>
            </div>
          </div>

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="bg-error-bg border border-error-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="text-error" size={16} />
                <span className="text-body-sm font-medium text-error">
                  Erros encontrados
                </span>
              </div>
              <ul className="space-y-1">
                {preview.errors.map((err, i) => (
                  <li key={i} className="text-caption text-error">
                    Linha {err.row}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data preview */}
          <div className="card-emotioncare overflow-hidden">
            <div className="card-header">
              <h3 className="text-heading-3 text-brand-text">
                Preview dos dados
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-brand-bg-subtle">
                    <th className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted">#</th>
                    <th className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted">Nome</th>
                    <th className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted">E-mail</th>
                    <th className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted">CPF</th>
                    <th className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted">Setor</th>
                    <th className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted">Cargo</th>
                    <th className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {preview.rows.slice(0, 50).map((row, i) => (
                    <tr
                      key={i}
                      className={
                        row._valid === false
                          ? "bg-error-bg"
                          : "hover:bg-[#F6F3EB]"
                      }
                    >
                      <td className="px-4 py-2.5 text-caption text-brand-muted">{i + 1}</td>
                      <td className="px-4 py-2.5 text-body-sm text-brand-text-2">{row.name || "—"}</td>
                      <td className="px-4 py-2.5 text-body-sm text-brand-text-2">{row.email || "—"}</td>
                      <td className="px-4 py-2.5 text-body-sm text-brand-text-2">{row.cpf || "—"}</td>
                      <td className="px-4 py-2.5 text-body-sm text-brand-text-2">{row.department_name || "—"}</td>
                      <td className="px-4 py-2.5 text-body-sm text-brand-text-2">{row.job_role_title || "—"}</td>
                      <td className="px-4 py-2.5">
                        {row._valid === false ? (
                          <span className="inline-flex items-center gap-1 text-caption text-error font-medium">
                            <X size={12} /> Erro
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-caption text-success font-medium">
                            <Check size={12} /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.total_rows > 50 && (
              <div className="card-footer">
                <p className="text-caption text-brand-muted">
                  Mostrando 50 de {preview.total_rows} linhas
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setStep("upload");
                setPreview(null);
                setFile(null);
              }}
              className="btn btn-secondary btn-md"
            >
              Voltar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || preview.valid_rows === 0}
              className="btn btn-primary btn-md"
            >
              {loading && <div className="spinner-brand-white" />}
              {loading
                ? "Importando..."
                : `Importar ${preview.valid_rows} colaboradores`}
            </button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === "result" && result && (
        <div className="card-emotioncare max-w-lg mx-auto">
          <div className="card-body text-center">
            <div className="mb-4">
              {result.error_count === 0 ? (
                <div className="inline-flex items-center justify-center w-16 h-16 bg-success-bg rounded-full mb-4">
                  <Check className="text-success" size={32} />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-16 h-16 bg-warning-bg rounded-full mb-4">
                  <AlertTriangle className="text-warning" size={32} />
                </div>
              )}
            </div>

            <h2 className="text-heading-2 text-brand-text mb-2">
              {result.message}
            </h2>

            <div className="grid grid-cols-2 gap-4 mt-6 mb-6">
              <div className="bg-success-bg rounded-lg p-3">
                <p className="text-body-sm text-success">Importados</p>
                <p className="text-heading-1 text-success mt-1">
                  {result.created_count}
                </p>
              </div>
              <div className="bg-error-bg rounded-lg p-3">
                <p className="text-body-sm text-error">Erros</p>
                <p className="text-heading-1 text-error mt-1">
                  {result.error_count}
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-error-bg border border-error-border rounded-lg p-3 text-left mb-6">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-caption text-error">
                    Linha {err.row} ({err.name}): {err.error}
                  </p>
                ))}
              </div>
            )}

            <button
              onClick={() => router.push("/employees")}
              className="btn btn-primary btn-md w-full"
            >
              Voltar para colaboradores
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
