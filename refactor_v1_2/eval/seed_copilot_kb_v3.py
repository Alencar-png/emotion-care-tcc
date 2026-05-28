"""Popula copilot_knowledge com corpus normativo COMPLETO (v3).

Mudança em relação ao seed_v2:
 - NR-01, NR-17 e LGPD passam a usar o texto OFICIAL INTEGRAL
   (refactor_v1_2/normas_completas/*.txt), não mais excertos.
 - COPSOQ-II, ISO 45003, k-anonymity e Aspectos Teóricos
   permanecem como excertos curados (não há fonte aberta de
   texto integral).
 - Combinado a chunk_size=600 com overlap=120 do copilot_nr01.py,
   gera de 400 a 800 chunks indexados (versus 60-90 do seed v2),
   sustentando threshold cosseno de 0,75 (produção).
"""
from __future__ import annotations
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care" / "nr1-backend"
NORMAS = ROOT.parent / "normas_completas"
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


def _load_norma(filename: str) -> str:
    path = NORMAS / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Texto integral ausente: {path}. Rode normas_completas/extract_norms.py."
        )
    return path.read_text(encoding="utf-8")


DOCS = {
    "NR-01": _load_norma("nr01.txt"),
    "NR-17": _load_norma("nr17.txt"),
    "LGPD": _load_norma("lgpd.txt"),
    "COPSOQ-II": """
Copenhagen Psychosocial Questionnaire (COPSOQ-II) - versão
brasileira COPSOQ II-Br adaptada por Boratti, Rocha e Santos (2018).

VISÃO GERAL. O COPSOQ-II é um instrumento psicométrico validado
internacionalmente para avaliação de riscos psicossociais no
trabalho. Foi originalmente desenvolvido pelo National Research
Centre for the Working Environment da Dinamarca (Kristensen et al.,
2010). A versão brasileira (Boratti, Rocha e Santos, 2018) adaptou
linguisticamente e culturalmente o instrumento e validou suas
propriedades psicométricas.

ESTRUTURA. A versão brasileira de pesquisa contém 80 itens em
escala Likert de cinco pontos, agrupados em 26 dimensões
psicossociais e organizadas em sete domínios analíticos.

DOMÍNIO 1 - DEMANDAS NO TRABALHO. Inclui as dimensões: Exigências
Quantitativas, Ritmo de Trabalho, Exigências Cognitivas, Exigências
Emocionais e Exigências de Esconder Emoções. Avalia o volume e
intensidade do trabalho percebido pelos respondentes.

DOMÍNIO 2 - ORGANIZAÇÃO E CONTEÚDO DO TRABALHO. Inclui Influência
no Trabalho, Possibilidade de Desenvolvimento, Significado do
Trabalho, Compromisso com o Local de Trabalho. Avalia autonomia e
sentido percebido.

DOMÍNIO 3 - RELAÇÕES SOCIAIS E LIDERANÇA. Inclui Previsibilidade,
Reconhecimento, Clareza de Papel, Conflitos de Papel, Qualidade da
Liderança, Suporte Social de Colegas, Suporte Social de Superiores
e Comunidade Social no Trabalho. É o domínio com maior número de
dimensões.

DOMÍNIO 4 - VALORES NO LOCAL DE TRABALHO. Inclui Confiança Vertical,
Confiança Horizontal, Justiça Organizacional e Respeito, Sentido do
Trabalho. Avalia o clima ético-organizacional.

DOMÍNIO 5 - SAÚDE E BEM-ESTAR. Inclui Saúde Geral, Burnout,
Estresse, Distúrbios do Sono, Sintomas Depressivos. Avalia o estado
do respondente.

DOMÍNIO 6 - COMPORTAMENTOS OFENSIVOS NO TRABALHO. Inclui Insultos e
Provocações, Assédio Sexual, Ameaças de Violência, Violência Física,
Bullying. Avalia exposição a violência interpessoal.

DOMÍNIO 7 - INSEGURANÇA LABORAL E CONFLITO TRABALHO-FAMÍLIA. Inclui
Insegurança no Trabalho, Insegurança nas Condições de Trabalho e
Conflito Trabalho-Família. Avalia ameaças externas à estabilidade.

ESCALA DE RESPOSTA. Cinco pontos: 0 (nunca/quase nunca), 25
(raramente), 50 (às vezes), 75 (frequentemente), 100 (sempre).
Itens de pontuação reversa são invertidos antes da agregação para
manter direcionalidade consistente.

CLASSIFICAÇÃO POR FAIXA DE COR. Após normalização para escala 0 a
100, as dimensões são classificadas em três faixas: Verde
(saudável, score 0 a 33), Amarelo (intermediário, score 34 a 66) e
Vermelho (em risco, score 67 a 100). Para dimensões positivas
(como Reconhecimento) a interpretação é inversa: scores altos
indicam fator protetor.

GRANULARIDADE MÍNIMA. A aplicação requer ao menos 4 respostas para
gerar scores agregados estatisticamente válidos. Recortes por setor
exigem ao menos 3 respondentes para preservação do anonimato.

USO NO BRASIL. A versão brasileira é recomendada como instrumento
de avaliação de riscos psicossociais para fins do PGR exigido pela
NR-01, por contar com validação psicométrica formal e adaptação
cultural.

Fonte: Boratti, Rocha e Santos (2018); Kristensen et al. (2010).
""",
    "ISO 45003": """
ISO 45003:2021 - Sistemas de gestão de saúde e segurança ocupacional.
Saúde e segurança psicológica no trabalho. Diretrizes para
gerenciamento de riscos psicossociais.

ESCOPO. A ISO 45003 é o primeiro padrão internacional dedicado
especificamente à saúde psicológica no trabalho. Estende o sistema
de gestão da ISO 45001 com foco em fatores psicossociais. Aplica-se
a organizações de todos os portes e setores.

ÁREAS COBERTAS. A norma cobre três grandes áreas de risco
psicossocial: (a) ORGANIZAÇÃO DO TRABALHO - cargas, controle,
relações, mudança organizacional, terceirização; (b) FATORES
SOCIAIS - liderança, relacionamentos, suporte, reconhecimento,
comportamentos ofensivos; (c) AMBIENTE E EQUIPAMENTO - ergonomia
psicológica, isolamento, exposição a violência ou trauma.

LIDERANÇA E PARTICIPAÇÃO. A norma exige comprometimento explícito
da alta direção com saúde psicológica e participação ativa dos
trabalhadores na identificação dos riscos. Os trabalhadores devem
ser consultados sobre os fatores percebidos e envolvidos no desenho
das intervenções (item 5.4 da norma).

IDENTIFICAÇÃO E AVALIAÇÃO DOS RISCOS PSICOSSOCIAIS. O item 6.1.2
trata da identificação de perigos psicossociais e o item 6.1.3 da
avaliação dos riscos. Recomenda instrumentos validados e métodos
participativos. A organização deve documentar critérios de
classificação e tolerância.

INTERVENÇÕES ORGANIZACIONAIS PRIMEIRO. A ISO 45003 reforça a
hierarquia de controles: medidas organizacionais (Nível 3) e de
substituição (Nível 2) devem preceder intervenções individuais
(Nível 4). Suporte psicológico ao trabalhador é complementar, não
substitui o redesenho organizacional.

MONITORAMENTO E AVALIAÇÃO DE DESEMPENHO. O item 9.1 estabelece
indicadores de processo (cobertura de avaliações, treinamentos,
intervenções implementadas) e de resultado (absenteísmo,
afastamentos por CID F, rotatividade, percepção de bem-estar). A
organização deve revisar os indicadores periodicamente.

MELHORIA CONTÍNUA. A norma adota o ciclo PDCA (Plan-Do-Check-Act)
do ISO 45001 aplicado a fatores psicossociais. Anexo A apresenta
exemplos de perigos psicossociais e medidas de controle; Anexo B
detalha aplicação setorial.

INTERFACE COM A NR-01 BRASILEIRA. A ISO 45003 é compatível e
complementar à NR-01 atualizada (2022). A norma brasileira
referencia o conceito de risco psicossocial e a hierarquia de
controles que a ISO 45003 detalha.

Fonte: ISO 45003:2021 - Occupational health and safety management.
""",
    "Política k-anonymity": """
Política de anonimato da plataforma Emotion Care.

LIMIARES INEGOCIÁVEIS DE EXIBIÇÃO. Implementação em
emotion-care/services/anonymity_policy.py:

MIN_RESPONSES_FOR_SCORE = 4. Nenhum score agregado por dimensão é
exibido a gestores ou aos agentes LLM se a campanha apresentar
menos de 4 respostas. A justificativa estatística é dupla: (i)
preservar anonimato individual em campanhas pequenas onde quatro
respondentes ainda não garantem indistinguibilidade total; (ii)
garantir que a média seja estatisticamente menos sensível a
outliers individuais.

MIN_RESPONDENTS_PER_SECTOR = 3. Nenhum recorte por setor é exibido
se a contagem é menor que 3 respondentes. Setores pequenos com 1
ou 2 respondentes ficam ocultos do dashboard e dos agentes; o
gestor só vê 'recorte indisponível por piso de anonimato'.

JUSTIFICATIVA TEÓRICA. Esses pisos seguem o modelo k-anonymity
proposto por Sweeney (2002): uma liberação satisfaz k-anonymity se,
para cada indivíduo, suas informações são indistinguíveis de pelo
menos k-1 outros indivíduos. Aplicado ao Emotion Care, k=4 para
scores e k=3 para setores reduz a probabilidade de reidentificação
por exclusão em organizações de pequeno e médio porte.

OVERRIDES SÓ TORNAM MAIS RIGOROSO. A política é unidirecional:
configurações por tenant podem AUMENTAR k (ex.: k=6 para setores em
empresa pequena), nunca diminuir abaixo do piso. Tentativas de
relaxar geram erro de configuração.

VALIDADOR ANTI-PII PÓS-GERAÇÃO. Toda saída textual de qualquer
agente LLM (narrador, gerador 5W2H, copiloto, analisador
qualitativo) passa OBRIGATORIAMENTE pelo validador anti-PII antes
de ser exibida ao gestor ou armazenada. O validador é determinístico
(regex + heurística + lista de prenomes brasileiros) e detecta oito
categorias: e-mail, CPF, CNPJ, telefone, matrícula, cargo
identificador, título com prenome e nome próprio composto. Latência
de pico inferior a 0,1 ms.

REFERÊNCIA TEÓRICA. Sweeney, L. (2002). k-anonymity: a model for
protecting privacy. International Journal on Uncertainty, Fuzziness
and Knowledge-Based Systems, 10(5), 557-570.
""",
    "Aspectos Teóricos": """
Modelos teóricos de referência para riscos psicossociais.

MODELO DEMANDA-CONTROLE (Karasek, 1979; Karasek e Theorell, 1990).
Postula que o estresse no trabalho resulta da combinação de
elevadas demandas (psicológicas e quantitativas) com baixa latitude
de decisão (controle sobre o conteúdo, ritmo e organização do
trabalho). Quatro quadrantes resultam: trabalho ativo (alta
demanda + alto controle, baixo risco), trabalho passivo (baixa
demanda + baixo controle), trabalho de baixo estresse (baixa
demanda + alto controle) e trabalho de alto estresse (alta demanda
+ baixo controle, MAIOR RISCO).

MODELO ESFORÇO-RECOMPENSA (Siegrist, 1996). Postula que o estresse
no trabalho resulta do desequilíbrio entre o esforço extrínseco
investido pelo trabalhador (carga, pressão de tempo, exigências) e
as recompensas recebidas (salário, reconhecimento, segurança no
emprego, oportunidades de carreira). O comprometimento excessivo
(super-comprometimento intrínseco) é fator agravante. O
desequilíbrio crônico esforço-recompensa associa-se a doenças
cardiovasculares, depressão e burnout.

MASLACH BURNOUT INVENTORY (MBI). Maslach e Jackson (1981) operacionalizaram
burnout em três dimensões: exaustão emocional (sentir-se
emocionalmente esgotado pelo trabalho), despersonalização
(distanciamento e cinismo em relação a colegas, clientes ou
pacientes) e baixa realização pessoal (perda do sentimento de
competência e realização). MBI é o instrumento de referência
internacional para mensurar burnout, com versão brasileira validada.

EVIDÊNCIAS EPIDEMIOLÓGICAS. Shi et al. (2025), meta-análise sobre
predição de burnout em profissionais de saúde com MBI como ground
truth, reportam AUC agrupada de 0,72 (IC95% 0,68 a 0,76) usando
modelos clássicos de aprendizado de máquina sobre features
tabulares. A literatura é predominantemente em saúde; aplicações em
outros setores brasileiros são escassas.

Fontes: Karasek (1979); Karasek e Theorell (1990); Siegrist (1996);
Maslach e Jackson (1981); Shi et al. (2025).
""",
}


async def main():
    if not os.getenv("OPENAI_API_KEY"):
        print("[!] sem OPENAI_API_KEY")
        return

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from services.ai.copilot_nr01 import index_document
    from models.models import CopilotKnowledge

    db_url = os.environ["DATABASE_URL"]
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        db.query(CopilotKnowledge).delete()
        db.commit()

    total = 0
    for source, content in DOCS.items():
        with Session() as db:
            n = await index_document(db, content, source=source)
            print(f"  {source}: {n} chunks (len={len(content)} chars)")
            total += n

    print(f"\nTotal: {total} chunks indexados (corpus v3, chunk_size=600, threshold=0,75)")


if __name__ == "__main__":
    asyncio.run(main())
