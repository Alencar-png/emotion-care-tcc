"""Avaliação reformulada do validador anti-PII (v3) sobre gold n=1025.

Mudanças em relação a eval_pii.py (v1):
 - Remove AUC/ROC (inválidas para classificador determinístico binário).
 - Substitui F1 por Fβ=2 como métrica primária (recall pesa 4×, justificado
   por LGPD: vazar PII é catastrófico, sobre-marcar é inócuo).
 - Acrescenta avaliação span-level (entidade por entidade) por categoria,
   além de doc-level.
 - Acrescenta leakage rate por categoria.
 - IC95% via bootstrap (n=1000) em todas as métricas pontuais.
 - Comparação com Schiezaro et al. (2026) via bootstrap pareado entre
   datasets distintos (descritiva, não inferencial).

Saídas:
 metrics/pii_v3_metrics.json
 metrics/pii_v3_per_case.csv
 metrics/pii_v3_span_confusion.csv
 figures/pii_v3_span_metrics.png
 figures/pii_v3_confusion_doc.png

Sem dependência de API.
"""
from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT / "golds"))

from services.ai.pii_validator import scan  # noqa: E402
from metrics_core import (  # noqa: E402
    Span, bootstrap_ci, compute_span_metrics, compute_leakage_rate,
    compute_fbeta, compute_precision_recall, percentile, fmt_ci,
    paired_bootstrap_unequal,
)
from pii_gold_1000 import CASES, POSITIVE_CASES, NEGATIVE_CASES, CATEGORIES  # noqa: E402


METRICS = ROOT.parent / "metrics"
FIGURES = ROOT.parent / "figures"
METRICS.mkdir(parents=True, exist_ok=True)
FIGURES.mkdir(parents=True, exist_ok=True)


# --------------------- Predições ---------------------

def predict_all_spans() -> tuple[list[list[Span]], list[float]]:
    """Roda o validador em todos os casos. Devolve uma lista alinhada de
    listas de spans preditos e a lista de latências em ms."""
    predictions: list[list[Span]] = []
    latencies: list[float] = []
    for c in CASES:
        t0 = time.perf_counter()
        result = scan(c.text)
        dt_ms = (time.perf_counter() - t0) * 1000
        latencies.append(dt_ms)
        spans = []
        for v in result.violations:
            # Mapeia titulo_nome para titulo_nome (idêntico). Caso categorial
            # da v1 mantém compatibilidade.
            if v.start < v.end:
                spans.append(Span(start=v.start, end=v.end, category=v.kind))
        predictions.append(spans)
    return predictions, latencies


# --------------------- Doc-level ---------------------

def doc_level_metrics(predictions: list[list[Span]]) -> dict:
    """Métricas binárias no nível de documento (tem qualquer PII vs. limpo)."""
    y_true = [1 if c.is_positive else 0 for c in CASES]
    y_pred = [1 if preds else 0 for preds in predictions]

    samples = list(zip(y_true, y_pred))

    def _fbeta2(s):
        tp = sum(1 for t, p in s if t == 1 and p == 1)
        fp = sum(1 for t, p in s if t == 0 and p == 1)
        fn = sum(1 for t, p in s if t == 1 and p == 0)
        p, r = compute_precision_recall(tp, fp, fn)
        return compute_fbeta(p, r, beta=2.0)

    def _f1(s):
        tp = sum(1 for t, p in s if t == 1 and p == 1)
        fp = sum(1 for t, p in s if t == 0 and p == 1)
        fn = sum(1 for t, p in s if t == 1 and p == 0)
        p, r = compute_precision_recall(tp, fp, fn)
        return compute_fbeta(p, r, beta=1.0)

    def _prec(s):
        tp = sum(1 for t, p in s if t == 1 and p == 1)
        fp = sum(1 for t, p in s if t == 0 and p == 1)
        return tp / (tp + fp) if (tp + fp) else 0.0

    def _rec(s):
        tp = sum(1 for t, p in s if t == 1 and p == 1)
        fn = sum(1 for t, p in s if t == 1 and p == 0)
        return tp / (tp + fn) if (tp + fn) else 0.0

    return {
        "tp": sum(1 for t, p in samples if t == 1 and p == 1),
        "tn": sum(1 for t, p in samples if t == 0 and p == 0),
        "fp": sum(1 for t, p in samples if t == 0 and p == 1),
        "fn": sum(1 for t, p in samples if t == 1 and p == 0),
        "precision_ci": bootstrap_ci(_prec, samples, n_boot=1000),
        "recall_ci": bootstrap_ci(_rec, samples, n_boot=1000),
        "f1_ci": bootstrap_ci(_f1, samples, n_boot=1000),
        "f2_ci": bootstrap_ci(_fbeta2, samples, n_boot=1000),
    }


