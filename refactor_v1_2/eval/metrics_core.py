"""Núcleo de métricas reutilizáveis para a avaliação dos cinco agentes.

Implementa:
 - bootstrap_ci: intervalo de confiança 95% via bootstrap não-paramétrico
   (Efron e Tibshirani, 1993), reamostragem com reposição (n=1000 por padrão)
 - paired_bootstrap_test: teste pareado de diferença de duas métricas sobre
   o mesmo dataset; retorna p-valor bicaudal
 - paired_bootstrap_unequal: teste pareado quando os datasets diferem;
   reamostra cada um internamente e compara as estatísticas
 - compute_fbeta: F-beta com beta configurável (Fβ=2 dá 4x mais peso ao
   recall, justificado para anonimização em LGPD onde FN é catastrófico)
 - compute_span_metrics: precisão/recall/Fβ no nível de span (entidade
   por entidade), com suporte a match exato e match parcial (>= 50% de
   sobreposição de offsets)
 - compute_leakage_rate: fração de documentos que continham PII de uma
   categoria e tiveram pelo menos uma entidade da categoria escapando
 - mcnemar_paired: teste de McNemar para dois sistemas binários sobre
   o mesmo dataset

Sem dependência de API. Determinístico via random_state.
"""
from __future__ import annotations

import math
import random
from collections import Counter
from dataclasses import dataclass
from typing import Callable, Iterable, Sequence


# -------------------- Métricas pontuais base --------------------

def compute_precision_recall(tp: int, fp: int, fn: int) -> tuple[float, float]:
    p = tp / (tp + fp) if (tp + fp) else 0.0
    r = tp / (tp + fn) if (tp + fn) else 0.0
    return p, r


def compute_fbeta(precision: float, recall: float, beta: float = 1.0) -> float:
    """F-beta = (1+β²) * P * R / (β² * P + R).

    β=1: F1 padrão (precisão e recall com peso igual).
    β=2: F2, recall pesa 4× mais que precisão. Recomendado para detecção de
       PII em LGPD: vazar dado pessoal (FN) é catastrófico; sobre-marcar
       (FP) é inócuo (Manning, Raghavan, Schütze, 2008, cap. 8).
    β=0,5: F0.5, precisão pesa 4× mais que recall.
    """
    if precision == 0.0 and recall == 0.0:
        return 0.0
    b2 = beta * beta
    num = (1 + b2) * precision * recall
    den = b2 * precision + recall
    return num / den if den else 0.0


# -------------------- Bootstrap --------------------

def bootstrap_ci(
    metric_fn: Callable[[Sequence], float],
    samples: Sequence,
    n_boot: int = 1000,
    alpha: float = 0.05,
    random_state: int = 42,
) -> dict:
    """Calcula ponto + IC95% via bootstrap não-paramétrico.

    Args:
        metric_fn: função que recebe uma sequência de amostras e devolve um float.
            Para classificação binária, cada amostra pode ser um dict
            {"y_true": 0/1, "y_pred": 0/1}; a metric_fn deve agregar.
        samples: lista de unidades observacionais (ex.: documentos do gold).
        n_boot: número de reamostragens com reposição.
        alpha: 0,05 → IC95%.
        random_state: seed para reprodutibilidade.

    Returns:
        {"point": ponto sobre todos os dados,
         "lo": percentil inferior, "hi": percentil superior,
         "se": desvio-padrão das reamostragens,
         "boot_values": lista de valores reamostrados}
    """
    rng = random.Random(random_state)
    n = len(samples)
    point = metric_fn(samples)
    values: list[float] = []
    for _ in range(n_boot):
        idx = [rng.randrange(n) for _ in range(n)]
        resample = [samples[i] for i in idx]
        try:
            v = metric_fn(resample)
        except Exception:
            v = float("nan")
        if not math.isnan(v):
            values.append(v)
    values.sort()
    if not values:
        return {"point": point, "lo": float("nan"), "hi": float("nan"),
                "se": float("nan"), "boot_values": []}
    lo_idx = int(math.floor((alpha / 2) * len(values)))
    hi_idx = int(math.ceil((1 - alpha / 2) * len(values))) - 1
    lo_idx = max(0, min(lo_idx, len(values) - 1))
    hi_idx = max(0, min(hi_idx, len(values) - 1))
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / max(1, len(values) - 1)
    se = math.sqrt(var)
    return {
        "point": point,
        "lo": values[lo_idx],
        "hi": values[hi_idx],
        "se": se,
        "boot_values": values,
    }


