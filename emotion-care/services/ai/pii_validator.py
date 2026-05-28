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

# Telefones BR — exige formato com separador explícito (parêntese, hífen ou
# espaço) para evitar casar com sequências longas de dígitos (CPF/CNPJ sem
# máscara). A detecção é feita APÓS CPF/CNPJ no scan, sobre o texto já
# expurgado dessas categorias.
#
# v2.2: alternativa 'intl_split' adicionada para cobrir +55DDD 9 NNNN-NNNN,
# anteriormente um ponto-de-falha conhecido (Seção 9.5 do TCC).
_PHONE = re.compile(
    r"(?:"
    r"\+?55\s?\d{2}\s9\s?\d{4}[-\s]\d{4}"  # +55 DDD 9 NNNN-NNNN (split, com ou sem espaço após +55)
    r"|"
    r"\+?55[\s\-]?\(\d{2}\)\s?\d{4,5}[-\s]\d{4}"  # +55 (DDD) NNNNN-NNNN
    r"|"
    r"\(\d{2}\)\s?\d{4,5}[-\s]\d{4}"  # (DDD) + 8 ou 9 dígitos com separador
    r"|"
    r"\+?55[\s\-]\d{2}\s\d{4,5}[-\s]\d{4}"  # +55 DDD NNNNN-NNNN
    r"|"
    r"\d{2}\s\d{4,5}[-\s]\d{4}"        # DDD + 9 dígitos com espaço e hífen
    r")"
    r"(?!\d)"
)

