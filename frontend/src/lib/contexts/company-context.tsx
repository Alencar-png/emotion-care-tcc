"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getCurrentUserFromToken, isSuperAdmin } from "@/lib/auth";

interface CompanyContextType {
  selectedCompanyId: number | null;
  setSelectedCompanyId: (id: number | null) => void;
  isSuperAdminUser: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = "selected_company_id";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const isSuperAdminUser = isSuperAdmin();

  useEffect(() => {
    const user = getCurrentUserFromToken();
    if (isSuperAdminUser) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSelectedCompanyIdState(Number(stored));
      } else if (user?.company_id) {
        setSelectedCompanyIdState(user.company_id);
      }
    } else if (user?.company_id) {
      setSelectedCompanyIdState(user.company_id);
    }
    setMounted(true);
  }, [isSuperAdminUser]);

  const setSelectedCompanyId = useCallback(
    (id: number | null) => {
      setSelectedCompanyIdState(id);
      if (isSuperAdminUser) {
        if (id) {
          localStorage.setItem(STORAGE_KEY, String(id));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    },
    [isSuperAdminUser]
  );

  if (!mounted) return null;

  return (
    <CompanyContext.Provider
      value={{ selectedCompanyId, setSelectedCompanyId, isSuperAdminUser }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error(
      "useCompanyContext deve ser usado dentro de um CompanyProvider"
    );
  }
  return context;
}

export function useCompanyId(): number | null {
  const { selectedCompanyId } = useCompanyContext();
  return selectedCompanyId;
}