def paired_bootstrap_test(
    sys_a_outputs: Sequence,
    sys_b_outputs: Sequence,
    gold: Sequence,
    metric_fn: Callable[[Sequence, Sequence], float],
    n_boot: int = 1000,
    random_state: int = 42,
) -> dict:
    """Teste pareado de diferença entre dois sistemas sobre o mesmo dataset.

    metric_fn(predictions, gold) -> float

    H0: metric(A) = metric(B). p-valor bicaudal aproximado pela fração de
    reamostragens em que sign(diff_boot) discorda de sign(diff_observed).
    """
    assert len(sys_a_outputs) == len(sys_b_outputs) == len(gold)
    rng = random.Random(random_state)
    n = len(gold)
    obs_a = metric_fn(sys_a_outputs, gold)
    obs_b = metric_fn(sys_b_outputs, gold)
    obs_diff = obs_a - obs_b

    diffs: list[float] = []
    for _ in range(n_boot):
        idx = [rng.randrange(n) for _ in range(n)]
        a_resample = [sys_a_outputs[i] for i in idx]
        b_resample = [sys_b_outputs[i] for i in idx]
        g_resample = [gold[i] for i in idx]
        try:
            d = metric_fn(a_resample, g_resample) - metric_fn(b_resample, g_resample)
            diffs.append(d)
        except Exception:
            continue

    if not diffs:
        return {"obs_a": obs_a, "obs_b": obs_b, "obs_diff": obs_diff,
                "p_value": float("nan"), "n_boot": 0}

    # p-valor bicaudal: fração de diffs com sinal contrário ao observado
    if obs_diff > 0:
        more_extreme = sum(1 for d in diffs if d <= 0)
    elif obs_diff < 0:
        more_extreme = sum(1 for d in diffs if d >= 0)
    else:
        more_extreme = len(diffs) // 2
    p = 2 * more_extreme / len(diffs)
    p = min(1.0, max(0.0, p))

    diffs.sort()
    lo = diffs[int(0.025 * len(diffs))]
    hi = diffs[int(0.975 * len(diffs)) - 1]

    return {
        "obs_a": obs_a, "obs_b": obs_b, "obs_diff": obs_diff,
        "p_value": p, "diff_ci_lo": lo, "diff_ci_hi": hi,
        "n_boot": len(diffs),
    }


def paired_bootstrap_unequal(
    sys_a_samples: Sequence,
    sys_b_samples: Sequence,
    metric_fn: Callable[[Sequence], float],
    n_boot: int = 1000,
    random_state: int = 42,
) -> dict:
    """Bootstrap pareado quando os datasets têm tamanhos diferentes.

    Reamostra independentemente cada sistema, compara as estatísticas.
    Útil para comparar o presente trabalho (n=200 sintéticos) contra
    a literatura (n=2962 clínicos), por exemplo.
    """
    rng = random.Random(random_state)
    na, nb = len(sys_a_samples), len(sys_b_samples)
    obs_a = metric_fn(sys_a_samples)
    obs_b = metric_fn(sys_b_samples)
    obs_diff = obs_a - obs_b

    diffs: list[float] = []
    for _ in range(n_boot):
        a_resample = [sys_a_samples[rng.randrange(na)] for _ in range(na)]
        b_resample = [sys_b_samples[rng.randrange(nb)] for _ in range(nb)]
        try:
            d = metric_fn(a_resample) - metric_fn(b_resample)
            diffs.append(d)
        except Exception:
            continue

    if not diffs:
        return {"obs_a": obs_a, "obs_b": obs_b, "obs_diff": obs_diff,
                "p_value": float("nan")}

    if obs_diff > 0:
        more_extreme = sum(1 for d in diffs if d <= 0)
    elif obs_diff < 0:
        more_extreme = sum(1 for d in diffs if d >= 0)
    else:
        more_extreme = len(diffs) // 2
    p = 2 * more_extreme / len(diffs)
    p = min(1.0, max(0.0, p))

    return {
        "obs_a": obs_a, "obs_b": obs_b, "obs_diff": obs_diff,
        "p_value": p, "n_boot": len(diffs),
    }


