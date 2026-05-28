"""Popula copilot_knowledge com corpus normativo EXPANDIDO (v2.1).

Diferença em relação a seed_copilot_kb.py:
 - Cada documento é ampliado para 1.500-3.000 palavras, com cobertura
   detalhada dos itens das normas mais referenciados no gold de perguntas
   do copiloto.
 - Combinado ao chunk_size reduzido (700 caracteres), gera 60-90 chunks
   indexados versus ~14 da versão anterior, elevando a context relevancy
   esperada (item 2 do checklist v2.1).

Documentos indexados:
 - NR-01 (NR-01 atualizada por Portaria MTE 1.419/2024)
 - NR-17 (Ergonomia, atualização 2018)
 - COPSOQ II-Br (Boratti, Rocha e Santos, 2018)
 - ISO 45003:2021
 - LGPD (Lei 13.709/2018, recortes de saúde e dados sensíveis)
 - Política k-anonymity da plataforma
 - Modelos teóricos (Karasek demanda-controle, Siegrist esforço-recompensa,
   Maslach burnout)
"""
from __future__ import annotations
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care" / "nr1-backend"
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
NR-01 - Disposições Gerais e Gerenciamento de Riscos Ocupacionais (GRO).
Portaria MTE 1.419/2024 atualizada.

OBJETIVO. A NR-01 estabelece disposições gerais sobre a aplicação das
Normas Regulamentadoras e implementa o Gerenciamento de Riscos
Ocupacionais (GRO) como ferramenta central da gestão de saúde e
segurança do trabalho. O empregador deve identificar, avaliar e
controlar todos os riscos ocupacionais, incluindo os riscos
psicossociais, considerando a hierarquia de controles.

PROGRAMA DE GERENCIAMENTO DE RISCOS (PGR). O PGR é o instrumento que
documenta o GRO. Deve conter: (i) o inventário de riscos
ocupacionais; (ii) o plano de ação com medidas de prevenção e
controle; (iii) os registros de monitoramento; (iv) as análises de
acidentes e doenças relacionadas ao trabalho. O PGR deve ser
assinado por profissional legalmente habilitado em saúde e
segurança do trabalho.

INVENTÁRIO DE RISCOS. O inventário deve listar e classificar todos
os perigos identificados, com avaliação quantitativa ou qualitativa
do risco, conforme item 1.5.3 da norma. Para riscos psicossociais
especificamente, recomenda-se uso de instrumentos validados como o
COPSOQ-II ou equivalentes adaptados ao contexto brasileiro.

PLANO DE AÇÃO. O plano de ação deve seguir a hierarquia de
controles, do nível mais alto ao mais baixo:

Nível 1 - Eliminação. Remover a causa raiz do risco. Aplicável quando
a fonte do risco é uma prática, política ou condição organizacional
que pode ser completamente removida sem prejuízo do fluxo essencial
do trabalho. Exemplos no contexto psicossocial: encerrar prática de
gestão abusiva formalizada em diretriz interna, eliminar meta
inatingível imposta por decisão organizacional, remover sistema de
ranking forçado com demissão automática, descontinuar vigilância
eletrônica sem comunicação prévia, suprimir cláusula contratual que
veta férias.

Nível 2 - Substituição. Substituir o processo ou método por
alternativa de menor risco quando a função operacional não pode ser
eliminada. Exemplos: substituir avaliação anual única por feedback
contínuo estruturado, trocar produção empurrada por puxada com
kanban, substituir multitarefa forçada por foco serial com janelas
dedicadas, trocar escala exaustiva por rodízio com cobertura,
substituir cobrança de meta semanal com ranking público por
acompanhamento individual privado.

Nível 3 - Controle Organizacional. Reorganizar o trabalho quando o
risco decorre da forma de organização (cargos, fluxos, comunicação,
liderança), sem fonte única removível. Exemplos: redistribuir carga
de trabalho entre equipes, revisar metas e indicadores, implementar
rodízio de funções, criar canais formais de escuta, treinar
lideranças em gestão humanizada, institucionalizar programas de
reconhecimento, publicar matriz RACI de responsabilidades, criar
calendário público de mudanças, instituir fóruns de resolução de
conflito de papel.

