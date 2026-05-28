"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useMainSidebar } from "@/hooks/use-main-sidebar";
import {
  useSidebarContext,
  type NavItemKey,
} from "@/lib/contexts/sidebar-context";
import { removeToken, getCurrentUserFromToken, isSuperAdmin } from "@/lib/auth";
import { useCompanyContext } from "@/lib/contexts/company-context";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  FolderTree,
  Briefcase,
  Users,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  CircleUser,
  ClipboardList,
  Megaphone,
  MessageSquareText,
  BarChart3,
  ShieldCheck,
  ChevronsUpDown,
  Bot,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

// ─── Tipos ───────────────────────────────────────────────
interface NavItem {
  key: NavItemKey;
  label: string;
  icon: LucideIcon;
  href: string;
  superAdminOnly?: boolean;
  disabled?: boolean;
}

interface SidebarProps {
  onRightClickNav?: (key: NavItemKey) => void;
}

// ─── Itens de navegação agrupados ────────────────────────
interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { key: "painel", label: "Painel", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    label: "Organização",
    items: [
      {
        key: "empresas",
        label: "Empresas",
        icon: Building2,
        href: "/companies",
        superAdminOnly: true,
      },
      {
        key: "setores",
        label: "Setores",
        icon: FolderTree,
        href: "/departments",
      },
      {
        key: "funcoes",
        label: "Funções",
        icon: Briefcase,
        href: "/job-roles",
      },
      {
        key: "colaboradores",
        label: "Colaboradores",
        icon: Users,
        href: "/employees",
      },
    ],
  },
  {
    label: "Avaliação",
    items: [
      {
        key: "questionarios",
        label: "Questionários",
        icon: ClipboardList,
        href: "/questionnaires",
      },
      {
        key: "campanhas",
        label: "Campanhas",
        icon: Megaphone,
        href: "/campaigns",
      },
      {
        key: "respostas",
        label: "Respostas",
        icon: MessageSquareText,
        href: "/responses",
        superAdminOnly: true,
      },
    ],
  },
  {
    label: "Resultados",
    items: [
      {
        key: "analise-campanhas",
        label: "Análise das Campanhas",
        icon: BarChart3,
        href: "/analytics",
      },
      {
        key: "pgr",
        label: "PGR",
        icon: ShieldCheck,
        href: "/pgr",
      },
      {
        key: "copiloto",
        label: "Copiloto IA",
        icon: Bot,
        href: "/copilot",
      },
      {
        key: "percepcoes",
        label: "Percepções Qualitativas",
        icon: MessageCircle,
        href: "/qualitative",
      },
    ],
  },
];

// Flat list for compatibility
const topNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

const bottomNavItems: NavItem[] = [
  {
    key: "configuracoes",
    label: "Configurações",
    icon: Settings,
    href: "/users",
    superAdminOnly: true,
  },
  {
    key: "minha-conta",
    label: "Minha Conta",
    icon: CircleUser,
    href: "/account",
  },
];

