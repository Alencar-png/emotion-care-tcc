"""Gold standard reformulado do gerador 5W2H, sem vazamento de rótulo.

Mudanças vs. action_plan_gold.json (v1):
 - Input NÃO contém o rótulo de hierarquia (expected_hierarchy_level)
   nem indicações textuais como "causa estrutural removível",
   "processo substituível" ou "questão organizacional"
   que poderiam vazar o nível para o agente.
 - 80 cenários (20 por nível da hierarquia NR-01).
 - Rótulos derivam de RUBRICA EXPLÍCITA com justificativa por cenário,
   pronta para aplicação por dois revisores independentes (kappa Cohen).
 - Descrição contém apenas: dimensão, score, setor, contexto laboral
   neutro.

A rubrica (Seção RUBRICA abaixo) foi construída a partir das diretrizes da
NR-01 e da ISO 45003 para riscos psicossociais.

Uso pelo agente em produção: o agente recebe os campos input e retorna a
hierarquia. O gold é a hierarquia conforme rubrica.

Uso por revisor humano (v1.7): aplicar a rubrica a cada caso de forma
independente e cega; calcular kappa entre revisores.
"""
from __future__ import annotations

from dataclasses import dataclass


HIERARCHY_LEVELS = (
    "1-Eliminação",
    "2-Substituição",
    "3-Controle Organizacional",
    "4-Controle Individual",
)


# --------------------- RUBRICA ---------------------
# Critérios objetivos para assignação de nível segundo NR-01/ISO 45003,
# aplicada de forma cega à descrição neutra do cenário.

RUBRIC = """
RUBRICA NR-01 PARA HIERARQUIA DE CONTROLE DE RISCO PSICOSSOCIAL

Nível 1 — ELIMINAÇÃO
  Aplicar quando a fonte do risco é uma prática, política ou condição
  organizacional que pode ser COMPLETAMENTE REMOVIDA sem prejuízo do
  fluxo essencial do trabalho. Exemplos: jornada compulsória além do
  legal; sistema de metas individuais inalcançáveis; políticas
  punitivas formais; vigilância eletrônica sem aviso.
  Indicadores: a descrição menciona prática inserida na rotina por
  decisão organizacional, sem origem em fator externo intransponível,
  e cuja remoção não compromete a entrega do serviço.

Nível 2 — SUBSTITUIÇÃO
  Aplicar quando a fonte do risco não pode ser eliminada por completo
  porque cumpre função operacional necessária, MAS pode ser substituída
  por um processo equivalente menos danoso. Exemplos: substituir
  produção empurrada por puxada; substituir avaliação anual de
  desempenho por feedback contínuo estruturado; substituir multitarefa
  forçada por foco serial.
  Indicadores: a descrição menciona processo cuja função é necessária
  mas cuja forma atual gera o dano; existe alternativa documentada.

Nível 3 — CONTROLE ORGANIZACIONAL / ENGENHARIA
  Aplicar quando o risco decorre da forma de organização do trabalho
  (cargos, fluxos, comunicação, liderança) e a intervenção apropriada
  é redesenho organizacional, capacitação de gestores, governança e
  comunicação. Não há fonte única removível; o risco está difuso na
  cultura ou estrutura.
  Indicadores: a descrição cita falta de clareza, falta de
  reconhecimento, comunicação deficiente, baixa qualidade de liderança,
  baixo suporte social entre pares, ou conflitos de papel.

Nível 4 — CONTROLE INDIVIDUAL
  Aplicar APENAS quando, após esgotada a hierarquia superior, persiste
  necessidade de medida individual de suporte (EAP, terapia,
  psicoeducação, treinamento de habilidades individuais para enfrentar
  exigência inerente à atividade). Não usar como primeira linha.
  Indicadores: a descrição cita demanda emocional inerente à atividade
  (atendimento humanizado, contato com sofrimento alheio) que não pode
  ser eliminada nem substituída e exige preparo individual.

NA AUSÊNCIA de indicador claro, escolher Nível 3 (Controle Organizacional)
como categoria modal e justificar.
"""


@dataclass(frozen=True)
class Scenario:
    id: str
    dimensao: str
    score: int
    setor: str
    description: str
    expected_hierarchy: str
    rubric_reasoning: str  # justificativa segundo rubrica


