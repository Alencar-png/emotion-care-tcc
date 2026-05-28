"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Shield,
  BarChart3,
  ClipboardList,
  Brain,
  Users,
  FileText,
  Zap,
  Target,
  ChevronDown,
  Check,
  ArrowRight,
  Star,
  Headphones,
  Building2,
  Sparkles,
} from "lucide-react";

/* ─── Hook: Scroll Reveal ──────────────────────────────────── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}


/* ─── Dados dos planos ─────────────────────────────────────── */
const plans = [
  {
    id: "l50",
    name: "EmotionCare L50",
    description: "Ideal para pequenas empresas que precisam se adequar à NR-1",
    price: 3000,
    period: "/ano",
    badge: null,
    highlighted: false,
    checkoutUrl:
      "https://payment-link-v3.pagar.me/pl_1gJbaKnwPkroGAzSJuKpXApVzx9ymZj8",
    features: [
      "Até 50 colaboradores",
      "Questionários de riscos psicossociais",
      "Campanhas de avaliação ilimitadas",
      "Dashboard analítico completo",
      "Relatório PGR automático",
      "Inventário de riscos",
      "Planos de ação",
      "Suporte por e-mail",
    ],
  },
  {
    id: "l100",
    name: "EmotionCare L100",
    description: "Para empresas em crescimento que exigem inteligência avançada",
    price: 5000,
    period: "/ano",
    badge: "Mais popular",
    highlighted: true,
    checkoutUrl:
      "https://payment-link-v3.pagar.me/pl_EKRlZdJgxX9wjBAFdse3qa2bYvAVGpz7",
    features: [
      "Até 100 colaboradores",
      "Tudo do plano L50 incluído",
      "Copiloto IA — análise inteligente",
      "Relatórios avançados por setor e função",
      "Suporte prioritário",
      "Onboarding assistido",
    ],
  },
];

/* ─── Features do produto ──────────────────────────────────── */
const productFeatures = [
  {
    icon: ClipboardList,
    title: "Questionários Validados",
    description:
      "Instrumentos cientificamente validados para avaliação de riscos psicossociais no trabalho.",
  },
  {
    icon: Zap,
    title: "Campanhas Automatizadas",
    description:
      "Envie avaliações para todos os colaboradores com poucos cliques e acompanhe em tempo real.",
  },
  {
    icon: BarChart3,
    title: "Dashboard Analítico",
    description:
      "Visualize resultados por setor, função e grau de risco com gráficos interativos.",
  },
  {
    icon: FileText,
    title: "PGR Automático",
    description:
      "Gere o Programa de Gerenciamento de Riscos com inventário e planos de ação em segundos.",
  },
  {
    icon: Brain,
    title: "Copiloto IA",
    description:
      "Inteligência artificial que analisa dados e sugere ações preventivas personalizadas.",
  },
  {
    icon: Shield,
    title: "Conformidade NR-1",
    description:
      "Total adequação às exigências regulatórias de saúde mental no trabalho.",
  },
];

/* ─── FAQ ──────────────────────────────────────────────────── */
const faqs = [
  {
    question: "Como funciona a assinatura?",
    answer:
      "Após escolher seu plano e realizar o pagamento único anual, você receberá um e-mail com as credenciais de acesso à plataforma.",
  },
  {
    question: "Posso trocar de plano depois?",
    answer:
      "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. A diferença será calculada proporcionalmente.",
  },
  {
    question: "Os questionários são validados cientificamente?",
    answer:
      "Sim. Utilizamos instrumentos reconhecidos e alinhados às diretrizes da NR-1 para avaliação de riscos psicossociais.",
  },
  {
    question: "Quanto tempo leva para configurar a plataforma?",
    answer:
      "A configuração inicial leva cerca de 15 minutos. Basta cadastrar setores, funções e colaboradores. No plano L100, oferecemos onboarding assistido.",
  },
  {
    question: "Os dados dos colaboradores estão seguros?",
    answer:
      "Sim. Todos os dados são criptografados e armazenados com as melhores práticas de segurança. As respostas dos colaboradores são anônimas.",
  },
];

