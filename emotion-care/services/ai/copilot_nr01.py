"""
IA 3 — Copiloto NR-01
Assistente RAG de perguntas e respostas sobre NR-01, riscos psicossociais
e dados da própria empresa.
"""

import logging
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session, joinedload

from services.ai.llm_config import get_llm, get_embeddings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é o Copiloto NR-01 da plataforma Emotion Care. Sua função é responder perguntas sobre a NR-01, gestão de riscos psicossociais e sobre os dados da empresa do usuário.

Você recebe dois blocos de contexto:
- DADOS DA EMPRESA: scores, riscos, planos de ação e informações da empresa do usuário extraídos da plataforma.
- DOCUMENTOS DE REFERÊNCIA: trechos de normas e documentos oficiais indexados (chunks numerados [Documento 1], [Documento 2], etc.).

REGRA DE OURO (ANCORAGEM OBRIGATÓRIA):
RESPONDA APENAS COM BASE NOS TRECHOS RECUPERADOS E NOS DADOS DA EMPRESA FORNECIDOS. Se a informação necessária para responder não estiver nos trechos nem nos dados fornecidos, escreva LITERALMENTE: "Não encontro essa informação nos documentos disponíveis. Recomendo consultar o texto integral da norma ou um especialista." NÃO complete a resposta com conhecimento próprio. Cada afirmação substantiva deve poder ser rastreada a um trecho específico ou a um campo dos dados da empresa.

REGRAS DE CITAÇÃO OBRIGATÓRIA:
- Para CADA afirmação derivada dos DOCUMENTOS DE REFERÊNCIA, indique entre colchetes qual chunk foi usado, no formato [Documento N] junto à afirmação.
- Ao final da resposta, liste as fontes textuais em uma linha "Fontes:" com nome do documento e seção (ex.: "Fontes: NR-01 item 1.5.3.1.1; ISO 45003 seção 6.1.2").
- NUNCA cite um item de norma que não tenha aparecido nos trechos recuperados. Se o usuário pedir um item específico que não está nos trechos, diga que não há base.

REGRAS GERAIS:
1. Para perguntas sobre a empresa: use os DADOS DA EMPRESA. Cite números e dimensões exatamente como aparecem.
2. Para perguntas sobre normas: use exclusivamente os DOCUMENTOS DE REFERÊNCIA recuperados.
3. Se a pergunta mistura empresa e normas, combine os dois contextos com as citações correspondentes.
4. Respostas entre 100 e 300 palavras. Seja direto.
5. Nunca forneça aconselhamento jurídico. Recomende advogado trabalhista para litígios.
6. Nunca identifique colaboradores individualmente. Use referências coletivas (ex.: 'os colaboradores do setor X').
7. Tom: profissional, acolhedor, sem jargão excessivo.
8. Se não houver dados nem trechos suficientes, diga explicitamente."""

# Threshold reduzido enquanto o corpus contém apenas excertos representativos.
# Para corpus com documentos normativos completos, retornar a 0.75 (produção).
SIMILARITY_THRESHOLD = 0.40
MAX_CHUNKS = 5
# chunk_size reduzido de 1600 -> 700 para melhorar context relevancy: chunks
# menores capturam unidades semânticas mais focadas, reduzindo a diluição
# do match cosseno por contexto irrelevante (item 2 do checklist v2.1).
CHUNK_SIZE = 700
CHUNK_OVERLAP = 120


def chunk_document(text: str, source: str, section: str = "") -> list[dict]:
    """Divide um documento em chunks para indexação.

    Args:
        text: Conteúdo textual do documento.
        source: Nome/referência do documento de origem.
        section: Seção específica (opcional).

    Returns:
        Lista de dicts com content, source, section prontos para indexação.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " "],
    )
    chunks = splitter.split_text(text)
    return [
        {
            "content": chunk,
            "source": source,
            "section": section,
        }
        for chunk in chunks
    ]