# --------------------- CENÁRIOS ---------------------
# 20 por nível, descrição neutra (sem palavras-âncora que vazem).

CENARIOS = []


def _add(level: str, items: list[dict]) -> None:
    for i, it in enumerate(items):
        CENARIOS.append(Scenario(
            id=f"plan_{level[0]}{i:02d}",
            dimensao=it["dimensao"],
            score=it["score"],
            setor=it["setor"],
            description=it["description"],
            expected_hierarchy=level,
            rubric_reasoning=it["rubric_reasoning"],
        ))


# --- Nível 1 — Eliminação (20) ---
_add("1-Eliminação", [
    {
        "dimensao": "Demandas Quantitativas",
        "score": 78, "setor": "Comercial",
        "description": "Carga de trabalho excede consistentemente o expediente "
                       "previsto em contrato. Há registros de pernoites na empresa "
                       "e e-mails fora de horário considerados obrigatórios.",
        "rubric_reasoning": "Prática formalizada (cobrança de e-mails fora do "
                            "expediente como obrigação) decidida pela própria "
                            "organização; remoção integral não impede entrega.",
    },
    {
        "dimensao": "Justiça Organizacional",
        "score": 71, "setor": "Operações",
        "description": "Política de bônus individual baseada em ranking forçado "
                       "anual que classifica os 10 por cento inferiores para "
                       "demissão automática.",
        "rubric_reasoning": "Política punitiva removível por decisão da diretoria; "
                            "sem prejuízo do fluxo essencial de operações.",
    },
    {
        "dimensao": "Confiança Vertical",
        "score": 74, "setor": "Administrativo",
        "description": "Sistema de vigilância por câmeras com microfones cobrindo "
                       "todas as estações de trabalho, instalado sem comunicação "
                       "prévia aos colaboradores.",
        "rubric_reasoning": "Sistema instalado por decisão organizacional, "
                            "removível, sem função operacional essencial.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 68, "setor": "RH",
        "description": "Diretriz informal de que conflitos interpessoais não "
                       "podem ser escalados acima da gerência sob risco de "
                       "retaliação documentada.",
        "rubric_reasoning": "Diretriz removível; sua eliminação restitui canal de "
                            "denúncia previsto em lei.",
    },
    {
        "dimensao": "Insegurança Laboral",
        "score": 81, "setor": "TI",
        "description": "Comunicação de demissões massivas anunciada em reuniões "
                       "trimestrais com nomes projetados em telão a todos os "
                       "presentes.",
        "rubric_reasoning": "Prática de exposição pública removível, substituível "
                            "por comunicação individual nada essencial à decisão.",
    },
    {
        "dimensao": "Conflitos de Papel",
        "score": 72, "setor": "Marketing",
        "description": "Atribuição duplicada do mesmo objetivo para duas equipes "
                       "concorrentes com bônus para quem entregar primeiro.",
        "rubric_reasoning": "Mecanismo de duplicação removível; o objetivo único é "
                            "preservado sem o instrumento conflituoso.",
    },
    {
        "dimensao": "Demandas Quantitativas",
        "score": 75, "setor": "Logística",
        "description": "Sistema interno que escala automaticamente horas extras "
                       "obrigatórias sempre que o estoque atinge limite, sem "
                       "anuência do trabalhador.",
        "rubric_reasoning": "Sistema automático removível; substituição não exige "
                            "manter a obrigatoriedade.",
    },
    {
        "dimensao": "Justiça Organizacional",
        "score": 69, "setor": "Comercial",
        "description": "Política de promoção que exige indicação informal de "
                       "padrinhos da diretoria, sem critérios objetivos "
                       "publicados.",
        "rubric_reasoning": "Política substituível por sistema meritocrático; o "
                            "atual é removível sem prejuízo operacional.",
    },
    {
        "dimensao": "Confiança Horizontal",
        "score": 73, "setor": "Produção",
        "description": "Programa de bonificação que premia apenas quem denuncia "
                       "colegas com atrasos, criando ambiente de delação.",
        "rubric_reasoning": "Programa removível; mecanismos de controle de "
                            "ponto não dependem da delação.",
    },
    {
        "dimensao": "Demandas Cognitivas",
        "score": 70, "setor": "Administrativo",
        "description": "Reuniões diárias obrigatórias de duas horas para todos os "
                       "níveis hierárquicos, sem agenda definida ou ata.",
        "rubric_reasoning": "Prática removível ou ajustável; nenhuma exigência "
                            "regulatória ou operacional requer reunião nessa "
                            "modalidade.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 76, "setor": "RH",
        "description": "Prática informal de feedback público em ambiente coletivo "
                       "com críticas individuais expostas no quadro central.",
        "rubric_reasoning": "Modalidade de feedback removível e substituível por "
                            "feedback privado, sem prejuízo da função.",
    },
    {
        "dimensao": "Reconhecimento",
        "score": 67, "setor": "Marketing",
        "description": "Política não escrita de não reconhecer publicamente "
                       "conquistas individuais para evitar 'inveja' entre colegas.",
        "rubric_reasoning": "Política informal removível; reconhecimento explícito "
                            "é prática de baixo custo e alto retorno.",
    },
    {
        "dimensao": "Insegurança nas Condições",
        "score": 80, "setor": "Logística",
        "description": "Rotatividade compulsória mensal de função sem treinamento "
                       "prévio, decidida por sorteio público.",
        "rubric_reasoning": "Mecanismo de sorteio público removível; "
                            "polivalência treinada substitui sem o componente "
                            "danoso.",
    },
    {
        "dimensao": "Demandas Quantitativas",
        "score": 79, "setor": "Operações",
        "description": "Sistema de metas progressivas que aumenta 5 por cento ao "
                       "trimestre sem revisão da base operacional ou recursos.",
        "rubric_reasoning": "Mecanismo de incremento automático removível; meta "
                            "fixa ou ajustada por capacidade é alternativa "
                            "imediata.",
    },
    {
        "dimensao": "Compromisso com o Local",
        "score": 65, "setor": "TI",
        "description": "Cláusula contratual que impede férias durante todo o ano "
                       "fiscal mediante penalidade salarial.",
        "rubric_reasoning": "Cláusula contratual removível; descumpre direito "
                            "trabalhista de descanso anual.",
    },
    {
        "dimensao": "Qualidade da Liderança",
        "score": 68, "setor": "Comercial",
        "description": "Hábito gerencial de impor punições coletivas a equipes "
                       "inteiras por falha individual identificada.",
        "rubric_reasoning": "Prática gerencial removível; sanção individualizada é "
                            "a alternativa preservando o controle.",
    },
    {
        "dimensao": "Suporte Social Superiores",
        "score": 72, "setor": "Produção",
        "description": "Política que impede líderes de pleitear treinamento para "
                       "suas equipes sob alegação de orçamento congelado contínuo.",
        "rubric_reasoning": "Política orçamentária removível ou flexibilizável; "
                            "investimento em treinamento é necessidade legítima.",
    },
    {
        "dimensao": "Conflitos de Papel",
        "score": 70, "setor": "Administrativo",
        "description": "Duas hierarquias paralelas e equivalentes cobrando tarefas "
                       "contraditórias do mesmo grupo de colaboradores.",
        "rubric_reasoning": "Duplicidade hierárquica removível por reestruturação; "
                            "comando unificado é norma de governança.",
    },
    {
        "dimensao": "Ritmo de Trabalho",
        "score": 73, "setor": "Logística",
        "description": "Esteira de produção com velocidade fixa em 130 por cento "
                       "do recomendado pelo fabricante para o turno noturno.",
        "rubric_reasoning": "Configuração da velocidade removível; especificação "
                            "do fabricante é a referência segura.",
    },
    {
        "dimensao": "Influência no Trabalho",
        "score": 66, "setor": "RH",
        "description": "Prática informal de revisão obrigatória de toda decisão "
                       "operacional dos colaboradores pelo diretor executivo "
                       "mesmo em decisões rotineiras.",
        "rubric_reasoning": "Microgestão centralizada removível; delegação por "
                            "alçada é prática estabelecida.",
    },
])

