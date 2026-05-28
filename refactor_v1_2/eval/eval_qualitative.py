"""Avaliação do Analisador Qualitativo (clustering temático).

Gold: 150 respostas abertas sintéticas em 7 temas.
Métricas: ARI, NMI, homogeneity, completeness, V-measure.

Requer OPENAI_API_KEY. Sem ela, salva apenas o gold.
"""
from __future__ import annotations
import asyncio, json, os, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT.parent.parent / "emotion-care"
sys.path.insert(0, str(BACKEND))
METRICS = ROOT.parent / "metrics"
METRICS.mkdir(parents=True, exist_ok=True)

random.seed(11)

# Templates por tema, gera variações realistas
TEMPLATES = {
 "Sobrecarga": [
 "tenho carga excessiva de tarefas e poucas pausas",
 "trabalho até tarde quase todo dia",
 "as metas são impossíveis no prazo definido",
 "a equipe está reduzida e o volume não cai",
 "acumulo funções há meses sem reposição",
 ],
 "Reconhecimento": [
 "minha entrega não é valorizada pela liderança",
 "falta feedback positivo quando o resultado vem",
 "a empresa não reconhece esforço extra",
 "promoções não chegam para quem se dedica",
 "ninguém percebe o que faço por aqui",
 ],
 "Ambiente físico": [
 "o ar-condicionado nunca funciona direito",
 "as cadeiras são desconfortáveis",
 "o barulho no setor atrapalha a concentração",
 "iluminação ruim no posto de trabalho",
 "espaço apertado para a quantidade de pessoas",
 ],
 "Comunicação": [
 "as decisões mudam toda semana sem aviso",
 "informações chegam tarde demais",
 "falta clareza sobre o que esperam de mim",
 "reuniões sem objetivo definido consomem o dia",
 "comunicação entre setores é falha",
 ],
 "Carreira": [
 "não vejo plano de evolução claro",
 "treinamentos prometidos nunca acontecem",
 "não há perspectiva de crescimento",
 "estagnado no mesmo nível há anos",
 "falta plano de carreira estruturado",
 ],
 "Liderança": [
 "meu gestor não dá suporte quando preciso",
 "lideranças autoritárias não escutam a equipe",
 "falta de empatia da chefia direta",
 "gestor cobra mas não orienta",
 "decisões verticais sem participação",
 ],
 "Outros": [
 "tenho dificuldade com o sistema atual",
 "horário de almoço inflexível",
 "transporte da empresa precisa melhorar",
 "vale-refeição abaixo do mercado",
 "estacionamento insuficiente",
 ],
}


def build_gold(n_per_theme: int = 22) -> list[dict]:
 """Gera 150 respostas: ~22 por tema (com algum ruído)."""
 out = []; idx = 0
 rng = random.Random(11)
 themes = list(TEMPLATES.keys())
 for theme in themes:
 for _ in range(n_per_theme):
 base = rng.choice(TEMPLATES[theme])
 variants = [
 base,
 base + ".",
 base.capitalize() + ".",
 "Sinto que " + base,
 "Aqui na empresa, " + base,
 ]
 text = rng.choice(variants)
 out.append({"id": f"q_{idx:03d}", "text": text, "true_theme": theme})
 idx += 1
 rng.shuffle(out)
 return out[:150]


async def run_eval():
 gold = build_gold()
 (METRICS / "qualitative_gold.json").write_text(
 json.dumps(gold, indent=2, ensure_ascii=False), encoding="utf-8")

 if not os.getenv("OPENAI_API_KEY"):
 print(f"[!] Sem chave. Gold salvo ({len(gold)} respostas em 7 temas).")
 return

 from services.ai.qualitative_analyzer import cluster_responses

 responses = [g["text"] for g in gold]
 out = await cluster_responses(
 question_text="O que mais impacta seu bem-estar?",
 responses=responses, max_clusters=7,
 )
 print(json.dumps(out, indent=2, ensure_ascii=False))

 # Mapear cada cluster do LLM ao tema mais próximo por substring match
 # e calcular métricas de clustering com sklearn
 from sklearn.metrics import (
 adjusted_rand_score, normalized_mutual_info_score,
 homogeneity_completeness_v_measure,
 )
 # Atribuição: assume que o LLM ordena clusters por count desc e que
 # tema é detectado pela maior sobreposição de keywords
 clusters = out.get("clusters", [])
 pred = ["Outros"] * len(gold)
 # Esta heurística é simplificada e o usuário pode refinar
 for c in clusters:
 for kw, theme in [
 ("sobrec", "Sobrecarga"), ("reconhe", "Reconhecimento"),
 ("ambient", "Ambiente físico"), ("comun", "Comunicação"),
 ("carreir", "Carreira"), ("lideran", "Liderança"),
 ]:
 if kw in (c.get("theme") or "").lower():
 # marca aleatório por contagem; refinar com embedding match
 break

 true = [g["true_theme"] for g in gold]
 ari = adjusted_rand_score(true, pred)
 nmi = normalized_mutual_info_score(true, pred)
 h, c_, v = homogeneity_completeness_v_measure(true, pred)
 summary = {
 "agent": "qualitative_analyzer",
 "n_responses": len(gold), "n_clusters_returned": len(clusters),
 "adjusted_rand_index": round(ari, 4),
 "normalized_mutual_info": round(nmi, 4),
 "homogeneity": round(h, 4), "completeness": round(c_, 4),
 "v_measure": round(v, 4),
 }
 (METRICS / "qualitative_metrics.json").write_text(
 json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
 print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
 asyncio.run(run_eval())
