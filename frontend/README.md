# Emotion Care — Frontend

Frontend da plataforma **Emotion Care**, desenvolvido com Next.js 14, React 18 e TypeScript. Sistema de gestão de saúde mental no trabalho (NR-01) com cadastros de empresas, departamentos, funcionários, cargos, usuários, campanhas e PGR — autenticação baseada em JWT.

> Identidade visual: paleta **verde-esmeralda** (`#10b981`) + **azul-marinho** (`#1e3a8a`).

## 🚀 Tecnologias

- **Next.js 14** - Framework React com App Router
- **React 18** - Biblioteca para construção de interfaces
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS utilitário
- **Radix UI** - Componentes acessíveis e sem estilo
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de schemas
- **PapaParse** - Parser de CSV para importação de dados
- **Lucide React** - Ícones

## 📋 Pré-requisitos

- Node.js 20 ou superior
- npm ou yarn
- API backend rodando (configurada via variável de ambiente)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <url-do-repositorio>
cd nr1-frontend
```

2. Instale as dependências:
```bash
npm install
```

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4200/api
```

**Variáveis de ambiente:**
- `NEXT_PUBLIC_API_BASE_URL` - URL base da API backend (padrão: `http://localhost:4200/api`)

## 🎯 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento na porta 3000
- `npm run build` - Cria uma build de produção otimizada
- `npm run start` - Inicia o servidor de produção (requer build prévio)
- `npm run lint` - Executa o linter ESLint

## 📁 Estrutura do Projeto

```
nr1-frontend/
├── src/
│   ├── app/                    # App Router do Next.js
│   │   ├── (dashboard)/        # Rotas protegidas do dashboard
│   │   │   ├── companies/      # Gerenciamento de empresas
│   │   │   ├── departments/    # Gerenciamento de departamentos
│   │   │   ├── employees/      # Gerenciamento de funcionários
│   │   │   ├── job-roles/      # Gerenciamento de cargos
│   │   │   ├── users/          # Gerenciamento de usuários
│   │   │   └── layout.tsx      # Layout do dashboard
│   │   ├── login/              # Página de login
│   │   ├── layout.tsx          # Layout raiz
│   │   └── globals.css         # Estilos globais
│   ├── components/             # Componentes reutilizáveis
│   │   ├── forms/              # Formulários
│   │   ├── auth-guard.tsx      # Proteção de rotas
│   │   ├── data-table.tsx      # Tabela de dados
│   │   ├── sidebar.tsx         # Barra lateral
│   │   └── toast.tsx           # Notificações
│   ├── hooks/                  # Custom hooks
│   ├── lib/                    # Utilitários e configurações
│   │   ├── api.ts              # Cliente HTTP da API
│   │   ├── auth.ts             # Funções de autenticação
│   │   ├── contexts/           # Contextos React
│   │   └── utils.ts            # Funções utilitárias
│   └── types/                  # Definições de tipos TypeScript
├── public/                     # Arquivos estáticos
├── Dockerfile                  # Configuração Docker
├── next.config.js              # Configuração Next.js
├── tailwind.config.ts          # Configuração Tailwind
└── tsconfig.json               # Configuração TypeScript
```

## 🔐 Autenticação

O sistema utiliza autenticação baseada em JWT (JSON Web Tokens). O token é armazenado no `localStorage` e enviado automaticamente em todas as requisições via header `Authorization: Bearer <token>`.

**Fluxo de autenticação:**
1. Usuário faz login na página `/login`
2. Token JWT é recebido e armazenado no `localStorage`
3. Token é validado automaticamente em cada requisição
4. Em caso de token expirado (401), o usuário é redirecionado para `/login`

**Funções de autenticação disponíveis:**
- `isAuthenticated()` - Verifica se o usuário está autenticado
- `getCurrentUserFromToken()` - Obtém informações do usuário do token
- `hasRole()` - Verifica se o usuário possui um papel específico
- `isSuperAdmin()` - Verifica se é super administrador
- `isCompanyAdminOrAbove()` - Verifica se é admin de empresa ou superior
- `isMedicalOrAbove()` - Verifica se é técnico médico ou superior

## 📊 Funcionalidades

### Gerenciamento de Empresas
- Listagem de empresas
- Criação de nova empresa
- Edição de empresa existente
- Visualização de detalhes

### Gerenciamento de Departamentos
- Listagem de departamentos
- Criação de novo departamento
- Edição de departamento existente
- Visualização de detalhes

### Gerenciamento de Funcionários
- Listagem de funcionários
- Criação de novo funcionário
- Edição de funcionário existente
- Importação em massa via CSV

### Gerenciamento de Cargos
- Listagem de cargos
- Criação de novo cargo
- Edição de cargo existente
- Visualização de detalhes

### Gerenciamento de Usuários
- Listagem de usuários
- Criação de novo usuário
- Edição de usuário existente
- Visualização de detalhes

## 🐳 Docker

O projeto inclui um `Dockerfile` para containerização. Para construir e executar:

```bash
# Build da imagem
docker build -t emotion-care-frontend .

# Executar container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:4200/api \
  emotion-care-frontend
```

**Nota:** A variável `NEXT_PUBLIC_API_BASE_URL` pode ser passada como argumento no build ou como variável de ambiente no runtime.

## 🛠️ Desenvolvimento

### Executando em modo desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

### Build de produção

```bash
npm run build
npm run start
```

O Next.js gera uma build otimizada em `.next/` e pode ser executada em modo standalone.

## 📝 Notas Importantes

- O frontend chama diretamente a URL da API configurada via `NEXT_PUBLIC_API_BASE_URL`
- Não são utilizados rewrites do Next.js para evitar problemas de CORS
- A build é configurada como `standalone` para facilitar o deploy
- O sistema de autenticação redireciona automaticamente para `/login` em caso de token expirado
- Todos os formulários utilizam validação com Zod e React Hook Form

## 🤝 Contribuindo

1. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
2. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
3. Push para a branch (`git push origin feature/nova-feature`)
4. Abra um Pull Request

## 📄 Licença

Este projeto é privado e proprietário.