# --- Nível 2 — Substituição (20) ---
_add("2-Substituição", [
    {
        "dimensao": "Ritmo de Trabalho",
        "score": 71, "setor": "Operações",
        "description": "Sistema de produção empurrada com lotes fixos prédeterminados, "
                       "ignorando o consumo efetivo dos postos seguintes.",
        "rubric_reasoning": "Função produtiva é necessária; existe alternativa "
                            "documentada (produção puxada / kanban) que substitui "
                            "com menor estresse de fluxo.",
    },
    {
        "dimensao": "Demandas Cognitivas",
        "score": 67, "setor": "Administrativo",
        "description": "Avaliação anual de desempenho como único mecanismo de "
                       "feedback, acumulando todas as críticas em um evento.",
        "rubric_reasoning": "Função (avaliar desempenho) é necessária; substituível "
                            "por feedback contínuo estruturado, menos danoso.",
    },
    {
        "dimensao": "Demandas Cognitivas",
        "score": 70, "setor": "TI",
        "description": "Modalidade de trabalho com multitarefa simultânea exigida "
                       "como padrão para todos os colaboradores do setor.",
        "rubric_reasoning": "Necessidade de polivalência é real; modalidade "
                            "substituível por foco serial com janelas dedicadas.",
    },
    {
        "dimensao": "Previsibilidade",
        "score": 65, "setor": "Comercial",
        "description": "Comunicações de mudanças estratégicas dadas apenas em "
                       "reuniões trimestrais, sem antecipação de tópicos.",
        "rubric_reasoning": "Comunicação necessária; substituível por "
                            "comunicação contínua com calendário previsível.",
    },
    {
        "dimensao": "Reconhecimento",
        "score": 68, "setor": "Marketing",
        "description": "Programa de reconhecimento que premia apenas o "
                       "colaborador do mês individualmente.",
        "rubric_reasoning": "Reconhecimento é função necessária; modalidade "
                            "individual única substituível por modelo "
                            "multinível (equipe + indivíduo).",
    },
    {
        "dimensao": "Sentido do Trabalho",
        "score": 69, "setor": "Operações",
        "description": "Onboarding focado exclusivamente em compliance e ferramentas, "
                       "sem conectar a função ao propósito da empresa.",
        "rubric_reasoning": "Onboarding é necessário; modelo substituível por "
                            "currículo que integra propósito e impacto.",
    },
    {
        "dimensao": "Possibilidade de Desenvolvimento",
        "score": 64, "setor": "RH",
        "description": "Treinamento formal apenas como obrigação anual de 8 "
                       "horas, focado em normas, sem trilha de carreira.",
        "rubric_reasoning": "Treinamento é necessário; modelo substituível por "
                            "trilhas de desenvolvimento contínuo personalizadas.",
    },
    {
        "dimensao": "Qualidade da Liderança",
        "score": 66, "setor": "Produção",
        "description": "Liderança operacional definida exclusivamente por tempo de "
                       "casa, sem avaliação de competência gerencial.",
        "rubric_reasoning": "Definir líderes é necessário; critério substituível "
                            "por avaliação multifatorial (competência + "
                            "experiência).",
    },
    {
        "dimensao": "Demandas Quantitativas",
        "score": 72, "setor": "Logística",
        "description": "Sistema de roteirização que aloca número fixo de paradas "
                       "por motorista independente de complexidade da rota.",
        "rubric_reasoning": "Roteirização é necessária; método substituível por "
                            "algoritmo que pondera complexidade e tempo real.",
    },
    {
        "dimensao": "Influência no Trabalho",
        "score": 68, "setor": "Administrativo",
        "description": "Processo decisório totalmente top-down sem etapa de "
                       "consulta aos afetados.",
        "rubric_reasoning": "Decidir é necessário; modelo substituível por "
                            "processo participativo com pontos de consulta.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 70, "setor": "TI",
        "description": "Atendimento de incidentes em sala única sem rodízio entre "
                       "membros da equipe.",
        "rubric_reasoning": "Atendimento de incidentes é necessário; modalidade "
                            "substituível por rodízio com pausas técnicas.",
    },
    {
        "dimensao": "Ritmo de Trabalho",
        "score": 71, "setor": "RH",
        "description": "Ciclo de recrutamento concentrado em três sprints "
                       "trimestrais com pico extremo.",
        "rubric_reasoning": "Recrutamento é necessário; cadência substituível por "
                            "fluxo contínuo distribuído.",
    },
    {
        "dimensao": "Justiça Organizacional",
        "score": 66, "setor": "Comercial",
        "description": "Distribuição de carteira de clientes feita uma vez por ano, "
                       "sem revisão durante o exercício.",
        "rubric_reasoning": "Carteira é necessária; modalidade substituível por "
                            "revisão semestral com critérios transparentes.",
    },
    {
        "dimensao": "Comunidade Social",
        "score": 67, "setor": "Marketing",
        "description": "Modelo de trabalho 100 por cento remoto sem encontros "
                       "presenciais ou rituais síncronos.",
        "rubric_reasoning": "Modelo remoto é necessidade legítima; substituível "
                            "por modelo híbrido com encontros estruturados.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 71, "setor": "Operações",
        "description": "Atendimento a reclamações em fila única sem mecanismo de "
                       "triagem prévia.",
        "rubric_reasoning": "Atendimento é necessário; fluxo substituível por "
                            "triagem que reduz exposição em massa.",
    },
    {
        "dimensao": "Significado do Trabalho",
        "score": 69, "setor": "Produção",
        "description": "Linha de montagem com tarefas atomizadas em ciclos de "
                       "menos de 30 segundos sem rotação.",
        "rubric_reasoning": "Linha de montagem é necessária; substituível por "
                            "células com rotação e ciclos mais longos.",
    },
    {
        "dimensao": "Conflitos de Papel",
        "score": 65, "setor": "Logística",
        "description": "Atribuição simultânea de função de motorista e operador "
                       "de empilhadeira sem regra de prioridade.",
        "rubric_reasoning": "Polivalência é função; regra de prioridade substitui "
                            "modelo atual que mistura funções.",
    },
    {
        "dimensao": "Clareza de Papel",
        "score": 64, "setor": "RH",
        "description": "Descrição de cargo redigida em texto livre sem "
                       "delimitação de entregáveis.",
        "rubric_reasoning": "Descrição é necessária; formato substituível por "
                            "modelo estruturado com responsabilidades claras.",
    },
    {
        "dimensao": "Suporte Social Colegas",
        "score": 68, "setor": "TI",
        "description": "Espaço físico em open office sem áreas para conversas "
                       "em pares ou pausas curtas.",
        "rubric_reasoning": "Espaço físico é necessário; layout substituível "
                            "por desenho com zonas funcionais distintas.",
    },
    {
        "dimensao": "Ritmo de Trabalho",
        "score": 70, "setor": "Comercial",
        "description": "Cobrança de meta semanal com publicação de ranking "
                       "público diário em painel.",
        "rubric_reasoning": "Acompanhar meta é necessário; publicação pública "
                            "substituível por feedback individual privado.",
    },
])

