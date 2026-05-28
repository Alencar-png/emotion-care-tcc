"""Orquestrador de evals comparativos com LLMs locais (Ollama).

Roda os 4 agentes generativos (action_plan, copilot, qualitative, narrator)
com um modelo Ollama escolhido, salvando os JSONs em arquivos sufixados
pelo nome do modelo (ex.: action_plan_v3_metrics_qwen.json).

Uso:
    python run_local_evals.py qwen2.5:14b
    python run_local_evals.py phi4:14b

Pré-requisitos:
    - Ollama rodando em http://localhost:11434
    - Modelo já baixado (ollama pull <nome>)
    - Banco PostgreSQL com copilot_knowledge populado
"""
from __future__ import annotations
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent

if len(sys.argv) < 2:
    print("Uso: python run_local_evals.py <modelo>")
    print("Exemplos: qwen2.5:14b, phi4:14b")
    sys.exit(1)

MODEL = sys.argv[1]
SUFFIX = MODEL.replace(":", "_").replace(".", "_")

# Set env vars BEFORE importing any agent module
os.environ["LLM_API_BASE"] = "http://localhost:11434/v1"
os.environ["LLM_API_KEY"] = "ollama-dummy"
os.environ["LLM_MODEL"] = MODEL
for uc in ("NARRATOR", "ACTION_PLAN", "COPILOT", "QUALITATIVE",
           "SUGGESTIONS", "RISK_COMM"):
    os.environ[f"LLM_MODEL_{uc}"] = MODEL

METRICS = ROOT.parent / "metrics"
METRICS.mkdir(exist_ok=True)


def archive_outputs(suffix: str, files: list[str]) -> None:
    """Move JSONs produzidos pelos evals para nomes sufixados."""
    for f in files:
        src = METRICS / f
        if src.exists():
            dst = METRICS / f.replace(".json", f"_{suffix}.json")
            dst_csv = METRICS / f.replace(".json", f"_{suffix}.csv")
            shutil.copy(src, dst)
            # Copia também CSVs irmãos se existirem
            csv_src = METRICS / f.replace(".json", "_per_case.csv")
            if csv_src.exists():
                shutil.copy(csv_src, METRICS / csv_src.name.replace(".csv", f"_{suffix}.csv"))


def run_eval(script: str, out_files: list[str]) -> None:
    """Executa um eval em subprocesso herdando o env de Ollama."""
    print(f"\n=== Rodando {script} com {MODEL} ===")
    t0 = time.perf_counter()
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        [sys.executable, script],
        env=env,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    elapsed = time.perf_counter() - t0
    print(f"  retcode={result.returncode}, tempo={elapsed:.0f}s")
    # Salva log
    log_path = METRICS / f"_{script.replace('.py', '')}_{SUFFIX}.log"
    log_path.write_text(result.stdout + "\n--- STDERR ---\n" + result.stderr,
                         encoding="utf-8")
    archive_outputs(SUFFIX, out_files)


def main():
    print(f"=== Run local evals com modelo: {MODEL} ===")
    print(f"Suffix: {SUFFIX}")
    print(f"LLM_API_BASE: {os.environ['LLM_API_BASE']}")

    plan = [
        ("eval_action_plan_v3.py", ["action_plan_v3_metrics.json"]),
        ("eval_copilot_v3.py", ["copilot_v3_metrics.json"]),
        ("eval_qualitative_v3.py", ["qualitative_v3_metrics.json"]),
        ("eval_narrator_v3.py", ["narrator_v3_metrics.json"]),
    ]

    for script, outs in plan:
        # Limpa cache do narrador antes de re-rodar com novo modelo
        if script == "eval_narrator_v3.py":
            cache = METRICS / "narrator_v3_outputs.pkl"
            if cache.exists():
                cache.unlink()
        run_eval(script, outs)

    print("\n=== Todos os evals concluídos ===")


if __name__ == "__main__":
    main()