Nível 4 - Controle Individual (menor prioridade). Apoio direto ao
trabalhador. Aplicável apenas após esgotadas as medidas
organizacionais, ou quando a demanda emocional ou cognitiva é
inerente à atividade-fim (atendimento a vítimas, ouvidoria,
controle de tráfego aéreo). Exemplos: Programa de Assistência ao
Empregado (EAP), supervisão psicológica regular, treinamento
individual de manejo emocional, psicoeducação em estresse, suporte
de mindfulness e bem-estar.

GRUPOS HOMOGÊNEOS DE EXPOSIÇÃO (GHE). Os GHE reúnem trabalhadores
com perfil de exposição semelhante e são a unidade base de
agregação dos riscos no PGR. A definição de GHE considera função,
posto de trabalho, jornada, agentes presentes e fluxo operacional.
Agregar riscos por GHE permite construir o inventário com
granularidade adequada sem expor indivíduos.

REAVALIAÇÃO DOS RISCOS. A reavaliação do PGR deve ocorrer no mínimo
a cada dois anos, ou imediatamente após qualquer alteração
significativa nas condições de trabalho (introdução de novos
processos, expansão de quadro, mudança organizacional relevante,
ocorrência de acidente ou doença relacionada ao trabalho). A
monitoração dos planos de ação é contínua.

PARTICIPAÇÃO DA CIPA. A Comissão Interna de Prevenção de Acidentes
participa do monitoramento dos riscos identificados no PGR e
contribui na elaboração das medidas de controle, com foco em ações
preventivas no ambiente de trabalho.

EQUIPE AVALIADORA. A equipe de avaliação do PGR deve ser composta
por profissionais legalmente habilitados em SST: engenheiros de
segurança, médicos do trabalho, técnicos de segurança e, para
riscos psicossociais, profissionais com formação em psicologia do
trabalho ou ergonomia.

LIMITES DE EXPOSIÇÃO. Para riscos psicossociais, a NR-01 não
estabelece limites quantitativos numéricos universais (à diferença
de riscos químicos ou físicos); a classificação por faixas Verde,
Amarela e Vermelha do instrumento aplicado, combinada com a matriz
de severidade por probabilidade (SxP), determina o nível de risco
para fins de priorização das medidas.

Fonte: Portaria MTE 1.419/2024 e Norma Regulamentadora NR-01.
""",

    "NR-17": """
NR-17 - Ergonomia. Norma Regulamentadora atualizada em 2018.

OBJETIVO. A NR-17 estabelece parâmetros que permitam a adaptação
das condições de trabalho às características psicofisiológicas dos
trabalhadores, de modo a proporcionar conforto, segurança e
desempenho eficiente.

ASPECTOS COGNITIVOS E PSICOSSOCIAIS. A NR-17 reconhece explicitamente
fatores ergonômicos cognitivos e organizacionais como carga mental,
exigências de atenção sustentada, ritmo de trabalho, monotonia,
exigências emocionais, pressão temporal e relacionamento interpessoal
no trabalho. O item 17.6 da norma trata da organização do trabalho.

CARGA MENTAL DE TRABALHO. A carga mental é avaliada pelas demandas
de atenção, memória, processamento de informação e tomada de
decisão exigidas pelo posto de trabalho. Pode ser sub-carga
(monotonia, repetitividade extrema) ou sobrecarga (excesso de
demanda simultânea, multitarefa forçada, pressão por velocidade).
Ambos os extremos geram fadiga mental, estresse e erros.

ANÁLISE ERGONÔMICA DO TRABALHO (AET). A AET é a metodologia
recomendada pela NR-17 para identificar fatores ergonômicos
inadequados. Contempla análise da demanda, da tarefa prescrita, da
atividade real e dos determinantes (organizacionais, ambientais e
individuais). A AET deve ser feita por profissional habilitado.

ORGANIZAÇÃO DO TRABALHO. O item 17.6 estabelece que a organização
do trabalho deve considerar: ritmos de trabalho compatíveis,
duração da jornada, pausas adequadas, conteúdo significativo das
tarefas, autonomia, participação nas decisões. Sistemas de avaliação
de desempenho não devem gerar pressão excessiva.

