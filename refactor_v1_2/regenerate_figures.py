"""Regera as 4 figuras estáticas do TCC (1 a 4) com:
 - acentos PT-BR completos
 - texto que cabe dentro das caixas (sem overflow)
 - layout mais compacto (menos espaço morto)
 - DPI 300 para qualidade ABNT

Saídas:
 figures/fig_system_design.png    (Figura 1)
 figures/fig_user_flow.png        (Figura 2)
 figures/fig_llm_pipeline.png     (Figura 3)
 figures/fig_llm_processing.png   (Figura 4)
"""
from __future__ import annotations

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from pathlib import Path

FIG = Path(__file__).parent / "figures"
FIG.mkdir(exist_ok=True)


def box(ax, xy, w, h, text, *, fc="#dde6f5", ec="#34466b", fontsize=9.5,
        bold=False, italic=False):
    """Caixa arredondada com texto centralizado, com quebra de linha
    automática se o texto vier com \\n."""
    x, y = xy
    p = FancyBboxPatch((x, y), w, h,
                       boxstyle="round,pad=0.02,rounding_size=0.04",
                       linewidth=1.2, edgecolor=ec, facecolor=fc)
    ax.add_patch(p)
    weight = "bold" if bold else "normal"
    style = "italic" if italic else "normal"
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontsize=fontsize, fontweight=weight, style=style, wrap=True)


def arrow(ax, src, dst, *, color="#5b6b8d", style="-", label=None,
          label_offset=(0, 0.05), fontsize=8.5):
    a = FancyArrowPatch(src, dst, arrowstyle="->,head_width=4,head_length=6",
                        linewidth=1.2, color=color, linestyle=style)
    ax.add_patch(a)
    if label:
        mx = (src[0] + dst[0]) / 2 + label_offset[0]
        my = (src[1] + dst[1]) / 2 + label_offset[1]
        ax.text(mx, my, label, ha="center", va="center", fontsize=fontsize,
                style="italic", color="#445275")


# ---------- Figura 1: System Design ----------

def fig_system_design():
    fig, ax = plt.subplots(figsize=(11, 6.5))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis("off")
    ax.set_title(
        "Figura 1 - System Design: arquitetura conceitual do Emotion Care",
        fontsize=13, fontweight="bold", pad=14)

    # Linha 1
    box(ax, (0.4, 6.8), 3.4, 1.4,
        "CAMADA DE CLIENTE\nNavegador / interface\n(colaboradores e gestores)",
        fc="#dde6f5", ec="#34466b", bold=True, fontsize=9.5)
    box(ax, (5.1, 6.8), 3.4, 1.4,
        "CAMADA DE SERVIDOR\nFastAPI 0.111\n(roteamento e auth)",
        fc="#fff3c6", ec="#a8842b", bold=True, fontsize=9.5)
    box(ax, (9.8, 6.8), 3.9, 1.4,
        "MOTOR ANALÍTICO\nNormalização COPSOQ-II\n+ k-anonymity (k = 4 / 3)",
        fc="#fff3c6", ec="#a8842b", bold=True, fontsize=9.5)

    # Linha 2: persistência + agentes
    box(ax, (0.4, 3.7), 3.4, 1.7,
        "PostgreSQL 16\n+ pgvector 0.7\n(34 tabelas, embeddings 1.536d)",
        fc="#dff2d8", ec="#3e7d2a", bold=True, fontsize=9.5)
    box(ax, (4.6, 3.4), 9.1, 2.3,
        "AGENTES LLM (cinco agentes especializados)\n"
        "Narrador do PGR · Gerador 5W2H · Copiloto RAG\n"
        "Validador anti-PII · Analisador Qualitativo",
        fc="#fadcec", ec="#8b3a72", bold=True, fontsize=10)

    # Linha 3: API externa + publicação
    box(ax, (4.6, 0.4), 4.3, 1.7,
        "OpenAI API\ngpt-4o-mini\ntext-embedding-3-small",
        fc="#fadcec", ec="#8b3a72", bold=True, fontsize=9.5)
    box(ax, (9.4, 0.4), 4.3, 1.7,
        "PUBLICAÇÃO\nPDF assinado\n(Inventário + Plano 5W2H)",
        fc="#fff3c6", ec="#a8842b", bold=True, fontsize=9.5)

    # Setas linha 1
    arrow(ax, (3.8, 7.5), (5.1, 7.5), label="HTTPS/REST",
          label_offset=(0, 0.18))
    arrow(ax, (8.5, 7.5), (9.8, 7.5), label="agregados",
          label_offset=(0, 0.18))
    # Servidor -> Agentes
    arrow(ax, (6.8, 6.8), (6.8, 5.7), label="JSON",
          label_offset=(0.45, 0))
    # Motor -> Agentes
    arrow(ax, (11.6, 6.8), (11.0, 5.7), label="scores",
          label_offset=(0.5, 0))
    # DB <-> Agentes
    arrow(ax, (4.6, 4.5), (3.8, 4.5))
    arrow(ax, (3.8, 4.8), (4.6, 4.8), label="leituras",
          label_offset=(0, 0.2))
    # Agentes -> OpenAI
    arrow(ax, (6.8, 3.4), (6.8, 2.1), label="embeddings / geração",
          label_offset=(0.95, 0))
    # OpenAI -> Publicação
    arrow(ax, (8.9, 1.25), (9.4, 1.25), label="documentos validados",
          label_offset=(0, 0.22))

    plt.tight_layout()
    plt.savefig(FIG / "fig_system_design.png", dpi=300, bbox_inches="tight")
    plt.close()
    print("OK fig_system_design.png")