# Matrícula / crachá — gatilhos ampliados e formatos variados.
# v2.2 adiciona:
#   - sufixo "no sistema de ponto", "no SAP", "no AD" (gatilho pós-numérico);
#   - prefixos abreviados extras: "RE", "PIS", "PASEP" (códigos comuns BR).
_ENROLLMENT = re.compile(
    r"(?:"
    # padrão com gatilho ANTES do número
    r"\b(?:matr[íi]cula|matr\.|crach[aá]|cr\.|registro|reg\.|cadastro|"
    r"funcional|c[óo]digo[\s\-]rh|id[\s\-]?(?:interno|funcional)|"
    r"n[º°ºo°]?\s*funcional|prontu[áa]rio|"
    r"re|pis|pasep|chapa|pront\.)"
    r"\s*(?:n[º°ºo°]\s*)?"
    r"(?:\d{3,}[\-/]?\d*|[a-z]{0,3}[-]?\d{3,})\b"
    r"|"
    # padrão com gatilho DEPOIS do número (ex.: "1234 no sistema de ponto")
    r"\b\d{3,}\b\s+"
    r"(?:no|na)\s+"
    r"(?:sistema\s+de\s+ponto|sistema\s+(?:de\s+)?(?:rh|recursos\s+humanos)|"
    r"folha\s+(?:de\s+)?(?:pagamento|ponto)|"
    r"cadastro\s+(?:do\s+)?(?:funcion[áa]rio|colaborador|empregado)|"
    r"crach[áa]|matr[íi]cula\b|ad|sap|adp|senior)"
    r")",
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


# Cargos específicos que, sozinhos, costumam identificar. Lista ampliada
# com base nas observações de vazamento (cargo, na avaliação span-level).
_IDENTIFYING_ROLE_MARKERS = re.compile(
    r"\b("
    r"CEO|CFO|COO|CTO|CIO|CMO|CHRO|CPO|"
    r"presidente|vice[\s\-]presidente|"
    r"diretor[-\s]?(?:executivo|geral|financeiro|presidente|de\s+opera[çc][õo]es|"
    r"de\s+tecnologia|jur[íi]dico|comercial|industrial|"
    r"de\s+recursos\s+humanos|de\s+marketing|"
    r"de\s+ti)?|"
    r"diretora[-\s]?(?:executiva|geral|financeira|de\s+opera[çc][õo]es|"
    r"de\s+tecnologia|jur[íi]dica|comercial|industrial)|"
    r"superintendente(?:\s+(?:geral|t[ée]cnico|t[ée]cnica))?|"
    r"ger[eê]nte\s+(?:geral|s[êe]nior|executivo|executiva|de\s+opera[çc][õo]es)|"
    r"head\s+of\s+\w+|"
    r"chief\s+\w+\s+officer|"
    r"founder|cofounder|s[óo]cio[\s\-]fundador"
    r")\b",
    re.IGNORECASE,
)


# Título + nome completo (ex.: "Sr. Pereira", "Dra. Fernanda Almeida",
# "Prof. João da Silva Souza"). Captura o nome composto inteiro para
# evitar duplicação span-level com a heurística de nome composto.
_TITLE_PLUS_NAME = re.compile(
    r"\b(?:Sr|Sra|Srta|Dr|Dra|Prof|Profa|Eng|Ms)\.?\s+"
    r"[A-ZÁ-ÚÂ-ÛÃ-Õ][A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ]+"
    r"(?:\s+(?:da|de|do|das|dos|e)\s+[A-ZÁ-ÚÂ-ÛÃ-Õ][A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ]+"
    r"|\s+[A-ZÁ-ÚÂ-ÛÃ-Õ][A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ]+)*"
)


# Tokens institucionais que NÃO devem ser considerados nomes próprios,
# mesmo se aparecerem em sequência capitalizada (item 8 do checklist v2.1).
# A lista é grande de propósito: false positive em compliance é caro.
_INSTITUTIONAL_TOKENS = frozenset({
    "plano", "ação", "acao", "programa", "norma", "politica", "política",
    "recursos", "humanos", "rh", "tecnologia", "informação", "informacao",
    "comissão", "comissao", "interna", "prevenção", "prevencao", "acidentes",
    "centro", "universitário", "universitario", "afya", "unima", "cesmac",
    "curso", "ciência", "ciencia", "computação", "computacao",
    "ministério", "ministerio", "trabalho", "emprego",
    "organização", "organizacao", "mundial", "saúde", "saude",
    "internacional", "lei", "geral", "proteção", "protecao", "dados",
    "modelo", "demanda", "controle", "esforço", "esforco", "recompensa",
    "saúde", "mental", "serviço", "servico", "segurança", "seguranca",
    "diário", "diario", "oficial", "união", "uniao", "banco", "central",
    "universidade", "federal", "alagoas", "sistema", "único", "unico",
    "tribunal", "superior", "conselho", "medicina", "instituto", "brasileiro",
    "geografia", "estatística", "estatistica", "gestão", "gestao", "pessoas",
    "atendimento", "cliente", "boletim", "técnico", "tecnico", "manual",
    "procedimentos", "privacidade", "termo", "consentimento", "livre",
    "esclarecido", "pessoal", "pessoais", "constituição", "constituicao",
    "decreto", "legislativo", "senado", "resolução", "resolucao", "normativa",
    "inventário", "inventario", "riscos", "psicossociais", "psicossocial",
    "gerenciamento", "matriz", "ishikawa", "investigação", "investigacao",
    "hierarquia", "controles", "boletim", "manual", "diretoria",
    "convocação", "convocacao", "ata", "reunião", "reuniao",
    "nordic", "knowles", "kolb", "karasek", "siegrist",
    "norte", "sul", "leste", "oeste", "estado", "alagoas", "pernambuco",
    "indústria", "industria", "comercial", "logística", "logistica",
    "operações", "operacoes", "marketing", "produção", "producao",
    "administrativo", "comércio", "comercio", "educação", "educacao",
    "serviços", "servicos", "vale", "refeição", "refeicao", "bradesco",
    "sindicato", "bancários", "bancarios", "federação", "federacao",
    "indústrias", "industrias", "isbn", "iso", "abnt",
})


# Sobrenomes brasileiros comuns para reforçar a heurística de nome composto:
# exige que, além de um prenome conhecido, haja TAMBÉM um sobrenome
# conhecido OU um conector + sobrenome conhecido. Isso reduz drasticamente
# falsos positivos em sequências como "Plano de Ação" e "Recursos Humanos".
_COMMON_LAST_NAMES = frozenset({
    "silva", "santos", "oliveira", "souza", "lima", "pereira", "carvalho",
    "almeida", "rodrigues", "costa", "gomes", "martins", "araújo", "araujo",
    "rocha", "cardoso", "mendes", "barbosa", "ribeiro", "castro", "moreira",
    "andrade", "nascimento", "ferreira", "correia", "pinto", "cavalcanti",
    "pacheco", "vieira", "mota", "teixeira", "alves", "fernandes", "monteiro",
    "freitas", "machado", "campos", "torres", "ramos", "borges", "lopes",
    "dias", "duarte", "esteves", "neves", "moura", "azevedo", "siqueira",
    "barreto", "magalhães", "magalhaes", "valente", "miranda", "guimarães",
    "guimaraes", "porto", "antunes", "sales", "barros", "rezende", "resende",
    "amaral", "leal", "leite", "garcia", "souto", "ferraz", "henriques",
    "queiroz", "couto", "marinho", "freire", "salgado", "noronha", "nóbrega",
    "nobrega", "jatobá", "jatoba",
})


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
    """Heurística refinada para nomes próprios PT-BR (item 8 do checklist).

    Regra (v2.1): sequências de 2 ou mais palavras começando com maiúscula
    (incluindo acentuadas) que satisfaçam TODAS as condições:
      1) Pelo menos um prenome conhecido (_COMMON_FIRST_NAMES);
      2) Pelo menos um sobrenome conhecido (_COMMON_LAST_NAMES) OU dois
         prenomes em sequência;
      3) Nenhum dos tokens não-conector seja um token institucional
         (_INSTITUTIONAL_TOKENS), o que rejeita sequências como
         "Plano de Ação", "Recursos Humanos", "Universidade Federal".
    """
    out: list[PIIViolation] = []
    token_re = re.compile(r"[A-ZÁ-ÚÂ-ÛÃ-Õ][A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ'-]{1,}")
    connectors = {"da", "de", "do", "das", "dos", "e"}
    connector = r"(?:\s+(?:da|de|do|das|dos|e)\s+|\s+)"
    seq_re = re.compile(
        rf"{token_re.pattern}(?:{connector}{token_re.pattern})+"
    )
    for m in seq_re.finditer(text):
        span = m.group(0)
        words = re.findall(r"[A-Za-zÁ-ÚÂ-ÛÃ-Õá-úâ-ûã-õ'-]+", span)
        if not words:
            continue
        lower_words = [w.lower() for w in words]
        # Rejeita se contém token institucional fora de conectores
        non_connector_tokens = [w for w in lower_words if w not in connectors]
        if any(t in _INSTITUTIONAL_TOKENS for t in non_connector_tokens):
            continue
        # Requer pelo menos um prenome conhecido
        prenomes_count = sum(
            1 for w in lower_words if w in _COMMON_FIRST_NAMES
        )
        if prenomes_count == 0:
            continue
        # E pelo menos um sobrenome conhecido OU dois prenomes
        sobrenomes_count = sum(
            1 for w in lower_words if w in _COMMON_LAST_NAMES
        )
        if sobrenomes_count == 0 and prenomes_count < 2:
            continue
        out.append(PIIViolation(
            kind="nome", value=span, start=m.start(), end=m.end(),
        ))
    return out


def _mask_spans(text: str, spans: list[tuple[int, int]]) -> str:
    """Substitui os intervalos por '#' do mesmo tamanho, preservando offsets.

    Usado para evitar que regex posteriores (item 7 do checklist v2.1)
    casem com sequências numéricas já consumidas por CPF, CNPJ ou e-mail.
    """
    if not spans:
        return text
    chars = list(text)
    for s, e in spans:
        for i in range(s, e):
            if i < len(chars):
                chars[i] = "#"
    return "".join(chars)


def scan(text: str) -> PIIScanResult:
    """Varre o texto e devolve todas as violações encontradas.

    Nunca muta, nunca levanta (exceto TypeError em input inválido).
    Não loga por si — cabe ao chamador decidir.

    Ordem de detecção (v2.1): categorias com formato mais específico
    rodam primeiro e suas posições são mascaradas no texto antes de
    categorias mais genéricas. Isso elimina o falso positivo de
    telefone casando com CPF/CNPJ sem máscara, identificado na
    avaliação span-level (item 7 do checklist v2.1).
    """
    if not isinstance(text, str):
        raise TypeError(f"texto deve ser str, recebi {type(text).__name__}")

    violations: list[PIIViolation] = []

    # Etapa 1 — categorias estruturadas (regex específico). Coletamos e
    # mascaramos os intervalos para a etapa 2.
    early_categories = [
        (_EMAIL, "email"),
        (_CNPJ, "cnpj"),
        (_CPF, "cpf"),
    ]
    consumed_spans: list[tuple[int, int]] = []
    for pat, kind in early_categories:
        for v in _collect(pat, kind, text):
            violations.append(v)
            consumed_spans.append((v.start, v.end))

    masked = _mask_spans(text, consumed_spans)

    # Etapa 2 — categorias que sofriam colisão com CPF/CNPJ sem máscara.
    later_categories = [
        (_PHONE, "telefone"),
        (_ENROLLMENT, "matricula"),
        (_IDENTIFYING_ROLE_MARKERS, "cargo_identificador"),
        (_TITLE_PLUS_NAME, "titulo_nome"),
    ]
    for pat, kind in later_categories:
        violations.extend(_collect(pat, kind, masked))

    # Etapa 3 — heurística de nome composto sobre texto mascarado.
    # Filtra spans de "nome" que estão integralmente dentro de um span de
    # "titulo_nome" já detectado, evitando duplicação span-level (item 8
    # do checklist v2.1).
    title_spans = [
        (v.start, v.end) for v in violations if v.kind == "titulo_nome"
    ]
    for v in _find_capitalized_name_sequences(masked):
        contained = any(s <= v.start and v.end <= e for s, e in title_spans)
        if contained:
            continue
        violations.append(v)

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
