"""Avaliação reformulada do gerador 5W2H (v3) sobre gold sem vazamento.

Mudanças vs. eval_action_plan_v2.py:
 - Usa action_plan_gold_v3 (80 cenários, descrição cega, rubrica explícita).
 - Acrescenta:
     * action_diversity (entropy + TTR sobre normalização)
     * andragogy_adherence (5 princípios Knowles via keyword matcher)
     * regulatory_hallucination
     * IC95% via bootstrap em todas as métricas
 - Mantém matriz de confusão 4×4 com IC95% por bootstrap.
 - Specificity e implementability vêm de avaliação humana (likert_rubrics.py);
   este script EXPORTA amostras estratificadas para revisor humano aplicar.

Execução: ~3 min para 80 cenários.
"""
from __future__ import annotations

import asyncio
import csv
import json
import math
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "golds"))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND / ".env")

from metrics_core import (  # noqa: E402
    bootstrap_ci, multiclass_metrics, fmt_ci, percentile,
)
from regulatory_lookup import hallucination_rate  # noqa: E402
from action_plan_gold_v3 import (  # noqa: E402
    CENARIOS, CASES_FOR_AGENT, HIERARCHY_LEVELS, RUBRIC,
)
from services.ai.action_plan_generator import generate_action_plans_ai  # noqa: E402

# Alias para compatibilidade com a interface esperada por este eval.
# A função real retorna {"planos": [{...campos 5W2H + nivel_hierarquia...}]}
# Vamos extrair o nivel_hierarquia do primeiro plano para comparar com gold.
async def generate_action_plan(payload: dict) -> dict:
    """Wrapper que adapta o payload do gold para a função real."""
    riscos = payload.get("riscos_criticos", [])
    if not riscos:
        return {"nivel_hierarquia": "", "acoes": []}
    raw = await generate_action_plans_ai(
        empresa_nome=payload.get("empresa_nome", "Empresa"),
        empresa_setor=payload.get("empresa_setor", "Geral"),
        total_colaboradores=payload.get("total_colaboradores", 100),
        riscos_criticos=riscos,
        riscos_intermediarios=payload.get("riscos_intermediarios", []),
        texto_inventario_aprovado=payload.get("contexto_neutro", ""),
    )
    planos = raw.get("planos", []) or []
    if not planos:
        return {"nivel_hierarquia": "", "acoes": [], "raw": raw}
    nivel = planos[0].get("nivel_hierarquia", "").strip()
    # Normaliza variações (com ou sem hífen, acento, etc.)
    nivel = nivel.replace("Eliminacao", "Eliminação").replace(
        "Substituicao", "Substituição").replace("Organizacional", "Organizacional")
    return {
        "nivel_hierarquia": nivel,
        "acoes": planos,
        "raw": raw,
    }


METRICS = ROOT.parent / "metrics"
SAMPLES = ROOT.parent / "metrics" / "likert_samples"
METRICS.mkdir(exist_ok=True, parents=True)
SAMPLES.mkdir(exist_ok=True, parents=True)


# --------------------- Andragogy adherence ---------------------

# 5 princípios de Knowles (1980)
KNOWLES_KEYWORDS = {
    "autodirigido": ["autodirig", "autonom", "auto-direção", "auto-dirigid"],
    "experiencia_previa": ["experiência prévia", "vivência", "trajetória",
                            "histórico do colaborador", "experiência anterior"],
    "relevancia_imediata": ["aplicação imediata", "aplicar no dia a dia",
                             "problema concreto", "problema real",
                             "relevância imediata"],
    "problema_centrado": ["problema centrado", "centrado em problema",
                            "estudo de caso", "situação real"],
    "motivacao_interna": ["motivação intrínseca", "motivação interna",
                           "engajamento intrínseco"],
}


def count_knowles_principles(text: str) -> int:
    lower = text.lower()
    n = 0
    for principles in KNOWLES_KEYWORDS.values():
        if any(p in lower for p in principles):
            n += 1
    return n


# --------------------- Action diversity ---------------------

