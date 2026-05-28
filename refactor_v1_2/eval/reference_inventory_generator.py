"""Gerador determinístico de inventário de referência para o narrador PGR.

Dado um payload (scores, dimensões classificadas, setores), produz um texto
de referência via templates + placeholders, sem usar LLM. Esse texto serve
de ground truth textual para BERTScore / ROUGE comparando contra a saída
do narrador.

Princípio: a referência NÃO precisa ser igual à saída do narrador, apenas
expor o mesmo conjunto de fatos que a saída deveria expor. BERTScore
permite paráfrase legítima; ROUGE pondera n-gramas em comum.

Saída: dicionário com as mesmas 7 seções do narrador.
"""
from __future__ import annotations

from typing import Sequence


SECTION_KEYS = (
    "secao_introducao",
    "secao_resultados_gerais",
    "secao_riscos_criticos",
    "secao_riscos_intermediarios",
    "secao_fatores_favoraveis",
    "secao_analise_por_setor",
    "secao_conclusao",
)


def _fmt_dimensao(d: dict) -> str:
    return f"{d['dimensao']} (score {d['score']})"


def _intro(p: dict) -> str:
    return (
        f"O presente Inventário de Riscos Psicossociais foi elaborado para "
        f"{p['empresa_nome']}, organização do setor {p['empresa_setor']}, "
        f"de porte {p['empresa_porte']}. O documento atende ao "
        f"Programa de Gerenciamento de Riscos (PGR) exigido pela "
        f"NR-01 (Portaria MTE 1.419/2024) e fundamenta-se no instrumento "
        f"{p.get('instrumento_nome', 'COPSOQ II-Br')}. "
        f"A coleta de dados ocorreu em {p['data_coleta']}, com "
        f"{p['total_respondentes']} respondentes e taxa de resposta de "
        f"{p['taxa_resposta']:.1f} por cento. Os scores são apresentados "
        f"em três faixas (Verde, Amarelo, Vermelho) e classificam o nível "
        f"de exposição psicossocial em cada dimensão avaliada."
    )


def _resultados_gerais(p: dict) -> str:
    dims = p.get("scores_geral", [])
    if not dims:
        return "Não há dimensões avaliadas no escopo do instrumento aplicado."
    verm = [d for d in dims if d["classificacao"] == "Vermelho"]
    amar = [d for d in dims if d["classificacao"] == "Amarelo"]
    verde = [d for d in dims if d["classificacao"] == "Verde"]
    return (
        f"O instrumento avaliou {len(dims)} dimensões. "
        f"Foram identificadas {len(verm)} dimensões com score elevado "
        f"(faixa Vermelha), {len(amar)} em faixa intermediária (Amarela) e "
        f"{len(verde)} em faixa favorável (Verde). Os números a seguir "
        f"refletem o instrumento e não substituem análise contextual."
    )


def _criticos(p: dict) -> str:
    verm = [d for d in p.get("scores_geral", [])
            if d["classificacao"] == "Vermelho"]
    if not verm:
        return (
            "Nenhuma dimensão foi classificada na faixa Vermelha nesta "
            "rodada. Recomenda-se manter o monitoramento periódico do "
            "instrumento e revisão semestral conforme a NR-01."
        )
    lines = ["As dimensões com score elevado, exigindo atenção prioritária, "
             "são descritas a seguir."]
    for d in verm:
        lines.append(
            f"A dimensão {_fmt_dimensao(d)} indica nível de exposição "
            f"elevado no coletivo. Possíveis implicações para a saúde "
            f"incluem estresse crônico, burnout e maior risco de "
            f"afastamentos. Recomenda-se intervenção organizacional "
            f"baseada na hierarquia de controles."
        )
    return " ".join(lines)


def _intermediarios(p: dict) -> str:
    amar = [d for d in p.get("scores_geral", [])
            if d["classificacao"] == "Amarelo"]
    if not amar:
        return ("Nenhuma dimensão foi classificada na faixa Amarela. "
                "O conjunto avaliado encontra-se em faixa Verde ou requer "
                "atenção priorizada conforme seção anterior.")
    lines = ["Em faixa intermediária encontram-se as seguintes dimensões."]
    for d in amar:
        lines.append(
            f"{_fmt_dimensao(d)}: requer monitoramento e ação preventiva "
            f"antes de eventual deterioração para a faixa Vermelha."
        )
    return " ".join(lines)


