"use client";

import { useRouter } from "next/navigation";
import { Rocket, ChevronRight } from "lucide-react";

interface OnboardingProgressCardProps {
  currentStep: number;
  totalSteps?: number;
}

const STEP_LABELS = [
  "Dados da Empresa",
  "Setores / GHEs",
  "Colaboradores",
  "Agendar Call",
  "Proximos Passos",
];

export default function OnboardingProgressCard({
  currentStep,
  totalSteps = 5,
}: OnboardingProgressCardProps) {
  const router = useRouter();
  const progress = Math.round(((currentStep - 1) / totalSteps) * 100);

  return (
    <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-brand-text">
              Configuracao Inicial
            </h3>
            <p className="text-xs text-brand-muted truncate">
              Passo {currentStep} de {totalSteps}: {STEP_LABELS[currentStep - 1] || ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/onboarding")}
          className="flex items-center gap-1 h-8 px-3 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0 ml-3"
        >
          Continuar
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3">
        <div className="w-full bg-white/60 rounded-full h-1.5">
          <div
            className="bg-primary rounded-full h-1.5 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
