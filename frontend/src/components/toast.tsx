"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastContextType {
  toast: (type: "success" | "error" | "info", message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      const id = Math.random().toString(36).substring(7);
      setToasts((prev) => [...prev, { id, type, message }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastMessage;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: {
      bg: "bg-success-bg border-success-border",
      text: "text-success",
      icon: <CheckCircle2 size={18} className="text-success shrink-0" />,
    },
    error: {
      bg: "bg-error-bg border-error-border",
      text: "text-error",
      icon: <AlertCircle size={18} className="text-error shrink-0" />,
    },
    info: {
      bg: "bg-info-bg border-info-border",
      text: "text-info",
      icon: <Info size={18} className="text-info shrink-0" />,
    },
  };

  const { bg, text, icon } = config[toast.type];

  return (
    <div
      className={`${bg} border rounded-lg px-4 py-3 shadow-lg min-w-[300px] max-w-[420px] flex items-center gap-3 animate-in slide-in-from-right`}
    >
      {icon}
      <p className={`text-body-sm ${text} flex-1`}>{toast.message}</p>
      <button
        onClick={onClose}
        className="text-brand-muted hover:text-brand-text shrink-0 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