def _favoraveis(p: dict) -> str:
    verde = [d for d in p.get("scores_geral", [])
             if d["classificacao"] == "Verde"]
    if not verde:
        return ("O conjunto de dimensões não apresenta resultados em faixa "
                "Verde nesta rodada de avaliação.")
    nomes = ", ".join(d["dimensao"] for d in verde[:6])
    return (
        f"As dimensões classificadas como fatores favoráveis incluem "
        f"{nomes}. Esses resultados indicam aspectos protetores presentes "
        f"no ambiente de trabalho que devem ser preservados nas ações "
        f"de intervenção."
    )


def _por_setor(p: dict) -> str:
    setores = p.get("scores_por_setor", [])
    if not setores:
        return ("A estratificação por setor não atende ao mínimo de "
                "respondentes por agrupamento exigido pela política "
                "k-anonymity (k = 3); nenhum recorte setorial é apresentado.")
    ordenados = sorted(setores, key=lambda s: -s["score"])
    top = ordenados[0]
    bot = ordenados[-1]
    afast = p.get("afastamentos_por_setor", [])
    base = (
        f"A análise por setor identifica {top['setor']} com score "
        f"agregado {top['score']} e {bot['setor']} com score "
        f"{bot['score']}. Diferenças entre setores devem ser interpretadas "
        f"com cautela, considerando contexto laboral e perfil de "
        f"trabalhadores."
    )
    if afast:
        base += (
            " Os dados de afastamentos, quando presentes, corroboram a "
            "narrativa como indicadores de efeito sem alterar o score "
            "do instrumento."
        )
    return base


def _conclusao(p: dict) -> str:
    verm = [d for d in p.get("scores_geral", [])
            if d["classificacao"] == "Vermelho"]
    amar = [d for d in p.get("scores_geral", [])
            if d["classificacao"] == "Amarelo"]
    return (
        f"O Inventário identifica {len(verm)} dimensões em faixa Vermelha "
        f"e {len(amar)} em faixa Amarela, demandando plano de ação "
        f"estruturado conforme NR-01 item 1.5.4. A reavaliação periódica "
        f"do instrumento e o acompanhamento das ações implementadas são "
        f"essenciais para o sucesso da gestão de riscos psicossociais. "
        f"As intervenções devem seguir a hierarquia de controles e "
        f"contemplar a participação dos trabalhadores."
    )


def generate_reference(payload: dict) -> dict[str, str]:
    """Gera as 7 seções de referência determinísticas."""
    return {
        "secao_introducao": _intro(payload),
        "secao_resultados_gerais": _resultados_gerais(payload),
        "secao_riscos_criticos": _criticos(payload),
        "secao_riscos_intermediarios": _intermediarios(payload),
        "secao_fatores_favoraveis": _favoraveis(payload),
        "secao_analise_por_setor": _por_setor(payload),
        "secao_conclusao": _conclusao(payload),
    }


def join_reference(reference: dict[str, str]) -> str:
    """Concatena as 7 seções em uma única string para BERTScore/ROUGE."""
    return " ".join(reference[k] for k in SECTION_KEYS)


if __name__ == "__main__":
    import json
    sample = {
        "empresa_nome": "Empresa Sintética Teste",
        "empresa_setor": "Indústria",
        "empresa_porte": "medio",
        "data_coleta": "2026-05-01",
        "total_respondentes": 130,
        "taxa_resposta": 73.5,
        "scores_geral": [
            {"dimensao": "Exigências Quantitativas", "score": 72,
             "classificacao": "Vermelho"},
            {"dimensao": "Suporte Social", "score": 18,
             "classificacao": "Verde"},
            {"dimensao": "Reconhecimento", "score": 48,
             "classificacao": "Amarelo"},
        ],
        "scores_por_setor": [
            {"setor": "Operações", "score": 74},
            {"setor": "RH", "score": 32},
        ],
        "afastamentos_por_setor": [],
        "instrumento_nome": "COPSOQ II-Br",
    }
    ref = generate_reference(sample)
    text = join_reference(ref)
    print(text)
    print(f"\nTotal palavras: {len(text.split())}")
