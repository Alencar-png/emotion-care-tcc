"""
Base de Conhecimento: Andragogia e Análise Transacional
Conteúdo pré-construído para indexação via RAG no CopilotKnowledge.
Utilizado pelo Copiloto NR-01 e pelo gerador de planos de ação 5W2H.
"""

import logging

logger = logging.getLogger(__name__)

ANDRAGOGY_KNOWLEDGE = [
    # =============================================
    # Princípios da Andragogia (Malcolm Knowles)
    # =============================================
    {
        "content": (
            "PRINCIPIOS DA ANDRAGOGIA DE MALCOLM KNOWLES\n\n"
            "Malcolm Knowles (1913-1997) foi o principal teórico da Andragogia, "
            "a ciência da aprendizagem de adultos. Ele identificou 5 pressupostos "
            "fundamentais que diferenciam a aprendizagem adulta da pedagogia infantil:\n\n"
            "1. AUTOCONCEITO (Autonomia): O adulto evolui de uma personalidade dependente "
            "para autodirigida. Ele precisa sentir que tem controle sobre seu processo de "
            "aprendizagem. Intervenções que tiram a autonomia do trabalhador geram resistência.\n\n"
            "2. EXPERIENCIA: O adulto acumula um reservatório crescente de experiências que se "
            "torna recurso rico para a aprendizagem. Programas que ignoram a experiência prévia "
            "dos colaboradores são percebidos como desrespeitosos e ineficazes.\n\n"
            "3. PRONTIDAO PARA APRENDER: O adulto desenvolve prontidão para aprender quando "
            "percebe que o conhecimento é necessário para lidar com situações reais da vida. "
            "Treinamentos desconectados da prática são rejeitados.\n\n"
            "4. ORIENTACAO PARA A APRENDIZAGEM: A perspectiva temporal do adulto muda de "
            "aplicação adiada para aplicação imediata. O adulto aprende melhor quando o conteúdo "
            "é organizado em torno de problemas, não de disciplinas.\n\n"
            "5. MOTIVACAO: Os motivadores mais potentes para adultos são internos: autoestima, "
            "qualidade de vida, reconhecimento, satisfação profissional. Pressões externas "
            "(obrigatoriedade, punições) têm efeito limitado e podem gerar resistência."
        ),
        "source": "andragogia_knowles",
        "section": "principios_fundamentais",
    },
    {
        "content": (
            "APLICACAO DA ANDRAGOGIA NO AMBIENTE CORPORATIVO\n\n"
            "No contexto de saúde ocupacional e gestão de riscos psicossociais, os princípios "
            "andragógicos se traduzem em práticas específicas:\n\n"
            "AUTONOMIA NO TRABALHO: Envolver os colaboradores na definição das soluções, "
            "não apenas comunicar decisões prontas. Criar comitês participativos, rodas de "
            "conversa e grupos de trabalho onde os próprios trabalhadores proponham melhorias.\n\n"
            "VALORIZACAO DA EXPERIENCIA: Utilizar o conhecimento tácito dos trabalhadores "
            "como ponto de partida. Implementar programas de mentoria entre pares, onde "
            "colaboradores mais experientes compartilham estratégias de enfrentamento.\n\n"
            "PRONTIDAO E RELEVANCIA: Conectar cada ação do plano a problemas concretos "
            "vivenciados pela equipe. Usar dados da pesquisa de riscos psicossociais para "
            "demonstrar a relevância das intervenções.\n\n"
            "APLICACAO IMEDIATA: Garantir que cada aprendizado possa ser aplicado no mesmo "
            "dia ou semana. Evitar treinamentos teóricos longos sem componente prático.\n\n"
            "MOTIVACAO INTRINSECA: Reconhecer publicamente contribuições, celebrar pequenas "
            "conquistas, mostrar o impacto das ações na qualidade de vida da equipe."
        ),
        "source": "andragogia_knowles",
        "section": "aplicacao_corporativa",
    },
    {
        "content": (
            "ESTRATEGIAS ANDRAGOGICAS PARA PLANOS DE ACAO EM SAUDE OCUPACIONAL\n\n"
            "Ao implementar planos de ação 5W2H para mitigar riscos psicossociais, "
            "as seguintes estratégias andragógicas aumentam significativamente a adesão:\n\n"
            "1. DIAGNOSTICO PARTICIPATIVO: Antes de implementar qualquer ação, envolver "
            "os colaboradores na análise dos dados da pesquisa. Quando as pessoas participam "
            "do diagnóstico, sentem-se coautoras da solução (Princípio da Autonomia).\n\n"
            "2. CONSTRUCAO COLETIVA DE SOLUCOES: Em vez de impor ações, facilitar workshops "
            "onde as equipes constroem suas próprias soluções a partir dos dados. O facilitador "
            "guia, não instrui (Princípio da Experiência Prévia).\n\n"
            "3. PILOTOS E EXPERIMENTACAO: Implementar ações em formato piloto, permitindo "
            "ajustes com base no feedback dos participantes. Isso respeita a necessidade "
            "de aplicação imediata e controle do adulto (Princípio da Orientação para Aplicação).\n\n"
            "4. HISTORIAS E CASOS REAIS: Usar relatos de sucesso de outros setores ou empresas "
            "como inspiração, não como modelo a ser copiado. O adulto se inspira em pares, "
            "não em autoridades (Princípio da Motivação Interna).\n\n"
            "5. FEEDBACK CONTINUO: Criar mecanismos de feedback bidirecional sobre as ações "
            "implementadas. O adulto precisa ver o impacto de suas ações para manter o engajamento."
        ),
        "source": "andragogia_knowles",
        "section": "estrategias_plano_acao",
    },
    # =============================================
    # Análise Transacional
    # =============================================
    {
        "content": (
            "ANALISE TRANSACIONAL NO AMBIENTE DE TRABALHO\n\n"
            "A Análise Transacional (AT), desenvolvida por Eric Berne, é uma teoria da "
            "personalidade e das relações humanas que identifica três Estados do Ego:\n\n"
            "PAI (P): Comportamentos, pensamentos e sentimentos copiados de figuras parentais. "
            "Subdivide-se em:\n"
            "- Pai Crítico: julga, critica, impõe regras. No trabalho: gestores que usam tom "
            "autoritário, políticas punitivas, comunicação top-down.\n"
            "- Pai Protetor: cuida, protege, orienta. No trabalho: líderes que apoiam, "
            "criam ambiente seguro, oferecem suporte genuíno.\n\n"
            "ADULTO (A): Estado racional, analítico, baseado em dados e fatos. No trabalho: "
            "tomada de decisão baseada em evidências, comunicação clara e objetiva, "
            "negociação de conflitos com foco em soluções.\n\n"
            "CRIANCA (C): Comportamentos, pensamentos e sentimentos da infância. Subdivide-se em:\n"
            "- Criança Livre: criatividade, espontaneidade, inovação. No trabalho: brainstorming, "
            "propostas criativas, engajamento genuíno.\n"
            "- Criança Adaptada: submissão, medo, conformismo. No trabalho: colaboradores "
            "que apenas obedecem sem questionar, medo de errar, falta de iniciativa."
        ),
        "source": "analise_transacional",
        "section": "estados_do_ego",
    },
    {
        "content": (
            "TRANSACOES NO AMBIENTE CORPORATIVO\n\n"
            "Uma transação é uma unidade de comunicação social. Na gestão de riscos "
            "psicossociais, o tipo de transação determina a qualidade da intervenção:\n\n"
            "TRANSACAO COMPLEMENTAR (eficaz):\n"
            "- Adulto-Adulto: 'Os dados mostram que nosso setor tem alto índice de "
            "sobrecarga. Vamos analisar juntos as causas e construir soluções.'\n"
            "- Resultado: colaboração, engajamento, soluções sustentáveis.\n\n"
            "TRANSACAO CRUZADA (gera resistência):\n"
            "- Pai Crítico-Criança: 'Vocês precisam participar do programa de bem-estar "
            "porque os números estão ruins e a empresa exige.'\n"
            "- Resultado: resistência passiva, baixa adesão, sensação de infantilização.\n\n"
            "APLICACAO NOS PLANOS DE ACAO:\n"
            "- Toda comunicação sobre as ações do plano deve ser feita no estado Adulto-Adulto.\n"
            "- Apresentar dados objetivos (resultados da pesquisa) em vez de julgamentos.\n"
            "- Convidar para construção conjunta em vez de impor soluções.\n"
            "- Evitar linguagem que coloque o gestor como Pai e o colaborador como Criança.\n"
            "- Reconhecer conquistas (strokes positivos) para reforçar comportamentos desejados."
        ),
        "source": "analise_transacional",
        "section": "transacoes_corporativas",
    },
    {
        "content": (
            "STROKES E RECONHECIMENTO NA ANALISE TRANSACIONAL\n\n"
            "Na Análise Transacional, 'stroke' é qualquer forma de reconhecimento. "
            "A necessidade de reconhecimento é uma das motivações humanas mais fundamentais.\n\n"
            "TIPOS DE STROKES:\n"
            "- Positivo incondicional: 'Sua presença na equipe faz diferença.'\n"
            "- Positivo condicional: 'Seu relatório sobre o processo ficou excelente.'\n"
            "- Negativo condicional: 'Este relatório precisa de ajustes na análise.' "
            "(feedback construtivo, necessário)\n"
            "- Negativo incondicional: 'Você nunca faz nada direito.' (destrutivo, evitar)\n\n"
            "APLICACAO NOS PLANOS DE ACAO:\n"
            "- Incluir mecanismos de reconhecimento positivo em cada ação implementada.\n"
            "- Celebrar marcos e progressos do plano de ação com a equipe.\n"
            "- Usar feedback condicional positivo para reforçar comportamentos de segurança.\n"
            "- Criar 'economia de strokes' onde o reconhecimento é abundante e genuíno.\n"
            "- Evitar strokes negativos incondicionais que geram desmotivação e resistência.\n"
            "- Líderes devem ser treinados para oferecer reconhecimento frequente e específico."
        ),
        "source": "analise_transacional",
        "section": "strokes_reconhecimento",
    },
    # =============================================
    # Ciclo de Aprendizagem Experiencial (Kolb)
    # =============================================
    {
        "content": (
            "CICLO DE APRENDIZAGEM EXPERIENCIAL DE DAVID KOLB\n\n"
            "David Kolb propôs que a aprendizagem eficaz ocorre em um ciclo de 4 fases. "
            "Aplicado a planos de ação em saúde ocupacional:\n\n"
            "1. EXPERIENCIA CONCRETA (Sentir):\n"
            "O colaborador vivencia a situação real. Ex: participar de uma roda de conversa "
            "sobre os desafios de sobrecarga no setor, compartilhar situações vividas.\n\n"
            "2. OBSERVACAO REFLEXIVA (Observar):\n"
            "O grupo reflete sobre a experiência. Ex: analisar coletivamente os dados "
            "da pesquisa de riscos psicossociais, identificar padrões e causas.\n\n"
            "3. CONCEITUACAO ABSTRATA (Pensar):\n"
            "Conectar a experiência com conceitos e boas práticas. Ex: apresentar "
            "estratégias comprovadas de gestão de carga de trabalho, discutir aplicabilidade.\n\n"
            "4. EXPERIMENTACAO ATIVA (Fazer):\n"
            "Aplicar o aprendizado em novas situações. Ex: implementar a solução proposta "
            "em formato piloto, monitorar resultados, ajustar.\n\n"
            "INTEGRACAO COM ANDRAGOGIA:\n"
            "O ciclo de Kolb é naturalmente andragógico: parte da experiência (valoriza o saber "
            "do adulto), passa pela reflexão (respeita a autonomia), conecta com teoria "
            "(orientação para aplicação) e termina com prática (aplicabilidade imediata)."
        ),
        "source": "aprendizagem_experiencial_kolb",
        "section": "ciclo_completo",
    },
    # =============================================
    # Integração: Andragogia + AT + NR-01
    # =============================================
    {
        "content": (
            "INTEGRACAO: ANDRAGOGIA, ANALISE TRANSACIONAL E NR-01\n\n"
            "A NR-01 (Portaria MTE 1.419/2024) exige que as empresas identifiquem "
            "e mitiguem riscos psicossociais no ambiente de trabalho. A integração com "
            "Andragogia e Análise Transacional potencializa a eficácia das ações:\n\n"
            "HIERARQUIA DE CONTROLE + ANDRAGOGIA:\n"
            "- Nível 1 (Eliminação): Envolva os trabalhadores na identificação das causas "
            "raiz (Autonomia de Knowles). Eles conhecem melhor que ninguém o que eliminar.\n"
            "- Nível 2 (Substituição): Use a experiência prévia dos trabalhadores para "
            "identificar alternativas viáveis (Experiência de Knowles).\n"
            "- Nível 3 (Controle Organizacional): Construa coletivamente as novas práticas "
            "organizacionais (Orientação para Aplicação de Knowles).\n"
            "- Nível 4 (Controle Individual): Ofereça recursos de apoio como oportunidade "
            "de crescimento, não como remediação (Motivação Interna de Knowles).\n\n"
            "COMUNICACAO NR-01 + ANALISE TRANSACIONAL:\n"
            "- Apresente resultados da pesquisa em formato Adulto-Adulto: dados, fatos, análise.\n"
            "- Evite tom alarmista (Pai Crítico) ou paternalista (Pai Protetor excessivo).\n"
            "- Estimule a Criança Livre na busca por soluções criativas.\n"
            "- Use strokes positivos para reconhecer setores que melhoraram seus indicadores."
        ),
        "source": "integracao_andragogia_at_nr01",
        "section": "aplicacao_integrada",
    },
    {
        "content": (
            "ENGAJAMENTO DE TRABALHADORES EM PLANOS DE ACAO DE SAUDE OCUPACIONAL\n\n"
            "Evidências mostram que planos de ação impostos top-down têm taxa de adesão "
            "significativamente menor do que aqueles construídos participativamente.\n\n"
            "FATORES DE SUCESSO PARA ENGAJAMENTO:\n"
            "1. PARTICIPACAO DESDE O DIAGNOSTICO: Apresentar os resultados da pesquisa "
            "para as equipes e convidá-las a interpretar os dados junto com RH e liderança.\n\n"
            "2. COAUTORIA DAS SOLUCOES: Facilitar sessões onde os trabalhadores propõem "
            "e priorizam ações, usando técnicas como World Café, Design Thinking ou "
            "círculos de diálogo.\n\n"
            "3. LINGUAGEM RESPEITOSA: Toda comunicação deve reconhecer o trabalhador como "
            "adulto competente. Evitar termos como 'conscientizar', 'educar', 'orientar' "
            "(que colocam o outro em posição inferior). Preferir: 'construir juntos', "
            "'trocar experiências', 'co-criar soluções'.\n\n"
            "4. RECONHECIMENTO CONTINUO: Celebrar cada etapa concluída do plano de ação. "
            "Divulgar métricas de progresso. Agradecer publicamente contribuições.\n\n"
            "5. FEEDBACK BIDIRECIONAL: Criar canais onde os colaboradores possam avaliar "
            "as próprias ações do plano e sugerir ajustes. Isso reforça a autonomia "
            "e demonstra que a opinião de cada pessoa importa."
        ),
        "source": "engajamento_trabalhadores",
        "section": "fatores_sucesso",
    },
    {
        "content": (
            "ERROS COMUNS NA IMPLEMENTACAO DE PLANOS DE ACAO E COMO EVITA-LOS\n\n"
            "A luz da Andragogia e da Análise Transacional, estes são os erros mais "
            "frequentes e suas correções:\n\n"
            "ERRO 1: Treinamentos obrigatórios sem contexto.\n"
            "Correção: Apresentar o 'porquê' baseado em dados reais (Prontidão de Knowles). "
            "Comunicar no estado Adulto-Adulto.\n\n"
            "ERRO 2: Palestras expositivas longas como principal intervenção.\n"
            "Correção: Substituir por formatos participativos: oficinas práticas, rodas de "
            "conversa, estudos de caso construídos pelos próprios participantes.\n\n"
            "ERRO 3: Ignorar o saber dos trabalhadores.\n"
            "Correção: Iniciar cada ação valorizando a experiência do grupo (Experiência "
            "de Knowles). Perguntar antes de ensinar.\n\n"
            "ERRO 4: Comunicação paternalista ('Vamos cuidar de vocês').\n"
            "Correção: Comunicação Adulto-Adulto ('Identificamos estes dados. Vamos "
            "construir soluções juntos.').\n\n"
            "ERRO 5: Foco exclusivo em controle individual (programas de mindfulness, "
            "terapia) sem abordar causas organizacionais.\n"
            "Correção: Seguir a hierarquia de controle da NR-01. Atuar primeiro nas "
            "causas organizacionais, depois oferecer apoio individual como complemento."
        ),
        "source": "engajamento_trabalhadores",
        "section": "erros_comuns",
    },
]


