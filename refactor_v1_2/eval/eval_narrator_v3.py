"""Avaliação reformulada do narrador PGR (v3).

Mudanças vs. eval_narrator_v2.py:
 - Remove "ausência de em-dash" como métrica (mera regra editorial).
 - Adiciona BERTScore F1 (vs. referência determinística), ROUGE-1/L.
 - Adiciona faithfulness ao payload (claims com número checados).
 - Adiciona taxa de alucinação regulatória (regulatory_lookup).
 - IC95% via bootstrap para todas as métricas pontuais.
 - Suporta gold ampliado (100 payloads: 5 perfis × 4 portes × 5 seeds).

Dependências adicionais:
    pip install bert-score rouge-score openai langchain

Execução (custosa em API):
    set PYTHONIOENCODING=utf-8
    python eval_narrator_v3.py

Saídas:
    metrics/narrator_v3_metrics.json
    metrics/narrator_v3_per_case.csv
    figures/narrator_v3_*.png

Tempo estimado: 100 payloads × ~25 s/payload = ~40 min para chamadas LLM,
mais BERTScore (~2 min para 100 textos com bert-base-portuguese).
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT))

# Carrega .env do backend
from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND / ".env")

from metrics_core import bootstrap_ci, percentile, fmt_ci  # noqa: E402
from reference_inventory_generator import (  # noqa: E402
    generate_reference, join_reference, SECTION_KEYS,
)
from regulatory_lookup import hallucination_rate  # noqa: E402
from services.ai.pgr_narrator import generate_pgr_narrative  # noqa: E402
from services.ai.pii_validator import scan  # noqa: E402


METRICS = ROOT.parent / "metrics"
FIGURES = ROOT.parent / "figures"
METRICS.mkdir(exist_ok=True, parents=True)
FIGURES.mkdir(exist_ok=True, parents=True)


# --------------------- Geração do gold expandido ---------------------

PROFILES = ["saudavel", "alerta_um", "alerta_multi", "critico_focal",
            "critico_multi"]
PORTES = ["micro", "pequeno", "medio", "grande"]
SECTORS_CYCLE = ["Saúde", "Indústria", "Comércio", "Educação", "Serviços",
                 "TI", "Logística", "Administração Pública"]
DIMS = [
    "Demandas Quantitativas", "Demandas Cognitivas", "Demandas Emocionais",
    "Ritmo de Trabalho", "Influência no Trabalho", "Reconhecimento",
    "Qualidade da Liderança", "Suporte Social Superiores",
    "Comunidade Social", "Sentido do Trabalho",
    "Confiança Vertical", "Justiça Organizacional",
    "Saúde Geral",
]


def _classification(score: int) -> str:
    if score >= 66:
        return "Vermelho"
    if score >= 33:
        return "Amarelo"
    return "Verde"


def build_payloads(seed: int = 20260527) -> list[dict]:
    import random
    rng = random.Random(seed)
    payloads = []
    case_id = 0
    for profile in PROFILES:
        for porte in PORTES:
            for s in range(5):  # 5 seeds por (perfil, porte)
                case_id += 1
                setor = SECTORS_CYCLE[(case_id) % len(SECTORS_CYCLE)]
                total = {"micro": 18, "pequeno": 55, "medio": 130,
                         "grande": 400}[porte]
                if profile == "saudavel":
                    scores = [(d, rng.randint(10, 30)) for d in DIMS]
                elif profile == "alerta_um":
                    scores = [(d, rng.randint(10, 30)) for d in DIMS]
                    idx = rng.randrange(len(scores))
                    scores[idx] = (scores[idx][0], rng.randint(35, 60))
                elif profile == "alerta_multi":
                    scores = [(d, rng.randint(35, 60) if rng.random() < 0.5
                               else rng.randint(10, 30)) for d in DIMS]
                elif profile == "critico_focal":
                    scores = [(d, rng.randint(10, 30)) for d in DIMS]
                    idx = rng.randrange(len(scores))
                    scores[idx] = (scores[idx][0], rng.randint(67, 90))
                else:  # critico_multi
                    scores = [(d, rng.randint(67, 90) if rng.random() < 0.4
                               else (rng.randint(35, 60) if rng.random() < 0.5
                                     else rng.randint(10, 30))) for d in DIMS]
                scores_geral = [{"dimensao": d, "score": v,
                                 "classificacao": _classification(v)}
                                for d, v in scores]
                vermelhas = [s["dimensao"] for s in scores_geral
                             if s["classificacao"] == "Vermelho"]
                amarelas = [s["dimensao"] for s in scores_geral
                            if s["classificacao"] == "Amarelo"]
                setores_aplicaveis = ["RH", "TI", "Operações", "Comercial",
                                      "Marketing", "Logística", "Produção"]
                scores_por_setor = [
                    {"setor": st, "score": rng.randint(30, 75)}
                    for st in rng.sample(setores_aplicaveis,
                                         k=min(5, len(setores_aplicaveis)))
                ]
                payloads.append({
                    "id": f"narr_{profile}_{porte}_{s}",
                    "payload": {
                        "empresa_nome": f"Empresa Sintética {case_id}",
                        "empresa_setor": setor,
                        "empresa_porte": porte,
                        "data_coleta": "2026-05-15",
                        "total_respondentes": total,
                        "taxa_resposta": round(rng.uniform(55, 95), 1),
                        "scores_geral": scores_geral,
                        "scores_por_setor": scores_por_setor,
                        "dimensoes_vermelhas": vermelhas,
                        "dimensoes_amarelas": amarelas,
                        "instrumento_nome": "COPSOQ II-Br",
                        "instrumento_codigo": "copsoq_ii",
                        "afastamentos_por_setor": [],
                    },
                    "expected_profile": profile,
                })
    return payloads


# --------------------- Métricas ---------------------

def compute_faithfulness(generated: str, payload: dict) -> float:
    """Faithfulness: % de claims numéricos na saída que estão ancorados no payload.

    Extrai todas as sentenças com pelo menos um número e verifica se ao menos
    um dos números (após normalização) aparece no payload.
    """
    # Conjunto de números do payload
    payload_text = json.dumps(payload, ensure_ascii=False)
    payload_nums = set(re.findall(r"\d+\.?\d*", payload_text))
    sentences = re.split(r"[.!?]\s+", generated)
    n_claims = 0
    n_supported = 0
    for s in sentences:
        nums = re.findall(r"\d+\.?\d*", s)
        if not nums:
            continue
        n_claims += 1
        # Tolerante: claim é suportado se qualquer número está no payload
        if any(n in payload_nums or n.split(".")[0] in payload_nums
               for n in nums):
            n_supported += 1
    return n_supported / n_claims if n_claims else 1.0


def compute_bertscore(generated: list[str], reference: list[str]) -> dict:
    """BERTScore F1 contra referência usando bert-base-portuguese-cased.

    O modelo neuralmind/bert-base-portuguese-cased não consta no
    model2layers do bert_score; precisamos passar num_layers explicitamente.
    BERT base tem 12 camadas; layer 9 é o padrão recomendado pela
    biblioteca para BERT-base em outras línguas.
    """
    try:
        from bert_score import score
    except ImportError:
        return {"available": False,
                "msg": "Instale com: pip install bert-score"}
    try:
        P, R, F1 = score(
            generated, reference,
            model_type="neuralmind/bert-base-portuguese-cased",
            num_layers=9,
            lang="pt", verbose=False, batch_size=8,
        )
    except Exception as e:
        # Fallback para bert-base-multilingual-cased (no model2layers)
        print(f"  Fallback bert-multilingual ({e})")
        P, R, F1 = score(
            generated, reference,
            model_type="bert-base-multilingual-cased",
            lang="pt", verbose=False, batch_size=8,
        )
    return {
        "available": True,
        "precision_mean": float(P.mean()),
        "recall_mean": float(R.mean()),
        "f1_mean": float(F1.mean()),
        "f1_per_doc": [float(x) for x in F1],
    }


def compute_rouge(generated: list[str], reference: list[str]) -> dict:
    """ROUGE-1 e ROUGE-L F1 contra referência."""
    try:
        from rouge_score import rouge_scorer
    except ImportError:
        return {"available": False,
                "msg": "Instale com: pip install rouge-score"}
    scorer = rouge_scorer.RougeScorer(["rouge1", "rougeL"], use_stemmer=False)
    r1, rL = [], []
    for g, r in zip(generated, reference):
        s = scorer.score(r, g)
        r1.append(s["rouge1"].fmeasure)
        rL.append(s["rougeL"].fmeasure)
    return {
        "available": True,
        "rouge1_f1_mean": sum(r1) / len(r1),
        "rougeL_f1_mean": sum(rL) / len(rL),
        "rouge1_per_doc": r1,
        "rougeL_per_doc": rL,
    }


def structural_conformity(parsed: dict) -> dict:
    """Métricas estruturais secundárias."""
    sections_ok = sum(1 for k in SECTION_KEYS if k in parsed
                      and parsed[k] and parsed[k].strip())
    total_words = sum(len(parsed.get(k, "").split()) for k in SECTION_KEYS)
    return {
        "sections_present": sections_ok,
        "all_sections": sections_ok == len(SECTION_KEYS),
        "word_count": total_words,
        "in_range_600_900": 600 <= total_words <= 900,
    }


def free_of_pii(text: str) -> bool:
    return scan(text).is_clean


# --------------------- Pipeline ---------------------

async def run_one(payload_obj: dict) -> dict:
    payload = payload_obj["payload"]
    t0 = time.perf_counter()
    parsed = await generate_pgr_narrative(payload)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    # texto completo (concatenação das 7 seções)
    full_text = " ".join(parsed.get(k, "") for k in SECTION_KEYS)
    ref = join_reference(generate_reference(payload))
    return {
        "id": payload_obj["id"],
        "parsed": parsed,
        "full_text": full_text,
        "reference_text": ref,
        "structural": structural_conformity(parsed),
        "free_of_pii": free_of_pii(full_text),
        "faithfulness_payload": compute_faithfulness(full_text, payload),
        "latency_ms": elapsed_ms,
    }


async def main():
    print("=== eval_narrator_v3 ===")
    payloads = build_payloads()
    print(f"Total payloads: {len(payloads)}")
    print(f"OPENAI_API_KEY presente: {bool(os.getenv('OPENAI_API_KEY'))}")

    # Cache intermediário: se já existir um pickle de resultados, carrega
    # e re-utiliza, evitando re-chamadas LLM caras em caso de retry.
    import pickle
    cache_path = METRICS / "narrator_v3_outputs.pkl"
    if cache_path.exists():
        print(f"  [cache] carregando outputs de {cache_path}")
        with open(cache_path, "rb") as f:
            results = pickle.load(f)
        if len(results) != len(payloads):
            print(f"  [cache] tamanho diferente ({len(results)} vs "
                  f"{len(payloads)}), invalidando")
            results = []
    else:
        results = []

    if not results:
        for i, p in enumerate(payloads):
            print(f"  [{i+1:3d}/{len(payloads)}] {p['id']}...",
                  end=" ", flush=True)
            try:
                r = await run_one(p)
                results.append(r)
                print(f"OK ({r['latency_ms']:.0f}ms, "
                      f"sections={r['structural']['sections_present']}/7, "
                      f"words={r['structural']['word_count']})")
            except Exception as e:
                print(f"FAIL: {type(e).__name__}: {e}")
                results.append({"id": p["id"], "error": str(e)})
            # Salva incrementalmente a cada 10 payloads
            if (i + 1) % 10 == 0:
                with open(cache_path, "wb") as f:
                    pickle.dump(results, f)
        # Save final
        with open(cache_path, "wb") as f:
            pickle.dump(results, f)
        print(f"  [cache] salvou outputs em {cache_path}")

    generated = [r["full_text"] for r in results if "full_text" in r]
    reference = [r["reference_text"] for r in results if "reference_text" in r]

    print("\nBERTScore (pode demorar 1-2 min)...")
    bs = compute_bertscore(generated, reference)
    print(f"  BERTScore F1: {bs.get('f1_mean')}")

    print("ROUGE...")
    rg = compute_rouge(generated, reference)
    print(f"  ROUGE-1 F1: {rg.get('rouge1_f1_mean')}")
    print(f"  ROUGE-L F1: {rg.get('rougeL_f1_mean')}")

    print("Alucinação regulatória...")
    halluc = hallucination_rate(generated)
    print(f"  Taxa: {halluc['hallucination_rate']:.4f}")

    print("Conformidades estruturais...")
    sect_ok = sum(1 for r in results if r.get("structural", {}).get("all_sections"))
    range_ok = sum(1 for r in results if r.get("structural", {}).get("in_range_600_900"))
    pii_free = sum(1 for r in results if r.get("free_of_pii"))
    n = len(results)
    print(f"  Sections OK: {sect_ok}/{n} = {sect_ok/n:.4f}")
    print(f"  Word range : {range_ok}/{n} = {range_ok/n:.4f}")
    print(f"  PII-free   : {pii_free}/{n} = {pii_free/n:.4f}")

    # Faithfulness CI
    faiths = [r["faithfulness_payload"] for r in results
              if "faithfulness_payload" in r]
    if faiths:
        faith_ci = bootstrap_ci(lambda s: sum(s) / len(s), faiths, n_boot=1000)
        print(f"  Faithfulness payload: {fmt_ci(faith_ci)}")

    # BERTScore CI
    if bs.get("available"):
        bs_ci = bootstrap_ci(lambda s: sum(s) / len(s), bs["f1_per_doc"],
                              n_boot=1000)
        print(f"  BERTScore F1: {fmt_ci(bs_ci)}")

    # Latências
    lats = [r["latency_ms"] for r in results if "latency_ms" in r]
    if lats:
        print(f"  Latência p50/p95/p99 ms: {percentile(lats,50):.0f} / "
              f"{percentile(lats,95):.0f} / {percentile(lats,99):.0f}")

    payload_out = {
        "agent": "pgr_narrator",
        "version": "v3_2026-05",
        "n_payloads": len(payloads),
        "n_success": len(generated),
        "bertscore": bs,
        "rouge": rg,
        "hallucination_regulatory": halluc,
        "structural": {
            "all_sections_rate": sect_ok / n if n else 0.0,
            "word_range_rate": range_ok / n if n else 0.0,
            "pii_free_rate": pii_free / n if n else 0.0,
        },
        "faithfulness_payload": {
            "mean": sum(faiths) / len(faiths) if faiths else 0.0,
            "ci_lo": faith_ci["lo"] if faiths else None,
            "ci_hi": faith_ci["hi"] if faiths else None,
        },
        "latency_ms": {
            "p50": percentile(lats, 50),
            "p95": percentile(lats, 95),
            "p99": percentile(lats, 99),
        },
    }
    (METRICS / "narrator_v3_metrics.json").write_text(
        json.dumps(payload_out, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    # Per-case CSV
    import csv
    with open(METRICS / "narrator_v3_per_case.csv", "w", newline="",
              encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "sections_ok", "word_count", "in_range",
                    "pii_free", "faithfulness", "bertscore_f1", "rouge1_f1",
                    "latency_ms"])
        for i, r in enumerate(results):
            if "error" in r:
                w.writerow([r["id"], "ERR", "", "", "", "", "", "", ""])
                continue
            bs_v = bs["f1_per_doc"][i] if bs.get("available") and i < len(bs["f1_per_doc"]) else ""
            r1_v = rg["rouge1_per_doc"][i] if rg.get("available") and i < len(rg["rouge1_per_doc"]) else ""
            w.writerow([r["id"], r["structural"]["sections_present"],
                        r["structural"]["word_count"],
                        int(r["structural"]["in_range_600_900"]),
                        int(r["free_of_pii"]),
                        f"{r['faithfulness_payload']:.4f}",
                        f"{bs_v:.4f}" if bs_v != "" else "",
                        f"{r1_v:.4f}" if r1_v != "" else "",
                        f"{r['latency_ms']:.0f}"])

    print(f"\nResultados em {METRICS / 'narrator_v3_metrics.json'}")


if __name__ == "__main__":
    asyncio.run(main())
