/** @type {import('next').NextConfig} */
const nextConfig = {
  // Não usar rewrites - o frontend chama diretamente a URL da API via NEXT_PUBLIC_API_BASE_URL
  // Isso evita problemas de CORS e permite configurar a URL via variável de ambiente
  output: "standalone",
  
  // Otimizações de compilação
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  
  // Otimizações de cache (removido optimizeCss - requer pacote critters)
  
  // Reduzir tempo de compilação
  typescript: {
    // Ignorar erros de tipo durante build (apenas em dev)
    ignoreBuildErrors: false,
  },
  eslint: {
    // Ignorar erros de lint durante build (apenas em dev)
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
