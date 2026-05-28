"""Popula a tabela copilot_knowledge com chunks vetorizados das normas
para permitir a avaliacao do copiloto RAG.

Documentos indexados:
  - NR-01 (excertos chave)
  - NR-17 (excertos chave)
  - COPSOQ-II (Boratti, Rocha e Santos, 2018)
  - ISO 45003
  - LGPD (recortes de saude e dados sensiveis)
  - Politica k-anonymity
"""
from __future__ import annotations
import asyncio, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care"
sys.path.insert(0, str(BACKEND))

env_path = BACKEND / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://emotioncare:emotioncare@localhost:5432/emotioncare",
)


DOCS = {
    "NR-01": """
NR-01 - Disposições Gerais e Gerenciamento de Riscos Ocupacionais.

A NR-01 estabelece o Gerenciamento de Riscos Ocupacionais (GRO) e exige que
o empregador identifique, avalie e controle os riscos ocupacionais, incluindo
os riscos psicossociais. O Programa de Gerenciamento de Riscos (PGR) deve
documentar o inventário de riscos e o plano de ação.

Hierarquia de controle de riscos da NR-01 (em ordem de prioridade):
1-Eliminação: remover a causa raiz do risco. Exemplo: encerrar prática
abusiva de gestão, eliminar meta inatingível imposta sem negociação.
2-Substituição: substituir o processo por alternativa de menor risco.
Exemplo: trocar escala 12x36 por rodízio com cobertura.
3-Controle Organizacional: reorganizar o trabalho. Exemplo: redistribuir
carga, criar canais formais de escuta, treinar lideranças.
4-Controle Individual (menor prioridade): apoio direto ao trabalhador.
Exemplo: programas de mindfulness e apoio psicológico.

A reavaliação dos riscos deve ocorrer no mínimo a cada dois anos ou após
qualquer alteração significativa nas condições de trabalho. O PGR deve ser
assinado por profissional habilitado de SST. A NR-01 entrou em vigor em
sua redação atualizada em 2022.

Os Grupos Homogêneos de Exposição (GHE) reúnem trabalhadores com perfil de
exposição semelhante e são a unidade base de agregação dos riscos.

Fonte: Portaria MTE 1.419/2024 e Norma Regulamentadora NR-01.
""",

    "NR-17": """
NR-17 - Ergonomia.

A NR-17 trata dos fatores ergonômicos, incluindo aspectos cognitivos,
organizacionais e psicossociais. Reconhece carga mental de trabalho,
pressão temporal, ritmo intenso, monotonia e exigências emocionais como
fatores ergonômicos relevantes.

A NR-17 estabelece que devem ser observados aspectos de organização do
trabalho compatíveis com as características psicofisiológicas dos
trabalhadores, sem desconsiderar a carga mental.

Fatores ergonômicos cognitivos incluem demandas de atenção, memória,
tomada de decisão e processamento de informação no posto de trabalho.

Fonte: Norma Regulamentadora NR-17 (atualização 2018).
""",

    "COPSOQ-II": """
Copenhagen Psychosocial Questionnaire (COPSOQ-II) - versão brasileira
(COPSOQ II-Br) adaptada por Boratti, Rocha e Santos (2018).

O COPSOQ-II é um instrumento psicométrico validado para avaliação de
riscos psicossociais no trabalho. A versão brasileira contém 26 dimensões
e 80 questões em escala Likert de cinco pontos, agrupadas em sete
domínios: exigências quantitativas, exigências cognitivas, exigências
emocionais, ritmo de trabalho, organização do trabalho, suporte social e
qualidade da liderança, e saúde geral.

Classificação por cor: Verde (saudável, score 0 a 33), Amarelo
(intermediário, score 34 a 66) e Vermelho (em risco, score 67 a 100).
Os itens de pontuação reversa são invertidos antes da agregação.

Granularidade mínima recomendada: a aplicação requer ao menos 4 respostas
para gerar scores agregados válidos.
""",

    "ISO 45003": """
ISO 45003:2021 - Saúde e segurança ocupacional. Saúde e segurança
psicológica no trabalho. Diretrizes para gerenciamento de riscos
psicossociais.

A ISO 45003 estende o sistema de gestão da ISO 45001 com foco específico
nos fatores psicossociais. Recomenda intervenções organizacionais antes de
intervenções individuais, em alinhamento com a hierarquia de controle.

Áreas cobertas: organização do trabalho, fatores sociais e equipamento e
ambiente. Inclui orientações sobre liderança, participação dos
trabalhadores e monitoramento contínuo.
""",

    "LGPD": """
Lei Geral de Proteção de Dados Pessoais - Lei nº 13.709/2018 (LGPD).

A LGPD classifica dados sobre saúde como dados pessoais sensíveis (Art.
5º, II), exigindo bases legais específicas para tratamento (Art. 11):
consentimento específico, proteção da vida, exercício regular de
direitos, ou tutela da saúde.

Princípios aplicáveis ao tratamento (Art. 6º): finalidade, adequação,
necessidade, livre acesso, qualidade dos dados, transparência, segurança,
prevenção, não discriminação e responsabilização.

Para coleta de respostas em pesquisas de saúde ocupacional, recomenda-se
anonimização (Art. 12) com piso k-anonymity para evitar reidentificação.
""",

    "Política k-anonymity": """
Política de anonimato da plataforma Emotion Care.

Limiares inegociáveis de exibição:
- MIN_RESPONSES_FOR_SCORE = 4: nenhum score agregado é exibido se a
  campanha tem menos de 4 respostas.
- MIN_RESPONDENTS_PER_SECTOR = 3: nenhum recorte por setor é exibido se
  a contagem é menor que 3 respondentes.

Esses pisos seguem o modelo k-anonymity proposto por Sweeney (2002) e
não podem ser relaxados por configuração de tenant. Overrides só podem
torná-los mais rigorosos.

Validador anti-PII pós-geração: toda saída textual de qualquer agente
LLM é filtrada para remover e-mails, CPF, CNPJ, telefones, matrículas,
cargos identificadores, títulos com prenome e nomes próprios compostos.
""",
}


async def main():
    if not os.getenv("OPENAI_API_KEY"):
        print("[!] sem chave")
        return

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from services.ai.copilot_nr01 import index_document
    from models.models import CopilotKnowledge

    db_url = os.environ["DATABASE_URL"]
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        # limpa e reindexa
        db.query(CopilotKnowledge).delete()
        db.commit()

    total = 0
    for source, content in DOCS.items():
        with Session() as db:
            n = await index_document(db, content, source=source)
            print(f"  {source}: {n} chunks")
            total += n

    print(f"Total: {total} chunks indexados")


if __name__ == "__main__":
    asyncio.run(main())