async def index_document(db: Session, text: str, source: str, section: str = ""):
    """Indexa um documento na base de conhecimento do Copiloto.

    Divide o texto em chunks, gera embeddings e armazena no banco.
    """
    from models.models import CopilotKnowledge

    chunks = chunk_document(text, source, section)
    embeddings_model = get_embeddings()

    texts = [c["content"] for c in chunks]
    vectors = await embeddings_model.aembed_documents(texts)

    for chunk_data, vector in zip(chunks, vectors):
        record = CopilotKnowledge(
            content=chunk_data["content"],
            source=chunk_data["source"],
            section=chunk_data["section"],
            embedding=vector,
        )
        db.add(record)

    db.commit()
    return len(chunks)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Calcula similaridade de cosseno entre dois vetores."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def search_knowledge_base(db: Session, query_embedding: list[float], top_k: int = MAX_CHUNKS) -> list[dict]:
    """Busca os chunks mais relevantes usando similaridade de cosseno.

    Args:
        db: Sessão do banco.
        query_embedding: Vetor da pergunta do usuário.
        top_k: Número máximo de resultados.

    Returns:
        Lista de chunks com score de similaridade.
    """
    from models.models import CopilotKnowledge

    all_chunks = db.query(CopilotKnowledge).all()

    scored = []
    for record in all_chunks:
        similarity = _cosine_similarity(query_embedding, record.embedding)
        if similarity >= SIMILARITY_THRESHOLD:
            scored.append({
                "content": record.content,
                "source": record.source,
                "section": record.section,
                "similarity": round(similarity, 4),
            })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:top_k]