# ---------- Figura 2: User Flow ----------

def fig_user_flow():
    fig, ax = plt.subplots(figsize=(12, 6.5))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis("off")
    ax.set_title(
        "Figura 2 - User Flow: colaborador respondente e gestor de SST",
        fontsize=13, fontweight="bold", pad=14)

    # Lane do colaborador
    ax.text(0.3, 8.0, "Colaborador", fontsize=12, fontweight="bold",
            color="#34466b")

    colab_steps = [
        ("Recebe convite\n(e-mail / SMS)",),
        ("Responde COPSOQ II-Br\n(escala Likert 1 a 5)",),
        ("Persistência anônima\n(ResponseAnswer)",),
        ("Campanha encerra\n(motor agrega scores)",),
        ("k-anonymity\nverifica piso (4 / 3)",),
        ("Não vê dados\nindividualizáveis",),
    ]
    w = 2.05
    h = 1.05
    gap = 0.18
    y_top = 6.5
    xs = [0.4 + i * (w + gap) for i in range(len(colab_steps))]
    for x, (txt,) in zip(xs, colab_steps):
        box(ax, (x, y_top), w, h, txt, fc="#dde6f5", ec="#34466b",
            fontsize=8.5)
    # Setas horizontais
    for i in range(len(colab_steps) - 1):
        arrow(ax, (xs[i] + w, y_top + h / 2),
              (xs[i + 1], y_top + h / 2))

    # Lane do gestor
    ax.text(0.3, 4.0, "Gestor de SST", fontsize=12, fontweight="bold",
            color="#8b2840")
    gestor_steps = [
        ("Acessa\ndashboard",),
        ("Inspeciona scores\nautorizados",),
        ("Aciona agentes\nLLM",),
        ("Revisa\nInventário PGR",),
        ("Revisa\nPlano 5W2H",),
        ("Exporta PDF\nassinado",),
    ]
    y_bot = 2.45
    for x, (txt,) in zip(xs, gestor_steps):
        box(ax, (x, y_bot), w, h, txt, fc="#dde6f5", ec="#34466b",
            fontsize=8.5)
    for i in range(len(gestor_steps) - 1):
        arrow(ax, (xs[i] + w, y_bot + h / 2),
              (xs[i + 1], y_bot + h / 2))

    # Seta entre lanes (de campanha encerra → revisa PGR via gestor)
    arrow(ax,
          (xs[3] + w / 2, y_top),
          (xs[3] + w / 2, y_bot + h),
          style="--",
          label="agregados\nliberados",
          label_offset=(0.85, 0))

    # Caixa anti-PII embaixo, contida
    pii_y = 0.4
    pii_x = 1.8
    pii_w = 10.4
    pii_h = 1.2
    box(ax, (pii_x, pii_y), pii_w, pii_h,
        "Toda saída textual passa obrigatoriamente pelo Validador anti-PII\n"
        "antes de ser exibida ao gestor",
        fc="#fbe2e2", ec="#a83232", bold=True, fontsize=10)
    # Seta de gestor->PII
    arrow(ax,
          (xs[2] + w / 2, y_bot),
          (xs[2] + w / 2, pii_y + pii_h),
          color="#a83232", style=":")

    plt.tight_layout()
    plt.savefig(FIG / "fig_user_flow.png", dpi=300, bbox_inches="tight")
    plt.close()
    print("OK fig_user_flow.png")


