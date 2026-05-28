"use client";

import { useState } from "react";
import { Search, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMainSidebar } from "@/hooks/use-main-sidebar";

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  /** Ocultar esta coluna no card mobile */
  mobileHidden?: boolean;
}

interface DataTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  searchPlaceholder?: string;
  onSearch: (search: string) => void;
  onPageChange: (page: number) => void;
  /** Callback quando o usuario altera o tamanho da pagina */
  onPageSizeChange?: (size: number) => void;
  /** Opcoes disponiveis no seletor de tamanho de pagina */
  pageSizeOptions?: readonly number[];
  onAdd?: () => void;
  addLabel?: string;
  actions?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  /** Callback ao clicar na linha — torna o nome clicável */
  onRowClick?: (item: T) => void;
}

export default function DataTable<T extends { id: number }>({
  title,
  columns,
  data,
  total,
  page,
  pageSize,
  totalPages,
  loading,
  searchPlaceholder = "Buscar...",
  onSearch,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 50, 100],
  onAdd,
  addLabel = "Novo",
  actions,
  emptyMessage = "Nenhum registro encontrado.",
  onRowClick,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState("");
  const { isMobile } = useMainSidebar();

  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch(value);
  };

  // Colunas visíveis no mobile (exclui as marcadas como mobileHidden)
  const mobileColumns = columns.filter((col) => !col.mobileHidden);

  return (
    <div className="card-emotioncare overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-brand-bg-subtle">
        <h2 className="text-heading-3 text-brand-text">{title}</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
              size={16}
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              className="input-emotioncare pl-10 w-full sm:w-[260px]"
            />
          </div>
          {/* Add button */}
          {onAdd && (
            <button
              onClick={onAdd}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              <Plus size={16} />
              {addLabel}
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo: Cards no mobile, Table no desktop */}
      {isMobile ? (
        /* ─── Mobile: Card View ─── */
        <div className="divide-y divide-brand-border">
          {loading ? (
            <div className="px-4 py-12 text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="spinner-emotioncare" />
                <span className="text-body-sm text-brand-muted">Carregando...</span>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-body-sm text-brand-muted">{emptyMessage}</p>
            </div>
          ) : (
            data.map((item, idx) => (
              <div
                key={item.id || idx}
                className="px-4 py-3 space-y-2 hover:bg-[#F6F3EB] transition-colors"
              >
                {/* Primeira coluna como título do card */}
                {mobileColumns.length > 0 && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-body-sm font-medium truncate ${
                          onRowClick ? "text-primary cursor-pointer hover:underline" : "text-brand-text"
                        }`}
                        onClick={onRowClick ? () => onRowClick(item) : undefined}
                      >
                        {mobileColumns[0].render
                          ? mobileColumns[0].render(item)
                          : ((item as Record<string, unknown>)[mobileColumns[0].key] as React.ReactNode) ?? "—"}
                      </p>
                    </div>
                    {actions && (
                      <div className="shrink-0">
                        {actions(item)}
                      </div>
                    )}
                  </div>
                )}

                {/* Demais colunas como pares label/valor */}
                {mobileColumns.length > 1 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {mobileColumns.slice(1).map((col) => (
                      <div key={col.key} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                          {col.label}
                        </p>
                        <p className="text-body-sm text-brand-text-2 truncate">
                          {col.render
                            ? col.render(item)
                            : ((item as Record<string, unknown>)[col.key] as React.ReactNode) ?? "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* ─── Desktop: Table View ─── */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-bg-subtle">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2.5 text-left text-label-upper uppercase text-brand-muted tracking-wider whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                {actions && (
                  <th className="px-4 py-2.5 text-right text-label-upper uppercase text-brand-muted tracking-wider whitespace-nowrap">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="px-4 py-12 text-center"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="spinner-emotioncare" />
                      <span className="text-body-sm text-brand-muted">Carregando...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="px-4 py-12 text-center"
                  >
                    <p className="text-body-sm text-brand-muted">{emptyMessage}</p>
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="hover:bg-[#F6F3EB] transition-colors"
                  >
                    {columns.map((col, colIdx) => {
                      const cellContent = col.render
                        ? col.render(item)
                        : ((item as Record<string, unknown>)[col.key] as React.ReactNode) ?? "—";
                      const isNameCol = colIdx === 0 && onRowClick;
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-body-sm ${
                            isNameCol
                              ? "text-primary font-medium cursor-pointer hover:underline"
                              : "text-brand-text-2"
                          }`}
                          onClick={isNameCol ? () => onRowClick(item) : undefined}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                    {actions && (
                      <td className="px-4 py-3 text-right">
                        {actions(item)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="px-4 sm:px-5 py-3 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 bg-brand-bg-subtle">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <p className="text-body-sm text-brand-muted">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de{" "}
              {total}
            </p>
            {onPageSizeChange && (
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="dt-page-size"
                  className="text-body-sm text-brand-muted whitespace-nowrap"
                >
                  Exibir
                </label>
                <select
                  id="dt-page-size"
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="input-emotioncare text-body-sm h-8 w-auto min-w-[64px] py-0 px-2"
                >
                  {pageSizeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded-md hover:bg-brand-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-brand-text-2"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-body-sm text-brand-text-2 px-2">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded-md hover:bg-brand-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-brand-text-2"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