# -------------------- McNemar --------------------

def mcnemar_paired(
    correct_a: Sequence[bool],
    correct_b: Sequence[bool],
    continuity_correction: bool = True,
) -> dict:
    """Teste de McNemar pareado para dois classificadores binários sobre o
    mesmo dataset.

    H0: P(A acerta, B erra) = P(A erra, B acerta).
    Útil para comparar a presente arquitetura vs. baseline em mesmo dataset.

    Estatística: (|b - c| - 0,5)^2 / (b + c) ~ χ² com 1 grau de liberdade.
    """
    assert len(correct_a) == len(correct_b)
    b = sum(1 for a, b_ in zip(correct_a, correct_b) if a and not b_)
    c = sum(1 for a, b_ in zip(correct_a, correct_b) if not a and b_)
    if b + c == 0:
        return {"b": b, "c": c, "chi2": 0.0, "p_value": 1.0}
    if continuity_correction:
        chi2 = (abs(b - c) - 0.5) ** 2 / (b + c)
    else:
        chi2 = (b - c) ** 2 / (b + c)
    # p-valor aproximado de χ² com 1 grau de liberdade (cdf via erf):
    # p = 1 - erf(sqrt(chi2/2))
    p = 1.0 - math.erf(math.sqrt(chi2 / 2.0))
    return {"b": b, "c": c, "chi2": chi2, "p_value": p}


# -------------------- Span-level metrics --------------------

@dataclass(frozen=True)
class Span:
    """Span de entidade com offsets fechados-abertos: [start, end)."""
    start: int
    end: int
    category: str

    def __post_init__(self):
        assert self.start < self.end, f"Span vazio: [{self.start}, {self.end})"


def spans_overlap(a: Span, b: Span) -> int:
    """Tamanho da sobreposição em caracteres (0 se não há)."""
    return max(0, min(a.end, b.end) - max(a.start, b.start))


def span_matches(
    pred: Span,
    gold: Span,
    mode: str = "exact",
    min_overlap_ratio: float = 0.5,
) -> bool:
    """Decide se um span predito casa com um span do gold.

    Args:
        mode: "exact" exige offsets e categoria iguais;
              "partial" aceita >= min_overlap_ratio de sobreposição
              relativa ao MENOR dos dois spans (definição NER padrão).
    """
    if pred.category != gold.category:
        return False
    if mode == "exact":
        return pred.start == gold.start and pred.end == gold.end
    overlap = spans_overlap(pred, gold)
    if overlap == 0:
        return False
    min_len = min(pred.end - pred.start, gold.end - gold.start)
    return (overlap / min_len) >= min_overlap_ratio