# ---------- Figura 3: Pipeline LLM/RAG ----------

def fig_llm_pipeline():
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis("off")
    ax.set_title(
        "Figura 3 - Pipeline LLM/RAG dos cinco agentes com validador anti-PII",
        fontsize=12.5, fontweight="bold", pad=12)

    # Linha superior: fluxo principal
    items = [
        ("Entrada\nscores agregados\nou pergunta", "#dde6f5", "#34466b"),
        ("Construtor de\nprompt + payload\nJSON", "#fff3c6", "#a8842b"),
        ("LLM\ngpt-4o-mini\ntemp [0.1, 0.5]", "#fadcec", "#8b3a72"),
        ("Saída JSON\nestruturada", "#fadcec", "#8b3a72"),
        ("Validador anti-PII\n8 categorias\nregex + heurística", "#fbe2e2",
         "#a83232"),
    ]
    w = 2.25
    h = 1.45
    gap = 0.35
    y_top = 5.0
    xs = [0.5 + i * (w + gap) for i in range(len(items))]
    for x, (txt, fc, ec) in zip(xs, items):
        bold = "Validador" in txt or "LLM" in txt
        box(ax, (x, y_top), w, h, txt, fc=fc, ec=ec, bold=bold, fontsize=9)
    for i in range(len(items) - 1):
        arrow(ax, (xs[i] + w, y_top + h / 2),
              (xs[i + 1], y_top + h / 2))

    # Retriever pgvector embaixo do LLM
    rx = xs[2] - 0.1
    ry = 2.0
    rw = 2.45
    rh = 1.3
    box(ax, (rx, ry), rw, rh,
        "Retriever pgvector\nembedding 1.536d\ntop-k = 5, sim >= 0,75",
        fc="#dff2d8", ec="#3e7d2a", fontsize=8.7)
    # Seta retriever → LLM (chunks)
    arrow(ax, (rx + rw / 2, ry + rh),
          (xs[2] + w / 2, y_top), style="--",
          label="chunks recuperados", label_offset=(0.85, 0))

    # Decisor (limpo / contém PII)
    dx = xs[2]
    dy = 0.3
    dw = w * 2 + gap
    dh = 1.1
    box(ax, (dx, dy), dw, dh,
        "Decisor: se limpo, entrega ao gestor;\n"
        "se contém PII, redact + log auditável",
        fc="#fbe2e2", ec="#a83232", fontsize=9)

    # Seta saída JSON → decisor
    arrow(ax, (xs[3] + w / 2, y_top), (dx + dw / 2, dy + dh))
    # Seta validador → decisor (se PII)
    arrow(ax, (xs[4] + w / 2, y_top), (dx + dw, dy + dh / 2),
          style=":", color="#a83232", label="se PII", label_offset=(0.4, 0.2))
    # Documento entregue
    edx = xs[4]
    edy = 0.3
    box(ax, (edx, edy), w, 1.1,
        "Documento entregue\nao gestor\n(Inventário / 5W2H / RAG)",
        fc="#fff3c6", ec="#a8842b", bold=True, fontsize=8.7)
    # Seta decisor → entregue
    arrow(ax, (dx + dw, dy + dh / 2), (edx, edy + 0.55))

    plt.tight_layout()
    plt.savefig(FIG / "fig_llm_pipeline.png", dpi=300, bbox_inches="tight")
    plt.close()
    print("OK fig_llm_pipeline.png")


