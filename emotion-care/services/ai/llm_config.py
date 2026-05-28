"""
Configuração do LLM via LangChain.
Suporta OpenAI direto ou via OpenRouter.
"""

import os
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Modelos por caso de uso (configurável via .env)
_DEFAULT_MODELS = {
    "narrator": "gpt-4o-mini",      # Texto técnico longo — mini é rápido e suficiente
    "action_plan": "gpt-4o-mini",   # Planos 5W2H estruturados
    "copilot": "gpt-4o-mini",       # Respostas curtas do copiloto
    "suggestions": "gpt-4o-mini",   # Sugestões de follow-up
    "risk_comm": "gpt-4o-mini",     # Comunicação de riscos para CIPA
    "qualitative": "gpt-4o-mini",  # Clustering de respostas abertas (NC_OPEN_VIEW)
}


def get_llm(temperature: float = 0.3, max_tokens: int = 1500, model: str = None, use_case: str = None):
    """Retorna instância do LLM configurado.

    Args:
        temperature: Criatividade (0.0 a 1.0).
        max_tokens: Máximo de tokens na resposta.
        model: Override explícito do modelo.
        use_case: Caso de uso (narrator, action_plan, copilot, suggestions).
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_API_BASE", None)

    # Prioridade: model param > env var por use_case > default por use_case > env global > gpt-4o-mini
    if model:
        model_name = model
    elif use_case:
        env_key = f"LLM_MODEL_{use_case.upper()}"
        model_name = os.getenv(env_key, _DEFAULT_MODELS.get(use_case, "gpt-4o-mini"))
    else:
        model_name = os.getenv("LLM_MODEL", "gpt-4o-mini")

    kwargs = {
        "model": model_name,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "api_key": api_key,
    }
    if base_url:
        kwargs["base_url"] = base_url

    return ChatOpenAI(**kwargs)


def get_embeddings():
    """Retorna modelo de embeddings."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    base_url = os.getenv("OPENAI_API_BASE", None)
    model_name = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    kwargs = {
        "model": model_name,
        "api_key": api_key,
    }
    if base_url:
        kwargs["base_url"] = base_url

    return OpenAIEmbeddings(**kwargs)