/* ─── CSS Animations ───────────────────────────────────────── */
const animationStyles = `
@keyframes hero-fade-up {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes hero-stagger-1 { 0%, 10% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes hero-stagger-2 { 0%, 25% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes hero-stagger-3 { 0%, 40% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes hero-stagger-4 { 0%, 55% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }
  50%      { box-shadow: 0 0 24px 8px rgba(52, 211, 153, 0.2); }
}
@keyframes shimmer-line {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@keyframes badge-bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%      { transform: translateX(-50%) translateY(-4px); }
}

.anim-hero-1 { animation: hero-fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) both; }
.anim-hero-2 { animation: hero-stagger-1 1.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
.anim-hero-3 { animation: hero-stagger-2 1.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
.anim-hero-4 { animation: hero-stagger-3 1.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
.anim-hero-5 { animation: hero-stagger-4 2.1s cubic-bezier(0.16, 1, 0.3, 1) both; }
.anim-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
.anim-badge-bounce { animation: badge-bounce 2s ease-in-out infinite; }

.anim-gradient-text {
  background: linear-gradient(90deg, #6ee7b7, #6ee7b7, #6ee7b7);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradient-shift 4s ease-in-out infinite;
}

/* Scroll reveal */
.reveal {
  opacity: 0;
  transform: translateY(36px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal.visible { opacity: 1; transform: translateY(0); }

.reveal-scale {
  opacity: 0;
  transform: scale(0.9) translateY(24px);
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-scale.visible { opacity: 1; transform: scale(1) translateY(0); }

/* CTA shimmer */
.btn-shimmer { position: relative; overflow: hidden; }
.btn-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  animation: shimmer-line 3s ease-in-out infinite;
}

/* Feature card lift */
.card-lift {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.card-lift:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(16, 185, 129, 0.12);
}

/* Stat divider */
.stat-divider {
  position: relative;
}
.stat-divider::after {
  content: '';
  position: absolute;
  right: 0;
  top: 15%;
  height: 70%;
  width: 1px;
  background: rgba(255,255,255,0.2);
}
.stat-divider:last-child::after { display: none; }
`;


