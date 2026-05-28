"""
Fonte única da verdade para os thresholds de anonimato do Emotion Care v2.0.

Qualquer módulo que precise decidir se expõe score global, resultados de setor
ou permitir geração de PGR granular DEVE importar as constantes e funções
daqui. Nunca duplicar os números nem reimplementar a lógica.

Regras (plano v2.0, Seção 2.2):
- MIN_RESPONSES_FOR_SCORE (4): controla score global da campanha e exibição de
  clusters de respostas abertas.
- MIN_RESPONDENTS_PER_SECTOR (3): controla resultados por setor/GHE e geração
  de PGR por recorte (unit/sector/activity).
- Os thresholds são independentes: um setor com 3 respondentes exibe mesmo que
  a campanha total ainda tenha < 4 respostas.

Este módulo é PURO: não depende de SQLAlchemy, FastAPI ou I/O. Pode ser
importado por workers, schedulers, exporters e testes sem fixtures pesadas.
"""
from dataclasses import dataclass
from typing import Literal, Optional


MIN_RESPONSES_FOR_SCORE: int = 4
MIN_RESPONDENTS_PER_SECTOR: int = 3

GranularityMode = Literal["consolidated", "unit", "sector", "activity"]


@dataclass(frozen=True)
class AnonymityDecision:
    """Resultado imutável de uma verificação de anonimato.

    Frozen para permitir caching seguro e prevenir mutação pós-decisão.

    Campos:
        allowed: se o consumidor pode exibir o dado.
        current: contagem atual observada.
        required: mínimo exigido pela política.
        message: texto pt-BR pronto para UI quando bloqueado; None se liberado.
    """
    allowed: bool
    current: int
    required: int
    message: Optional[str]


def _normalize_count(count: int) -> int:
    """Garante que contagens negativas sejam tratadas como zero.

    Chamadores que passem valores negativos (ex.: bug de cálculo upstream)
    não devem nunca ver dado exibido por "debaixo" do threshold — tratamos
    como zero defensivamente.
    """
    if not isinstance(count, int) or isinstance(count, bool):
        raise TypeError(
            f"contagem deve ser int (recebido {type(count).__name__}: {count!r})"
        )
    return max(count, 0)


def score_visibility(response_count: int) -> AnonymityDecision:
    """Decide se o score global da campanha pode ser exibido.

    Regra: libera com >= MIN_RESPONSES_FOR_SCORE respostas.
    """
    current = _normalize_count(response_count)
    if current >= MIN_RESPONSES_FOR_SCORE:
        return AnonymityDecision(True, current, MIN_RESPONSES_FOR_SCORE, None)
    return AnonymityDecision(
        allowed=False,
        current=current,
        required=MIN_RESPONSES_FOR_SCORE,
        message=(
            f"Resultados disponíveis após {MIN_RESPONSES_FOR_SCORE} respostas. "
            f"Atual: {current} resposta(s)."
        ),
    )


def sector_visibility(
    respondent_count: int,
    sector_name: Optional[str] = None,
) -> AnonymityDecision:
    """Decide se dados de um setor/GHE podem ser exibidos.

    Regra: libera com >= MIN_RESPONDENTS_PER_SECTOR respondentes no recorte.
    Se `sector_name` for passado, entra na mensagem de bloqueio.
    """
    current = _normalize_count(respondent_count)
    if current >= MIN_RESPONDENTS_PER_SECTOR:
        return AnonymityDecision(True, current, MIN_RESPONDENTS_PER_SECTOR, None)
    label = f"Setor {sector_name}: " if sector_name else ""
    return AnonymityDecision(
        allowed=False,
        current=current,
        required=MIN_RESPONDENTS_PER_SECTOR,
        message=(
            f"{label}Dados não disponíveis "
            f"(mínimo {MIN_RESPONDENTS_PER_SECTOR} respondentes)."
        ),
    )


def pgr_granular_allowed(respondent_count: int, group_label: str) -> AnonymityDecision:
    """Decide se um PGR por recorte (unidade/setor/atividade) pode ser gerado.

    Reusa o mesmo piso de sector_visibility mas devolve mensagem específica.
    """
    current = _normalize_count(respondent_count)
    if current >= MIN_RESPONDENTS_PER_SECTOR:
        return AnonymityDecision(True, current, MIN_RESPONDENTS_PER_SECTOR, None)
    return AnonymityDecision(
        allowed=False,
        current=current,
        required=MIN_RESPONDENTS_PER_SECTOR,
        message=(
            f"Recorte {group_label} não atingiu o número mínimo de respondentes "
            "para geração do PGR."
        ),
    )


def open_responses_cluster_visibility(response_count: int) -> AnonymityDecision:
    """Decide se clusters de respostas abertas podem ser exibidos.

    Política: o piso de exibição de abertas é o mesmo do score global.
    """
    current = _normalize_count(response_count)
    if current >= MIN_RESPONSES_FOR_SCORE:
        return AnonymityDecision(True, current, MIN_RESPONSES_FOR_SCORE, None)
    return AnonymityDecision(
        allowed=False,
        current=current,
        required=MIN_RESPONSES_FOR_SCORE,
        message=(
            f"Volume insuficiente para exibição protegida "
            f"(mínimo {MIN_RESPONSES_FOR_SCORE} respostas)."
        ),
    )


def individual_drilldown_allowed(respondent_count: int) -> AnonymityDecision:
    """Decide se é permitido mostrar dados individualizáveis (uma única resposta).

    NR-01 e LGPD: nunca expor resposta identificável. O piso é o mesmo de setor
    (mínimo 3 respondentes). Exposto separadamente porque é o gate que será
    chamado por NC_OPEN_VIEW quando alguém tentar drill-down em um cluster.
    """
    current = _normalize_count(respondent_count)
    if current >= MIN_RESPONDENTS_PER_SECTOR:
        return AnonymityDecision(True, current, MIN_RESPONDENTS_PER_SECTOR, None)
    return AnonymityDecision(
        allowed=False,
        current=current,
        required=MIN_RESPONDENTS_PER_SECTOR,
        message=(
            "Drill-down individual bloqueado: exige pelo menos "
            f"{MIN_RESPONDENTS_PER_SECTOR} respondentes no recorte."
        ),
    )


def resolve_threshold(
    kind: Literal["score", "sector"],
    override: Optional[int] = None,
) -> int:
    """Resolve o threshold aplicável respeitando um piso inegociável.

    Um override (vindo de coluna `campaigns.anonymization_threshold` ou
    configuração) só pode TORNAR A POLÍTICA MAIS RIGOROSA. Jamais diminuir
    o piso — isso é governança, não configuração.

    Exemplo:
        resolve_threshold("score", override=None)  -> 4
        resolve_threshold("score", override=10)    -> 10  (mais rigoroso, ok)
        resolve_threshold("score", override=2)     -> 4   (ignora, aplica piso)
    """
    floor = MIN_RESPONSES_FOR_SCORE if kind == "score" else MIN_RESPONDENTS_PER_SECTOR
    if override is None:
        return floor
    if not isinstance(override, int) or isinstance(override, bool):
        raise TypeError(f"override precisa ser int ou None, recebi {override!r}")
    return max(floor, override)
