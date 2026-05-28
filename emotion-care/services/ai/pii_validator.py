"""
Validador anti-PII para outputs de IA do Emotion Care v2.0.

Restrição não-negociável da Seção 2.5 do plano v2.0:
    Nenhum documento gerado pela IA (PGR, laudo, plano de ação, comunicação
    CIPA, clusters de abertas) pode conter nome próprio, cargo específico ou
    trecho que permita reidentificação. Implemente uma etapa de validação
    pós-geração (regex + heurística) com log auditável quando detectar
    ocorrências.

Uso típico:

    from services.ai.pii_validator import scan, redact, PIIDetected

    result = scan(llm_output)
    if result.violations:
        redacted = redact(llm_output)
        log_violation(result)
        # decida: rejeitar, reemitir, ou aceitar redacted

Contrato:
    - `scan(text)` nunca muta o input, retorna `PIIScanResult`.
    - `redact(text)` devolve nova string com tokens substituídos por
      placeholders `[EMAIL]`, `[CPF]`, `[TELEFONE]`, `[NOME]`, etc.
    - Não depende de I/O, BD, rede. Pode ser chamado em worker, teste unitário
      e validação pós-LLM sem setup.

Limitações conhecidas (documentadas intencionalmente):
    - Detecção de nomes próprios por heurística (lista de prenomes BR comuns
      + maiúscula). Falsos positivos esperados para palavras PT com maiúscula
      em início de sentença. Trade-off aceitável — a política prefere falso
      positivo (redact desnecessário) a falso negativo (vaza nome).
    - Não analisa contexto semântico. Para isso, LLM secundário seria
      necessário — fora do escopo deste módulo.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Iterable


log = logging.getLogger(__name__)


# ----- Padrões regex (compilados uma vez) -----

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

# CPF: 000.000.000-00 ou 00000000000 (11 dígitos seguidos não dentro de número maior).
_CPF = re.compile(
    r"(?<!\d)(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?!\d)"
)

# CNPJ: 00.000.000/0000-00 ou 14 dígitos seguidos.
_CNPJ = re.compile(
    r"(?<!\d)(?:\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{14})(?!\d)"
)

# Telefones BR. Ordem: formato mais específico primeiro (com DDD entre parênteses).
_PHONE = re.compile(
    r"(?:\+?55\s?)?"                    # +55 opcional
    r"(?:\(\d{2}\)|\d{2})\s?"           # DDD com ou sem parênteses
    r"(?:9?\d{4})[-\s]?\d{4}\b"         # 8 ou 9 dígitos com separador opcional
)

# Matrícula / crachá — heurística: palavra-chave + dígitos.
_ENROLLMENT = re.compile(
    r"\b(?:matr[íi]cula|crach[aá]|registro)\s*(?:n[º°ºo]\s*)?\d{3,}\b",
    re.IGNORECASE,
)


# Top prenomes BR (lista enxuta, ~120 nomes). Intencionalmente não é exaustiva:
# serve como *âncora* — combinada com padrão capitalizado subsequente, captura
# nomes compostos. Lista em minúsculo para comparação case-insensitive.
_COMMON_FIRST_NAMES = frozenset({
    # masculinos
    "joão", "jose", "josé", "antonio", "antônio", "francisco", "carlos",
    "paulo", "pedro", "lucas", "luiz", "luís", "marcos", "gabriel", "rafael",
    "daniel", "marcelo", "bruno", "eduardo", "felipe", "raimundo", "rodrigo",
    "manoel", "manuel", "sebastião", "ricardo", "fernando", "roberto", "andré",
    "sérgio", "sergio", "fábio", "fabio", "leandro", "vinícius", "vinicius",
    "diego", "thiago", "tiago", "gustavo", "igor", "matheus", "henrique",
    "arthur", "davi", "davi", "miguel", "benjamin", "enzo", "heitor", "theo",
    "ravi", "isaac", "caio", "murilo", "bernardo", "guilherme",
    # femininos
    "maria", "ana", "francisca", "antônia", "antonia", "adriana", "juliana",
    "márcia", "marcia", "fernanda", "patrícia", "patricia", "aline", "sandra",
    "camila", "amanda", "bruna", "jessica", "jéssica", "letícia", "leticia",
    "júlia", "julia", "luiza", "luíza", "manuela", "sophia", "sofia", "isabela",
    "isabella", "laura", "alice", "helena", "valentina", "lívia", "livia",
    "beatriz", "bianca", "carolina", "natália", "natalia", "rafaela", "mariana",
    "daniela", "débora", "debora", "roberta", "simone", "silvana", "vanessa",
    "viviane", "renata", "tatiana", "tatiane", "monique", "cláudia", "claudia",
    "rosana", "célia", "celia", "eliana", "márcia", "cristina", "luciana",
    "graça", "graca", "lúcia", "lucia",
})


# Cargos específicos que, sozinhos, costumam identificar. Lista propositalmente
# pequena — ampliar conforme incidentes reais em produção.
_IDENTIFYING_ROLE_MARKERS = re.compile(
    r"\b(CEO|CFO|COO|CTO|CIO|presidente|diretor[-\s]?(?:executivo|geral|financeiro|"
    r"presidente)|ger[eê]nte\s+geral)\b",
    re.IGNORECASE,
)


# Título + prenome capitalizado (ex.: "Sr. Pereira", "Dra. Fernanda")
_TITLE_PLUS_NAME = re.compile(
    r"\b(?:Sr|Sra|Srta|Dr|Dra|Prof|Profa|Eng)\.?\s+[A-ZÁ-ÚÂ-ÛÃ-Õ][A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ]+"
)


@dataclass(frozen=True)
class PIIViolation:
    """Um fragmento identificado como PII.

    kind: rótulo ("email", "cpf", "cnpj", "telefone", "nome", "matricula",
          "cargo_identificador", "titulo_nome").
    value: trecho literal detectado.
    start, end: offsets em caracteres na string original.
    """
    kind: str
    value: str
    start: int
    end: int


@dataclass(frozen=True)
class PIIScanResult:
    text: str
    violations: tuple[PIIViolation, ...] = field(default_factory=tuple)

    @property
    def is_clean(self) -> bool:
        return len(self.violations) == 0


class PIIDetected(Exception):
    """Levantada quando o chamador pediu validação estrita e houve violação."""

    def __init__(self, result: PIIScanResult):
        self.result = result
        kinds = sorted({v.kind for v in result.violations})
        super().__init__(f"PII detectada: {', '.join(kinds)}")


def _collect(pattern: re.Pattern[str], kind: str, text: str) -> Iterable[PIIViolation]:
    for m in pattern.finditer(text):
        yield PIIViolation(kind=kind, value=m.group(0), start=m.start(), end=m.end())


def _find_capitalized_name_sequences(text: str) -> list[PIIViolation]:
    """Heurística para nomes próprios PT-BR.

    Regra: sequências de 2+ palavras começando com maiúscula (incluindo
    acentuadas) onde pelo menos uma das palavras bate com a lista de prenomes
    comuns. Evita disparar em "Plano de Ação" ou "Recursos Humanos".
    """
    out: list[PIIViolation] = []
    # token = palavra capitalizada (incluindo acento) com tamanho >= 2
    token_re = re.compile(r"[A-ZÁ-ÚÂ-ÛÃ-Õ][A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ'-]{1,}")
    # sequência de 2+ tokens separados por espaço / "da" / "de" / "dos" / etc.
    connector = r"(?:\s+(?:da|de|do|das|dos|e)\s+|\s+)"
    seq_re = re.compile(
        rf"{token_re.pattern}(?:{connector}{token_re.pattern})+"
    )
    for m in seq_re.finditer(text):
        span = m.group(0)
        words = re.findall(r"[A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ'-]+", span)
        if not words:
            continue
        # exige ao menos um prenome conhecido na sequência
        if any(w.lower() in _COMMON_FIRST_NAMES for w in words):
            out.append(PIIViolation(kind="nome", value=span, start=m.start(), end=m.end()))
    return out


def scan(text: str) -> PIIScanResult:
    """Varre o texto e devolve todas as violações encontradas.

    Nunca muta, nunca levanta (exceto TypeError em input inválido).
    Não loga por si — cabe ao chamador decidir.
    """
    if not isinstance(text, str):
        raise TypeError(f"texto deve ser str, recebi {type(text).__name__}")

    violations: list[PIIViolation] = []
    violations.extend(_collect(_EMAIL, "email", text))
    violations.extend(_collect(_CNPJ, "cnpj", text))  # CNPJ antes de CPF para não colidir
    violations.extend(_collect(_CPF, "cpf", text))
    violations.extend(_collect(_PHONE, "telefone", text))
    violations.extend(_collect(_ENROLLMENT, "matricula", text))
    violations.extend(_collect(_IDENTIFYING_ROLE_MARKERS, "cargo_identificador", text))
    violations.extend(_collect(_TITLE_PLUS_NAME, "titulo_nome", text))
    violations.extend(_find_capitalized_name_sequences(text))

    # Dedupe — duas regras podem marcar o mesmo span; mantém a primeira.
    seen: set[tuple[int, int, str]] = set()
    deduped: list[PIIViolation] = []
    for v in violations:
        key = (v.start, v.end, v.kind)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(v)
    deduped.sort(key=lambda v: v.start)

    return PIIScanResult(text=text, violations=tuple(deduped))


_PLACEHOLDER = {
    "email": "[EMAIL]",
    "cpf": "[CPF]",
    "cnpj": "[CNPJ]",
    "telefone": "[TELEFONE]",
    "nome": "[NOME]",
    "matricula": "[MATRICULA]",
    "cargo_identificador": "[CARGO]",
    "titulo_nome": "[NOME]",
}


def redact(text: str) -> str:
    """Retorna cópia do texto com as ocorrências de PII substituídas por placeholders."""
    result = scan(text)
    if result.is_clean:
        return text
    # Substitui de trás para frente para não invalidar offsets.
    out = text
    for v in sorted(result.violations, key=lambda x: x.start, reverse=True):
        placeholder = _PLACEHOLDER.get(v.kind, "[PII]")
        out = out[: v.start] + placeholder + out[v.end :]
    return out


def assert_clean(text: str, *, audit_context: dict | None = None) -> None:
    """Levanta PIIDetected se houver PII, logando evento auditável.

    `audit_context` vai para o log (ex.: {"doc_type": "cipa", "campaign_id": 42}).
    """
    result = scan(text)
    if result.is_clean:
        return
    log.warning(
        "pii_detected violations=%d kinds=%s context=%s",
        len(result.violations),
        sorted({v.kind for v in result.violations}),
        audit_context or {},
    )
    raise PIIDetected(result)
