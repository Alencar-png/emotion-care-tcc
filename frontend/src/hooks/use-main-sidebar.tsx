"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const STORAGE_KEY = "sidebar-collapsed";

interface MainSidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isMobile: boolean;
  mounted: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const MainSidebarContext = createContext<MainSidebarState | undefined>(
  undefined
);

export function MainSidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsMobileOpen(false);
      }
    };

    checkMobile();
    setMounted(true);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggle = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => {
        const newValue = !prev;
        localStorage.setItem(STORAGE_KEY, String(newValue));
        return newValue;
      });
    }
  }, [isMobile]);

  const open = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return (
    <MainSidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        isMobile,
        mounted,
        toggle,
        open,
        close,
      }}
    >
      {children}
    </MainSidebarContext.Provider>
  );
}

export function useMainSidebar(): MainSidebarState {
  const context = useContext(MainSidebarContext);
  if (!context) {
    throw new Error(
      "useMainSidebar deve ser usado dentro de um MainSidebarProvider"
    );
  }
  return context;
}