// ─── Componente NavButton ────────────────────────────────
function NavButton({
  item,
  isActive,
  isPanelActive,
  isCollapsed,
  onClick,
  onContextMenu,
}: {
  item: NavItem;
  isActive: boolean;
  isPanelActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const Icon = item.icon;
  const isDisabled = item.disabled;

  const button = (
    <button
      onClick={isDisabled ? undefined : onClick}
      onContextMenu={isDisabled ? undefined : onContextMenu}
      disabled={isDisabled}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-md px-3.5 h-10 text-sm font-medium font-inter transition-colors duration-200",
        isDisabled
          ? "text-white/25 cursor-not-allowed"
          : isActive
            ? "bg-white/30 text-white"
            : "text-white/65 hover:bg-white/15 hover:text-white/90",
        isPanelActive && !isDisabled && "ring-1 ring-white/40",
        isCollapsed && "justify-center px-0"
      )}
    >
      {/* Barrinha verde na borda esquerda quando ativo */}
      {isActive && !isDisabled && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-[#D6F5E8]" />
      )}
      <Icon className={cn(
        "h-[18px] w-[18px] shrink-0",
        isDisabled ? "text-white/20" : isActive ? "text-white" : "text-white/40"
      )} />
      {!isCollapsed && (
        <span className="truncate transition-opacity duration-280 ease-sidebar">
          {item.label}
        </span>
      )}
    </button>
  );

  // Tooltip apenas no modo colapsado
  if (isCollapsed) {
    return (
      <Tooltip.Root delayDuration={0}>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={8}
            className="z-50 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-brand-text border border-brand-border shadow-md animate-in fade-in-0 zoom-in-95"
          >
            {item.label}
            {isDisabled && <span className="text-brand-muted"> (em breve)</span>}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return button;
}

// ─── Componente CompanySelector ─────────────────────────
function CompanySelector({ isCollapsed }: { isCollapsed: boolean }) {
  const { selectedCompanyId, setSelectedCompanyId, isSuperAdminUser } = useCompanyContext();
  const router = useRouter();
  const [companies, setCompanies] = useState<{ id: number; name: string; trade_name?: string }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isSuperAdminUser) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get<{ data: { id: number; name: string; trade_name?: string }[] }>("/companies/", { page_size: 100 });
        if (cancelled) return;
        const list = res.data || [];
        setCompanies(list);
        if (!selectedCompanyId && list.length > 0) {
          setSelectedCompanyId(list[0].id);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoaded(true);
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdminUser]);

  const selected = companies.find((c) => c.id === selectedCompanyId);
  const displayName = selected?.trade_name || selected?.name || "Selecionar empresa";

  // Non-superAdmin users don't see the company selector at all
  if (!isSuperAdminUser) {
    return null;
  }

  if (!loaded) return null;

  if (isCollapsed) {
    return (
      <Tooltip.Root delayDuration={0}>
        <Tooltip.Trigger asChild>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="mx-1 mb-3 flex items-center justify-center h-10 w-full rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          >
            <Building2 className="h-4 w-4" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={8}
            className="z-50 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-brand-text border border-brand-border shadow-md"
          >
            {displayName}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return (
    <div className="mx-1 mb-3 relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
      >
        <div className="flex-1 text-left min-w-0">
          <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Empresa</p>
          <p className="text-xs text-white/90 truncate mt-0.5">{displayName}</p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg bg-white border border-brand-border shadow-lg max-h-48 overflow-y-auto">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => {
                setSelectedCompanyId(company.id);
                setIsOpen(false);
                router.push("/dashboard");
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-brand-bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg",
                company.id === selectedCompanyId
                  ? "bg-primary/5 text-primary font-medium"
                  : "text-brand-text"
              )}
            >
              {company.trade_name || company.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente Sidebar Principal ────────────────────────
export default function Sidebar({ onRightClickNav }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed: desktopCollapsed, isMobileOpen, isMobile, toggle, close, mounted } = useMainSidebar();
  // No mobile, a sidebar nunca é "colapsada" — sempre mostra labels
  const isCollapsed = isMobile ? false : desktopCollapsed;
  const { activeNavItem, isPanelOpen, togglePanel } = useSidebarContext();
  const user = getCurrentUserFromToken();
  const superAdmin = isSuperAdmin();

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const handleNavClick = (item: NavItem) => {
    if (item.disabled) return;
    router.push(item.href);
    // Fechar sidebar no mobile após clicar em um item
    if (isMobile) {
      close();
    }
  };

  const handleRightClick = (e: React.MouseEvent, item: NavItem) => {
    e.preventDefault();
    togglePanel(item.key);
    onRightClickNav?.(item.key);
  };

  const isItemActive = (item: NavItem) =>
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href));

  const isItemPanelActive = (item: NavItem) =>
    isPanelOpen && activeNavItem === item.key;

  // Filtrar itens baseado em permissões
  const filteredTopItems = topNavItems.filter(
    (item) => !item.superAdminOnly || superAdmin
  );

  if (!mounted) return null;

  // Overlay para mobile
  const overlay = isMobile && (
    <div
      className={cn(
        "fixed inset-0 h-[100dvh] bg-black/50 z-40 transition-opacity duration-280 ease-sidebar",
        isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={close}
      aria-hidden="true"
    />
  );

  return (
    <>
      {overlay}
      <Tooltip.Provider>
        <aside
          className={cn(
            "flex shrink-0 flex-col py-5 px-3 transition-all duration-280 ease-sidebar",
            "bg-[#065f46]",
            "shadow-lg",
            // Mobile: drawer com posição fixa + dvh para respeitar barra do navegador
            isMobile && [
              "fixed left-0 top-0 z-50 w-sidebar-mobile h-[100dvh]",
              "rounded-r-xl",
              isMobileOpen 
                ? "translate-x-0" 
                : "-translate-x-full"
            ],
            // Desktop: sidebar fixa ao scrollar
            !isMobile && [
              "h-screen sticky top-0",
              "rounded-r-xl",
              isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"
            ]
          )}
        >
        {/* ─── Logo e botão fechar (mobile) ─── */}
        <div className={cn(
          "mb-4 flex items-center justify-between shrink-0",
          isCollapsed ? "justify-center px-1" : "px-2"
        )}>
          <div className="flex items-center">
            {isCollapsed ? (
              <div className="flex items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm h-10 w-10 transition-all duration-280">
                <span className="text-white font-bold text-base">N</span>
              </div>
            ) : (
              <Image
                src="/logo-emotion-care-white.svg"
                alt="Emotion Care"
                width={200}
                height={36}
                className="h-9 w-auto transition-opacity duration-280 ease-sidebar"
                priority
                unoptimized
              />
            )}
          </div>
          {/* Botão fechar no mobile */}
          {isMobile && !isCollapsed && (
            <button
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* ─── Seletor de Empresa ─── */}
        <CompanySelector isCollapsed={isCollapsed} />

        {/* ─── Container de navegação (wrapper sem overflow para o botão toggle) ─── */}
        <div className="relative flex flex-1 flex-col min-h-0">
          {/* ─── Botão toggle (apenas desktop) — fora da área rolável ─── */}
          {!isMobile && (
            <button
              onClick={toggle}
              className="absolute -right-4 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-brand-border bg-white text-brand-muted shadow-sm transition-all duration-200 hover:scale-110 hover:text-primary"
              title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* ─── Área rolável da navegação ─── */}
          <div className="flex flex-1 flex-col px-1 min-h-0 overflow-y-auto">
            {/* ─── Navegação topo ─── */}
            <nav className="mt-2 flex flex-1 flex-col gap-0.5">
              {navGroups.map((group, groupIdx) => {
                const groupItems = group.items.filter(
                  (item) => !item.superAdminOnly || superAdmin
                );
                if (groupItems.length === 0) return null;

                return (
                  <div key={groupIdx}>
                    {group.label && !isCollapsed && (
                      <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest px-3.5 pt-4 pb-1">
                        {group.label}
                      </p>
                    )}
                    {group.label && isCollapsed && (
                      <div className="border-t border-white/10 my-1.5 mx-2" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      {groupItems.map((item) => (
                        <NavButton
                          key={item.key}
                          item={item}
                          isActive={isItemActive(item)}
                          isPanelActive={isItemPanelActive(item)}
                          isCollapsed={isCollapsed}
                          onClick={() => handleNavClick(item)}
                          onContextMenu={(e) => handleRightClick(e, item)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* ─── Separador + Navegação inferior ─── */}
            <div className="border-t border-white/20 pt-3 mt-3">
              <div className="flex flex-col gap-1.5">
                {bottomNavItems.map((item) => (
                  <NavButton
                    key={item.key}
                    item={item}
                    isActive={isItemActive(item)}
                    isPanelActive={isItemPanelActive(item)}
                    isCollapsed={isCollapsed}
                    onClick={() => handleNavClick(item)}
                    onContextMenu={(e) => handleRightClick(e, item)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Rodapé / Usuário ─── */}
        <div className="mt-3 border-t border-white/20 px-1 pt-3 shrink-0">
          {isCollapsed ? (
            <Tooltip.Root delayDuration={0}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-md h-10 text-white/40 hover:bg-white/15 hover:text-red-300 transition-colors duration-200"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="right"
                  sideOffset={8}
                  className="z-50 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-brand-text border border-brand-border shadow-md animate-in fade-in-0 zoom-in-95"
                >
                  Sair
                  <Tooltip.Arrow className="fill-white" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3.5 h-10 text-sm font-medium font-inter text-white/40 hover:bg-white/15 hover:text-red-300 transition-colors duration-200"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sair</span>
            </button>
          )}
        </div>
        </aside>
      </Tooltip.Provider>
    </>
  );
}
