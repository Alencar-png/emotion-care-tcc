"""Avaliação reformulada do Copiloto NR-01 com framework tipo RAGAS (v3).

Mudanças em relação a eval_copilot_v2:
 - Faithfulness: % de sentenças da resposta com suporte semântico nos chunks
   recuperados (limiar cosseno >= 0,75 sobre embedding)
 - Answer relevancy: cosseno entre embedding da pergunta e da resposta
 - Context relevancy: % de chunks recuperados que têm similaridade >= 0,55
   com a pergunta
 - Taxa de alucinação regulatória contra base curada (regulatory_lookup)
 - IC95% bootstrap para todas as métricas pontuais
 - Mantém Precision@k, Recall@k, MRR (recuperação)

Continua com SIMILARITY_THRESHOLD=0.40 do v2, pois o corpus indexado é
pequeno na configuração atual (6 documentos). A expansão para corpora
completas (NR-01, NR-17, ISO 45003, COPSOQ, LGPD) é trabalho futuro.

Saídas:
 metrics/copilot_v3_metrics.json
 metrics/copilot_v3_per_case.csv
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
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care" / "nr1-backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT))

# Carrega .env
env_path = BACKEND / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://emotioncare:emotioncare@localhost:5432/emotioncare",
)

# Monkey-patch removido: usar o threshold de produção (0.75) definido no
# copilot_nr01.py, agora compatível com o corpus integral indexado pelo
# seed_copilot_kb_v3.py (NR-01, NR-17 e LGPD completos).
from services.ai import copilot_nr01  # noqa: E402

from metrics_core import bootstrap_ci, fmt_ci, percentile  # noqa: E402
from regulatory_lookup import hallucination_rate  # noqa: E402
from eval_copilot import GOLD, precision_at_k, recall_at_k, mrr  # noqa: E402

METRICS = ROOT.parent / "metrics"
METRICS.mkdir(parents=True, exist_ok=True)


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def split_sentences(text: str) -> list[str]:
    s = re.split(r"(?<=[.!?])\s+", text.strip())
    return [x.strip() for x in s if len(x.strip()) > 10]


async def compute_ragas_metrics(
    question: str,
    answer: str,
    chunks: list[dict],
    embedder,
    faith_threshold: float = 0.75,
    context_threshold: float = 0.55,
) -> dict:
    """Faithfulness + Answer Relevancy + Context Relevancy."""
    sentences = split_sentences(answer)
    if not sentences:
        return {
            "faithfulness": 1.0 if not answer.strip() else 0.0,
            "answer_relevancy": 0.0,
            "context_relevancy": 0.0,
            "n_sentences": 0,
            "n_supported": 0,
        }

    chunk_texts = [c.get("content", "") for c in chunks]

    # Embeddings em uma chamada batched
    to_embed = [question, answer] + sentences + chunk_texts
    embs = await embedder.aembed_documents(to_embed)
    q_emb = embs[0]
    a_emb = embs[1]
    sent_embs = embs[2:2 + len(sentences)]
    chunk_embs = embs[2 + len(sentences):]

    # Answer relevancy
    answer_relevancy = cosine(q_emb, a_emb)

    # Faithfulness
    n_supported = 0
    for se in sent_embs:
        if not chunk_embs:
            continue
        sims = [cosine(se, ce) for ce in chunk_embs]
        if max(sims) >= faith_threshold:
            n_supported += 1
    faithfulness = n_supported / len(sentences) if sentences else 0.0

    # Context relevancy
    n_relevant = 0
    for ce in chunk_embs:
        if cosine(q_emb, ce) >= context_threshold:
            n_relevant += 1
    context_relevancy = n_relevant / len(chunk_embs) if chunk_embs else 0.0

    return {
        "faithfulness": faithfulness,
        "answer_relevancy": answer_relevancy,
        "context_relevancy": context_relevancy,
        "n_sentences": len(sentences),
        "n_supported": n_supported,
        "n_chunks": len(chunk_embs),
        "n_chunks_relevant": n_relevant,
    }


async def main():
    print("=== eval_copilot_v3 (RAGAS-like) ===")
    if not os.getenv("OPENAI_API_KEY"):
        print("[!] sem OPENAI_API_KEY")
        return

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from services.ai.copilot_nr01 import answer_question, search_knowledge_base
    from services.ai.llm_config import get_embeddings

    engine = create_engine(os.environ["DATABASE_URL"])
    Session = sessionmaker(bind=engine)
    embedder = get_embeddings()

    rows = []
    latencies = []
    all_answers = []
    n = len(GOLD)

    for i, (cid, q, src) in enumerate(GOLD):
        print(f"  [{i+1:3d}/{n}] {cid}...", end=" ", flush=True)
        t0 = time.perf_counter()
        # Para RAGAS, precisamos dos chunks recuperados. Vamos buscar
        # explicitamente antes da geração para ter acesso aos chunks.
        try:
            q_emb = await embedder.aembed_query(q)
            with Session() as db:
                chunks = search_knowledge_base(db, q_emb, top_k=5)
                out = await answer_question(db, q, company_id=None)
        except Exception as e:
            out = {"sources": [], "answer": "", "is_fallback": True}
            chunks = []
        dt = (time.perf_counter() - t0) * 1000
        latencies.append(dt)
        srcs = out.get("sources", [])
        answer = out.get("answer", "")
        all_answers.append(answer)

        # RAGAS metrics
        try:
            ragas = await compute_ragas_metrics(q, answer, chunks, embedder)
        except Exception as e:
            ragas = {"faithfulness": 0.0, "answer_relevancy": 0.0,
                     "context_relevancy": 0.0, "n_sentences": 0,
                     "n_supported": 0, "error": str(e)}

        row = {
            "id": cid, "pergunta": q, "fonte_esperada": src,
            "fontes_retornadas": ";".join(srcs),
            "answer_len_words": len(answer.split()),
            "n_chunks": ragas.get("n_chunks", 0),
            "latency_ms": round(dt, 2),
        }
        for k in (1, 3, 5):
            row[f"precision@{k}"] = round(precision_at_k(srcs, src, k), 4)
            row[f"recall@{k}"] = round(recall_at_k(srcs, src, k), 4)
        row["mrr"] = round(mrr(srcs, src), 4)
        row["faithfulness"] = round(ragas["faithfulness"], 4)
        row["answer_relevancy"] = round(ragas["answer_relevancy"], 4)
        row["context_relevancy"] = round(ragas["context_relevancy"], 4)
        rows.append(row)
        print(f"OK p@1={row['precision@1']:.2f} faith={row['faithfulness']:.2f} "
              f"({dt:.0f}ms)")

    # Agregados com bootstrap
    def _mean(s):
        return sum(s) / len(s) if s else 0.0

    p1 = [r["precision@1"] for r in rows]
    p3 = [r["precision@3"] for r in rows]
    p5 = [r["precision@5"] for r in rows]
    r1 = [r["recall@1"] for r in rows]
    r3 = [r["recall@3"] for r in rows]
    r5 = [r["recall@5"] for r in rows]
    mrr_v = [r["mrr"] for r in rows]
    faith = [r["faithfulness"] for r in rows]
    ans_rel = [r["answer_relevancy"] for r in rows]
    ctx_rel = [r["context_relevancy"] for r in rows]

    print("\nAgregados (bootstrap n=1000)...")
    p1_ci = bootstrap_ci(_mean, p1, n_boot=1000)
    r5_ci = bootstrap_ci(_mean, r5, n_boot=1000)
    mrr_ci = bootstrap_ci(_mean, mrr_v, n_boot=1000)
    faith_ci = bootstrap_ci(_mean, faith, n_boot=1000)
    ar_ci = bootstrap_ci(_mean, ans_rel, n_boot=1000)
    cr_ci = bootstrap_ci(_mean, ctx_rel, n_boot=1000)

    print(f"  Precision@1: {fmt_ci(p1_ci)}")
    print(f"  Recall@5   : {fmt_ci(r5_ci)}")
    print(f"  MRR        : {fmt_ci(mrr_ci)}")
    print(f"  Faithfulness     : {fmt_ci(faith_ci)} [PRIMÁRIA]")
    print(f"  Answer relevancy : {fmt_ci(ar_ci)} [PRIMÁRIA]")
    print(f"  Context relevancy: {fmt_ci(cr_ci)}")

    # Alucinação regulatória
    halluc = hallucination_rate(all_answers)
    print(f"  Taxa de alucinação regulatória: {halluc['hallucination_rate']:.4f}")

    payload = {
        "agent": "copilot_nr01",
        "version": "v3_2026-05",
        "n_questions": n,
        "similarity_threshold": copilot_nr01.SIMILARITY_THRESHOLD,
        "retrieval": {
            "precision@1": {"point": p1_ci["point"], "lo": p1_ci["lo"], "hi": p1_ci["hi"]},
            "precision@3": _mean(p3),
            "precision@5": _mean(p5),
            "recall@1": _mean(r1),
            "recall@3": _mean(r3),
            "recall@5": {"point": r5_ci["point"], "lo": r5_ci["lo"], "hi": r5_ci["hi"]},
            "mrr": {"point": mrr_ci["point"], "lo": mrr_ci["lo"], "hi": mrr_ci["hi"]},
        },
        "ragas": {
            "faithfulness": {"point": faith_ci["point"], "lo": faith_ci["lo"], "hi": faith_ci["hi"]},
            "answer_relevancy": {"point": ar_ci["point"], "lo": ar_ci["lo"], "hi": ar_ci["hi"]},
            "context_relevancy": {"point": cr_ci["point"], "lo": cr_ci["lo"], "hi": cr_ci["hi"]},
        },
        "regulatory_hallucination": halluc,
        "latency_ms": {
            "p50": percentile(latencies, 50),
            "p95": percentile(latencies, 95),
            "p99": percentile(latencies, 99),
        },
    }
    (METRICS / "copilot_v3_metrics.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )

    with open(METRICS / "copilot_v3_per_case.csv", "w", newline="",
              encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"\nResultados em {METRICS / 'copilot_v3_metrics.json'}")


if __name__ == "__main__":
    asyncio.run(main())
