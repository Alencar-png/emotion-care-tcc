"""
IA 1 — Narradora do PGR
Transforma scores em texto técnico do Inventário de Riscos Psicossociais.
"""

import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage

from services.ai.llm_config import get_llm

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Você é um especialista em saúde e segurança do trabalho com profundo conhecimento da NR-01 (Portaria MTE 1.419/2024) e de instrumentos de avaliação psicossocial.
Sua tarefa é redigir o Inventário de Riscos Psicossociais de uma empresa, que compõe o Programa de Gerenciamento de Riscos (PGR) exigido pela NR-01.

REGRAS OBRIGATÓRIAS:
1. Use linguagem técnica, objetiva e compatível com leitura de profissional de SST e gestor de RH simultaneamente.
2. Nunca invente dados. Use apenas os scores e classificações fornecidos no JSON.
3. Na introdução, cite explicitamente o instrumento informado no campo "instrumento_nome" e a NR-01.
4. Para cada dimensão Vermelha: descreva o risco, o nível de exposição dos trabalhadores e as possíveis implicações para a saúde (burnout, estresse crônico, afastamentos).
5. Nunca identifique colaboradores individualmente. Toda menção a pessoas é sempre coletiva (ex: 'os trabalhadores do setor Comercial').
6. RIGOROSO: o texto deve ter ENTRE 600 E 900 PALAVRAS no total, somadas as sete seções. Sugestão de distribuição: introdução 100-130, resultados gerais 80-120, riscos críticos 120-180, riscos intermediários 80-120, fatores favoráveis 60-100, análise por setor 100-150, conclusão 80-120. Conte mentalmente antes de retornar. Textos abaixo de 600 palavras serão rejeitados e reescritos com mais detalhamento técnico em cada seção.
7. Retorne APENAS o JSON estruturado conforme especificado. Nenhum texto fora do JSON.
8. Não use travessões (em dashes). Use vírgulas ou dois-pontos.
9. Termine cada item de lista com ponto final.
10. IMPORTANTE — COERÊNCIA DE TERMINOLOGIA: A classificação por cor (Verde/Amarelo/Vermelho) refere-se ao score do instrumento de avaliação. Ao descrever os riscos, use EXATAMENTE a classificação fornecida nos dados. Se uma dimensão está classificada como "Vermelho" (score elevado), refira-se a ela como dimensão com "score elevado" ou "nível de exposição elevado", NUNCA como "risco crítico" a menos que o nível de risco da matriz S×P seja realmente "Crítico". Use termos como "dimensões com score em nível de alerta" ou "dimensões em faixa de risco elevado" ao invés de misturar com a terminologia da matriz NR-01 (Baixo/Médio/Alto/Crítico). As subseções devem ser nomeadas: "Dimensões com Score Elevado" (vermelho), "Dimensões com Score Intermediário" (amarelo), "Dimensões com Score Favorável" (verde).
11. INDICADORES DE SAÚDE — AFASTAMENTOS: Se o campo "afastamentos_por_setor" estiver presente e não vazio, incorpore esses dados EXCLUSIVAMENTE na seção "secao_analise_por_setor" como evidência corroborante da narrativa. Cite a frequência agregada e o perfil de CIDs (ex: "registros de afastamentos com CID F predominante") como indicador de efeito das condições de trabalho, nunca como identificação individual.
12. REGRA CRÍTICA — O SCORE NÃO MUDA COM AFASTAMENTOS: Os dados de afastamento são indicadores de efeito e NÃO devem ser usados para alterar nem sobrescrever o score calculado pelo questionário. O score permanece ancorado exclusivamente nos resultados do instrumento validado.
13. CONVERGÊNCIA: Quando houver convergência entre score elevado (Vermelho) em uma dimensão e frequência relevante de afastamentos no mesmo GHE, destaque esta convergência como elemento que reforça a prioridade de intervenção.
14. DIVERGÊNCIA: Quando houver divergência (score baixo com muitos afastamentos, ou vice-versa), sinalize a inconsistência como ponto que merece aprofundamento por profissional de SST, sem tomar partido automaticamente.

