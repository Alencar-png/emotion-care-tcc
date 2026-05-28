"""Rubricas Likert pré-registradas para avaliação humana cega dos agentes.

Cada rubrica tem âncoras textuais explícitas para os níveis 1, 3 e 5 (a
escala é 1 a 5 inteira, com 2 e 4 como pontos intermediários sem âncora
escrita, conforme prática recomendada em estudos de NLP).

Estrutura preparada para aplicação por DOIS revisores independentes:
 - O usuário (autor do TCC)
 - A colega coautora
 Com cegueira: o avaliador não vê seed, configuração, nem qual versão
 do agente produziu cada saída.

Exporta planilha CSV com 30 amostras estratificadas por agente para que
os revisores apliquem a rubrica.

Após aplicação, rodar:
 from likert_rubrics import compute_cohen_kappa_weighted
 kappa = compute_cohen_kappa_weighted(rater_a, rater_b)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


# --------------------- RUBRICAS ---------------------

NARRATOR_RUBRICS = {
    "clareza_tecnica": {
        "description": "O texto é tecnicamente claro para profissional de SST?",
        "anchors": {
            1: "Texto confuso ou incompreensível; termos usados de forma "
               "incorreta ou inconsistente.",
            3: "Texto claro nos pontos principais com pequenas inconsistências "
               "terminológicas; um profissional de SST experiente entenderia "
               "sem dificuldade.",
            5: "Texto perfeitamente claro, com terminologia precisa e fluxo "
               "lógico evidente; serve como minuta pronta com poucos ajustes.",
        },
    },
    "aderencia_regulatoria": {
        "description": "O texto está aderente à NR-01 e ao COPSOQ?",
        "anchors": {
            1: "Cita normas erradas, atribui conteúdo que não existe na "
               "norma ou ignora elementos obrigatórios (inventário, "
               "plano de ação, classificação de exposição).",
            3: "Cita as normas corretas e cobre os elementos centrais, "
               "com lacunas pontuais que demandariam revisão.",
            5: "Aderência impecável: cita item correto, terminologia "
               "fiel à NR-01 vigente e cobertura completa.",
        },
    },
    "faithfulness_percebida": {
        "description": "O texto é fiel aos dados do payload (sem inventar)?",
        "anchors": {
            1: "Inventa números, atribui scores, dimensões ou setores que "
               "não estão no payload.",
            3: "Fiel no essencial, com 1 ou 2 generalizações que extrapolam "
               "minimamente os dados.",
            5: "Nenhuma afirmação numérica ou factual sem ancoragem clara "
               "no payload.",
        },
    },
    "ausencia_percebida_pii": {
        "description": "O texto está livre de PII (nome, e-mail, CPF, cargo "
                       "identificador, etc)?",
        "anchors": {
            1: "Contém PII clara (nome próprio, e-mail, CPF, telefone, "
               "cargo identificador, matrícula).",
            3: "Sem PII evidente, mas com expressões que poderiam "
               "permitir reidentificação em contexto pequeno.",
            5: "Texto totalmente coletivo, sem nomes, cargos identificáveis "
               "ou recortes finos.",
        },
    },
}

ACTION_PLAN_RUBRICS = {
    "specificity": {
        "description": "Quão específica é a ação proposta?",
        "anchors": {
            1: "Genérica ('fazer treinamento'); sem nome de instrumento, "
               "duração, formato ou público.",
            3: "Especifica o instrumento ou formato, mas faltam parâmetros "
               "(duração, periodicidade, audiência).",
            5: "Totalmente específica: instrumento nomeado, duração e "
               "formato definidos, público claro, indicador de "
               "acompanhamento explicitado.",
        },
    },
    "implementability": {
        "description": "Quão implementável é a ação por um RH médio sem "
                       "consultoria externa?",
        "anchors": {
            1: "Demandaria meses, consultoria especializada ou recursos "
               "indisponíveis na maioria das empresas.",
            3: "Implementável com esforço moderado; alguns pontos "
               "precisariam refinamento.",
            5: "Acionável na próxima reunião: responsável claro, prazo "
               "factível, recursos típicos suficientes.",
        },
    },
    "aderencia_andragogica": {
        "description": "A ação referencia explicitamente princípios "
                       "andragógicos (Knowles) ou ciclo de Kolb?",
        "anchors": {
            1: "Nenhuma menção; abordagem genérica de treinamento.",
            3: "Referencia 1 ou 2 princípios (ex.: relevância para a "
               "atividade, problemas concretos).",
            5: "Articula explicitamente múltiplos princípios "
               "(autodirigido, relevante, problemas reais, experiência "
               "prévia) e/ou estrutura em ciclo de aprendizagem.",
        },
    },
    "aderencia_hierarquia": {
        "description": "A ação respeita a hierarquia da NR-01 para o "
                       "risco proposto?",
        "anchors": {
            1: "Pula níveis (parte para EPI/Individual sem esgotar "
               "Eliminação/Substituição/Controle) sem justificativa.",
            3: "Aderente em essência, com algum nível parcialmente "
               "justificado.",
            5: "Justifica explicitamente por que o nível escolhido é o "
               "mais alto factível, conforme rubrica NR-01.",
        },
    },
}

COPILOT_RUBRICS = {
    "completude": {
        "description": "A resposta endereça completamente a pergunta?",
        "anchors": {
            1: "Resposta parcial ou tangente; ignora aspectos relevantes "
               "da pergunta.",
            3: "Cobre o essencial com lacunas pontuais.",
            5: "Cobertura completa com nuances regulatórias e "
               "operacionais.",
        },
    },
    "precisao_regulatoria": {
        "description": "A resposta cita as normas corretas e seus itens "
                       "reais?",
        "anchors": {
            1: "Cita itens inexistentes ou atribui conteúdo errado a "
               "uma norma.",
            3: "Cita normas corretas, com 1 imprecisão menor de item.",
            5: "Citações verificáveis, todas existentes e atribuídas "
               "corretamente.",
        },
    },
    "clareza_gestor_rh": {
        "description": "A resposta é clara para um gestor de RH (não "
                       "necessariamente técnico em SST)?",
        "anchors": {
            1: "Jargão excessivo; gestor de RH típico não conseguiria "
               "usar a resposta para tomar decisão.",
            3: "Inteligível, mas requer leitura atenta ou pesquisa "
               "adicional.",
            5: "Pronta para uso por gestor de RH com formação básica em "
               "SST.",
        },
    },
}

QUALITATIVE_RUBRICS = {
    "coerencia_interna_cluster": {
        "description": "As respostas dentro de cada cluster são coerentes "
                       "entre si?",
        "anchors": {
            1: "Cluster com respostas de temas evidentemente distintos "
               "misturadas.",
            3: "Cluster majoritariamente coerente com 1 a 2 outliers.",
            5: "Cluster totalmente coerente; todas as respostas "
               "endereçam o mesmo tópico.",
        },
    },
    "distintividade_entre_clusters": {
        "description": "Os clusters são claramente distintos entre si?",
        "anchors": {
            1: "Múltiplos clusters cobrem o mesmo tema com rótulos "
               "diferentes (redundância semântica).",
            3: "Distinção razoável com sobreposição parcial entre 2 "
               "clusters.",
            5: "Cada cluster ocupa nicho semântico próprio sem "
               "sobreposição relevante.",
        },
    },
    "qualidade_nomes": {
        "description": "Os nomes atribuídos aos clusters resumem bem o "
                       "conteúdo?",
        "anchors": {
            1: "Nomes genéricos ou enganosos; não refletem o conteúdo.",
            3: "Nomes adequados, alguns vagos ou poderiam ser mais "
               "específicos.",
            5: "Nomes específicos, descritivos e fiéis ao conteúdo.",
        },
    },
}


ALL_RUBRICS = {
    "narrator": NARRATOR_RUBRICS,
    "action_plan": ACTION_PLAN_RUBRICS,
    "copilot": COPILOT_RUBRICS,
    "qualitative": QUALITATIVE_RUBRICS,
}


# --------------------- KAPPA DE COHEN PONDERADO ---------------------

def compute_cohen_kappa_weighted(
    rater_a: Sequence[int],
    rater_b: Sequence[int],
    n_levels: int = 5,
) -> dict:
    """Kappa de Cohen com pesos quadráticos para escala Likert.

    Args:
        rater_a, rater_b: notas inteiras 1..n_levels.
        n_levels: número de níveis da escala (default 5).

    Returns:
        {"kappa": float, "po": observado, "pe": esperado,
         "n": tamanho da amostra}
    """
    assert len(rater_a) == len(rater_b)
    n = len(rater_a)
    if n == 0:
        return {"kappa": 0.0, "po": 0.0, "pe": 0.0, "n": 0}

    # Matriz de confusão
    cm = [[0] * n_levels for _ in range(n_levels)]
    for a, b in zip(rater_a, rater_b):
        if 1 <= a <= n_levels and 1 <= b <= n_levels:
            cm[a - 1][b - 1] += 1

    # Pesos quadráticos
    max_d = (n_levels - 1) ** 2
    weights = [[1.0 - ((i - j) ** 2) / max_d for j in range(n_levels)]
               for i in range(n_levels)]

    # Marginais
    a_marg = [sum(cm[i]) for i in range(n_levels)]
    b_marg = [sum(cm[i][j] for i in range(n_levels)) for j in range(n_levels)]

    po = sum(weights[i][j] * cm[i][j] for i in range(n_levels)
             for j in range(n_levels)) / n
    pe = sum(weights[i][j] * a_marg[i] * b_marg[j]
             for i in range(n_levels)
             for j in range(n_levels)) / (n * n)
    kappa = (po - pe) / (1.0 - pe) if pe < 1.0 else 1.0

    return {"kappa": kappa, "po": po, "pe": pe, "n": n}


# --------------------- Export de amostras estratificadas ---------------------

def export_sample_csv(
    agent: str,
    samples: list[dict],
    output_path: str,
) -> None:
    """Exporta CSV cego para que os revisores apliquem a rubrica.

    Cada linha tem:
     sample_id (anônimo, sem revelar seed/configuração)
     output_text (saída do agente — para revisor avaliar)
     ... colunas vazias para o revisor preencher conforme rubrica do agente.
    """
    import csv
    rubrics = ALL_RUBRICS[agent]
    fieldnames = ["sample_id", "output_text"]
    for dim in rubrics.keys():
        fieldnames.append(f"score_{dim}")
        fieldnames.append(f"obs_{dim}")
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for s in samples:
            row = {"sample_id": s["sample_id"], "output_text": s["output_text"]}
            for dim in rubrics.keys():
                row[f"score_{dim}"] = ""
                row[f"obs_{dim}"] = ""
            w.writerow(row)


if __name__ == "__main__":
    # Smoke test: kappa de Cohen com dois avaliadores em concordância parcial
    a = [5, 4, 3, 4, 5, 5, 2, 3, 4, 5]
    b = [5, 5, 3, 3, 4, 5, 2, 4, 4, 4]
    k = compute_cohen_kappa_weighted(a, b)
    print(f"Kappa de Cohen ponderado (quadrático): {k}")

    # Exporta rubricas para revisão
    print("\nRúbricas disponíveis:")
    for agent, rubs in ALL_RUBRICS.items():
        print(f"  {agent}: {list(rubs.keys())}")
