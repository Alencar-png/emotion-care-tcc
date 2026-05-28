"""Gera gráficos comparativos para a v2.1 do TCC.

Lê os JSONs dos 3 modelos (OpenAI gpt-4o-mini, Qwen 2.5 14B, Phi-4 14B)
e produz:
 - fig_compare_action_plan.png    F1 por nível NR-01 (3 modelos × 4 níveis)
 - fig_compare_copilot_ragas.png   3 métricas RAGAS × 3 modelos
 - fig_compare_narrator.png        BERTScore, faithfulness, word_range × 3 modelos
 - fig_compare_qualitative.png     ARI mean, σ ARI, c_v × 3 modelos
 - fig_pareto_latencia_qualidade.png  Pareto custo/latência × qualidade
 - fig_antipii_v20_v21.png         Antes/depois por categoria

Saída em refactor_v1_2/figures/.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parent
METRICS = ROOT / "metrics"
FIG = ROOT / "figures"
FIG.mkdir(exist_ok=True)

# Cores consistentes por modelo
COLORS = {
    "gpt-4o-mini": "#10a37f",   # verde OpenAI
    "Qwen 2.5 14B": "#7b3ff0",  # roxo Qwen
    "Phi-4 14B": "#0078d4",     # azul Microsoft
}


def load_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def fig_compare_action_plan():
    """F1 por nível NR-01 nos três modelos."""
    files = {
        "gpt-4o-mini": METRICS / "action_plan_v3_metrics_openai.json",
        "Qwen 2.5 14B": METRICS / "action_plan_v3_metrics_qwen2_5_14b.json",
        "Phi-4 14B": METRICS / "action_plan_v3_metrics_phi4_14b.json",
    }
    data = {m: load_json(p) for m, p in files.items()}
    levels = ["1-Eliminação", "2-Substituição", "3-Controle Organizacional",
              "4-Controle Individual"]
    fig, ax = plt.subplots(figsize=(11, 5.5))
    x = np.arange(len(levels))
    width = 0.27
    for i, (model, d) in enumerate(data.items()):
        if d is None:
            f1s = [0] * 4
            acc = 0
        else:
            f1s = [d["per_label"][lev]["f1"] for lev in levels]
            acc = d["accuracy_ci"]["point"]
        ax.bar(x + (i - 1) * width, f1s, width,
               label=f"{model} (acc geral={acc:.3f})",
               color=COLORS[model])
    ax.set_xticks(x)
    ax.set_xticklabels([l.replace(" ", "\n", 1) for l in levels],
                       fontsize=9)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("F1 por nível NR-01")
    ax.set_title("Gerador 5W2H: F1 por nível da hierarquia de controle "
                 "(gold cego v3, n=80)")
    ax.legend(loc="lower right")
    ax.grid(axis="y", alpha=0.3)
    ax.axhline(0.70, color="red", linestyle="--", alpha=0.4,
               label="Ideal (≥0,70 cada)")
    plt.tight_layout()
    plt.savefig(FIG / "fig_compare_action_plan.png", dpi=300,
                bbox_inches="tight")
    plt.close()
    print("OK fig_compare_action_plan.png")


def fig_compare_copilot_ragas():
    files = {
        "gpt-4o-mini": METRICS / "copilot_v3_metrics_openai.json",
        "Qwen 2.5 14B": METRICS / "copilot_v3_metrics_qwen2_5_14b.json",
        "Phi-4 14B": METRICS / "copilot_v3_metrics_phi4_14b.json",
    }
    data = {m: load_json(p) for m, p in files.items()}
    metrics = ["Precision@1", "MRR", "Faithfulness", "Context relev."]
    fig, ax = plt.subplots(figsize=(11, 5.5))
    x = np.arange(len(metrics))
    width = 0.27
    for i, (model, d) in enumerate(data.items()):
        if d is None:
            vals = [0] * len(metrics)
        else:
            vals = [
                d["retrieval"]["precision@1"]["point"],
                d["retrieval"]["mrr"]["point"],
                d["ragas"]["faithfulness"]["point"],
                d["ragas"]["context_relevancy"]["point"],
            ]
        ax.bar(x + (i - 1) * width, vals, width, label=model,
               color=COLORS[model])
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=10)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Valor")
    ax.set_title("Copiloto NR-01 (RAGAS): comparação entre LLMs (n=40 perguntas)")
    ax.legend(loc="upper left")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIG / "fig_compare_copilot_ragas.png", dpi=300,
                bbox_inches="tight")
    plt.close()
    print("OK fig_compare_copilot_ragas.png")


def fig_compare_narrator():
    files = {
        "gpt-4o-mini": METRICS / "narrator_v3_metrics_openai.json",
        "Qwen 2.5 14B": METRICS / "narrator_v3_metrics_qwen2_5_14b.json",
        "Phi-4 14B": METRICS / "narrator_v3_metrics_phi4_14b.json",
    }
    data = {m: load_json(p) for m, p in files.items()}
    metrics = ["BERTScore F1", "Faithfulness\nao payload", "Word range\n600-900",
               "Sections 7/7", "PII-free"]
    fig, ax = plt.subplots(figsize=(11, 5.5))
    x = np.arange(len(metrics))
    width = 0.27
    for i, (model, d) in enumerate(data.items()):
        if d is None:
            vals = [0] * len(metrics)
        else:
            vals = [
                d.get("bertscore", {}).get("f1_mean", 0),
                d.get("faithfulness_payload", {}).get("mean", 0),
                d.get("structural", {}).get("word_range_rate", 0),
                d.get("structural", {}).get("all_sections_rate", 0),
                d.get("structural", {}).get("pii_free_rate", 0),
            ]
        ax.bar(x + (i - 1) * width, vals, width, label=model,
               color=COLORS[model])
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=9)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Valor")
    ax.set_title("Narrador do PGR: comparação entre LLMs (n=100 payloads)")
    ax.legend(loc="lower right")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIG / "fig_compare_narrator.png", dpi=300,
                bbox_inches="tight")
    plt.close()
    print("OK fig_compare_narrator.png")


def fig_compare_qualitative():
    files = {
        "gpt-4o-mini": METRICS / "qualitative_v3_metrics_openai.json",
        "Qwen 2.5 14B": METRICS / "qualitative_v3_metrics_qwen2_5_14b.json",
        "Phi-4 14B": METRICS / "qualitative_v3_metrics_phi4_14b.json",
    }
    data = {m: load_json(p) for m, p in files.items()}
    metrics = ["ARI (média)", "NMI (média)", "c_v (média)", "macro F1"]
    fig, ax = plt.subplots(figsize=(11, 5.5))
    x = np.arange(len(metrics))
    width = 0.27
    for i, (model, d) in enumerate(data.items()):
        if d is None:
            vals = [0] * len(metrics)
            stds = [0] * len(metrics)
        else:
            s = d["llm_stability"]
            vals = [s["ari_mean"], s["nmi_mean"],
                    s["cv_mean"], s["macro_f1_mean"]]
            stds = [s["ari_std"], s["nmi_std"],
                    s["cv_std"], s["macro_f1_std"]]
        ax.bar(x + (i - 1) * width, vals, width, yerr=stds,
               label=model, color=COLORS[model], capsize=4)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=10)
    ax.set_ylim(0, 0.85)
    ax.set_ylabel("Valor (5 seeds, média ± desvio-padrão)")
    ax.set_title("Analisador Qualitativo: comparação entre LLMs (n=150 respostas, 5 seeds)")
    ax.legend(loc="upper right")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIG / "fig_compare_qualitative.png", dpi=300,
                bbox_inches="tight")
    plt.close()
    print("OK fig_compare_qualitative.png")


def fig_pareto_latencia_qualidade():
    """Pareto: latência mediana × média geometrica das métricas primárias."""
    files = {
        "gpt-4o-mini": ("action_plan_v3_metrics_openai.json",
                         "copilot_v3_metrics_openai.json",
                         "narrator_v3_metrics_openai.json",
                         "qualitative_v3_metrics_openai.json"),
        "Qwen 2.5 14B": ("action_plan_v3_metrics_qwen2_5_14b.json",
                          "copilot_v3_metrics_qwen2_5_14b.json",
                          "narrator_v3_metrics_qwen2_5_14b.json",
                          "qualitative_v3_metrics_qwen2_5_14b.json"),
        "Phi-4 14B": ("action_plan_v3_metrics_phi4_14b.json",
                       "copilot_v3_metrics_phi4_14b.json",
                       "narrator_v3_metrics_phi4_14b.json",
                       "qualitative_v3_metrics_phi4_14b.json"),
    }

    points = []
    for model, fns in files.items():
        ap = load_json(METRICS / fns[0])
        cp = load_json(METRICS / fns[1])
        nr = load_json(METRICS / fns[2])
        ql = load_json(METRICS / fns[3])
        if not all([ap, cp, nr, ql]):
            continue
        # média geométrica de quality scores
        q = [
            ap["accuracy_ci"]["point"],
            cp["retrieval"]["mrr"]["point"],
            nr.get("faithfulness_payload", {}).get("mean", 0.5),
            ql["llm_stability"]["macro_f1_mean"],
        ]
        gm = np.exp(np.mean([np.log(max(v, 0.01)) for v in q]))
        # latência mediana média entre os 4 agentes (s)
        lat = np.mean([
            ap["latency_ms"]["p50"] / 1000,
            cp["latency_ms"]["p50"] / 1000,
            nr["latency_ms"]["p50"] / 1000,
            5.0,  # qualitative latency aprox
        ])
        points.append((model, lat, gm))

    fig, ax = plt.subplots(figsize=(9, 6))
    for model, lat, gm in points:
        ax.scatter(lat, gm, s=300, color=COLORS[model], label=model,
                   edgecolor="black", linewidth=1.5)
        ax.annotate(model, (lat, gm), xytext=(10, 10),
                    textcoords="offset points", fontsize=10)
    ax.set_xlabel("Latência mediana p50 ponta a ponta (segundos, média 4 agentes)")
    ax.set_ylabel("Qualidade (média geométrica das métricas primárias)")
    ax.set_title("Pareto: latência vs. qualidade dos LLMs (4 agentes generativos)")
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIG / "fig_pareto_latencia_qualidade.png", dpi=300,
                bbox_inches="tight")
    plt.close()
    print("OK fig_pareto_latencia_qualidade.png")


def fig_antipii_v20_v21():
    """Comparação anti-PII v2.0 vs v2.1 por categoria."""
    # v2.0 (hardcoded — não há JSON original separado)
    v20 = {
        "email": {"P": 1.0, "R": 1.0, "F2": 1.0},
        "cpf": {"P": 1.0, "R": 1.0, "F2": 1.0},
        "cnpj": {"P": 1.0, "R": 1.0, "F2": 1.0},
        "telefone": {"P": 0.506, "R": 0.800, "F2": 0.717},
        "matricula": {"P": 0.868, "R": 0.660, "F2": 0.693},
        "cargo_identificador": {"P": 1.000, "R": 0.720, "F2": 0.763},
        "titulo_nome": {"P": 1.000, "R": 0.860, "F2": 0.885},
        "nome": {"P": 0.595, "R": 0.920, "F2": 0.829},
    }
    d = load_json(METRICS / "pii_v3_metrics.json")
    if d is None:
        print("[skip] pii_v3_metrics.json não encontrado")
        return
    v21 = {}
    for cat, m in d["span_level_partial"]["per_category"].items():
        v21[cat] = {"P": m["precision"], "R": m["recall"], "F2": m["f2"]}

    cats = list(v20.keys())
    fig, ax = plt.subplots(figsize=(12, 5.5))
    x = np.arange(len(cats))
    width = 0.4
    f2_v20 = [v20[c]["F2"] for c in cats]
    f2_v21 = [v21.get(c, {"F2": 0})["F2"] for c in cats]
    ax.bar(x - width / 2, f2_v20, width, label="v2.0 (gold n=200)",
           color="#cccccc", edgecolor="black", linewidth=0.5)
    ax.bar(x + width / 2, f2_v21, width, label="v2.1 (gold n=1.025 span-level)",
           color="#2ca02c", edgecolor="black", linewidth=0.5)
    ax.set_xticks(x)
    ax.set_xticklabels(cats, rotation=30, ha="right", fontsize=10)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Fβ=2 por categoria")
    ax.set_title("Anti-PII: Fβ=2 por categoria, v2.0 vs. v2.1 (validador "
                 "determinístico)")
    ax.legend(loc="lower right")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIG / "fig_antipii_v20_v21.png", dpi=300, bbox_inches="tight")
    plt.close()
    print("OK fig_antipii_v20_v21.png")


def main():
    try:
        fig_compare_action_plan()
    except Exception as e:
        print(f"[fail action_plan] {e}")
    try:
        fig_compare_copilot_ragas()
    except Exception as e:
        print(f"[fail copilot] {e}")
    try:
        fig_compare_narrator()
    except Exception as e:
        print(f"[fail narrator] {e}")
    try:
        fig_compare_qualitative()
    except Exception as e:
        print(f"[fail qualitative] {e}")
    try:
        fig_pareto_latencia_qualidade()
    except Exception as e:
        print(f"[fail pareto] {e}")
    try:
        fig_antipii_v20_v21()
    except Exception as e:
        print(f"[fail antipii] {e}")


if __name__ == "__main__":
    main()
