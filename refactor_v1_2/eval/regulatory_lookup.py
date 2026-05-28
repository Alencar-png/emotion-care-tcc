"""Base curada de itens normativos para verificação de alucinação regulatória.

Contém estrutura mínima dos quatro instrumentos normativos citados no trabalho
(NR-01, NR-17, COPSOQ II-Br, ISO 45003), suficiente para verificar se uma
citação ("NR-01 item 1.5.3.1.1", "COPSOQ dimensão Exigências Cognitivas")
corresponde a algo real, sem precisar parsear PDFs completos da Portaria
MTE 1.419/2024 nem da norma ISO completa (que tem restrição de licença).

Uso:
 from regulatory_lookup import lookup, extract_regulatory_citations
 cit = extract_regulatory_citations(texto)
 for c in cit:
     ok, info = lookup(c)
     print(c, ok, info)
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable


# --------------------- NR-01 (Portaria MTE 1.419/2024) ---------------------
# Estrutura hierárquica de itens. Cada chave é uma seção válida; o valor
# é uma descrição curta (suficiente para verificar existência).

NR01_ITEMS = {
    "1.1": "Disposições gerais",
    "1.2": "Objetivo",
    "1.3": "Campo de aplicação",
    "1.4": "Termos e definições",
    "1.4.1": "Acidente de trabalho",
    "1.4.2": "Agentes nocivos",
    "1.4.3": "Doença ocupacional",
    "1.4.4": "Empregador",
    "1.4.5": "Gerenciamento de riscos ocupacionais (GRO)",
    "1.5": "Gerenciamento de riscos ocupacionais",
    "1.5.1": "Disposições gerais do GRO",
    "1.5.2": "Programa de Gerenciamento de Riscos (PGR)",
    "1.5.2.1": "Estrutura do PGR",
    "1.5.2.2": "Documentos do PGR: inventário de riscos e plano de ação",
    "1.5.3": "Avaliação dos riscos ocupacionais",
    "1.5.3.1": "Inventário de riscos",
    "1.5.3.1.1": "Conteúdo mínimo do inventário",
    "1.5.3.2": "Classificação dos riscos",
    "1.5.4": "Plano de ação",
    "1.5.4.1": "Conteúdo mínimo do plano de ação",
    "1.5.4.2": "Hierarquia de medidas de controle: eliminação, substituição, "
              "controles de engenharia, administrativos e EPI",
    "1.5.5": "Acompanhamento do controle dos riscos ocupacionais",
    "1.5.5.1": "Monitoramento de exposições",
    "1.5.5.2": "Reavaliação periódica do PGR",
    "1.5.6": "Análise de acidentes e doenças relacionadas ao trabalho",
    "1.5.7": "Preparação para emergências",
    "1.6": "Capacitação em SST",
    "1.7": "Direitos e deveres",
    "1.8": "Disposições finais",
    "Anexo I": "Riscos psicossociais relacionados ao trabalho",
    "Anexo II": "Levantamento preliminar de perigos",
}


# --------------------- NR-17 (Ergonomia) ---------------------

NR17_ITEMS = {
    "17.1": "Objetivo e campo de aplicação",
    "17.2": "Análise ergonômica do trabalho (AET)",
    "17.3": "Mobiliário dos postos de trabalho",
    "17.4": "Equipamentos dos postos de trabalho",
    "17.5": "Condições ambientais de trabalho",
    "17.6": "Organização do trabalho",
    "17.6.1": "Adequação às características psicofisiológicas",
    "17.6.2": "Ritmos, jornada, pausas e descansos",
    "17.6.3": "Avaliação de desempenho",
    "17.6.4": "Conteúdo das tarefas",
    "17.6.5": "Modo operatório",
    "17.6.6": "Exigências de tempo e produção",
    "17.7": "Trabalho em teleatendimento e telemarketing",
    "Anexo I": "Trabalho em movimentação manual de cargas",
    "Anexo II": "Trabalho dos operadores de checkout",
}


# --------------------- COPSOQ II-Br (versão de 80 itens) ---------------------
# Dimensões agrupadas em domínios.

COPSOQ_DIMENSIONS = {
    "Demandas no Trabalho": [
        "Demandas Quantitativas",
        "Ritmo de Trabalho",
        "Demandas Cognitivas",
        "Demandas Emocionais",
        "Exigências de Esconder Emoções",
    ],
    "Organização e Conteúdo do Trabalho": [
        "Influência no Trabalho",
        "Possibilidade de Desenvolvimento",
        "Significado do Trabalho",
        "Compromisso com o Local de Trabalho",
    ],
    "Relações Sociais e Liderança": [
        "Previsibilidade",
        "Reconhecimento",
        "Clareza de Papel",
        "Conflitos de Papel",
        "Qualidade da Liderança",
        "Suporte Social de Colegas",
        "Suporte Social de Superiores",
        "Comunidade Social no Trabalho",
    ],
    "Valores no Local de Trabalho": [
        "Confiança Vertical",
        "Confiança Horizontal",
        "Justiça Organizacional e Respeito",
        "Sentido do Trabalho",
    ],
    "Saúde e Bem-Estar": [
        "Saúde Geral",
        "Burnout",
        "Estresse",
        "Distúrbios do Sono",
        "Sintomas Depressivos",
    ],
    "Comportamentos Ofensivos no Trabalho": [
        "Insultos e Provocações",
        "Assédio Sexual",
        "Ameaças de Violência",
        "Violência Física",
        "Bullying",
    ],
    "Insegurança Laboral": [
        "Insegurança no Trabalho",
        "Insegurança nas Condições de Trabalho",
    ],
    "Conflito Trabalho-Família": [
        "Conflito Trabalho-Família",
    ],
}

COPSOQ_DIMENSIONS_FLAT = {
    d.lower() for dims in COPSOQ_DIMENSIONS.values() for d in dims
}


# --------------------- ISO 45003:2021 ---------------------

ISO45003_SECTIONS = {
    "1": "Escopo",
    "2": "Referências normativas",
    "3": "Termos e definições",
    "4": "Contexto da organização",
    "5": "Liderança e participação dos trabalhadores",
    "5.1": "Liderança e comprometimento",
    "5.2": "Política de SST",
    "5.3": "Funções, responsabilidades e autoridades",
    "5.4": "Consulta e participação dos trabalhadores",
    "6": "Planejamento",
    "6.1": "Ações para abordar riscos e oportunidades",
    "6.1.2": "Identificação de perigos psicossociais",
    "6.1.3": "Avaliação dos riscos psicossociais",
    "7": "Apoio",
    "7.4": "Comunicação",
    "8": "Operação",
    "8.1": "Planejamento e controle operacional",
    "8.1.2": "Eliminação de perigos psicossociais",
    "8.1.3": "Gestão da mudança",
    "8.2": "Preparação e resposta a emergências",
    "9": "Avaliação de desempenho",
    "9.1": "Monitoramento, medição, análise e avaliação",
    "10": "Melhoria",
    "Anexo A": "Diretrizes para gerenciamento de riscos psicossociais",
    "Anexo B": "Exemplos de perigos psicossociais",
}


# --------------------- API de lookup ---------------------

@dataclass(frozen=True)
class Citation:
    raw: str
    norm: str          # NR-01, NR-17, COPSOQ, ISO 45003
    locator: str       # item / seção / dimensão
    kind: str          # "item", "section", "dimension", "annex"


def lookup(citation: Citation) -> tuple[bool, str | None]:
    """Verifica se a citação aponta para item real.

    Returns:
        (existe, descrição_curta_ou_None)
    """
    if citation.norm == "NR-01":
        d = NR01_ITEMS.get(citation.locator)
        return (d is not None, d)
    if citation.norm == "NR-17":
        d = NR17_ITEMS.get(citation.locator)
        return (d is not None, d)
    if citation.norm == "COPSOQ":
        ok = citation.locator.lower() in COPSOQ_DIMENSIONS_FLAT
        return (ok, citation.locator if ok else None)
    if citation.norm == "ISO 45003":
        d = ISO45003_SECTIONS.get(citation.locator)
        return (d is not None, d)
    return (False, None)


# Regex para extrair citações típicas
_NR01_PAT = re.compile(
    r"\bNR[-\s]?0?1(?!\d)[,\s]*(?:item|seção|Sec\.?|§)?\s*"
    r"((?:\d+\.)*\d+|Anexo\s+[IVX]+)",
    re.IGNORECASE,
)
_NR17_PAT = re.compile(
    r"\bNR[-\s]?17(?!\d)[,\s]*(?:item|seção|Sec\.?|§)?\s*"
    r"((?:\d+\.)*\d+|Anexo\s+[IVX]+)",
    re.IGNORECASE,
)
_ISO_PAT = re.compile(
    r"\bISO\s*45003[,\s]*(?:Sec\.?|seção|Anexo)?\s*((?:\d+\.)*\d+|Anexo\s+[A-Z])",
    re.IGNORECASE,
)
# COPSOQ: padrão "dimensão X" onde X é um nome conhecido. Mais simples: olha
# se aparecem nomes da lista flat dentro de N caracteres de "COPSOQ" ou
# "dimensão".
_COPSOQ_TRIGGER = re.compile(r"\b(?:COPSOQ|dimens[ãa]o)\b", re.IGNORECASE)


def extract_regulatory_citations(text: str) -> list[Citation]:
    """Extrai todas as citações regulatórias detectáveis no texto."""
    out: list[Citation] = []

    for m in _NR01_PAT.finditer(text):
        loc = m.group(1).strip()
        loc = loc.replace("Anexo  ", "Anexo ").replace("anexo", "Anexo")
        out.append(Citation(raw=m.group(0), norm="NR-01", locator=loc,
                            kind="item" if loc[0].isdigit() else "annex"))

    for m in _NR17_PAT.finditer(text):
        loc = m.group(1).strip()
        # Para NR-17, o item já vem com 17.X.Y ou apenas X.Y; normaliza
        if not loc.startswith("17") and loc[0].isdigit():
            loc = "17." + loc
        out.append(Citation(raw=m.group(0), norm="NR-17", locator=loc,
                            kind="item"))

    for m in _ISO_PAT.finditer(text):
        loc = m.group(1).strip()
        if loc.lower().startswith("anexo"):
            loc = "Anexo " + loc.split()[-1].upper()
        out.append(Citation(raw=m.group(0), norm="ISO 45003", locator=loc,
                            kind="section"))

    # COPSOQ: tenta encontrar nomes de dimensões mencionados próximos a
    # palavras-gatilho.
    lower_text = text.lower()
    for dim_name in COPSOQ_DIMENSIONS_FLAT:
        if dim_name in lower_text:
            # Procura se há "COPSOQ" ou "dimensão" em janela de ±80 chars
            for occ in [i for i in range(len(lower_text))
                        if lower_text.startswith(dim_name, i)]:
                window = text[max(0, occ - 80): occ + len(dim_name) + 80]
                if _COPSOQ_TRIGGER.search(window):
                    out.append(Citation(
                        raw=dim_name,
                        norm="COPSOQ",
                        locator=dim_name,
                        kind="dimension",
                    ))
                    break

    return out


def hallucination_rate(texts: Iterable[str]) -> dict:
    """Para uma coleção de textos, calcula:

      - n_citations_total: número de citações regulatórias detectadas
      - n_citations_valid: número que existe na base curada
      - n_citations_invalid: alucinações
      - hallucination_rate = invalid / total (0 se nenhuma citação)
      - n_docs_with_hallucination: docs com >=1 alucinação
    """
    total = valid = invalid = 0
    docs_with_hall = 0
    for t in texts:
        local_hall = 0
        for cit in extract_regulatory_citations(t):
            total += 1
            ok, _ = lookup(cit)
            if ok:
                valid += 1
            else:
                invalid += 1
                local_hall += 1
        if local_hall > 0:
            docs_with_hall += 1
    rate = invalid / total if total else 0.0
    return {
        "n_citations_total": total,
        "n_citations_valid": valid,
        "n_citations_invalid": invalid,
        "n_docs_with_hallucination": docs_with_hall,
        "hallucination_rate": rate,
    }


if __name__ == "__main__":
    sample = (
        "Conforme NR-01 item 1.5.3.1.1, o inventário deve listar os riscos. "
        "Adicionalmente, NR-17 item 17.6.1 trata da organização do trabalho. "
        "A dimensão COPSOQ Demandas Cognitivas pontuou 72. "
        "Citação inventada: NR-01 item 9.9.9.9 não existe. "
        "ISO 45003 seção 6.1.2 aborda identificação de perigos psicossociais."
    )
    cits = extract_regulatory_citations(sample)
    for c in cits:
        ok, info = lookup(c)
        print(f"  {c.norm} {c.locator:10s} -> {ok}  {info or '(NAO EXISTE)'}")
    print()
    print(hallucination_rate([sample]))
