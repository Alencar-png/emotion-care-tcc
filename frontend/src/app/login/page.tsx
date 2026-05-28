"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api } from "@/lib/api";
import { setToken, parseToken } from "@/lib/auth";
import { LoginResponse, OnboardingStatusResponse, UserRole } from "@/types";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

/* ─── CSS Animations ───────────────────────────────────────── */
const loginAnimations = `
@keyframes login-fade-up {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes login-fade-left {
  from { opacity: 0; transform: translateX(-40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes login-fade-right {
  from { opacity: 0; transform: translateX(40px) scale(0.96); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes login-stagger-1 { 0%, 15% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes login-stagger-2 { 0%, 30% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes login-stagger-3 { 0%, 45% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes login-stagger-4 { 0%, 55% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes login-stagger-5 { 0%, 65% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes float-blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(25px, -20px) scale(1.08); }
  66%      { transform: translate(-15px, 12px) scale(0.95); }
}
@keyframes float-blob-r {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(-20px, 18px) scale(1.05); }
  66%      { transform: translate(18px, -10px) scale(0.97); }
}
@keyframes particle-drift {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
  10%      { opacity: 0.8; }
  50%      { transform: translateY(-100px) translateX(30px); opacity: 0.4; }
  90%      { opacity: 0; }
}
@keyframes shimmer-btn {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(94, 203, 161, 0.4); }
  70%  { box-shadow: 0 0 0 15px rgba(94, 203, 161, 0); }
  100% { box-shadow: 0 0 0 0 rgba(94, 203, 161, 0); }
}

.login-left  { animation: login-fade-left 0.9s cubic-bezier(0.16, 1, 0.3, 1) both; }
.login-card  { animation: login-fade-right 1s cubic-bezier(0.16, 1, 0.3, 1) both; }
.login-s1    { animation: login-stagger-1 1.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
.login-s2    { animation: login-stagger-2 1.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
.login-s3    { animation: login-stagger-3 1.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
.login-s4    { animation: login-stagger-4 1.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
.login-s5    { animation: login-stagger-5 2.0s cubic-bezier(0.16, 1, 0.3, 1) both; }
.login-float { animation: float-blob 12s ease-in-out infinite; }
.login-float-r { animation: float-blob-r 14s ease-in-out infinite; }

.login-btn-shimmer { position: relative; overflow: hidden; }
.login-btn-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(22, 108, 73, 0.12), transparent);
  animation: shimmer-btn 3s ease-in-out infinite;
}

.login-card-glow {
  animation: pulse-ring 3s ease-in-out infinite;
}
`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>("/login/", {
        email,
        password,
      });
      setToken(response.access_token);
      sessionStorage.removeItem("onboarding_status");

      // Verificar se precisa de onboarding (apenas para companyAdmin)
      const payload = parseToken(response.access_token);
      const role = payload?.role;
      if (role && role !== UserRole.SUPER_ADMIN && payload?.company_id) {
        try {
          const onboarding = await api.get<OnboardingStatusResponse>("/onboarding/status/");
          if (onboarding.onboarding_status !== "completed") {
            router.push("/onboarding");
            return;
          }
        } catch {}
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao fazer login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col-reverse lg:flex-row relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: loginAnimations }} />

      {/* Background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/[0.06]"
            style={{
              width: `${Math.random() * 5 + 2}px`,
              height: `${Math.random() * 5 + 2}px`,
              left: `${50 + Math.random() * 50}%`,
              top: `${Math.random() * 100}%`,
              animation: `particle-drift ${Math.random() * 8 + 6}s ease-in-out ${Math.random() * 5}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ─── Painel Esquerdo — Branding ─── */}
      <div className="flex-1 bg-white flex items-center justify-center p-8 lg:p-16 relative">
        {/* Blobs decorativos sutis */}
        <div className="absolute top-20 left-10 w-48 h-48 bg-primary/[0.04] rounded-full blur-3xl login-float pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-[#34d399]/[0.04] rounded-full blur-3xl login-float-r pointer-events-none" />

        <div className="max-w-md login-left relative">
          <Image
            src="/logo-emotion-care.svg"
            alt="Emotion Care"
            width={200}
            height={48}
            className="h-12 w-auto"
            priority
            unoptimized
          />
          <p className="text-gray-400 mt-3 text-sm leading-relaxed">
            Plataforma inteligente para gestao de riscos psicossociais, geracao automatica de PGR e laudos NR-1 com total conformidade regulatoria.
          </p>
        </div>
      </div>

      {/* ─── Painel Direito — Card de Login ─── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-white relative">
        {/* Blob atrás do card */}
        <div className="absolute w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-3xl login-float-r pointer-events-none" />

        <div
          className="login-card login-card-glow w-full max-w-[420px] rounded-3xl p-8 sm:p-10 relative"
          style={{
            backgroundColor: "#065f46",
            boxShadow: "0 25px 70px rgba(94, 203, 161, 0.3)",
          }}
        >
          {/* Floating blobs dentro do card */}
          <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/[0.04] rounded-full blur-2xl login-float" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#34d399]/[0.08] rounded-full blur-2xl login-float-r" />
          </div>

          {/* Logo */}
          <div className="mb-8 login-s1 relative">
            <Image
              src="/logo-emotion-care.svg"
              alt="Emotion Care"
              width={200}
              height={40}
              className="h-10 w-auto brightness-0 invert"
              priority
              unoptimized
            />
            <p className="text-white/70 text-sm mt-2">Gestao de Riscos Psicossociais</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 relative">
            {/* Email */}
            <div className="login-s2">
              <label className="block text-xs font-medium text-white/80 mb-1.5">
                E-mail corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-brand-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@empresa.com.br"
                  required
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-white/40 text-brand-text text-sm placeholder:text-brand-muted outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white autofill-fix"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="login-s3">
              <label className="block text-xs font-medium text-white/80 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-brand-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-12 pl-11 pr-11 rounded-xl bg-white border border-white/40 text-brand-text text-sm placeholder:text-brand-muted outline-none transition-all duration-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white autofill-fix"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-primary hover:scale-110 transition-all duration-200"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Esqueci minha senha */}
            <div className="flex justify-end login-s4">
              <button type="button" className="text-xs text-white/70 hover:text-white transition-colors duration-200">
                Esqueci minha senha
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-white/15 border border-white/25 text-white text-sm p-3 rounded-xl animate-[login-fade-up_0.3s_ease-out]">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="login-s5">
              <button
                type="submit"
                disabled={loading}
                className="login-btn-shimmer w-full h-12 rounded-xl text-sm font-bold text-[#065f46] bg-white hover:bg-white/90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#065f46]/30 border-t-[#065f46] rounded-full animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-white/60 mt-6 login-s5">
            Acesso restrito a empresas cadastradas
          </p>

          {/* Legal links */}
          <div className="flex items-center justify-center gap-3 mt-3 login-s5">
            <a
              href="/termos-de-uso"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors duration-200"
            >
              Termos de Uso
            </a>
            <span className="text-white/20 text-[11px]">|</span>
            <a
              href="/politica-de-privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors duration-200"
            >
              Politica de Privacidade
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