def build_company_context(db: Session, company_id: Optional[int]) -> str:
    """Constrói contexto textual com os dados da empresa para o Copiloto.

    Inclui: info da empresa, última campanha, scores por dimensão,
    riscos do PGR, planos de ação e análise por setor.
    """
    if not company_id:
        return ""

    from models.models import (
        Company, CampaignResult, DimensionResult, SectorDimensionResult,
        PGRRisk, ActionPlan, Department, Employee, Campaign,
    )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return ""

    parts = []

    # Info da empresa
    total_employees = db.query(Employee).filter(
        Employee.company_id == company_id, Employee.is_active == True
    ).count()
    total_departments = db.query(Department).filter(
        Department.company_id == company_id, Department.is_active == True
    ).count()
    parts.append(
        f"Empresa: {company.name}"
        + (f" ({company.trade_name})" if company.trade_name else "")
        + f"\nCNPJ: {company.cnpj}"
        + f"\nSetor: {company.trade_name or 'Não informado'}"
        + f"\nTotal de colaboradores ativos: {total_employees}"
        + f"\nTotal de setores: {total_departments}"
    )

    # Última campanha com resultados
    latest_result = db.query(CampaignResult).options(
        joinedload(CampaignResult.campaign),
        joinedload(CampaignResult.dimension_results).joinedload(DimensionResult.dimension),
        joinedload(CampaignResult.sector_dimension_results).joinedload(SectorDimensionResult.department),
        joinedload(CampaignResult.sector_dimension_results).joinedload(SectorDimensionResult.dimension),
    ).filter(
        CampaignResult.company_id == company_id,
    ).order_by(CampaignResult.computed_at.desc()).first()

    if not latest_result:
        parts.append("\nNenhuma campanha com resultados computados.")
        return "\n".join(parts)

    campaign = latest_result.campaign
    risk_map = {"healthy": "Verde (Favorável)", "intermediate": "Amarelo (Intermediário)", "risk": "Vermelho (Desfavorável)"}
    overall_risk = risk_map.get(latest_result.risk_level, latest_result.risk_level)

    parts.append(
        f"\n--- Última campanha: {campaign.name if campaign else 'N/A'} ---"
        + f"\nTotal de convidados: {latest_result.total_invited}"
        + f"\nTotal de respostas: {latest_result.total_responses}"
        + f"\nTaxa de resposta: {latest_result.response_rate}%"
        + f"\nScore geral de risco: {latest_result.overall_risk_score}/100"
        + f"\nClassificação geral: {overall_risk}"
    )

    # Scores por dimensão
    if latest_result.dimension_results:
        parts.append("\n--- Scores por dimensão COPSOQ II-Br ---")
        sorted_dims = sorted(latest_result.dimension_results, key=lambda d: d.average_score, reverse=True)
        for dr in sorted_dims:
            dim_name = dr.dimension.name if dr.dimension else "Dimensão"
            classificacao = risk_map.get(dr.risk_level, dr.risk_level)
            parts.append(f"  {dim_name}: score {dr.average_score}/100, {classificacao} ({dr.response_count} respostas)")

    # Análise por setor
    if latest_result.sector_dimension_results:
        sector_data = {}
        for sdr in latest_result.sector_dimension_results:
            # Dados por setor são coletivos — incluir mesmo anonimizados
            # (a anonimização protege identidade individual, não scores coletivos)
            dept_name = sdr.department.name if sdr.department else "Setor"
            if dept_name not in sector_data:
                sector_data[dept_name] = []
            dim_name = sdr.dimension.name if sdr.dimension else "Dimensão"
            sector_data[dept_name].append({
                "dimensao": dim_name,
                "score": sdr.average_score,
                "nivel": risk_map.get(sdr.risk_level, sdr.risk_level),
            })

        if sector_data:
            parts.append("\n--- Análise por setor ---")
            for setor, dims in sector_data.items():
                risk_dims = [d for d in dims if "Vermelho" in d["nivel"] or "Amarelo" in d["nivel"]]
                if risk_dims:
                    risk_strs = [f"{d['dimensao']} ({d['score']}, {d['nivel']})" for d in risk_dims]
                    parts.append(f"  {setor}: {', '.join(risk_strs)}")
                else:
                    avg = round(sum(d["score"] for d in dims) / len(dims)) if dims else 0
                    parts.append(f"  {setor}: todas dimensões favoráveis (média {avg})")

    # Riscos do PGR
    risks = db.query(PGRRisk).filter(
        PGRRisk.company_id == company_id,
        PGRRisk.campaign_id == latest_result.campaign_id,
    ).order_by(PGRRisk.average_score.desc()).all()

    if risks:
        risk_level_map = {"low": "Baixo", "medium": "Médio", "high": "Alto", "critical": "Crítico"}
        parts.append(f"\n--- Inventário de riscos PGR ({len(risks)} riscos) ---")
        for r in risks:
            nivel = risk_level_map.get(r.risk_level, r.risk_level)
            parts.append(
                f"  {r.risk_axis}: nível {nivel} (score {r.average_score}, severidade {r.severity}/5, probabilidade {r.probability}/5)"
                + f"\n    Fonte: {r.source}"
                + f"\n    Danos possíveis: {r.possible_damages}"
                + f"\n    Medidas de controle: {r.control_measures}"
            )

    # Planos de ação
    if risks:
        risk_ids = [r.id for r in risks]
        plans = db.query(ActionPlan).filter(ActionPlan.pgr_risk_id.in_(risk_ids)).all()
        if plans:
            status_map = {"pending": "Pendente", "in_progress": "Em andamento", "completed": "Concluída"}
            completed = sum(1 for p in plans if p.status == "completed")
            in_progress = sum(1 for p in plans if p.status == "in_progress")
            pending = sum(1 for p in plans if p.status == "pending")
            parts.append(
                f"\n--- Planos de ação ({len(plans)} total) ---"
                + f"\nConcluídas: {completed}, Em andamento: {in_progress}, Pendentes: {pending}"
            )
            for p in plans:
                risk = next((r for r in risks if r.id == p.pgr_risk_id), None)
                risk_name = risk.risk_axis if risk else "Risco"
                status = status_map.get(p.status, p.status)
                deadline_str = p.deadline.strftime("%d/%m/%Y") if p.deadline else "Sem prazo"
                parts.append(
                    f"  [{status}] {risk_name}: {p.measure}"
                    + (f" (responsável: {p.responsible_person})" if p.responsible_person else "")
                    + f" — prazo: {deadline_str}"
                )

    return "\n".join(parts)


async def _generate_suggestions(llm, question: str, answer: str) -> list[str]:
    """Gera 3 sugestões de perguntas de follow-up baseadas na conversa."""
    try:
        prompt = f"""Com base nesta conversa, sugira exatamente 3 perguntas curtas (máximo 10 palavras cada) que o usuário poderia fazer em seguida. As perguntas devem ser relevantes e aprofundar o tema.

Pergunta do usuário: {question}
Resposta dada: {answer[:500]}

Retorne APENAS as 3 perguntas, uma por linha, sem numeração, sem aspas, sem explicação."""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        lines = [l.strip() for l in response.content.strip().split("\n") if l.strip()]
        return lines[:3]
    except Exception as e:
        logger.warning("Erro ao gerar sugestões: %s", e)
        return []