def compute_span_metrics(
    predictions_per_doc: Sequence[Sequence[Span]],
    gold_per_doc: Sequence[Sequence[Span]],
    categories: Sequence[str],
    mode: str = "partial",
    beta: float = 2.0,
) -> dict:
    """Calcula precisão/recall/Fβ no nível de span, por categoria e macro.

    Cada documento tem uma lista de spans preditos e uma lista de spans gold.
    Conta TP/FP/FN ao tentar casar cada gold com algum predito (matching
    greedy: cada gold consome no máximo um predito).
    """
    assert len(predictions_per_doc) == len(gold_per_doc)
    per_cat = {c: {"tp": 0, "fp": 0, "fn": 0} for c in categories}

    for preds, golds in zip(predictions_per_doc, gold_per_doc):
        preds_remaining = list(preds)
        for g in golds:
            matched_idx = None
            for i, p in enumerate(preds_remaining):
                if span_matches(p, g, mode=mode):
                    matched_idx = i
                    break
            if matched_idx is not None:
                per_cat[g.category]["tp"] += 1
                preds_remaining.pop(matched_idx)
            else:
                per_cat[g.category]["fn"] += 1
        for p in preds_remaining:
            if p.category in per_cat:
                per_cat[p.category]["fp"] += 1

    results = {}
    macro_p_sum = macro_r_sum = macro_f_sum = 0.0
    n_cat_with_support = 0
    for c, counts in per_cat.items():
        p, r = compute_precision_recall(counts["tp"], counts["fp"], counts["fn"])
        fbeta = compute_fbeta(p, r, beta=beta)
        f1 = compute_fbeta(p, r, beta=1.0)
        support = counts["tp"] + counts["fn"]
        results[c] = {
            **counts,
            "support": support,
            "precision": p,
            "recall": r,
            "f1": f1,
            f"f{beta:.0f}": fbeta,
        }
        if support > 0:
            macro_p_sum += p
            macro_r_sum += r
            macro_f_sum += fbeta
            n_cat_with_support += 1

    n = max(1, n_cat_with_support)
    results["_macro"] = {
        "precision": macro_p_sum / n,
        "recall": macro_r_sum / n,
        f"f{beta:.0f}": macro_f_sum / n,
        "n_categories": n_cat_with_support,
    }

    # micro: agrega TP/FP/FN
    micro_tp = sum(per_cat[c]["tp"] for c in categories)
    micro_fp = sum(per_cat[c]["fp"] for c in categories)
    micro_fn = sum(per_cat[c]["fn"] for c in categories)
    mp, mr = compute_precision_recall(micro_tp, micro_fp, micro_fn)
    results["_micro"] = {
        "tp": micro_tp, "fp": micro_fp, "fn": micro_fn,
        "precision": mp,
        "recall": mr,
        f"f{beta:.0f}": compute_fbeta(mp, mr, beta=beta),
        "f1": compute_fbeta(mp, mr, beta=1.0),
    }
    return results


# -------------------- Leakage rate --------------------

def compute_leakage_rate(
    predictions_per_doc: Sequence[Sequence[Span]],
    gold_per_doc: Sequence[Sequence[Span]],
    category: str,
) -> dict:
    """Taxa de vazamento por categoria.

    Definição: fração de documentos que continham pelo menos um span da
    categoria no gold E não tiveram TODOS os spans dessa categoria
    detectados (i.e., pelo menos um vazou para a saída).

    Retorna (num_docs_com_categoria, num_docs_com_vazamento, taxa).
    """
    docs_with_cat = 0
    docs_with_leak = 0
    for preds, golds in zip(predictions_per_doc, gold_per_doc):
        gold_cat = [g for g in golds if g.category == category]
        if not gold_cat:
            continue
        docs_with_cat += 1
        preds_cat = [p for p in preds if p.category == category]
        # Vazamento: existe um gold da categoria que não foi casado por
        # nenhum span predito.
        any_leaked = False
        preds_remaining = list(preds_cat)
        for g in gold_cat:
            matched = None
            for i, p in enumerate(preds_remaining):
                if span_matches(p, g, mode="partial"):
                    matched = i
                    break
            if matched is None:
                any_leaked = True
                break
            preds_remaining.pop(matched)
        if any_leaked:
            docs_with_leak += 1
    rate = docs_with_leak / docs_with_cat if docs_with_cat else 0.0
    return {
        "category": category,
        "docs_with_category": docs_with_cat,
        "docs_with_leak": docs_with_leak,
        "leakage_rate": rate,
    }


# -------------------- Helpers de classificação binária / multi-classe --------------------

def binary_confusion(y_true: Sequence[int], y_pred: Sequence[int]) -> dict:
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    return {"tp": tp, "tn": tn, "fp": fp, "fn": fn}


def binary_metrics(y_true: Sequence[int], y_pred: Sequence[int],
                   beta: float = 2.0) -> dict:
    cm = binary_confusion(y_true, y_pred)
    p, r = compute_precision_recall(cm["tp"], cm["fp"], cm["fn"])
    return {
        **cm,
        "precision": p,
        "recall": r,
        "f1": compute_fbeta(p, r, 1.0),
        f"f{beta:.0f}": compute_fbeta(p, r, beta),
    }


def multiclass_confusion(
    y_true: Sequence[str], y_pred: Sequence[str], labels: Sequence[str]
) -> dict[str, dict[str, int]]:
    """Matriz de confusão como dict[true][pred] = count."""
    cm: dict[str, dict[str, int]] = {a: {b: 0 for b in labels} for a in labels}
    for t, p in zip(y_true, y_pred):
        if t in cm and p in cm[t]:
            cm[t][p] += 1
    return cm


