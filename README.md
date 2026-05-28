# Emotion Care — TCC

Plataforma experimental e aparato de avaliação que sustentam o Trabalho de
Conclusão de Curso (Ciência da Computação, Centro Universitário Afya
UNIMA-AL, 2026):

> **Interpretação de questionários psicossociais com modelos de linguagem
> de grande escala: uma arquitetura de agentes com RAG e validação anti-PII
> para a NR-01**
>
> Guilherme R. M. de Alencar · Maria Fernanda J. C. de Oliveira

Repositório de referência citado no Apêndice A do TCC. Contém o código
dos cinco agentes baseados em LLM, os gold standards anotados, os scripts
de avaliação reformulados e o gerador determinístico do documento de TCC.

---

## Estrutura

```
emotion-care-tcc/
├── README.md                   este arquivo
├── .env.example                template de configuração (preencher e
│                               renomear para .env localmente)
├── .gitignore                  exclusões (segredos, caches, artefatos)
│
├── emotion-care/               backend Python (FastAPI + LangChain)
│   ├── services/
│   │   ├── ai/                 cinco agentes especializados
│   │   │   ├── pgr_narrator.py            narrador do Inventário PGR
│   │   │   ├── action_plan_generator.py   gerador de Plano 5W2H
│   │   │   ├── copilot_nr01.py            copiloto RAG sobre normas
│   │   │   ├── qualitative_analyzer.py    analisador qualitativo
│   │   │   ├── pii_validator.py           validador anti-PII determinístico
│   │   │   ├── llm_config.py              fachada para OpenAI
│   │   │   └── andragogy_knowledge.py     base andragógica de Knowles
│   │   └── anonymity_policy.py            piso de k-anonymity (k=4/k=3)
│   ├── models/                 esquema SQLAlchemy
│   ├── main.py                 entrypoint FastAPI
│   └── requirements.txt        dependências Python
│
├── frontend/                   interface Next.js + TypeScript
│   ├── src/                    componentes, páginas e hooks React
│   ├── public/                 assets estáticos
│   ├── package.json            dependências npm
│   ├── next.config.js          configuração Next.js
│   ├── tailwind.config.ts      configuração TailwindCSS
│   ├── tsconfig.json           configuração TypeScript
│   └── Dockerfile              empacotamento da aplicação
│
└── refactor_v1_2/              aparato de avaliação e geração do TCC
    ├── build_docx.py           gera TCC .docx e .pdf
    ├── audit_pdf.py            verifica acentos no PDF final
    ├── regenerate_figures.py   regera as 4 figuras estáticas
    ├── figures/                figuras embutidas no TCC
    └── eval/                   scripts de avaliação dos agentes
        ├── metrics_core.py                  bootstrap, Fβ, span-level
        ├── regulatory_lookup.py             base NR-01/NR-17/COPSOQ/ISO
        ├── reference_inventory_generator.py inventário-referência det.
        ├── likert_rubrics.py                rubricas Likert + κ Cohen
        ├── eval_pii_v3.py                   avaliação anti-PII Fβ=2
        ├── eval_narrator_v3.py              BERTScore + ROUGE + faith
        ├── eval_action_plan_v3.py           5W2H gold cego (n=80)
        ├── eval_copilot_v3.py               RAGAS sobre copiloto
        ├── eval_qualitative_v3.py           c_v + baselines
        └── golds/                gold standards versionados
            ├── pii_gold_1000.py             1.025 casos span-level
            └── action_plan_gold_v3.py       80 cenários cegos
```

---

## Pré-requisitos

- Python 3.11+
- Docker (para PostgreSQL 16 + pgvector 0.7)
- LibreOffice (Windows: `C:\Program Files\LibreOffice\program\soffice.exe`)
  para conversão `.docx → .pdf` do TCC
- Conta na OpenAI com crédito (≈ US$ 7 para reexecutar os quatro evals
  generativos completos)

---

## Configuração