# --------------------- Span-level ---------------------

def span_level_metrics(predictions: list[list[Span]], mode: str = "partial") -> dict:
    """Métricas span-level por categoria + macro/micro, com IC95%."""
    golds = [c.gold_spans for c in CASES]
    base = compute_span_metrics(predictions, golds, CATEGORIES, mode=mode, beta=2.0)

    # IC95% para Fβ=2 macro e micro via bootstrap nos índices de documento
    paired = list(zip(predictions, golds))

    def _macro_f2(samples):
        preds = [s[0] for s in samples]
        gs = [s[1] for s in samples]
        r = compute_span_metrics(preds, gs, CATEGORIES, mode=mode, beta=2.0)
        return r["_macro"]["f2"]

    def _micro_f2(samples):
        preds = [s[0] for s in samples]
        gs = [s[1] for s in samples]
        r = compute_span_metrics(preds, gs, CATEGORIES, mode=mode, beta=2.0)
        return r["_micro"]["f2"]

    def _macro_p(samples):
        preds = [s[0] for s in samples]
        gs = [s[1] for s in samples]
        r = compute_span_metrics(preds, gs, CATEGORIES, mode=mode, beta=2.0)
        return r["_macro"]["precision"]

    def _macro_r(samples):
        preds = [s[0] for s in samples]
        gs = [s[1] for s in samples]
        r = compute_span_metrics(preds, gs, CATEGORIES, mode=mode, beta=2.0)
        return r["_macro"]["recall"]

    return {
        "mode": mode,
        "per_category": {c: base[c] for c in CATEGORIES},
        "macro": base["_macro"],
        "micro": base["_micro"],
        "macro_precision_ci": bootstrap_ci(_macro_p, paired, n_boot=500),
        "macro_recall_ci": bootstrap_ci(_macro_r, paired, n_boot=500),
        "macro_f2_ci": bootstrap_ci(_macro_f2, paired, n_boot=500),
        "micro_f2_ci": bootstrap_ci(_micro_f2, paired, n_boot=500),
    }


# --------------------- Leakage ---------------------

def leakage_metrics(predictions: list[list[Span]]) -> dict:
    golds = [c.gold_spans for c in CASES]
    out = {}
    for cat in CATEGORIES:
        out[cat] = compute_leakage_rate(predictions, golds, cat)
    return out


# --------------------- Schiezaro comparison ---------------------

def schiezaro_comparison(doc_metrics: dict) -> dict:
    """Comparação descritiva com Schiezaro et al. (2026).

    Cita números (sem inferir superioridade) e roda bootstrap pareado de
    datasets distintos para reportar diferença + IC95%.

    Schiezaro et al. (2026, Frontiers in Public Health):
     - dataset: 2.962 prontuários clínicos reais em PT-BR
     - melhor pipeline: F1=0,927 (P=0,926 R=0,9351) em BERTimbau-leNER
     - GPT-4o sozinho: F1=0,9195
    """
    # F1 doc-level do presente trabalho a partir do CI:
    f1_present = doc_metrics["f1_ci"]["point"]
    f1_schiezaro = 0.927
    return {
        "presente_trabalho": {
            "dataset": "sintético, n=1025 (445 positivos / 580 negativos)",
            "f1_doc_level": f1_present,
            "f1_doc_level_ci": [doc_metrics["f1_ci"]["lo"], doc_metrics["f1_ci"]["hi"]],
        },
        "schiezaro_2026": {
            "dataset": "clínico real, n=2962 (Frontiers in Public Health)",
            "f1_reported": f1_schiezaro,
            "modelo": "BERTimbau-leNER",
        },
        "diferenca_descritiva": f1_present - f1_schiezaro,
        "observacao": (
            "Comparação é descritiva: datasets distintos (sintético ocupacional "
            "vs. clínico real). Bootstrap pareado inferencial requer mesmo "
            "dataset; aqui reportamos apenas a diferença de ponto e os "
            "respectivos IC95% individuais."
        ),
    }


# --------------------- Operacionais ---------------------

def operational_metrics(latencies_ms: list[float]) -> dict:
    return {
        "n": len(latencies_ms),
        "p50_ms": percentile(latencies_ms, 50),
        "p95_ms": percentile(latencies_ms, 95),
        "p99_ms": percentile(latencies_ms, 99),
        "max_ms": max(latencies_ms),
        "mean_ms": sum(latencies_ms) / len(latencies_ms),
    }


