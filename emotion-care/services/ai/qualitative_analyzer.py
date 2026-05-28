"""
Analisador Qualitativo — NC_OPEN_VIEW
Agrupa respostas abertas por similaridade semântica usando LLM,
gerando clusters temáticos com contagens.

RESTRIÇÃO CRÍTICA (Seção 2.1 do plano v2.0): dados de perguntas abertas
NUNCA alimentam PGR ou inventário de riscos. Servem apenas para a área
"Percepções Qualitativas" e como contexto adicional do Copiloto IA com
marcação explícita "dado qualitativo não validado metodologicamente".

Thresholds: importados de `services.anonymity_policy` — nunca hardcode aqui.
PII: validação pós-LLM via `services.ai.pii_validator.redact`.
"""

import json
import logging
from typing import Optional

from langchain_core.messages import SystemMessage, HumanMessage

from services.ai.llm_config import get_llm
from services.ai.pii_validator import redact
from services.anonymity_policy import (
    MIN_RESPONSES_FOR_SCORE,
    open_responses_cluster_visibility,
)

logger = logging.getLogger(__name__)

CLUSTER_SYSTEM_PROMPT = """Você é um analista de pesquisas organizacionais. Sua tarefa é analisar respostas anônimas de uma pesquisa sobre ambiente de trabalho e agrupá-las por similaridade temática.

REGRAS:
1. Agrupe as respostas em 3 a 7 clusters temáticos.
2. Cada cluster deve ter um nome curto e descritivo em português (ex: "Sobrecarga de trabalho", "Falta de reconhecimento").
3. Conte quantas respostas se encaixam em cada cluster. Uma resposta pode contar em mais de um cluster se abordar múltiplos temas.
4. Para cada cluster, forneça um breve resumo (1-2 frases) que sintetize o sentimento geral, sem citar respondentes individualmente.
5. NUNCA identifique, referencie ou cite respostas individuais literalmente.
6. NUNCA invente respostas ou números. Use apenas o que foi fornecido.
7. Se houver respostas fora do tema ou sem conteúdo relevante, agrupe-as em "Outros".

REGRAS ANTI-COLAPSO (OBRIGATÓRIAS):
a) Se DUAS OU MAIS respostas mencionarem "promoção", "crescer", "carreira", "futuro" ou "desenvolvimento profissional", você DEVE criar um cluster próprio chamado "Carreira" e NÃO fundi-lo com "Reconhecimento" ou "Liderança". Carreira é sobre FUTURO PROFISSIONAL E POSSIBILIDADES; Reconhecimento é sobre PASSADO/PRESENTE (esforço atual); Liderança é sobre COMPORTAMENTO do superior.
b) "Outros" é um cluster legítimo e esperado. Crie-o sempre que tiver respostas que não cabem nos temas listados (instalações afastadas dos itens listados, salário, benefícios não-monetários específicos, comentários soltos sobre clima). NÃO force essas respostas em outros temas.
c) Você DEVE produzir entre 5 e 7 clusters em datasets com mais de 100 respostas. Menos do que 5 clusters em datasets grandes é sinal de colapso e deve ser evitado.

FRONTEIRAS SEMÂNTICAS (CRÍTICO PARA EVITAR COLAPSO DE TEMAS):

Os seguintes temas devem ser distinguidos com critérios PRÓPRIOS, sem fundir entre si:

- "Sobrecarga de trabalho": respostas sobre volume, ritmo, horas extras, multitarefa, pressão de tempo, fadiga física e mental decorrentes da QUANTIDADE de trabalho.
  Sinais lexicais: "muito trabalho", "horas extras", "prazos apertados", "sem tempo", "exausto", "demanda enorme".

- "Reconhecimento": respostas sobre falta de valorização, ausência de feedback positivo, sentir-se invisível ou não recompensado. Sobre o JULGAMENTO percebido do esforço.
  Sinais lexicais: "não sou reconhecido", "ninguém valoriza", "sem feedback", "esforço não é visto", "elogio nunca".

- "Liderança": respostas sobre comportamento, comunicação e gestão dos superiores hierárquicos. Sobre o ESTILO de quem manda.
  Sinais lexicais: "chefe", "gestor", "liderança", "supervisor", "gerente", "comunicação do líder", "decisão sem consulta".

- "Carreira": respostas sobre crescimento profissional, oportunidades de promoção, trilhas de desenvolvimento, plano de carreira. Sobre o FUTURO profissional.
  Sinais lexicais: "promoção", "crescer", "carreira", "futuro na empresa", "oportunidade", "plano de carreira", "desenvolvimento", "estagnação".

- "Ambiente físico": respostas sobre instalações, equipamentos, temperatura, ruído, ergonomia física do espaço de trabalho.
  Sinais lexicais: "cadeira", "iluminação", "temperatura", "espaço", "ergonomia", "barulho", "equipamento".

- "Comunicação": respostas sobre clareza de informações, fluxo entre áreas, transparência institucional, ruído organizacional. Distinta de "Liderança" (foco no superior) e de "Reconhecimento" (foco no julgamento).
  Sinais lexicais: "informação não chega", "ninguém comunica", "alinhamento entre áreas", "transparência", "ruído".

- "Outros": APENAS para respostas que NÃO se encaixam claramente em nenhum dos temas acima. Use com parcimônia. Se a resposta menciona algum dos temas, classifique-a no tema correspondente mesmo que parcialmente, em vez de "Outros".

Quando uma resposta menciona mais de um tema, escolha o tema PRINCIPAL (o mais explorado pelo respondente), não os secundários.

Retorne APENAS um JSON válido no seguinte formato, sem markdown ou explicação adicional:
{
  "clusters": [
    {
      "theme": "Nome do tema",
      "count": 5,
      "summary": "Resumo breve do sentimento deste grupo."
    }
  ]
}"""