async def answer_question(
    db: Session,
    question: str,
    company_id: Optional[int] = None,
    chat_history: Optional[list[dict]] = None,
) -> dict:
    """Responde uma pergunta usando RAG + dados da empresa.

    Args:
        db: Sessão do banco.
        question: Pergunta em linguagem natural.
        company_id: ID da empresa do usuário (para contexto de dados).
        chat_history: Últimas 5 trocas para contexto conversacional.

    Returns:
        Dict com resposta, fontes citadas e flag de fallback.
    """
    # Construir contexto da empresa
    company_context = build_company_context(db, company_id)

    # Buscar chunks de documentos normativos (RAG)
    rag_context = ""
    sources = []
    try:
        embeddings_model = get_embeddings()
        query_vector = await embeddings_model.aembed_query(question)
        chunks = search_knowledge_base(db, query_vector)
        if chunks:
            context_parts = []
            for i, chunk in enumerate(chunks, 1):
                context_parts.append(
                    f"[Documento {i}: {chunk['source']}"
                    + (f", {chunk['section']}" if chunk['section'] else "")
                    + f"]\n{chunk['content']}"
                )
            rag_context = "\n\n".join(context_parts)
            sources = list({chunk["source"] for chunk in chunks})
    except Exception as e:
        logger.warning("Erro ao buscar RAG (continuando apenas com dados da empresa): %s", e)

    # Se não tem nenhum contexto (nem empresa, nem RAG), fallback
    if not company_context and not rag_context:
        return {
            "answer": (
                "Não encontrei informação suficiente nas fontes disponíveis para responder "
                "a essa pergunta com segurança. Recomendo entrar em contato com o suporte "
                "Emotion Care ou consultar diretamente a norma NR-01 no site do Ministério "
                "do Trabalho e Emprego."
            ),
            "sources": [],
            "is_fallback": True,
            "suggestions": [],
        }

    # Montar histórico de conversa
    history_text = ""
    if chat_history:
        history_lines = []
        for msg in chat_history[-5:]:
            role = "Usuário" if msg.get("role") == "user" else "Copiloto"
            history_lines.append(f"{role}: {msg.get('content', '')}")
        history_text = "\n\nHistórico recente da conversa:\n" + "\n".join(history_lines)

    # Construir contexto qualitativo (percepções abertas — NC_OPEN_VIEW)
    qualitative_context = ""
    try:
        from services.ai.qualitative_analyzer import build_qualitative_context
        qualitative_context = build_qualitative_context(db, company_id)
    except Exception as e:
        logger.warning("Erro ao construir contexto qualitativo: %s", e)

    # Montar prompt
    prompt_parts = []
    if company_context:
        prompt_parts.append(f"DADOS DA EMPRESA:\n{company_context}")
        if "Dados da empresa" not in sources:
            sources.insert(0, "Dados da empresa")
    if qualitative_context:
        prompt_parts.append(f"\n{qualitative_context}")
        if "Percepções qualitativas" not in sources:
            sources.append("Percepções qualitativas")
    if rag_context:
        prompt_parts.append(f"DOCUMENTOS DE REFERÊNCIA:\n{rag_context}")

    user_prompt = "\n\n".join(prompt_parts) + f"{history_text}\n\nPergunta do usuário: {question}"

    # temperatura quase 0 para reduzir alucinação e improvisação além dos
    # chunks recuperados (item 1 do checklist v2.1).
    llm = get_llm(temperature=0.0, max_tokens=600, use_case="copilot")

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt),
    ]

    response = await llm.ainvoke(messages)
    answer_text = response.content.strip()

    # Gerar sugestões de follow-up (em paralelo com modelo leve)
    suggestions_llm = get_llm(temperature=0.5, max_tokens=150, use_case="suggestions")
    suggestions = await _generate_suggestions(suggestions_llm, question, answer_text)

    return {
        "answer": answer_text,
        "sources": sources,
        "is_fallback": False,
        "suggestions": suggestions,
    }