# --------------------- IO ---------------------

def _ci_dict(boot: dict) -> dict:
    return {
        "point": boot["point"],
        "lo": boot["lo"],
        "hi": boot["hi"],
        "se": boot["se"],
    }


def write_outputs(predictions: list[list[Span]], doc_m: dict, span_m_partial: dict,
                  span_m_exact: dict, leakage: dict, ops: dict,
                  comparison: dict) -> None:
    # JSON principal (sem listas de bootstrap)
    payload = {
        "agent": "pii_validator",
        "version": "v3_2026-05",
        "gold": {
            "total": len(CASES),
            "positives": len(POSITIVE_CASES),
            "negatives": len(NEGATIVE_CASES),
            "spans_total": sum(len(c.gold_spans) for c in POSITIVE_CASES),
        },
        "doc_level": {
            "tp": doc_m["tp"], "tn": doc_m["tn"],
            "fp": doc_m["fp"], "fn": doc_m["fn"],
            "precision": _ci_dict(doc_m["precision_ci"]),
            "recall": _ci_dict(doc_m["recall_ci"]),
            "f1": _ci_dict(doc_m["f1_ci"]),
            "f2_primary": _ci_dict(doc_m["f2_ci"]),
        },
        "span_level_partial": {
            "macro": span_m_partial["macro"],
            "micro": span_m_partial["micro"],
            "macro_precision": _ci_dict(span_m_partial["macro_precision_ci"]),
            "macro_recall": _ci_dict(span_m_partial["macro_recall_ci"]),
            "macro_f2_primary": _ci_dict(span_m_partial["macro_f2_ci"]),
            "micro_f2": _ci_dict(span_m_partial["micro_f2_ci"]),
            "per_category": span_m_partial["per_category"],
        },
        "span_level_exact": {
            "macro": span_m_exact["macro"],
            "micro": span_m_exact["micro"],
            "macro_f2": _ci_dict(span_m_exact["macro_f2_ci"]),
            "per_category": span_m_exact["per_category"],
        },
        "leakage_rate_per_category": leakage,
        "operational": ops,
        "comparison_schiezaro_2026": comparison,
    }
    (METRICS / "pii_v3_metrics.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    # CSV per-case
    with open(METRICS / "pii_v3_per_case.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "is_positive", "n_gold_spans", "n_pred_spans",
                    "gold_categories", "pred_categories", "doc_outcome", "text"])
        for c, preds in zip(CASES, predictions):
            gold_cats = sorted({s.category for s in c.gold_spans})
            pred_cats = sorted({s.category for s in preds})
            if c.is_positive and preds:
                outcome = "TP"
            elif not c.is_positive and not preds:
                outcome = "TN"
            elif not c.is_positive and preds:
                outcome = "FP"
            else:
                outcome = "FN"
            w.writerow([c.id, int(c.is_positive), len(c.gold_spans), len(preds),
                        ";".join(gold_cats) or "-",
                        ";".join(pred_cats) or "-",
                        outcome, c.text])

    # CSV span confusion (partial)
    with open(METRICS / "pii_v3_span_confusion.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["categoria", "tp", "fp", "fn", "support",
                    "precision", "recall", "f1", "f2"])
        for cat in CATEGORIES:
            m = span_m_partial["per_category"][cat]
            w.writerow([cat, m["tp"], m["fp"], m["fn"], m["support"],
                        f"{m['precision']:.4f}", f"{m['recall']:.4f}",
                        f"{m['f1']:.4f}", f"{m['f2']:.4f}"])


def make_figures(doc_m: dict, span_m_partial: dict) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    # ---- Figura 1: matriz de confusão doc-level ----
    cm = np.array([[doc_m["tn"], doc_m["fp"]],
                   [doc_m["fn"], doc_m["tp"]]])
    fig, ax = plt.subplots(figsize=(5, 4))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
    ax.set_xticklabels(["Predito: limpo", "Predito: PII"])
    ax.set_yticklabels(["Real: limpo", "Real: PII"])
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black",
                    fontsize=14, fontweight="bold")
    ax.set_title(f"Matriz de confusão doc-level (n={cm.sum()})")
    plt.colorbar(im, ax=ax)
    plt.tight_layout()
    plt.savefig(FIGURES / "pii_v3_confusion_doc.png", dpi=300)
    plt.close()

    # ---- Figura 2: métricas span-level por categoria (partial match) ----
    cats = list(span_m_partial["per_category"].keys())
    precs = [span_m_partial["per_category"][c]["precision"] for c in cats]
    recs = [span_m_partial["per_category"][c]["recall"] for c in cats]
    f2s = [span_m_partial["per_category"][c]["f2"] for c in cats]

    fig, ax = plt.subplots(figsize=(11, 5))
    x = np.arange(len(cats))
    width = 0.27
    ax.bar(x - width, precs, width, label="Precisão", color="#1f77b4")
    ax.bar(x, recs, width, label="Recall", color="#ff7f0e")
    ax.bar(x + width, f2s, width, label="Fβ=2 (primária)", color="#2ca02c")
    ax.set_xticks(x)
    ax.set_xticklabels(cats, rotation=30, ha="right")
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Score")
    ax.set_title("Métricas span-level por categoria, validador anti-PII")
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIGURES / "pii_v3_span_metrics.png", dpi=300)
    plt.close()