async def cluster_responses(
    question_text: str,
    responses: list[str],
    max_clusters: int = 7,
) -> dict:
    """Agrupa respostas abertas por similaridade semântica usando LLM.

    Thresholds e mensagens vêm do módulo central `services.anonymity_policy`.
    Output do LLM é redactado via PII validator antes de retornar.
    """
    decision = open_responses_cluster_visibility(len(responses))
    if not decision.allowed:
        return {
            "status": "blocked",
            "response_count": decision.current,
            "message": decision.message,
        }

    # Monta prompt com respostas já higienizadas (sem PII direto no input)
    numbered_responses = "\n".join(
        f"- {redact(r.strip())}" for r in responses if r.strip()
    )

    user_prompt = (
        f"Pergunta da pesquisa: \"{question_text}\"\n\n"
        f"Total de respostas: {len(responses)}\n\n"
        f"Respostas anônimas:\n{numbered_responses}\n\n"
        f"Agrupe estas respostas em no máximo {max_clusters} clusters temáticos."
    )

    # temperatura 0 para maximizar reprodutibilidade entre seeds
    # (item 14 do checklist v2.1)
    llm = get_llm(temperature=0.0, max_tokens=1000, use_case="qualitative")

    try:
        messages = [
            SystemMessage(content=CLUSTER_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]
        response = await llm.ainvoke(messages)
        content = response.content.strip()

        # Tentar extrair JSON mesmo se vier com markdown code blocks
        if content.startswith("```"):
            lines = content.split("\n")
            json_lines = []
            in_block = False
            for line in lines:
                if line.strip().startswith("```"):
                    in_block = not in_block
                    continue
                if in_block or not line.strip().startswith("```"):
                    json_lines.append(line)
            content = "\n".join(json_lines)

        parsed = json.loads(content)
        clusters = parsed.get("clusters", [])

        # Redact final nas strings de cada cluster (defense in depth)
        safe_clusters = []
        for c in clusters:
            safe_clusters.append({
                "theme": redact(str(c.get("theme", ""))),
                "count": int(c.get("count", 0)),
                "summary": redact(str(c.get("summary", ""))),
            })

        return {
            "status": "ok",
            "response_count": len(responses),
            "clusters": safe_clusters,
        }

    except json.JSONDecodeError as e:
        logger.error("Erro ao parsear JSON do LLM para clustering: %s", e)
        return {
            "status": "error",
            "response_count": len(responses),
            "message": "Erro ao processar agrupamento temático. Tente novamente.",
        }
    except Exception as e:
        logger.error("Erro no clustering de respostas: %s", e)
        return {
            "status": "error",
            "response_count": len(responses),
            "message": "Erro ao processar agrupamento temático.",
        }


def build_qualitative_context(
    db,
    company_id: int,
    campaign_id: Optional[int] = None,
) -> str:
    """Constrói contexto qualitativo para o Copiloto IA.

    Retorna texto formatado com resumo das percepções qualitativas
    (respostas abertas agrupadas), marcado claramente como dados
    qualitativos não validados.

    Threshold: `MIN_RESPONSES_FOR_SCORE` do módulo central.
    """
    from models.models import (
        CustomQuestion, ResponseAnswer, Response, Campaign,
        QuestionnaireConfig, CustomQuestionType,
    )

    campaign_query = db.query(Campaign).filter(
        Campaign.company_id == company_id,
        Campaign.status.in_(["completed", "in_progress"]),
    )
    if campaign_id:
        campaign_query = campaign_query.filter(Campaign.id == campaign_id)

    campaigns = campaign_query.order_by(Campaign.created_at.desc()).limit(3).all()
    if not campaigns:
        return ""

    campaign_ids = [c.id for c in campaigns]
    config_ids = list({c.config_id for c in campaigns})

    open_questions = db.query(CustomQuestion).filter(
        CustomQuestion.config_id.in_(config_ids),
        CustomQuestion.question_type == CustomQuestionType.OPEN_TEXT.value,
    ).all()

    if not open_questions:
        return ""

    parts = []
    parts.append("DADOS QUALITATIVOS (não validados metodologicamente)")
    parts.append("=" * 50)
    parts.append(
        "AVISO: As percepções abaixo são respostas abertas agregadas. "
        "NÃO devem ser usadas para cálculo de riscos ou geração de PGR. "
        "São dados qualitativos para contextualização adicional apenas."
    )

    has_content = False

    for cq in open_questions:
        text_responses = (
            db.query(ResponseAnswer.text_value)
            .join(Response, Response.id == ResponseAnswer.response_id)
            .filter(
                ResponseAnswer.custom_question_id == cq.id,
                ResponseAnswer.text_value.isnot(None),
                ResponseAnswer.text_value != "",
                Response.campaign_id.in_(campaign_ids),
                Response.is_complete == True,
            )
            .all()
        )

        response_texts = [r[0] for r in text_responses if r[0] and r[0].strip()]

        if len(response_texts) < MIN_RESPONSES_FOR_SCORE:
            continue

        has_content = True
        parts.append(f"\nPergunta: \"{cq.text}\"")
        parts.append(f"Total de respostas: {len(response_texts)}")

        sample = response_texts[:10]
        parts.append("Amostra de percepções (agregadas):")
        for s in sample:
            truncated = s[:200] + "..." if len(s) > 200 else s
            parts.append(f"  - {redact(truncated)}")  # defense in depth

    if not has_content:
        return ""

    return "\n".join(parts)