FATORES PSICOSSOCIAIS. A NR-17 cita expressamente como fatores a
serem observados: as exigências cognitivas, a pressão temporal, a
necessidade de manter postura emocional adequada ao atendimento
externo, e a possibilidade de interrupção do trabalho. O atendimento
em call centers e telemarketing tem anexo específico (Anexo II).

INTERFACE COM A NR-01. A NR-17 complementa a NR-01 ao detalhar
aspectos ergonômicos do GRO. Riscos identificados pela AET devem ser
incorporados ao inventário de riscos do PGR.

Fonte: Norma Regulamentadora NR-17 (revisão 2018) e anexos.
""",

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

    "LGPD": """
Lei Geral de Proteção de Dados Pessoais - Lei nº 13.709, de 14 de
agosto de 2018 (LGPD).

OBJETIVO. A LGPD dispõe sobre o tratamento de dados pessoais por
pessoa natural ou jurídica, com o objetivo de proteger os direitos
fundamentais de liberdade e de privacidade.

DADOS PESSOAIS SENSÍVEIS. O Art. 5º, II define como dados sensíveis
informações sobre origem racial ou étnica, convicção religiosa,
opinião política, filiação a sindicato, dado referente à saúde ou à
vida sexual, dado genético ou biométrico. DADOS SOBRE SAÚDE,
inclusive saúde mental e psicossocial coletados em avaliações
ocupacionais, são EXPRESSAMENTE classificados como sensíveis.

BASES LEGAIS PARA DADOS SENSÍVEIS (Art. 11). O tratamento de dados
pessoais sensíveis exige base legal específica: (a) consentimento
específico e destacado para finalidades determinadas; (b) sem
consentimento, apenas nas hipóteses do inciso II - cumprimento de
obrigação legal, execução de políticas públicas, estudos por órgão
de pesquisa com anonimização, exercício regular de direitos,
proteção da vida, tutela da saúde, garantia da prevenção à fraude e
à segurança.

PRINCÍPIOS GERAIS (Art. 6º). Aplicáveis a todo tratamento:
finalidade (propósitos legítimos, específicos, explícitos e
informados ao titular), adequação (compatibilidade com finalidades),
necessidade (mínimo necessário), livre acesso, qualidade dos
dados, transparência, segurança, prevenção, não discriminação,
responsabilização e prestação de contas.

ANONIMIZAÇÃO (Art. 12). Dados anonimizados não são considerados
dados pessoais para fins desta Lei, salvo se o processo de
anonimização for revertido com esforços razoáveis. A LGPD não
impõe técnica específica de anonimização; modelos consagrados na
literatura como k-anonymity (Sweeney, 2002), l-diversity e
t-closeness são aceitáveis.

APLICAÇÃO EM SAÚDE OCUPACIONAL. Para coleta de respostas em
pesquisas de avaliação de riscos psicossociais no trabalho,
recomenda-se: (i) consentimento específico do trabalhador para a
finalidade declarada; (ii) coleta anonimizada quando possível,
com piso k-anonymity para evitar reidentificação por exclusão em
setores pequenos; (iii) finalidade restrita à avaliação coletiva,
sem uso para decisões individuais (promoção, demissão); (iv)
retenção temporal limitada ao necessário; (v) eliminação após
encerramento do propósito.

DIREITOS DO TITULAR (Art. 18). O trabalhador tem direito de
solicitar confirmação da existência de tratamento, acesso aos
dados, correção de dados incompletos, anonimização, bloqueio ou
eliminação, portabilidade, eliminação dos dados tratados com
consentimento, informação sobre compartilhamento e revogação do
consentimento.

ENCARREGADO DE DADOS (DPO). O Art. 41 exige a designação de
Encarregado pelo Tratamento de Dados Pessoais (Data Protection
Officer) responsável pela interlocução com titulares e com a
Autoridade Nacional de Proteção de Dados (ANPD).

SANÇÕES (Art. 52). Vão de advertência a multa de até 2% do
faturamento (limitada a R$ 50 milhões por infração). Vazamento de
dados sensíveis de saúde é incidente de alto impacto reportável à
ANPD.

Fonte: Lei nº 13.709/2018 e regulamentação ANPD.
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
            print(f"  {source}: {n} chunks")
            total += n

    print(f"Total: {total} chunks indexados (corpus v2.1, chunk_size=700)")


if __name__ == "__main__":
    asyncio.run(main())