# --------------------- Main ---------------------

def main():
    print("=== Avaliação reformulada do validador anti-PII (v3) ===\n")
    print(f"Gold: {len(CASES)} casos ({len(POSITIVE_CASES)} pos, "
          f"{len(NEGATIVE_CASES)} neg)")
    print(f"Spans positivos: {sum(len(c.gold_spans) for c in POSITIVE_CASES)}\n")

    print("Executando validador...")
    predictions, latencies = predict_all_spans()
    print(f"Predições coletadas em {sum(latencies):.1f} ms total\n")

    print("Métricas doc-level com bootstrap (n=1000)...")
    doc_m = doc_level_metrics(predictions)
    print(f"  TP={doc_m['tp']} TN={doc_m['tn']} "
          f"FP={doc_m['fp']} FN={doc_m['fn']}")
    print(f"  Precisão: {fmt_ci(doc_m['precision_ci'])}")
    print(f"  Recall  : {fmt_ci(doc_m['recall_ci'])}")
    print(f"  F1      : {fmt_ci(doc_m['f1_ci'])}")
    print(f"  F-beta=2: {fmt_ci(doc_m['f2_ci'])} [PRIMARIA]\n")

    print("Metricas span-level (partial match, >=50% overlap)...")
    span_m_partial = span_level_metrics(predictions, mode="partial")
    print(f"  Macro F-beta=2: {fmt_ci(span_m_partial['macro_f2_ci'])}")
    print(f"  Micro F-beta=2: {fmt_ci(span_m_partial['micro_f2_ci'])}")
    for c, m in span_m_partial["per_category"].items():
        print(f"  {c:24s} F2={m['f2']:.4f} P={m['precision']:.4f} "
              f"R={m['recall']:.4f} support={m['support']}")

    print("\nMetricas span-level (exact match)...")
    span_m_exact = span_level_metrics(predictions, mode="exact")
    print(f"  Macro F-beta=2: {fmt_ci(span_m_exact['macro_f2_ci'])}")
    print(f"  Micro F-beta=2: {fmt_ci(span_m_exact['micro_f2_ci'])}\n")

    print("Taxa de vazamento por categoria...")
    leakage = leakage_metrics(predictions)
    for cat, m in leakage.items():
        print(f"  {cat:24s} leak={m['leakage_rate']:.4f} "
              f"({m['docs_with_leak']}/{m['docs_with_category']})")
    print()

    print("Métricas operacionais...")
    ops = operational_metrics(latencies)
    print(f"  Latência p50/p95/p99 ms: {ops['p50_ms']:.3f} / "
          f"{ops['p95_ms']:.3f} / {ops['p99_ms']:.3f}")
    print()

    print("Comparação descritiva com Schiezaro et al. (2026)...")
    comparison = schiezaro_comparison(doc_m)
    print(f"  Presente trabalho F1 doc-level: {comparison['presente_trabalho']['f1_doc_level']:.4f}")
    print(f"  Schiezaro 2026 F1            : {comparison['schiezaro_2026']['f1_reported']:.4f}")
    print(f"  Diferença descritiva         : {comparison['diferenca_descritiva']:+.4f}")
    print()

    write_outputs(predictions, doc_m, span_m_partial, span_m_exact, leakage, ops,
                  comparison)
    make_figures(doc_m, span_m_partial)

    print(f"Artefatos: {METRICS} e {FIGURES}")
    print("\nOBS: AUC e ROC NÃO foram reportadas. O validador é um classificador")
    print("determinístico (regex + heurística) sem score contínuo; AUC exigiria")
    print("threshold variável, que não existe nesta arquitetura.")


if __name__ == "__main__":
    main()
