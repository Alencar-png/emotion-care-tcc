"""Avaliação reformulada do Analisador Qualitativo (v3).

Mudanças em relação a eval_qualitative_v2:
 - F1 macro + F1 weighted (em vez de só macro)
 - Coerência tópica c_v (gensim) e c_npmi
 - Stability across 3 seeds (média e desvio-padrão de ARI/NMI/c_v)
 - Baselines comparados sobre o mesmo gold:
     * BERTopic (sentence-transformers + HDBSCAN + UMAP)
     * k-means k=7 sobre embeddings text-embedding-3-small
     * LDA com 7 tópicos (sklearn LatentDirichletAllocation)
 - IC95% via bootstrap para ARI/NMI

Saídas:
 metrics/qualitative_v3_metrics.json
 metrics/qualitative_v3_per_response.csv
 metrics/qualitative_v3_baselines.csv
"""
from __future__ import annotations

import asyncio
import csv
import json
import math
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care"
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

from metrics_core import bootstrap_ci, fmt_ci  # noqa: E402

METRICS = ROOT.parent / "metrics"
METRICS.mkdir(parents=True, exist_ok=True)

THEMES = [
    "Sobrecarga", "Reconhecimento", "Ambiente físico",
    "Comunicação", "Carreira", "Liderança", "Outros",
]
K = 7
N_SEEDS = 3  # 3 seeds em vez de 5 para reduzir custo de API


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def tokenize_simple(text: str) -> list[str]:
    import re
    s = text.lower()
    s = re.sub(r"[^a-záâãàéêíóôõúüç0-9 ]+", " ", s)
    return [t for t in s.split() if len(t) >= 3]


# --------------------- Coerência c_v / c_npmi ---------------------

def compute_coherence(topics_words: list[list[str]], texts: list[str],
                      n_top: int = 10) -> dict:
    """Calcula c_v e c_npmi via gensim.

    topics_words: lista de listas de palavras (top-N por tópico)
    texts: corpus tokenizado (pré-processado)
    """
    try:
        from gensim.corpora import Dictionary
        from gensim.models import CoherenceModel
    except ImportError:
        return {"available": False, "msg": "Instale gensim"}

    # Tokeniza textos
    tokenized = [tokenize_simple(t) for t in texts]
    dictionary = Dictionary(tokenized)
    # Limita top-N
    topics_clipped = [t[:n_top] for t in topics_words]
    # Remove tópicos vazios
    topics_clipped = [t for t in topics_clipped if len(t) >= 2]
    if not topics_clipped:
        return {"available": True, "c_v": 0.0, "c_npmi": 0.0,
                "msg": "sem tópicos válidos"}
    try:
        cv = CoherenceModel(topics=topics_clipped, texts=tokenized,
                             dictionary=dictionary, coherence="c_v",
                             topn=n_top).get_coherence()
    except Exception as e:
        cv = float("nan")
    try:
        cnpmi = CoherenceModel(topics=topics_clipped, texts=tokenized,
                                dictionary=dictionary, coherence="c_npmi",
                                topn=n_top).get_coherence()
    except Exception:
        cnpmi = float("nan")
    return {"available": True, "c_v": cv, "c_npmi": cnpmi,
            "n_topics": len(topics_clipped)}


def extract_topic_words_from_assignments(
    pred_themes: list[str], texts: list[str], n_top: int = 10
) -> list[list[str]]:
    """Para cada tópico atribuído, extrai as N palavras mais frequentes
    nas respostas atribuídas a ele."""
    from collections import Counter
    topics = {}
    for theme, text in zip(pred_themes, texts):
        topics.setdefault(theme, []).extend(tokenize_simple(text))
    words_per_topic = []
    for theme in sorted(topics.keys()):
        counter = Counter(topics[theme])
        words_per_topic.append([w for w, _ in counter.most_common(n_top)])
    return words_per_topic


# --------------------- Pipeline LLM ---------------------

async def run_llm_clustering(responses: list[str], seed_idx: int) -> list[dict]:
    """Executa cluster_responses do agente. Variação por seed via
    randomização da ordem das respostas no prompt."""
    import random
    rng = random.Random(20260527 + seed_idx)
    shuffled_responses = responses.copy()
    rng.shuffle(shuffled_responses)
    from services.ai.qualitative_analyzer import cluster_responses
    out = await cluster_responses(
        question_text="O que mais impacta seu bem-estar?",
        responses=shuffled_responses,
        max_clusters=K,
    )
    return out.get("clusters", []) or []


