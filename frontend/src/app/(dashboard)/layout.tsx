"use client";

import AuthGuard from "@/components/auth-guard";
import Sidebar from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";
import { ConfirmProvider } from "@/components/confirm-modal";
import { useMainSidebar, MainSidebarProvider } from "@/hooks/use-main-sidebar";
import { SidebarProvider } from "@/lib/contexts/sidebar-context";
import { CompanyProvider } from "@/lib/contexts/company-context";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { mounted, isMobile, isMobileOpen, open } = useMainSidebar();

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col transition-all duration-280 ease-sidebar min-w-0">
        {/* Botão hambúrguer para mobile - só aparece quando sidebar está fechada */}
        {isMobile && !isMobileOpen && (
          <button
            onClick={open}
            className="fixed top-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-brand-border text-brand-text shadow-sm transition-all duration-200 hover:bg-brand-bg-muted hover:scale-105"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className={cn(
          "flex-1 p-space-10",
          isMobile && "pt-20 px-4 pb-4"
        )}>
          {children}
        </div>

        {/* Legal footer */}
        <footer className="py-3 px-6 flex items-center justify-center gap-3 border-t border-brand-border/40">
          <a
            href="/termos-de-uso"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-brand-muted hover:text-brand-text transition-colors duration-200"
          >
            Termos de Uso
          </a>
          <span className="text-brand-muted/40 text-[11px]">|</span>
          <a
            href="/politica-de-privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-brand-muted hover:text-brand-text transition-colors duration-200"
          >
            Politica de Privacidade
          </a>
        </footer>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ToastProvider>
        <CompanyProvider>
          <ConfirmProvider>
            <MainSidebarProvider>
              <SidebarProvider>
                <DashboardContent>{children}</DashboardContent>
              </SidebarProvider>
            </MainSidebarProvider>
          </ConfirmProvider>
        </CompanyProvider>
      </ToastProvider>
    </AuthGuard>
  );
}