# ---------- Figura 4: Processamento no narrador ----------

def fig_llm_processing():
    fig, ax = plt.subplots(figsize=(13, 4.8))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.set_title(
        "Figura 4 - Processamento de uma resposta no agente narrador do PGR",
        fontsize=12.5, fontweight="bold", pad=12)

    stages = [
        ("Resposta\nLikert 1 a 5", "#e9f3fb", "#34466b"),
        ("Normalização\n0 a 100", "#d4f1f5", "#2784a2"),
        ("Agregação\npor dimensão", "#bce7f0", "#2784a2"),
        ("k-anonymity\n(piso >= 4)", "#fce5c4", "#a8842b"),
        ("Serialização\nJSON", "#fff3c6", "#a8842b"),
        ("Tokenização\n(BPE)", "#f5d27b", "#a8842b"),
        ("Embedding\n+ atenção\n(Transformer)", "#f4a04e", "#7a3c10",
         True),
        ("Decoder\nautorregressivo", "#ea7427", "#7a3c10", True),
        ("Detokenização\n+ parsing JSON", "#f4a04e", "#7a3c10"),
        ("Validador\nanti-PII", "#fbe2e2", "#a83232", True),
        ("Inventário\nde Riscos", "#dff2d8", "#3e7d2a"),
    ]
    w = 1.12
    h = 1.55
    gap = 0.12
    y = 3.0
    xs = [0.45 + i * (w + gap) for i in range(len(stages))]
    for x, s in zip(xs, stages):
        txt, fc, ec = s[0], s[1], s[2]
        bold = (len(s) > 3 and s[3])
        box(ax, (x, y), w, h, txt, fc=fc, ec=ec, bold=bold, fontsize=8.2)
    # Setas
    for i in range(len(stages) - 1):
        arrow(ax, (xs[i] + w, y + h / 2),
              (xs[i + 1], y + h / 2))

    # Faixas anotadoras embaixo
    ax.annotate("", xy=(xs[5] + w, 2.6), xytext=(xs[1], 2.6),
                arrowprops=dict(arrowstyle="-", color="#2784a2",
                                linewidth=1.5))
    ax.text((xs[1] + xs[5] + w) / 2, 2.3, "motor determinístico (Python)",
            ha="center", fontsize=9, color="#2784a2", style="italic")
    ax.annotate("", xy=(xs[8] + w, 2.6), xytext=(xs[6], 2.6),
                arrowprops=dict(arrowstyle="-", color="#7a3c10",
                                linewidth=1.5))
    ax.text((xs[6] + xs[8] + w) / 2, 2.3, "OpenAI gpt-4o-mini (API)",
            ha="center", fontsize=9, color="#7a3c10", style="italic")
    ax.annotate("", xy=(xs[9] + w, 2.6), xytext=(xs[9], 2.6),
                arrowprops=dict(arrowstyle="-", color="#a83232",
                                linewidth=1.5))
    ax.text(xs[9] + w / 2, 2.3, "validador local",
            ha="center", fontsize=9, color="#a83232", style="italic")

    # Caixa de texto explicativa abaixo
    caption = (
        "Cada estágio é instrumentado para coletar latência, tokens "
        "consumidos e taxa de falhas. O processamento do LLM (caixas em "
        "laranja) é uma caixa-preta acessada via API; a determinização "
        "ocorre nas camadas anteriores (Python puro) e o filtro anti-PII "
        "(vermelho) é o gate de saída obrigatório."
    )
    ax.text(7, 0.95, caption, ha="center", va="center", fontsize=9,
            style="italic", color="#333", wrap=True)

    plt.tight_layout()
    plt.savefig(FIG / "fig_llm_processing.png", dpi=300, bbox_inches="tight")
    plt.close()
    print("OK fig_llm_processing.png")


if __name__ == "__main__":
    fig_system_design()
    fig_user_flow()
    fig_llm_pipeline()
    fig_llm_processing()
    print("Todas as figuras regeneradas.")