# --- Nível 3 — Controle Organizacional (20) ---
_add("3-Controle Organizacional", [
    {
        "dimensao": "Qualidade da Liderança",
        "score": 68, "setor": "RH",
        "description": "Pesquisa interna indica baixa percepção de qualidade "
                       "gerencial em vários níveis sem padrão claro.",
        "rubric_reasoning": "Risco difuso na cultura gerencial; intervenção "
                            "apropriada é capacitação de gestores e governança.",
    },
    {
        "dimensao": "Suporte Social Superiores",
        "score": 71, "setor": "Operações",
        "description": "Distância percebida entre liderança e equipe operacional "
                       "sem rituais de aproximação.",
        "rubric_reasoning": "Risco organizacional; ritmos e rotinas de gestão "
                            "redesenháveis com capacitação.",
    },
    {
        "dimensao": "Comunidade Social",
        "score": 67, "setor": "TI",
        "description": "Baixo entrosamento entre equipes do mesmo setor, "
                       "rituais de integração inexistentes.",
        "rubric_reasoning": "Risco organizacional; cultura de integração é "
                            "redesenhável.",
    },
    {
        "dimensao": "Reconhecimento",
        "score": 69, "setor": "Comercial",
        "description": "Percepção de reconhecimento baixa em todos os recortes "
                       "sem programa institucional formal.",
        "rubric_reasoning": "Risco organizacional; programa institucional de "
                            "reconhecimento é controle organizacional.",
    },
    {
        "dimensao": "Clareza de Papel",
        "score": 65, "setor": "Administrativo",
        "description": "Percepção generalizada de papéis pouco definidos sem "
                       "matriz de responsabilidades publicada.",
        "rubric_reasoning": "Risco organizacional; matriz RACI institucional "
                            "endereça a causa.",
    },
    {
        "dimensao": "Conflitos de Papel",
        "score": 66, "setor": "Marketing",
        "description": "Conflito entre áreas adjacentes sem fórum de "
                       "resolução institucional.",
        "rubric_reasoning": "Risco organizacional; fórum institucional é "
                            "controle apropriado.",
    },
    {
        "dimensao": "Justiça Organizacional",
        "score": 70, "setor": "Produção",
        "description": "Percepção difusa de injustiça em decisões de promoção "
                       "sem indicador específico claro.",
        "rubric_reasoning": "Risco organizacional sem fonte única; governança "
                            "de promoções endereça.",
    },
    {
        "dimensao": "Previsibilidade",
        "score": 68, "setor": "Logística",
        "description": "Falta de calendário público de mudanças com "
                       "comunicação ad hoc.",
        "rubric_reasoning": "Risco organizacional; instituir calendário e "
                            "comunicação é controle organizacional.",
    },
    {
        "dimensao": "Influência no Trabalho",
        "score": 67, "setor": "RH",
        "description": "Baixa percepção de influência sobre o próprio trabalho "
                       "sem ritmo claro de quando ocorrem decisões.",
        "rubric_reasoning": "Risco organizacional; rituais de participação "
                            "endereçam.",
    },
    {
        "dimensao": "Possibilidade de Desenvolvimento",
        "score": 66, "setor": "TI",
        "description": "Percepção de estagnação na carreira sem trilhas "
                       "estabelecidas formalmente.",
        "rubric_reasoning": "Risco organizacional; trilhas estabelecidas são "
                            "controle organizacional.",
    },
    {
        "dimensao": "Comunidade Social",
        "score": 64, "setor": "Comercial",
        "description": "Baixa integração entre filiais distintas sem rituais "
                       "compartilhados.",
        "rubric_reasoning": "Risco organizacional; rituais e canais comuns "
                            "endereçam.",
    },
    {
        "dimensao": "Sentido do Trabalho",
        "score": 65, "setor": "Operações",
        "description": "Conexão fraca entre as atividades operacionais e o "
                       "propósito da empresa sem comunicação interna que "
                       "amarre os dois.",
        "rubric_reasoning": "Risco organizacional; comunicação interna e "
                            "rituais reforçam significado.",
    },
    {
        "dimensao": "Confiança Horizontal",
        "score": 66, "setor": "Marketing",
        "description": "Indícios de desconfiança entre equipes sem "
                       "mecanismo de transparência mútua.",
        "rubric_reasoning": "Risco organizacional; transparência mútua e "
                            "fóruns interáreas endereçam.",
    },
    {
        "dimensao": "Confiança Vertical",
        "score": 67, "setor": "Administrativo",
        "description": "Indicadores de baixa confiança nas decisões da "
                       "diretoria sem mecanismo formal de prestação de contas.",
        "rubric_reasoning": "Risco organizacional; governança transparente "
                            "endereça.",
    },
    {
        "dimensao": "Suporte Social Colegas",
        "score": 65, "setor": "Logística",
        "description": "Baixo suporte social entre pares sem rituais "
                       "institucionalizados de troca.",
        "rubric_reasoning": "Risco organizacional; rituais institucionais "
                            "endereçam.",
    },
    {
        "dimensao": "Qualidade da Liderança",
        "score": 70, "setor": "Produção",
        "description": "Percepção de liderança operacional pouco preparada "
                       "para feedback sem programa de desenvolvimento de "
                       "liderança.",
        "rubric_reasoning": "Risco organizacional; programa de desenvolvimento "
                            "de liderança é controle organizacional.",
    },
    {
        "dimensao": "Demandas Cognitivas",
        "score": 68, "setor": "TI",
        "description": "Sobrecarga cognitiva difusa decorrente de excesso de "
                       "canais síncronos sem governança de comunicação.",
        "rubric_reasoning": "Risco organizacional; governança de canais "
                            "endereça.",
    },
    {
        "dimensao": "Sentido do Trabalho",
        "score": 64, "setor": "Comercial",
        "description": "Comunicação interna desconectada do propósito sem "
                       "narrativa institucional consistente.",
        "rubric_reasoning": "Risco organizacional; comunicação institucional "
                            "endereça.",
    },
    {
        "dimensao": "Influência no Trabalho",
        "score": 66, "setor": "Administrativo",
        "description": "Estrutura organizacional muito vertical sem fóruns de "
                       "consulta institucionalizados.",
        "rubric_reasoning": "Risco organizacional; instituir fóruns endereça.",
    },
    {
        "dimensao": "Reconhecimento",
        "score": 67, "setor": "Operações",
        "description": "Falta de feedback positivo regular sem cadência "
                       "institucional definida.",
        "rubric_reasoning": "Risco organizacional; cadência institucional "
                            "endereça.",
    },
])

