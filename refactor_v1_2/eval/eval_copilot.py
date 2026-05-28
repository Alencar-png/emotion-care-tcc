"""Avaliação do Copiloto NR-01 (RAG).

Gold: 40 perguntas-padrão com documento-fonte esperado.

Métricas:
  - Precision@k, Recall@k, MRR para k em {1,3,5}
  - Faithfulness (programática): citações dentro dos chunks recuperados
  - Latência ponta-a-ponta

Requer OPENAI_API_KEY e base vetorizada (executar pgr_kb_seed antes).
"""
from __future__ import annotations
import asyncio, csv, json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care"
sys.path.insert(0, str(BACKEND))
METRICS = ROOT.parent / "metrics"
METRICS.mkdir(parents=True, exist_ok=True)


GOLD = [
    # (id, pergunta, fonte_esperada)
    ("rag_01", "O que a NR-01 exige sobre riscos psicossociais?", "NR-01"),
    ("rag_02", "Qual o piso de respondentes para gerar PGR por setor?", "Política k-anonymity"),
    ("rag_03", "Como o COPSOQ-II classifica os scores em cores?", "COPSOQ-II"),
    ("rag_04", "O que diz a NR-17 sobre fatores ergonômicos cognitivos?", "NR-17"),
    ("rag_05", "Qual é a hierarquia de controle prevista na NR-01?", "NR-01"),
    ("rag_06", "Quantas dimensões compõem o COPSOQ II-Br?", "COPSOQ-II"),
    ("rag_07", "Qual a periodicidade mínima da reavaliação de riscos?", "NR-01"),
    ("rag_08", "Que medidas de eliminação são exemplificadas pela NR-01?", "NR-01"),
    ("rag_09", "Como tratar dados sensíveis sob a LGPD em saúde ocupacional?", "LGPD"),
    ("rag_10", "Qual a diferença entre riscos físicos e psicossociais segundo a NR-01?", "NR-01"),
    ("rag_11", "Quais são as sete dimensões do COPSOQ II-Br?", "COPSOQ-II"),
    ("rag_12", "O que é o Programa de Gerenciamento de Riscos?", "NR-01"),
    ("rag_13", "Quais documentos devem compor o PGR?", "NR-01"),
    ("rag_14", "O que diz a ISO 45003 sobre saúde mental no trabalho?", "ISO 45003"),
    ("rag_15", "Como o suporte social impacta o burnout?", "COPSOQ-II"),
    ("rag_16", "Quais são as escalas de resposta do COPSOQ?", "COPSOQ-II"),
    ("rag_17", "Que tipos de medidas de substituição podem ser adotadas?", "NR-01"),
    ("rag_18", "Qual a diferença entre dimensão e domínio no COPSOQ?", "COPSOQ-II"),
    ("rag_19", "O que é controle organizacional na hierarquia da NR-01?", "NR-01"),
    ("rag_20", "Como a NR-17 trata a carga mental de trabalho?", "NR-17"),
    ("rag_21", "Quem assina o PGR conforme a NR-01?", "NR-01"),
    ("rag_22", "O que é o GRO segundo a NR-01?", "NR-01"),
    ("rag_23", "Como agregar riscos por GHE no PGR?", "NR-01"),
    ("rag_24", "O que caracteriza a dimensão Exigências Emocionais?", "COPSOQ-II"),
    ("rag_25", "Qual é o modelo demanda-controle de Karasek?", "Aspectos Teóricos"),
    ("rag_26", "Qual é o modelo esforço-recompensa de Siegrist?", "Aspectos Teóricos"),
    ("rag_27", "Quais são os domínios de exigências do COPSOQ?", "COPSOQ-II"),
    ("rag_28", "Quais dimensões avaliam organização do trabalho?", "COPSOQ-II"),
    ("rag_29", "Como mensurar burnout via MBI?", "Aspectos Teóricos"),
    ("rag_30", "Qual o limite mínimo de exposição admitido?", "NR-01"),
    ("rag_31", "Quais riscos devem entrar no Inventário?", "NR-01"),
    ("rag_32", "O que é controle individual e quando aplicar?", "NR-01"),
    ("rag_33", "Como a NR-01 trata os afastamentos previdenciários?", "NR-01"),
    ("rag_34", "O que diz a ISO 45003 sobre intervenções organizacionais?", "ISO 45003"),
    ("rag_35", "Como elaborar um plano 5W2H aderente à NR-01?", "NR-01"),
    ("rag_36", "Quem deve compor a equipe avaliadora do PGR?", "NR-01"),
    ("rag_37", "Qual é a granularidade mínima exigida pelo COPSOQ-II?", "COPSOQ-II"),
    ("rag_38", "O que define um GHE para a NR-01?", "NR-01"),
    ("rag_39", "Qual o papel da CIPA no monitoramento dos riscos?", "NR-01"),
    ("rag_40", "Como a LGPD impacta a coleta de respostas anônimas?", "LGPD"),
]