async def seed_andragogy_knowledge(db) -> dict:
    """Indexa a base de conhecimento de Andragogia e Análise Transacional no RAG.

    Remove entradas anteriores das mesmas fontes antes de reindexar,
    garantindo idempotência.

    Args:
        db: Sessão do banco SQLAlchemy.

    Returns:
        Dict com total de entradas processadas e chunks criados.
    """
    from models.models import CopilotKnowledge
    from services.ai.copilot_nr01 import index_document

    # Fontes que serão reindexadas
    sources = list({entry["source"] for entry in ANDRAGOGY_KNOWLEDGE})

    # Remover entradas antigas dessas fontes (idempotência)
    deleted = db.query(CopilotKnowledge).filter(
        CopilotKnowledge.source.in_(sources)
    ).delete(synchronize_session="fetch")
    if deleted:
        db.commit()
        logger.info("Removidas %d entradas antigas de andragogia/AT.", deleted)

    total_chunks = 0
    for entry in ANDRAGOGY_KNOWLEDGE:
        chunks = await index_document(
            db=db,
            text=entry["content"],
            source=entry["source"],
            section=entry["section"],
        )
        total_chunks += chunks

    logger.info(
        "Indexados %d documentos de andragogia/AT, total de %d chunks.",
        len(ANDRAGOGY_KNOWLEDGE),
        total_chunks,
    )

    return {
        "documents_processed": len(ANDRAGOGY_KNOWLEDGE),
        "chunks_created": total_chunks,
        "sources": sources,
        "deleted_previous": deleted,
    }