# --- Nível 4 — Controle Individual (20) ---
_add("4-Controle Individual", [
    {
        "dimensao": "Demandas Emocionais",
        "score": 73, "setor": "RH",
        "description": "Atendimento de luto e situações de crise familiar inerente "
                       "ao papel; expostos psiquicamente em todos os atendimentos.",
        "rubric_reasoning": "Demanda inerente à atividade (impossível eliminar a "
                            "exposição a sofrimento alheio); medida apropriada é "
                            "suporte psicológico individual e psicoeducação.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 75, "setor": "Operações",
        "description": "Atendimento a vítimas em pronto-socorro como atividade-fim "
                       "do setor; exposição direta a quadros graves.",
        "rubric_reasoning": "Atividade-fim inerente; medida apropriada é EAP, "
                            "supervisão psicológica e treinamento emocional.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 70, "setor": "Comercial",
        "description": "Negociação com clientes hostis em segmento de cobrança "
                       "como atividade-fim do setor.",
        "rubric_reasoning": "Demanda inerente à função; medida apropriada é "
                            "treinamento individual de manejo emocional.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 72, "setor": "Administrativo",
        "description": "Atendimento de demandas judiciais com prazos legais "
                       "rígidos e exposição a casos sensíveis como atividade-fim.",
        "rubric_reasoning": "Demanda inerente; medida apropriada é supervisão "
                            "individual e gerenciamento emocional.",
    },
    {
        "dimensao": "Demandas Cognitivas",
        "score": 71, "setor": "TI",
        "description": "Resolução de incidentes críticos em ambiente de "
                       "missão crítica como atividade-fim com plantão 24x7.",
        "rubric_reasoning": "Demanda cognitiva inerente; medida apropriada é "
                            "treinamento individual de regulação cognitiva.",
    },
    {
        "dimensao": "Exigências de Esconder",
        "score": 68, "setor": "Comercial",
        "description": "Atendimento presencial em ambiente onde o profissional "
                       "deve manter postura cordial mesmo sob hostilidade do "
                       "cliente, como atividade-fim.",
        "rubric_reasoning": "Trabalho emocional inerente; medida apropriada é "
                            "treinamento individual e suporte psicológico.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 74, "setor": "Operações",
        "description": "Trabalho com cuidados paliativos a familiares de "
                       "pacientes terminais como atividade-fim.",
        "rubric_reasoning": "Demanda inerente; medida apropriada é EAP e "
                            "supervisão psicológica.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 69, "setor": "RH",
        "description": "Profissional responsável por comunicar demissões em "
                       "massa por força de reestruturação inevitável.",
        "rubric_reasoning": "Tarefa inerente em momento específico; medida "
                            "apropriada é preparação individual e debriefing.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 71, "setor": "Administrativo",
        "description": "Trabalho em ouvidoria interna recebendo denúncias "
                       "graves como atividade-fim.",
        "rubric_reasoning": "Demanda inerente; medida apropriada é supervisão "
                            "individual e suporte psicológico.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 70, "setor": "Marketing",
        "description": "Gestão de crise de imagem com exposição midiática "
                       "constante como atividade-fim em momentos críticos.",
        "rubric_reasoning": "Exposição inerente em momentos específicos; medida "
                            "apropriada é treinamento de exposição midiática.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 73, "setor": "Comercial",
        "description": "Negociação de contratos de alto valor com pressão "
                       "psicológica intensa como atividade-fim do papel.",
        "rubric_reasoning": "Pressão inerente; medida apropriada é treinamento "
                            "de inteligência emocional individual.",
    },
    {
        "dimensao": "Demandas Cognitivas",
        "score": 69, "setor": "Operações",
        "description": "Controle de tráfego aéreo como atividade-fim com "
                       "exigência cognitiva máxima sustentada.",
        "rubric_reasoning": "Demanda cognitiva inerente; medida apropriada é "
                            "treinamento individual e suporte psicológico.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 72, "setor": "RH",
        "description": "Trabalho em centros de atendimento a vítimas de "
                       "violência doméstica como atividade-fim.",
        "rubric_reasoning": "Demanda inerente; medida apropriada é EAP e "
                            "supervisão psicológica regular.",
    },
    {
        "dimensao": "Exigências de Esconder",
        "score": 67, "setor": "Operações",
        "description": "Atendimento ao público em situação de catástrofe natural "
                       "com manutenção obrigatória de postura serena, "
                       "atividade-fim.",
        "rubric_reasoning": "Trabalho emocional inerente; medida apropriada é "
                            "treinamento individual e debriefing após eventos.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 70, "setor": "TI",
        "description": "Pesquisa de fraude com exposição a conteúdo de violência "
                       "explícita como parte essencial da atividade.",
        "rubric_reasoning": "Exposição inerente; medida apropriada é supervisão "
                            "psicológica e suporte individual contínuo.",
    },
    {
        "dimensao": "Demandas Cognitivas",
        "score": 68, "setor": "Administrativo",
        "description": "Análise de processos judiciais complexos com "
                       "responsabilização pessoal pela decisão como "
                       "atividade-fim.",
        "rubric_reasoning": "Responsabilização inerente; medida apropriada é "
                            "treinamento individual e suporte técnico.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 71, "setor": "Logística",
        "description": "Transporte de cargas em região com alta incidência de "
                       "assaltos como atividade-fim, exposição persistente.",
        "rubric_reasoning": "Exposição inerente ao trajeto; medida apropriada é "
                            "preparo individual e suporte psicológico.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 70, "setor": "RH",
        "description": "Mediação de conflitos interpessoais em CIPA como "
                       "atividade-fim do papel.",
        "rubric_reasoning": "Demanda inerente; medida apropriada é treinamento "
                            "individual em mediação.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 69, "setor": "Comercial",
        "description": "Venda B2B em segmento com clientes em situação financeira "
                       "frágil como atividade-fim.",
        "rubric_reasoning": "Exposição emocional inerente; medida apropriada é "
                            "treinamento individual em finanças e empatia.",
    },
    {
        "dimensao": "Demandas Emocionais",
        "score": 68, "setor": "Marketing",
        "description": "Atendimento a campanhas sensíveis (saúde mental, "
                       "luto) como atividade-fim do segmento.",
        "rubric_reasoning": "Exposição emocional inerente ao conteúdo; medida "
                            "apropriada é suporte psicológico individual.",
    },
])