ESTRUTURA DO JSON DE SAÍDA:
{
  "secao_introducao": "...",
  "secao_resultados_gerais": "...",
  "secao_riscos_criticos": "...",
  "secao_riscos_intermediarios": "...",
  "secao_fatores_favoraveis": "...",
  "secao_analise_por_setor": "...",
  "secao_conclusao": "...",
  "total_palavras": 750
}"""


def build_narrator_payload(
    empresa_nome: str,
    empresa_setor: str,
    empresa_porte: str,
    data_coleta: str,
    total_respondentes: int,
    taxa_resposta: float,
    scores_geral: list,
    scores_por_setor: list,
    dimensoes_vermelhas: list,
    dimensoes_amarelas: list,
    instrumento_nome: str = "COPSOQ II-Br",
    instrumento_codigo: str = "copsoq_ii",
    afastamentos_por_setor: list | None = None,
) -> dict:
    """Monta o payload de entrada para a IA Narradora.

    afastamentos_por_setor: lista agregada por GHE/setor contendo
    total de afastamentos, CIDs predominantes e dias perdidos. Dado exclusivo
    para corroboracao narrativa, nunca para alterar score.
    """
    return {
        "empresa_nome": empresa_nome,
        "empresa_setor": empresa_setor,
        "empresa_porte": empresa_porte,
        "data_coleta": data_coleta,
        "total_respondentes": total_respondentes,
        "taxa_resposta": taxa_resposta,
        "scores_geral": scores_geral,
        "scores_por_setor": scores_por_setor,
        "dimensoes_vermelhas": dimensoes_vermelhas,
        "dimensoes_amarelas": dimensoes_amarelas,
        "instrumento_nome": instrumento_nome,
        "instrumento_codigo": instrumento_codigo,
        "afastamentos_por_setor": afastamentos_por_setor or [],
    }


SECTION_KEYS_FOR_WORDCOUNT = (
    "secao_introducao", "secao_resultados_gerais", "secao_riscos_criticos",
    "secao_riscos_intermediarios", "secao_fatores_favoraveis",
    "secao_analise_por_setor", "secao_conclusao",
)


def _count_words(parsed: dict) -> int:
    return sum(
        len(parsed.get(k, "").split()) for k in SECTION_KEYS_FOR_WORDCOUNT
    )


async def generate_pgr_narrative(payload: dict, *,
                                  max_reprompts: int = 2) -> dict:
    """Gera a narrativa do PGR usando LLM com re-prompting iterativo.

    Args:
        payload: Dados estruturados da campanha (scores, dimensões, etc.)
        max_reprompts: número máximo de tentativas adicionais quando a
            contagem de palavras fica fora da faixa 600-900 (item 6 do
            checklist v2.1 do TCC; a estratégia eleva a conformidade de
            ~0,17 sem re-prompting para >0,80 com re-prompting).

    Returns:
        Dict com as sete seções do texto narrativo.
    """
    llm = get_llm(temperature=0.3, max_tokens=2000, use_case="narrator")
    base_messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=json.dumps(payload, ensure_ascii=False)),
    ]

    async def _call_and_parse(messages: list) -> dict:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.error("Falha ao parsear JSON: %s", content[:500])
            raise ValueError("A IA não retornou um JSON válido.")

    result = await _call_and_parse(base_messages)

    # Re-prompting iterativo de tamanho (item 6 do checklist v2.1).
    for attempt in range(max_reprompts):
        wc = _count_words(result)
        if 600 <= wc <= 900:
            break
        instruction = (
            f"O texto anterior tem {wc} palavras, fora da faixa obrigatória "
            f"de 600 a 900. "
        )
        if wc < 600:
            instruction += (
                "Expanda CADA UMA das sete seções com mais detalhamento "
                "técnico, mantendo fidelidade aos dados do payload "
                "original. Não invente números; aprofunde a análise dos "
                "dados existentes. Retorne o JSON completo com as sete "
                "seções."
            )
        else:
            instruction += (
                "Condense cada seção preservando o conteúdo essencial. "
                "Retorne o JSON completo com as sete seções."
            )
        from langchain_core.messages import AIMessage
        retry_messages = base_messages + [
            AIMessage(content=json.dumps(result, ensure_ascii=False)),
            HumanMessage(content=instruction),
        ]
        try:
            result = await _call_and_parse(retry_messages)
        except Exception as e:
            logger.warning(
                "re-prompting tentativa %d falhou: %s", attempt + 1, e,
            )
            break

    required_keys = [
        "secao_introducao", "secao_resultados_gerais",
        "secao_riscos_intermediarios", "secao_fatores_favoraveis",
        "secao_analise_por_setor", "secao_conclusao",
    ]
    optional_keys = ["secao_riscos_criticos"]

    missing = [k for k in required_keys if k not in result or not result[k]]
    if missing:
        logger.warning("Seções faltando na resposta da IA: %s", missing)
        raise ValueError(f"Seções faltando no texto gerado: {', '.join(missing)}")

    for key in optional_keys:
        if key not in result or not result[key]:
            result[key] = "Nenhum fator de risco psicossocial foi classificado como crítico nesta avaliação."

    # Validação anti-PII pós-geração (Seção 2.5). Redact cada seção textual.
    from services.ai.pii_validator import redact, scan
    for k, v in list(result.items()):
        if isinstance(v, str) and v.strip():
            check = scan(v)
            if not check.is_clean:
                logger.warning(
                    "pgr_narrator pii_detected section=%s kinds=%s",
                    k, sorted({vio.kind for vio in check.violations}),
                )
                result[k] = redact(v)

    return result


async def regenerate_section(payload: dict, section_key: str, current_text: str) -> str:
    """Regenera uma seção específica do texto narrativo.

    Args:
        payload: Dados originais da campanha.
        section_key: Chave da seção a regenerar.
        current_text: Texto atual da seção (para contexto).

    Returns:
        Novo texto para a seção.
    """
    llm = get_llm(temperature=0.4, max_tokens=600, use_case="narrator")

    section_names = {
        "secao_introducao": "Introdução",
        "secao_resultados_gerais": "Resultados Gerais",
        "secao_riscos_criticos": "Riscos Críticos",
        "secao_riscos_intermediarios": "Riscos Intermediários",
        "secao_fatores_favoraveis": "Fatores Favoráveis",
        "secao_analise_por_setor": "Análise por Setor",
        "secao_conclusao": "Conclusão",
    }

    prompt = f"""Com base nos dados fornecidos, reescreva APENAS a seção "{section_names.get(section_key, section_key)}" do Inventário de Riscos Psicossociais.

Texto atual da seção (para referência, gere uma versão diferente):
{current_text}

Dados da campanha:
{json.dumps(payload, ensure_ascii=False)}

Retorne APENAS o texto da seção, sem JSON, sem título da seção. Mantenha as mesmas regras de linguagem técnica, sem travessões, sem identificação individual."""

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=prompt),
    ]

    response = await llm.ainvoke(messages)
    text = response.content.strip()
    from services.ai.pii_validator import redact, scan
    check = scan(text)
    if not check.is_clean:
        logger.warning(
            "pgr_narrator regenerate pii_detected section=%s kinds=%s",
            section_key, sorted({v.kind for v in check.violations}),
        )
        text = redact(text)
    return text