/* ═══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Scroll reveal refs
  const featuresHeader = useScrollReveal();
  const featuresGrid = useScrollReveal(0.1);
  const planosHeader = useScrollReveal();
  const planosGrid = useScrollReveal(0.05);
  const comoHeader = useScrollReveal();
  const comoGrid = useScrollReveal(0.1);
  const faqSection = useScrollReveal();
  const ctaSection = useScrollReveal();

  return (
    <div className="min-h-screen bg-white">
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* ─── Navbar ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Image
            src="/logo-emotion-care.svg"
            alt="Emotion Care"
            width={160}
            height={40}
            className="h-9 w-auto"
            unoptimized
          />
          <div className="flex items-center gap-1">
            <a
              href="#planos"
              className="hidden sm:inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium text-brand-text-2 hover:text-primary hover:bg-primary-lighter transition-all duration-200"
            >
              Planos
            </a>
            <a
              href="#features"
              className="hidden sm:inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium text-brand-text-2 hover:text-primary hover:bg-primary-lighter transition-all duration-200"
            >
              Funcionalidades
            </a>
            <Link
              href="/login"
              className="ml-2 inline-flex items-center h-9 px-5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-hover active:scale-[0.97] transition-all duration-200"
            >
              Entrar
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#10b981]" />

        {/* Blobs estáticos (sem animação) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-[5%] w-80 h-80 bg-white/[0.06] rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-[10%] w-[400px] h-[400px] bg-[#34d399]/[0.07] rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="anim-hero-1 text-3xl sm:text-4xl lg:text-5xl font-bold text-white !leading-[1.35]">
              Gestão inteligente de{" "}
              <span className="text-[#6ee7b7]">riscos psicossociais</span>{" "}
              no trabalho
            </h1>

            <p className="anim-hero-3 mt-6 text-base sm:text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
              Avalie, monitore e atue sobre os riscos psicossociais da sua
              empresa com a plataforma mais completa do mercado. PGR automático,
              dashboards em tempo real e Copiloto IA.
            </p>

            <div className="anim-hero-4 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#planos"
                className="btn-shimmer w-full sm:w-auto inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl text-sm font-bold text-[#065f46] bg-white hover:shadow-xl hover:scale-[1.04] active:scale-[0.98] transition-all duration-300"
              >
                Ver planos e assinar
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-14 px-8 rounded-xl text-sm font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all duration-300"
              >
                Como funciona
                <ArrowRight className="w-4 h-4 opacity-60" />
              </a>
            </div>
          </div>

        </div>

        {/* Wave divider */}
        <div className="absolute -bottom-px left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full block h-[60px] sm:h-[80px]" preserveAspectRatio="none">
            <path d="M0 120V60C360 0 720 0 1080 60C1260 90 1380 90 1440 75V120H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────── */}
      <section id="features" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={featuresHeader.ref}
            className={`text-center mb-12 sm:mb-16 reveal ${featuresHeader.visible ? "visible" : ""}`}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-text">
              Tudo que você precisa para a{" "}
              <span className="text-primary">NR-1</span>
            </h2>
            <p className="mt-3 text-brand-muted text-body max-w-2xl mx-auto">
              Da avaliação ao plano de ação, automatizamos todo o processo de
              gerenciamento de riscos psicossociais.
            </p>
          </div>

          <div
            ref={featuresGrid.ref}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
          >
            {productFeatures.map((feature, i) => (
              <div
                key={feature.title}
                className={`card-lift group p-6 rounded-xl border border-brand-border bg-white hover:border-primary-border reveal-scale ${featuresGrid.visible ? "visible" : ""}`}
                style={{ transitionDelay: featuresGrid.visible ? `${i * 0.1}s` : "0s" }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <feature.icon className="w-6 h-6 text-primary group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-base font-semibold text-brand-text mb-2">
                  {feature.title}
                </h3>
                <p className="text-body-sm text-brand-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Planos / Pricing ───────────────────────────────── */}
      <section id="planos" className="py-16 sm:py-24 bg-brand-bg-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={planosHeader.ref}
            className={`text-center mb-12 sm:mb-16 reveal ${planosHeader.visible ? "visible" : ""}`}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-text">
              Escolha o plano ideal para sua empresa
            </h2>
            <p className="mt-3 text-brand-muted text-body max-w-xl mx-auto">
              Comece agora e receba o acesso imediato à plataforma por e-mail.
            </p>
          </div>

          <div
            ref={planosGrid.ref}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto"
          >
            {plans.map((plan, i) => (
              <div
                key={plan.id}
                className={`card-lift relative rounded-2xl p-1 reveal-scale ${planosGrid.visible ? "visible" : ""} ${
                  plan.highlighted
                    ? "bg-gradient-to-br from-[#10b981] to-[#34d399] shadow-xl lg:scale-[1.03]"
                    : "bg-brand-border"
                }`}
                style={{ transitionDelay: planosGrid.visible ? `${i * 0.15}s` : "0s" }}
              >
                {/* Badge animado */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 z-10 anim-badge-bounce">
                    <div className="inline-flex items-center gap-1.5 bg-[#10b981] text-white text-xs font-bold px-4 py-1.5 rounded-full anim-pulse-glow">
                      <Star className="w-3.5 h-3.5 fill-white" />
                      {plan.badge}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-xl p-6 sm:p-8 h-full flex flex-col">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-brand-text">{plan.name}</h3>
                    <p className="text-body-sm text-brand-muted mt-1">{plan.description}</p>
                  </div>

                  <div className="mb-6 pb-6 border-b border-brand-border">
                    <div className="flex items-baseline gap-1">
                      <span className="text-brand-muted text-sm">R$</span>
                      <span className="text-4xl font-bold text-brand-text">
                        {plan.price.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-brand-muted text-sm">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            plan.highlighted ? "bg-primary text-white" : "bg-primary-light text-primary"
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-body-sm text-brand-text-2">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={plan.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`btn-shimmer w-full inline-flex items-center justify-center gap-2 h-14 rounded-xl text-sm font-bold transition-all duration-300 active:scale-[0.97] hover:scale-[1.02] hover:shadow-lg ${
                      plan.highlighted
                        ? "bg-[#065f46] text-white hover:bg-[#064e3b]"
                        : "bg-white text-[#065f46] border-2 border-[#065f46] hover:bg-[#065f46] hover:text-white"
                    }`}
                  >
                    Assinar agora
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Trust signals */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 text-brand-muted">
            <div className="flex items-center gap-2 text-body-sm">
              <Shield className="w-4 h-4 text-primary" />
              Pagamento seguro
            </div>
            <div className="flex items-center gap-2 text-body-sm">
              <Headphones className="w-4 h-4 text-primary" />
              Suporte dedicado
            </div>
            <div className="flex items-center gap-2 text-body-sm">
              <Building2 className="w-4 h-4 text-primary" />
              Acesso imediato por e-mail
            </div>
          </div>
        </div>
      </section>

      {/* ─── Como funciona ──────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={comoHeader.ref}
            className={`text-center mb-12 sm:mb-16 reveal ${comoHeader.visible ? "visible" : ""}`}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-text">
              Como funciona
            </h2>
            <p className="mt-3 text-brand-muted text-body max-w-xl mx-auto">
              Em 3 passos simples, sua empresa estará em conformidade.
            </p>
          </div>

          <div
            ref={comoGrid.ref}
            className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            {[
              { step: "1", icon: Target, title: "Assine o plano", description: "Escolha o plano ideal e receba o acesso à plataforma por e-mail em minutos." },
              { step: "2", icon: Users, title: "Configure sua empresa", description: "Cadastre setores, funções e importe seus colaboradores via planilha." },
              { step: "3", icon: Sparkles, title: "Avalie e atue", description: "Envie campanhas, visualize resultados e gere o PGR automaticamente." },
            ].map((item, i) => (
              <div
                key={item.step}
                className={`text-center reveal ${comoGrid.visible ? "visible" : ""}`}
                style={{ transitionDelay: comoGrid.visible ? `${i * 0.2}s` : "0s" }}
              >
                <div className="relative w-16 h-16 mx-auto mb-4 group">
                  <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center transition-transform duration-300 hover:scale-110">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-base font-semibold text-brand-text mb-2">{item.title}</h3>
                <p className="text-body-sm text-brand-muted leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 bg-brand-bg-subtle">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={faqSection.ref}
            className={`text-center mb-12 reveal ${faqSection.visible ? "visible" : ""}`}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-text">
              Perguntas frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-xl border border-brand-border overflow-hidden card-lift reveal ${faqSection.visible ? "visible" : ""}`}
                style={{ transitionDelay: faqSection.visible ? `${idx * 0.08}s` : "0s" }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-body-sm font-medium text-brand-text pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-brand-muted flex-shrink-0 transition-transform duration-300 ${
                      openFaq === idx ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-400 ease-in-out ${
                    openFaq === idx ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5">
                      <p className="text-body-sm text-brand-muted leading-relaxed">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Final ───────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#10b981]" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-[10%] w-64 h-64 bg-white/[0.05] rounded-full blur-3xl" />
          <div className="absolute bottom-5 left-[15%] w-48 h-48 bg-[#34d399]/[0.06] rounded-full blur-3xl" />
        </div>
        <div
          ref={ctaSection.ref}
          className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center reveal ${ctaSection.visible ? "visible" : ""}`}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Pronto para se adequar à NR-1?
          </h2>
          <p className="text-white/60 text-body mb-8 max-w-lg mx-auto">
            Comece agora e tenha sua empresa em conformidade com as exigências de saúde mental no trabalho.
          </p>
          <a
            href="#planos"
            className="btn-shimmer inline-flex items-center justify-center gap-2 h-14 px-10 rounded-xl text-sm font-bold text-[#065f46] bg-white hover:shadow-xl hover:scale-[1.04] active:scale-[0.98] transition-all duration-300"
          >
            Escolher meu plano
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="bg-white text-brand-muted border-t border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Image
              src="/logo-emotion-care.svg"
              alt="Emotion Care"
              width={120}
              height={30}
              className="h-7 w-auto opacity-70"
              unoptimized
            />
            <div className="flex items-center gap-6 text-xs">
              <Link href="/login" className="hover:text-primary transition-colors">Entrar</Link>
              <a href="#planos" className="hover:text-primary transition-colors">Planos</a>
              <a href="#features" className="hover:text-primary transition-colors">Funcionalidades</a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-brand-border text-center text-xs text-brand-muted">
            © {new Date().getFullYear()} EmotionCare Lab. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