```bash
# 1) Clonar
git clone https://github.com/Alencar-png/emotion-care-tcc.git
cd emotion-care-tcc

# 2) Configurar variáveis
cp .env.example .env
# editar .env e preencher OPENAI_API_KEY

# 3) Instalar dependências do backend
cd emotion-care
python -m venv .venv
source .venv/bin/activate   # ou .venv\Scripts\activate no Windows
pip install -r requirements.txt

# 4) Instalar dependências da avaliação
pip install bert-score rouge-score gensim bertopic

# 5) (Opcional) Subir o frontend Next.js
cd ../frontend
cp .env.example .env.local
npm install
npm run dev   # disponível em http://localhost:3000
```

---

## Reproduzindo os experimentos do TCC

Os números reportados nas Seções 6.1 a 6.5 são reproduzíveis na ordem
abaixo. A execução completa custa aproximadamente US$ 7 em API OpenAI e
leva cerca de 80 minutos (paralelizando os quatro evals generativos).

```bash
cd refactor_v1_2/eval

# Anti-PII (sem custo de API, baseado em regex + heurística)
python eval_pii_v3.py

# 5W2H sobre gold cego (~3 min, ~US$ 0,5)
python eval_action_plan_v3.py

# Narrador com BERTScore + ROUGE + faithfulness (~40 min, ~US$ 3)
python eval_narrator_v3.py

# Copiloto RAG sob framework RAGAS (~7 min, ~US$ 0,5)
python eval_copilot_v3.py

# Analisador qualitativo + baselines BERTopic/k-means/LDA (~3 min, ~US$ 1)
python eval_qualitative_v3.py
```

Cada script grava resultados em `refactor_v1_2/metrics/` (JSON + CSV
por caso).

---

## Regerando o TCC

```bash
cd refactor_v1_2
python build_docx.py
# saídas em ../TCC - MF e G - v2.0.docx e .pdf
```

A conversão PDF é via LibreOffice headless.

---

## Os cinco agentes

| Agente | Função | Métricas primárias |
|---|---|---|
| Narrador do PGR | Transforma scores agregados em prosa técnica do Inventário de Riscos Psicossociais. | BERTScore F1, faithfulness ao payload, alucinação regulatória |
| Gerador 5W2H | Produz Plano de Ação 5W2H aderente à hierarquia de controle NR-01 e a princípios andragógicos. | Acurácia 4x4 (gold cego), aderência andragógica, alucinação regulatória |
| Copiloto NR-01 | Responde perguntas sobre normas e dados da empresa via RAG sobre corpus vetorizado. | Faithfulness, answer relevancy, context relevancy (RAGAS) |
| Validador anti-PII | Filtro determinístico (regex + heurística) sobre toda saída textual dos demais agentes. | Fβ=2 doc-level e macro span-level, taxa de vazamento por categoria |
| Analisador Qualitativo | Agrupa respostas abertas em temas semânticos preservando anonimato. | Coerência tópica c_v, ARI vs. baselines |

Os prompts de sistema dos quatro primeiros agentes constam no Apêndice B
do TCC.

---

## Política de privacidade

- Todos os dados de avaliação são **sintéticos**, gerados
  algoritmicamente para representar cenários ocupacionais plausíveis
  sem corresponder a indivíduos reais.
- Piso inegociável de **k-anonymity**: k = 4 por dimensão, k = 3 por
  recorte setorial. Implementado em
  `emotion-care/services/anonymity_policy.py`.
- Validador anti-PII obrigatório sobre toda saída textual de agente
  LLM antes da exposição ao gestor. Implementado em
  `emotion-care/services/ai/pii_validator.py`.
- Nenhuma execução com respondentes humanos foi conduzida; a
  validação em campo permanece como trabalho futuro condicionada à
  aprovação por Comitê de Ética em Pesquisa.

---

## Licença e citação

Este repositório acompanha um Trabalho de Conclusão de Curso. Para
citações em trabalhos acadêmicos:

```
ALENCAR, G. R. M.; OLIVEIRA, M. F. J. C. Interpretação de
questionários psicossociais com modelos de linguagem de grande
escala: uma arquitetura de agentes com RAG e validação anti-PII para
a NR-01. Trabalho de Conclusão de Curso. Centro Universitário Afya
UNIMA-AL, Maceió, 2026.
```

---

## Contato

Issues e pull requests pelo GitHub. Para questões diretamente
relacionadas ao TCC, contatar os autores via Afya UNIMA-AL.
