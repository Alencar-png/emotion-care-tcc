"use client";

import { useState, useCallback, createContext, useContext, useRef } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

// ─── Types ──────────────────────────────────────────────
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm?: () => Promise<void>;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ────────────────────────────────────────────
const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}

// ─── Provider ───────────────────────────────────────────
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const onConfirmRef = useRef<(() => Promise<void>) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      onConfirmRef.current = options.onConfirm || null;
      setState({ ...options, open: true });
    });
  }, []);

  const cleanup = () => {
    resolveRef.current = null;
    onConfirmRef.current = null;
    setState(null);
  };

  const handleClose = async (result: boolean) => {
    if (result && onConfirmRef.current) {
      setConfirmLoading(true);
      try {
        await onConfirmRef.current();
      } catch {
        // Erro tratado dentro do onConfirm
      } finally {
        setConfirmLoading(false);
        resolveRef.current?.(result);
        cleanup();
      }
    } else {
      resolveRef.current?.(result);
      cleanup();
    }
  };

  const variantStyles = {
    danger: {
      icon: "bg-error-bg text-error",
      button: "bg-error text-white hover:bg-error/90",
    },
    warning: {
      icon: "bg-warning-bg text-warning",
      button: "bg-warning text-white hover:bg-warning/90",
    },
    default: {
      icon: "bg-primary/10 text-primary",
      button: "btn-primary",
    },
  };

  const v = state?.variant || "default";
  const styles = variantStyles[v];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Modal overlay */}
      {state?.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={confirmLoading ? undefined : () => handleClose(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="p-6">
              {/* Close button */}
              {!confirmLoading && (
                <button
                  onClick={() => handleClose(false)}
                  className="absolute top-4 right-4 text-brand-muted hover:text-brand-text transition-colors"
                >
                  <X size={18} />
                </button>
              )}

              {/* Icon */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${styles.icon}`}>
                <AlertTriangle size={24} />
              </div>

              {/* Content */}
              <h3 className="text-heading-3 text-brand-text mb-2">
                {state.title || "Confirmar ação"}
              </h3>
              <p className="text-body-sm text-brand-text-2 leading-relaxed whitespace-pre-line">
                {state.message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => handleClose(false)}
                disabled={confirmLoading}
                className="btn btn-secondary btn-md flex-1"
              >
                {state.cancelLabel || "Cancelar"}
              </button>
              <button
                onClick={() => handleClose(true)}
                disabled={confirmLoading}
                className={`btn btn-md flex-1 ${styles.button} flex items-center justify-center gap-2`}
              >
                {confirmLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processando...
                  </>
                ) : (
                  state.confirmLabel || "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