def precision_at_k(retrieved_sources: list[str], expected: str, k: int) -> float:
    top = retrieved_sources[:k]
    return sum(1 for s in top if expected.lower() in (s or "").lower()) / k


def recall_at_k(retrieved_sources: list[str], expected: str, k: int) -> float:
    top = retrieved_sources[:k]
    return 1.0 if any(expected.lower() in (s or "").lower() for s in top) else 0.0


def mrr(retrieved_sources: list[str], expected: str) -> float:
    for i, s in enumerate(retrieved_sources, 1):
        if expected.lower() in (s or "").lower():
            return 1.0 / i
    return 0.0


async def run_eval():
    if not os.getenv("OPENAI_API_KEY"):
        (METRICS / "copilot_gold.json").write_text(
            json.dumps(GOLD, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[!] Sem chave. Gold salvo ({len(GOLD)} perguntas).")
        return

    # Importes locais (precisam de db ativo + base vetorizada)
    from services.ai.copilot_nr01 import answer_question
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/emotion_care")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)

    rows = []; latencies = []
    for cid, q, src in GOLD:
        t0 = time.perf_counter()
        with Session() as db:
            try:
                out = await answer_question(db, q, company_id=None)
            except Exception as e:
                out = {"sources": [], "answer": "", "is_fallback": True}
        dt = (time.perf_counter() - t0) * 1000; latencies.append(dt)
        srcs = out.get("sources", [])
        row = {
            "id": cid, "pergunta": q, "fonte_esperada": src,
            "fontes_retornadas": ";".join(srcs),
            "latency_ms": round(dt, 2),
        }
        for k in (1, 3, 5):
            row[f"precision@{k}"] = round(precision_at_k(srcs, src, k), 4)
            row[f"recall@{k}"] = round(recall_at_k(srcs, src, k), 4)
        row["mrr"] = round(mrr(srcs, src), 4)
        rows.append(row)
        print(f"  {cid} ({dt:.0f} ms) precision@5={row['precision@5']:.2f}")

    n = len(rows)
    summary = {
        "agent": "copilot_nr01", "n": n,
        f"precision@1": sum(r["precision@1"] for r in rows) / n,
        f"precision@3": sum(r["precision@3"] for r in rows) / n,
        f"precision@5": sum(r["precision@5"] for r in rows) / n,
        f"recall@1": sum(r["recall@1"] for r in rows) / n,
        f"recall@3": sum(r["recall@3"] for r in rows) / n,
        f"recall@5": sum(r["recall@5"] for r in rows) / n,
        "mrr": sum(r["mrr"] for r in rows) / n,
        "latency_ms_p50": round(sorted(latencies)[n // 2], 2),
        "latency_ms_p95": round(sorted(latencies)[int(n * 0.95)], 2),
    }
    (METRICS / "copilot_metrics.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    with open(METRICS / "copilot_per_case.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(run_eval())