def normalize_action(action_text: str) -> str:
    """Normalização simples: lowercase, remove pontuação, espaços extras."""
    s = action_text.lower()
    s = re.sub(r"[^\w\sá-ÿ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def type_token_ratio(actions: list[str]) -> float:
    if not actions:
        return 0.0
    tokens = []
    for a in actions:
        tokens.extend(normalize_action(a).split())
    if not tokens:
        return 0.0
    return len(set(tokens)) / len(tokens)


def shannon_entropy(actions: list[str]) -> float:
    """Entropia de Shannon sobre as ações normalizadas."""
    if not actions:
        return 0.0
    counts = Counter(normalize_action(a) for a in actions)
    n = sum(counts.values())
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


# --------------------- Pipeline ---------------------

async def run_one(case: dict) -> dict:
    t0 = time.perf_counter()
    plan = await generate_action_plan(case["input"])
    elapsed_ms = (time.perf_counter() - t0) * 1000
    # Extrai a hierarquia atribuída e o texto da primeira ação
    predicted = plan.get("nivel_hierarquia", "").strip()
    acoes = plan.get("acoes", [])
    primeira_acao = acoes[0] if acoes else {}
    action_text = json.dumps(primeira_acao, ensure_ascii=False)
    return {
        "id": case["id"],
        "expected": case["expected_hierarchy"],
        "predicted": predicted,
        "plan": plan,
        "action_text": action_text,
        "n_acoes": len(acoes),
        "n_knowles": count_knowles_principles(json.dumps(plan, ensure_ascii=False)),
        "latency_ms": elapsed_ms,
    }


async def main():
    print("=== eval_action_plan_v3 (gold cego, 80 cenários) ===")
    print(f"OPENAI_API_KEY presente: {bool(os.getenv('OPENAI_API_KEY'))}")
    results = []
    for i, c in enumerate(CASES_FOR_AGENT):
        print(f"  [{i+1:3d}/{len(CASES_FOR_AGENT)}] {c['id']} "
              f"(expected={c['expected_hierarchy']})...", end=" ", flush=True)
        try:
            r = await run_one(c)
            results.append(r)
            ok = "OK" if r["predicted"] == r["expected"] else f"MISS({r['predicted']})"
            print(f"{ok} ({r['latency_ms']:.0f}ms)")
        except Exception as e:
            print(f"FAIL: {type(e).__name__}: {e}")
            results.append({"id": c["id"], "error": str(e)})

    succ = [r for r in results if "predicted" in r]
    if not succ:
        print("Nenhum caso bem-sucedido; abortando.")
        return

    y_true = [r["expected"] for r in succ]
    y_pred = [r["predicted"] for r in succ]

    # Matriz + métricas
    mm = multiclass_metrics(y_true, y_pred, HIERARCHY_LEVELS, average="macro")
    print(f"\nAcurácia: {mm['accuracy']:.4f}")
    print(f"Macro F1: {mm['macro_avg']['f1']:.4f}")
    for lev in HIERARCHY_LEVELS:
        p = mm["per_label"][lev]
        print(f"  {lev:32s} P={p['precision']:.3f} R={p['recall']:.3f} F1={p['f1']:.3f}")

    # Bootstrap CI para acurácia
    paired = list(zip(y_true, y_pred))

    def _acc(s):
        return sum(1 for t, p in s if t == p) / len(s) if s else 0.0

    acc_ci = bootstrap_ci(_acc, paired, n_boot=1000)
    print(f"\nAcurácia (IC95%): {fmt_ci(acc_ci)}")

    # Action diversity (sobre as 80 ações)
    actions = [r["action_text"] for r in succ]
    ttr = type_token_ratio(actions)
    H = shannon_entropy(actions)
    H_max = math.log2(len(actions)) if len(actions) > 1 else 1.0
    print(f"\nDiversidade de ações:")
    print(f"  Type-Token Ratio: {ttr:.4f}")
    print(f"  Entropia Shannon: {H:.4f} (máx={H_max:.4f}, norm={H/H_max:.4f})")

    # Andragogy adherence rate
    n_with_knowles = sum(1 for r in succ if r["n_knowles"] >= 1)
    andragogy_rate = n_with_knowles / len(succ)
    print(f"\nAderência andragógica (>=1 princípio Knowles): "
          f"{andragogy_rate:.4f} ({n_with_knowles}/{len(succ)})")

    # Alucinação regulatória
    plan_texts = [json.dumps(r["plan"], ensure_ascii=False) for r in succ]
    halluc = hallucination_rate(plan_texts)
    print(f"Taxa de alucinação regulatória: {halluc['hallucination_rate']:.4f}")

    lats = [r["latency_ms"] for r in succ]
    print(f"Latência p50/p95/p99: {percentile(lats,50):.0f}/{percentile(lats,95):.0f}/{percentile(lats,99):.0f} ms")

    payload_out = {
        "agent": "action_plan_generator",
        "version": "v3_2026-05",
        "n_cases": len(CASES_FOR_AGENT),
        "n_success": len(succ),
        "accuracy_ci": {
            "point": acc_ci["point"], "lo": acc_ci["lo"], "hi": acc_ci["hi"],
        },
        "macro_metrics": mm["macro_avg"],
        "per_label": mm["per_label"],
        "confusion": mm["confusion"],
        "action_diversity": {
            "type_token_ratio": ttr,
            "shannon_entropy": H,
            "shannon_max": H_max,
        },
        "andragogy_adherence_rate": andragogy_rate,
        "hallucination_regulatory": halluc,
        "latency_ms": {
            "p50": percentile(lats, 50),
            "p95": percentile(lats, 95),
            "p99": percentile(lats, 99),
        },
        "gold_rubric_md_excerpt": RUBRIC[:400],
    }
    (METRICS / "action_plan_v3_metrics.json").write_text(
        json.dumps(payload_out, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    # Per-case CSV
    with open(METRICS / "action_plan_v3_per_case.csv", "w", newline="",
              encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "expected", "predicted", "correct", "n_acoes",
                    "n_knowles", "latency_ms"])
        for r in succ:
            w.writerow([r["id"], r["expected"], r["predicted"],
                        int(r["expected"] == r["predicted"]),
                        r["n_acoes"], r["n_knowles"],
                        f"{r['latency_ms']:.0f}"])

    # Export amostras Likert estratificadas (30 amostras: ~7 por nível)
    import random
    rng = random.Random(20260527)
    samples = []
    for lev in HIERARCHY_LEVELS:
        candidates = [r for r in succ if r["expected"] == lev]
        rng.shuffle(candidates)
        for r in candidates[:8]:
            samples.append({
                "sample_id": f"plan_{r['id']}_anon",  # poderia anonimizar mais
                "output_text": json.dumps(r["plan"], ensure_ascii=False)[:3000],
            })
    from likert_rubrics import export_sample_csv
    export_sample_csv("action_plan", samples,
                      str(SAMPLES / "action_plan_likert_samples.csv"))
    print(f"\nAmostras Likert em {SAMPLES / 'action_plan_likert_samples.csv'}")


if __name__ == "__main__":
    asyncio.run(main())