def to_agent_payload(s: Scenario) -> dict:
    """Constrói o input que o agente receberá. NÃO inclui o rótulo."""
    return {
        "id": s.id,
        "input": {
            "empresa_nome": f"Empresa Sintética {s.id}",
            "empresa_setor": s.setor,
            "total_colaboradores": 200,
            "riscos_criticos": [
                {
                    "dimensao": s.dimensao,
                    "score": s.score,
                    # NÃO incluir expected_hierarchy_level — sem vazamento.
                },
            ],
            "riscos_intermediarios": [],
            "contexto_neutro": s.description,
        },
        "expected_hierarchy": s.expected_hierarchy,
        "rubric_reasoning": s.rubric_reasoning,
    }


CASES_FOR_AGENT = [to_agent_payload(s) for s in CENARIOS]


if __name__ == "__main__":
    from collections import Counter
    print(f"Total cenários: {len(CENARIOS)}")
    counter = Counter(s.expected_hierarchy for s in CENARIOS)
    for lev in HIERARCHY_LEVELS:
        print(f"  {lev:30s} {counter[lev]}")
    print()
    # Sanidade: nenhum input contém palavra-âncora delatora
    LEAK_TERMS = ["expected_hierarchy", "removível", "removivel", "substituível",
                  "substituivel", "controle organizacional", "controle individual",
                  "eliminação", "eliminacao", "substituição", "substituicao"]
    leaks = 0
    for c in CASES_FOR_AGENT:
        text = c["input"]["contexto_neutro"].lower()
        for term in LEAK_TERMS:
            if term in text:
                leaks += 1
                print(f"  LEAK [{c['id']}]: '{term}' em '{text[:60]}...'")
    print(f"Vazamentos detectados: {leaks}")
