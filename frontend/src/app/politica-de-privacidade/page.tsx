import Image from "next/image";
import Link from "next/link";

export default function PoliticaDePrivacidadePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full text-center space-y-8">
        <Link href="/login">
          <Image
            src="/logo-emotion-care.svg"
            alt="Emotion Care"
            width={200}
            height={48}
            className="h-12 w-auto mx-auto"
            priority
            unoptimized
          />
        </Link>

        <div className="rounded-2xl border border-brand-border bg-brand-bg-muted/30 p-8 space-y-4">
          <h1 className="text-xl font-semibold text-brand-text">
            Politica de Privacidade
          </h1>
          <p className="text-sm text-brand-muted leading-relaxed">
            Documento em validacao com o juridico. Previsao de liberacao em breve.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-block text-sm text-primary hover:underline transition-colors"
        >
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}