async def map_pred_themes(responses: list[str], clusters: list[dict],
                           true_themes_set: list[str]) -> list[str]:
    """Mapeia cada resposta para o tema verdadeiro mais próximo via embedding."""
    from services.ai.llm_config import get_embeddings
    embedder = get_embeddings()
    cluster_names = [c["theme"] for c in clusters]
    if not cluster_names:
        return ["Outros"] * len(responses)
    cluster_embs = await embedder.aembed_documents(cluster_names)
    theme_embs = await embedder.aembed_documents(true_themes_set)
    response_embs = await embedder.aembed_documents(responses)

    cluster_to_theme = []
    for cemb in cluster_embs:
        sims = [cosine(cemb, temb) for temb in theme_embs]
        cluster_to_theme.append(true_themes_set[sims.index(max(sims))])

    pred = []
    for remb in response_embs:
        sims = [cosine(remb, cemb) for cemb in cluster_embs]
        pred.append(cluster_to_theme[sims.index(max(sims))])
    return pred


# --------------------- Baselines ---------------------

def kmeans_baseline(responses: list[str], embeddings: list[list[float]],
                     true_themes: list[str], seed: int = 0) -> dict:
    """Baseline: k-means com k=7 sobre embeddings text-embedding-3-small."""
    import numpy as np
    from sklearn.cluster import KMeans
    X = np.array(embeddings)
    km = KMeans(n_clusters=K, random_state=seed, n_init=10).fit(X)
    cluster_ids = km.labels_

    # Mapa cluster_id -> tema mais frequente entre os true_themes do cluster
    from collections import Counter
    cluster_to_theme = {}
    for cid in range(K):
        idx = [i for i, c in enumerate(cluster_ids) if c == cid]
        if not idx:
            cluster_to_theme[cid] = "Outros"
            continue
        true_in = [true_themes[i] for i in idx]
        most = Counter(true_in).most_common(1)[0][0]
        cluster_to_theme[cid] = most
    pred_themes = [cluster_to_theme[c] for c in cluster_ids]
    return {"pred_themes": pred_themes, "method": "kmeans"}


def lda_baseline(responses: list[str], true_themes: list[str],
                  seed: int = 0) -> dict:
    """Baseline: LDA com 7 tópicos sobre CountVectorizer."""
    from sklearn.feature_extraction.text import CountVectorizer
    from sklearn.decomposition import LatentDirichletAllocation
    from collections import Counter

    vec = CountVectorizer(max_features=2000, lowercase=True,
                          ngram_range=(1, 2), min_df=2)
    try:
        X = vec.fit_transform(responses)
    except ValueError:
        # min_df muito alto para gold pequeno
        vec = CountVectorizer(max_features=2000, lowercase=True)
        X = vec.fit_transform(responses)
    lda = LatentDirichletAllocation(n_components=K, random_state=seed,
                                     max_iter=20)
    Z = lda.fit_transform(X)
    cluster_ids = Z.argmax(axis=1)
    cluster_to_theme = {}
    for cid in range(K):
        idx = [i for i, c in enumerate(cluster_ids) if c == cid]
        if not idx:
            cluster_to_theme[cid] = "Outros"
            continue
        true_in = [true_themes[i] for i in idx]
        most = Counter(true_in).most_common(1)[0][0]
        cluster_to_theme[cid] = most
    pred_themes = [cluster_to_theme[c] for c in cluster_ids]
    return {"pred_themes": pred_themes, "method": "lda"}


def bertopic_baseline(responses: list[str], embeddings: list[list[float]],
                       true_themes: list[str], seed: int = 0) -> dict:
    """Baseline: BERTopic com embeddings pré-computados, forçando k=7
    via reduce_topics."""
    import numpy as np
    from collections import Counter
    try:
        from bertopic import BERTopic
        from umap import UMAP
        from hdbscan import HDBSCAN
    except ImportError:
        return {"pred_themes": ["Outros"] * len(responses),
                "method": "bertopic_unavailable"}
    X = np.array(embeddings)
    # Para datasets pequenos, parâmetros reduzidos
    umap_model = UMAP(n_neighbors=8, n_components=5, min_dist=0.0,
                      metric="cosine", random_state=seed)
    hdb = HDBSCAN(min_cluster_size=5, metric="euclidean",
                  cluster_selection_method="eom", prediction_data=True)
    bt = BERTopic(umap_model=umap_model, hdbscan_model=hdb, language="multilingual",
                  calculate_probabilities=False, verbose=False)
    topics, _ = bt.fit_transform(responses, embeddings=X)
    # Reduz para 7 tópicos
    try:
        topics_new = bt.reduce_topics(responses, nr_topics=K)
        topics = bt.topics_
    except Exception:
        pass

    cluster_to_theme = {}
    unique_topics = sorted(set(topics))
    for cid in unique_topics:
        idx = [i for i, c in enumerate(topics) if c == cid]
        if not idx:
            cluster_to_theme[cid] = "Outros"
            continue
        true_in = [true_themes[i] for i in idx]
        most = Counter(true_in).most_common(1)[0][0]
        cluster_to_theme[cid] = most
    pred_themes = [cluster_to_theme[c] for c in topics]
    return {"pred_themes": pred_themes, "method": "bertopic"}


