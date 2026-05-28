"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type NavItemKey =
  | "painel"
  | "empresas"
  | "setores"
  | "funcoes"
  | "colaboradores"
  | "questionarios"
  | "campanhas"
  | "respostas"
  | "analise-campanhas"
  | "pgr"
  | "copiloto"
  | "percepcoes"
  | "usuarios"
  | "configuracoes"
  | "minha-conta";

interface SidebarContextType {
  activeNavItem: NavItemKey | null;
  isPanelOpen: boolean;
  togglePanel: (key: NavItemKey) => void;
  openPanel: (key: NavItemKey) => void;
  closePanel: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [activeNavItem, setActiveNavItem] = useState<NavItemKey | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = useCallback((key: NavItemKey) => {
    setActiveNavItem((prev) => {
      if (prev === key) {
        setIsPanelOpen(false);
        return null;
      }
      setIsPanelOpen(true);
      return key;
    });
  }, []);

  const openPanel = useCallback((key: NavItemKey) => {
    setActiveNavItem(key);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setActiveNavItem(null);
    setIsPanelOpen(false);
  }, []);

  return (
    <SidebarContext.Provider
      value={{ activeNavItem, isPanelOpen, togglePanel, openPanel, closePanel }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error(
      "useSidebarContext deve ser usado dentro de um SidebarProvider"
    );
  }
  return context;
}
