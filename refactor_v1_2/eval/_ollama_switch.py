"""Configura Ollama (Qwen 2.5 14B) como provedor de LLM para os evals.

Import this BEFORE importing services.ai.* nos scripts de eval v2.2/qwen.

Como Ollama oferece endpoint compatível com OpenAI em /v1, apenas
sobrescrevemos as env vars que o ChatOpenAI consulta. Embeddings
continuam via OpenAI text-embedding-3-small (necessário para
compatibilidade com índice pgvector da copilot_knowledge).
"""
import os

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:14b")


def enable_ollama_for_chat() -> None:
    """Direciona TODAS as chamadas ChatOpenAI para Ollama local.

    Mantém OPENAI_API_KEY original para o cliente de embeddings, que
    é construído em paralelo (get_embeddings em llm_config.py).
    """
    # Após o refactor do llm_config.py, get_llm() lê LLM_API_BASE
    # separadamente de get_embeddings() (que continua via OPENAI_*).
    os.environ["LLM_API_BASE"] = OLLAMA_BASE_URL
    os.environ["LLM_API_KEY"] = "ollama-dummy"
    os.environ["LLM_MODEL"] = OLLAMA_MODEL
    for use_case in ("NARRATOR", "ACTION_PLAN", "COPILOT", "QUALITATIVE",
                     "SUGGESTIONS", "RISK_COMM"):
        os.environ[f"LLM_MODEL_{use_case}"] = OLLAMA_MODEL


def restore_openai_chat() -> None:
    """Desfaz o switch (restaura OpenAI para chat)."""
    for k in ("LLM_API_BASE", "LLM_API_KEY", "LLM_MODEL"):
        if k in os.environ:
            del os.environ[k]
    for use_case in ("NARRATOR", "ACTION_PLAN", "COPILOT", "QUALITATIVE",
                     "SUGGESTIONS", "RISK_COMM"):
        key = f"LLM_MODEL_{use_case}"
        if key in os.environ:
            del os.environ[key]


if __name__ == "__main__":
    enable_ollama_for_chat()
    print(f"OLLAMA_BASE_URL={OLLAMA_BASE_URL}")
    print(f"LLM_MODEL={OLLAMA_MODEL}")
    print("Pronto para testes locais.")