# --------------------- Metric helpers ---------------------

def compute_clustering_metrics(true_themes: list[str], pred_themes: list[str],
                                texts: list[str]) -> dict:
    from sklearn.metrics import (
        adjusted_rand_score, normalized_mutual_info_score,
        homogeneity_completeness_v_measure,
        precision_recall_fscore_support,
    )
    ari = float(adjusted_rand_score(true_themes, pred_themes))
    nmi = float(normalized_mutual_info_score(true_themes, pred_themes))
    h, c, v = homogeneity_completeness_v_measure(true_themes, pred_themes)
    P, R, F, S = precision_recall_fscore_support(
        true_themes, pred_themes, labels=THEMES, zero_division=0)
    macro_f1 = float(sum(F) / len(F))
    # Weighted
    total = sum(S)
    weighted_f1 = float(sum(F[i] * S[i] for i in range(len(F))) / total) if total else 0.0
    # Coerência
    topic_words = extract_topic_words_from_assignments(pred_themes, texts)
    coh = compute_coherence(topic_words, texts)
    return {
        "ari": ari, "nmi": nmi,
        "homogeneity": float(h), "completeness": float(c),
        "v_measure": float(v),
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "c_v": coh.get("c_v"),
        "c_npmi": coh.get("c_npmi"),
        "per_label": {THEMES[i]: {"P": float(P[i]), "R": float(R[i]),
                                  "F1": float(F[i]), "support": int(S[i])}
                      for i in range(len(THEMES))},
    }


# --------------------- Main ---------------------