def multiclass_metrics(
    y_true: Sequence[str], y_pred: Sequence[str], labels: Sequence[str],
    average: str = "macro",
) -> dict:
    cm = multiclass_confusion(y_true, y_pred, labels)
    per_label = {}
    for lab in labels:
        tp = cm[lab][lab]
        fp = sum(cm[other][lab] for other in labels if other != lab)
        fn = sum(cm[lab][other] for other in labels if other != lab)
        p, r = compute_precision_recall(tp, fp, fn)
        per_label[lab] = {
            "tp": tp, "fp": fp, "fn": fn,
            "precision": p, "recall": r,
            "f1": compute_fbeta(p, r, 1.0),
            "support": sum(cm[lab].values()),
        }
    correct = sum(cm[lab][lab] for lab in labels)
    total = len(y_true)
    acc = correct / total if total else 0.0

    if average == "macro":
        macro_p = sum(per_label[l]["precision"] for l in labels) / len(labels)
        macro_r = sum(per_label[l]["recall"] for l in labels) / len(labels)
        macro_f = sum(per_label[l]["f1"] for l in labels) / len(labels)
        agg = {"precision": macro_p, "recall": macro_r, "f1": macro_f}
    elif average == "weighted":
        total_sup = sum(per_label[l]["support"] for l in labels) or 1
        w_p = sum(per_label[l]["precision"] * per_label[l]["support"]
                  for l in labels) / total_sup
        w_r = sum(per_label[l]["recall"] * per_label[l]["support"]
                  for l in labels) / total_sup
        w_f = sum(per_label[l]["f1"] * per_label[l]["support"]
                  for l in labels) / total_sup
        agg = {"precision": w_p, "recall": w_r, "f1": w_f}
    else:
        raise ValueError(f"average desconhecido: {average}")

    return {
        "confusion": cm,
        "per_label": per_label,
        "accuracy": acc,
        f"{average}_avg": agg,
    }


# -------------------- Funções utilitárias --------------------

def fmt_ci(boot: dict, digits: int = 4) -> str:
    """Formata 'ponto (IC95% [lo, hi])' a partir do dict do bootstrap_ci."""
    fmt = f"{{:.{digits}f}}"
    return (f"{fmt.format(boot['point'])} "
            f"(IC95% [{fmt.format(boot['lo'])}, {fmt.format(boot['hi'])}])")


def percentile(values: Sequence[float], p: float) -> float:
    """Percentil p (0-100) via interpolação linear."""
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * (p / 100)
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


# -------------------- Smoke test --------------------

if __name__ == "__main__":
    # Smoke test: F2 com recall alto deve superar F1
    p_ = compute_fbeta(0.7, 0.95, beta=2.0)
    f1_ = compute_fbeta(0.7, 0.95, beta=1.0)
    assert p_ > f1_, f"F2 deveria > F1 quando recall alto, got {p_} vs {f1_}"

    # Bootstrap CI sobre média de uma lista
    samples = [1.0, 0.9, 0.8, 0.95, 1.0, 0.85, 0.92, 1.0, 0.88, 0.97]
    out = bootstrap_ci(lambda s: sum(s) / len(s), samples, n_boot=500)
    assert out["lo"] <= out["point"] <= out["hi"], out
    print(f"Bootstrap média: {fmt_ci(out)}")

    # Span metrics
    g = [[Span(0, 5, "nome"), Span(10, 15, "cpf")],
         [Span(0, 5, "email")],
         []]
    pr = [[Span(0, 5, "nome"), Span(10, 15, "cpf")],
          [Span(2, 6, "email")],   # partial match
          [Span(0, 5, "nome")]]    # false positive
    res = compute_span_metrics(pr, g, ["nome", "cpf", "email"], mode="partial")
    print(f"Span macro F2: {res['_macro']['f2']:.4f}")
    print(f"Span micro F2: {res['_micro']['f2']:.4f}")

    # Leakage
    lk = compute_leakage_rate(pr, g, "email")
    print(f"Leakage email: {lk}")

    # McNemar
    a = [True, True, False, True, False, True]
    b = [True, False, True, True, False, False]
    mc = mcnemar_paired(a, b)
    print(f"McNemar: {mc}")

    print("metrics_core: smoke test OK.")