async def main():
    print("=== eval_qualitative_v3 ===")
    if not os.getenv("OPENAI_API_KEY"):
        print("[!] sem OPENAI_API_KEY")
        return

    gold_path = METRICS / "qualitative_gold.json"
    if not gold_path.exists():
        print("Construindo gold...")
        from eval_qualitative import build_gold
        gold = build_gold()
    else:
        gold = json.loads(gold_path.read_text(encoding="utf-8"))

    responses = [g["text"] for g in gold]
    true_themes = [g["true_theme"] for g in gold]
    print(f"Gold: {len(responses)} respostas, {len(set(true_themes))} temas")

    # Embeddings das respostas (uma vez, reaproveita)
    print("\nGerando embeddings (uma vez)...")
    from services.ai.llm_config import get_embeddings
    embedder = get_embeddings()
    response_embs = await embedder.aembed_documents(responses)

    # ---------- LLM clustering com 3 seeds (stability) ----------
    print(f"\n--- LLM clustering, {N_SEEDS} seeds ---")
    llm_runs = []
    for s in range(N_SEEDS):
        print(f"\n[seed {s}]")
        t0 = time.perf_counter()
        clusters = await run_llm_clustering(responses, s)
        print(f"  Clusters: {len(clusters)}")
        pred_themes = await map_pred_themes(responses, clusters, THEMES)
        metrics = compute_clustering_metrics(true_themes, pred_themes, responses)
        elapsed = time.perf_counter() - t0
        print(f"  ARI={metrics['ari']:.4f} NMI={metrics['nmi']:.4f} "
              f"c_v={metrics['c_v']:.4f} macro_F1={metrics['macro_f1']:.4f} "
              f"weighted_F1={metrics['weighted_f1']:.4f} ({elapsed:.1f}s)")
        llm_runs.append({"seed": s, "metrics": metrics,
                         "clusters": [c.get("theme") for c in clusters]})

    # Stability: média e desvio-padrão
    def mean_std(key):
        vals = [r["metrics"][key] for r in llm_runs
                if r["metrics"][key] is not None and not math.isnan(r["metrics"][key])]
        if not vals:
            return None, None
        m = sum(vals) / len(vals)
        v = sum((x - m) ** 2 for x in vals) / max(1, len(vals) - 1)
        return m, math.sqrt(v)

    llm_stability = {
        "ari_mean": mean_std("ari")[0], "ari_std": mean_std("ari")[1],
        "nmi_mean": mean_std("nmi")[0], "nmi_std": mean_std("nmi")[1],
        "cv_mean": mean_std("c_v")[0], "cv_std": mean_std("c_v")[1],
        "macro_f1_mean": mean_std("macro_f1")[0],
        "macro_f1_std": mean_std("macro_f1")[1],
        "weighted_f1_mean": mean_std("weighted_f1")[0],
        "weighted_f1_std": mean_std("weighted_f1")[1],
    }
    print(f"\nLLM stability across {N_SEEDS} seeds:")
    print(f"  ARI: {llm_stability['ari_mean']:.4f} ± {llm_stability['ari_std']:.4f}")
    print(f"  NMI: {llm_stability['nmi_mean']:.4f} ± {llm_stability['nmi_std']:.4f}")
    print(f"  c_v: {llm_stability['cv_mean']:.4f} ± {llm_stability['cv_std']:.4f}")

    # ---------- Baselines ----------
    print("\n--- Baselines ---")
    baselines = {}

    print("k-means k=7...")
    km = kmeans_baseline(responses, response_embs, true_themes, seed=42)
    baselines["kmeans"] = compute_clustering_metrics(
        true_themes, km["pred_themes"], responses)
    print(f"  ARI={baselines['kmeans']['ari']:.4f} NMI={baselines['kmeans']['nmi']:.4f} "
          f"c_v={baselines['kmeans']['c_v']:.4f}")

    print("LDA k=7...")
    lda = lda_baseline(responses, true_themes, seed=42)
    baselines["lda"] = compute_clustering_metrics(
        true_themes, lda["pred_themes"], responses)
    print(f"  ARI={baselines['lda']['ari']:.4f} NMI={baselines['lda']['nmi']:.4f} "
          f"c_v={baselines['lda']['c_v']:.4f}")

    print("BERTopic...")
    bt = bertopic_baseline(responses, response_embs, true_themes, seed=42)
    baselines["bertopic"] = compute_clustering_metrics(
        true_themes, bt["pred_themes"], responses)
    print(f"  ARI={baselines['bertopic']['ari']:.4f} NMI={baselines['bertopic']['nmi']:.4f} "
          f"c_v={baselines['bertopic']['c_v']:.4f}")

    # Bootstrap ARI para o LLM (sobre o último run, indicativo)
    last_pred = await map_pred_themes(responses,
                                       await run_llm_clustering(responses, 0),
                                       THEMES)
    paired = list(zip(true_themes, last_pred))

    def _ari(s):
        from sklearn.metrics import adjusted_rand_score
        return float(adjusted_rand_score([x[0] for x in s], [x[1] for x in s]))

    ari_ci = bootstrap_ci(_ari, paired, n_boot=500)
    print(f"\nLLM ARI (último seed) IC95%: {fmt_ci(ari_ci)}")

    # ---------- Salva ----------
    payload = {
        "agent": "qualitative_analyzer",
        "version": "v3_2026-05",
        "n_responses": len(responses),
        "n_themes": len(set(true_themes)),
        "n_seeds": N_SEEDS,
        "llm_runs": [
            {"seed": r["seed"], "ari": r["metrics"]["ari"],
             "nmi": r["metrics"]["nmi"], "c_v": r["metrics"]["c_v"],
             "macro_f1": r["metrics"]["macro_f1"],
             "weighted_f1": r["metrics"]["weighted_f1"],
             "clusters": r["clusters"]} for r in llm_runs
        ],
        "llm_stability": llm_stability,
        "llm_last_run_full": llm_runs[-1]["metrics"],
        "llm_ari_ci": {"point": ari_ci["point"],
                       "lo": ari_ci["lo"], "hi": ari_ci["hi"]},
        "baselines": baselines,
    }
    (METRICS / "qualitative_v3_metrics.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    print(f"\nResultados em {METRICS / 'qualitative_v3_metrics.json'}")

    # CSV baselines comparativo
    with open(METRICS / "qualitative_v3_baselines.csv", "w", newline="",
              encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["method", "ari", "nmi", "homogeneity", "completeness",
                    "v_measure", "c_v", "c_npmi", "macro_f1", "weighted_f1"])
        # LLM (média)
        w.writerow(["LLM (média 3 seeds)",
                    f"{llm_stability['ari_mean']:.4f}±{llm_stability['ari_std']:.4f}",
                    f"{llm_stability['nmi_mean']:.4f}±{llm_stability['nmi_std']:.4f}",
                    "-", "-", "-",
                    f"{llm_stability['cv_mean']:.4f}±{llm_stability['cv_std']:.4f}",
                    "-",
                    f"{llm_stability['macro_f1_mean']:.4f}±{llm_stability['macro_f1_std']:.4f}",
                    f"{llm_stability['weighted_f1_mean']:.4f}±{llm_stability['weighted_f1_std']:.4f}"])
        for name in ["kmeans", "lda", "bertopic"]:
            m = baselines[name]
            w.writerow([name, f"{m['ari']:.4f}", f"{m['nmi']:.4f}",
                        f"{m['homogeneity']:.4f}", f"{m['completeness']:.4f}",
                        f"{m['v_measure']:.4f}",
                        f"{m['c_v']:.4f}" if m['c_v'] is not None else "-",
                        f"{m['c_npmi']:.4f}" if m['c_npmi'] is not None else "-",
                        f"{m['macro_f1']:.4f}", f"{m['weighted_f1']:.4f}"])


if __name__ == "__main__":
    asyncio.run(main())
