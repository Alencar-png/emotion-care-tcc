"""Gold standard expandido do validador anti-PII com 1.000 casos e
span-level offsets.

Distribuição: 420 positivos / 580 negativos. Cada caso tem:
 - id
 - text
 - gold_spans: lista de Span(start, end, category); vazia para negativos
 - categories_expected: conjunto agregado (compatibilidade com gold v1)

Construção determinística por template (random_state fixo), de modo a
permitir reprodução exata. Os textos cobrem variações realistas para
cada categoria (e-mail, CPF, CNPJ, telefone, matrícula, cargo
identificador, título + prenome, nome composto), além de adversariais
projetados para induzir falsos-positivos em heurísticas ingênuas.

Uso:
 from pii_gold_1000 import CASES, POSITIVE_CASES, NEGATIVE_CASES, Case
 for c in CASES:
   print(c.id, c.text, c.gold_spans)
"""
from __future__ import annotations

import random
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

# Importa Span de metrics_core
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from metrics_core import Span  # noqa: E402


CATEGORIES = [
    "email", "cpf", "cnpj", "telefone", "matricula",
    "cargo_identificador", "titulo_nome", "nome",
]


@dataclass(frozen=True)
class Case:
    id: str
    text: str
    gold_spans: List[Span] = field(default_factory=list)

    @property
    def categories_expected(self) -> set:
        return {s.category for s in self.gold_spans}

    @property
    def is_positive(self) -> bool:
        return bool(self.gold_spans)


# --------------------- Templates ---------------------

_FIRST_NAMES = [
    "João", "Maria", "Pedro", "Ana", "Lucas", "Beatriz", "Carlos", "Fernanda",
    "Roberto", "Patrícia", "Marcos", "Sofia", "Daniel", "Camila", "Gabriel",
    "Letícia", "Vinícius", "Mariana", "Rodrigo", "Juliana", "André", "Larissa",
    "Henrique", "Isabela", "Tiago", "Renata", "Felipe", "Aline", "Bruno",
    "Carolina", "Eduardo", "Gabriela", "Diego", "Vanessa", "Rafael", "Tatiana",
]
_LAST_NAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Carvalho",
    "Almeida", "Rodrigues", "Costa", "Gomes", "Martins", "Araújo", "Rocha",
    "Cardoso", "Mendes", "Barbosa", "Ribeiro", "Castro", "Moreira", "Andrade",
    "Nascimento", "Ferreira", "Correia", "Pinto", "Cavalcanti", "Pacheco",
    "Vieira", "Mota", "Teixeira",
]
_CONNECTORS = ["da", "de", "dos", "das"]

_TITLE_PREFIXES = [
    "Dr.", "Dra.", "Sr.", "Sra.", "Prof.", "Profa.", "Eng.", "Srta.", "Ms.",
]
_ROLES_ID = [
    "CEO", "CFO", "COO", "CTO", "Diretor Executivo", "Diretor Financeiro",
    "Diretor de Operações", "Diretor de Tecnologia", "Presidente",
    "Gerente Geral", "Superintendente",
]

_EMAIL_USERS = [
    "joao.silva", "maria.souza", "contato", "atendimento", "rh", "suporte",
    "comercial", "diretoria", "noreply", "pedro_henrique", "ana-paula",
    "ContatoRH", "diretor.geral", "MARIA.JOSE+TAG", "tst99", "envio.email",
]
_EMAIL_DOMAINS = [
    "empresa.com.br", "empresa.com", "empresa.io", "startup.tech",
    "x.gov.br", "uol.com.br", "gmail.com", "a.co.uk", "notificacoes.empresa.com",
    "dominio.gov.br", "dominio.com.br", "xyz123.org", "b.co",
]


# --------------------- Helpers ---------------------

def _gen_cpf(rng: random.Random, with_mask: bool) -> str:
    digits = "".join(str(rng.randint(0, 9)) for _ in range(11))
    if with_mask:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    return digits


def _gen_cnpj(rng: random.Random, with_mask: bool) -> str:
    digits = "".join(str(rng.randint(0, 9)) for _ in range(14))
    if with_mask:
        return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"
    return digits


def _gen_phone(rng: random.Random, fmt: str) -> str:
    ddd = rng.choice([11, 21, 31, 41, 47, 51, 61, 71, 81, 82, 85, 91])
    nine = rng.randint(0, 1)
    if nine:
        body = f"9{rng.randint(1000,9999):04d}-{rng.randint(0,9999):04d}"
    else:
        body = f"{rng.randint(2000,5999):04d}-{rng.randint(0,9999):04d}"
    if fmt == "paren":
        return f"({ddd}) {body}"
    elif fmt == "intl":
        return f"+55 {ddd} {body}"
    elif fmt == "intl_split":
        # 9 separado, ponto de falha conhecido
        digits = body.replace("-", "")
        return f"+55{ddd} 9 {digits[1:5]}-{digits[5:9]}"
    elif fmt == "no_paren":
        return f"{ddd} {body}"
    return f"{ddd}{body.replace('-','')}"


def _gen_email(rng: random.Random) -> str:
    user = rng.choice(_EMAIL_USERS)
    dom = rng.choice(_EMAIL_DOMAINS)
    return f"{user}@{dom}"


def _gen_name(rng: random.Random, parts: int = 2) -> str:
    n = [rng.choice(_FIRST_NAMES)]
    for _ in range(parts - 1):
        if rng.random() < 0.25 and len(n) >= 1:
            n.append(rng.choice(_CONNECTORS))
        n.append(rng.choice(_LAST_NAMES))
    return " ".join(n)


def _insert_in_template(rng: random.Random, value: str, category: str,
                        templates: List[str]) -> tuple[str, Span]:
    """Insere value em um template aleatório com o placeholder {V}.
    Retorna (texto, span)."""
    tpl = rng.choice(templates)
    idx = tpl.index("{V}")
    prefix = tpl[:idx]
    suffix = tpl[idx + 3:]
    text = prefix + value + suffix
    start = len(prefix)
    end = start + len(value)
    return text, Span(start=start, end=end, category=category)


_TPL_EMAIL = [
    "contato: {V} para detalhes",
    "envie para {V}",
    "responda a {V}",
    "email institucional {V}",
    "{V} consta no cadastro",
    "encaminhar para {V}",
    "use {V} para suporte",
    "{V} ativo no sistema",
    "remetente: {V}",
    "atendimento via {V}",
]
_TPL_CPF = [
    "CPF {V} informado",
    "documento {V} reconhecido",
    "registro {V} válido",
    "CPF: {V} confirmado",
    "CPF {V} não localizado",
    "{V} no cadastro",
    "{V} do colaborador",
    "RG não, mas CPF {V}",
    "consultou o CPF {V}",
    "CPF de {V} no relatório",
]
_TPL_CNPJ = [
    "empresa {V}",
    "CNPJ {V} ativo",
    "matriz {V}",
    "{V} no contrato",
    "fornecedor {V}",
    "CNPJ {V} vencido",
    "{V} sem máscara",
    "filial CNPJ {V}",
    "documento da empresa {V}",
    "razão social CNPJ {V}",
]
_TPL_PHONE = [
    "ligar para {V}",
    "{V} disponível",
    "telefone {V}",
    "{V} do escritório",
    "celular {V}",
    "{V} contato",
    "fixo {V} da empresa",
    "ligue {V}",
    "{V} manhã",
    "celular pessoal: {V}",
]
_TPL_ENROLL = [
    "matrícula {V} do colaborador",
    "crachá {V} ativo",
    "matrícula nº {V}",
    "registro {V} invalidado",
    "matrícula {V} emitida",
    "crachá nº {V} entregue",
    "ID interno {V}",
    "código de RH {V}",
    "número funcional {V}",
    "{V} no sistema de ponto",
]
_TPL_ROLE = [
    "o {V} da filial informou",
    "{V} anunciou a decisão",
    "{V} assinou o relatório",
    "o {V} acompanhou a reunião",
    "{V} presente na reunião",
    "{V} reuniu o board",
    "{V} aprovou o orçamento",
    "{V} validou o documento",
    "o {V} convocou a equipe",
    "a {V} liderou a apresentação",
]
_TPL_TITLE = [
    "{V} liderou a reunião",
    "{V} assinou o documento",
    "{V} presente no encontro",
    "{V} coordenou o projeto",
    "{V} apresentou os dados",
    "{V} ratificou a decisão",
    "{V} mediou o conflito",
    "{V} aprovou o relatório",
]
_TPL_NAME = [
    "{V} participou da reunião",
    "{V} está de férias",
    "{V} comentou no documento",
    "{V} respondeu ao questionário",
    "{V} validou a etapa",
    "{V} coordenou o projeto",
    "{V} apresentou os resultados",
    "{V} ratificou a decisão",
    "{V} mediou o caso",
    "{V} reportou ao gestor",
]


# --------------------- Geração ---------------------

def _gen_positives(rng: random.Random) -> list[Case]:
    cases: list[Case] = []

    # Cada categoria recebe ~55 spans positivos (8 cats x 55 ~= 440)
    targets = {
        "email": 60,
        "cpf": 55,
        "cnpj": 50,
        "telefone": 55,
        "matricula": 50,
        "cargo_identificador": 50,
        "titulo_nome": 50,
        "nome": 55,
    }

    n_id = 0
    for cat, n_target in targets.items():
        for i in range(n_target):
            n_id += 1
            if cat == "email":
                v = _gen_email(rng)
                text, sp = _insert_in_template(rng, v, "email", _TPL_EMAIL)
            elif cat == "cpf":
                with_mask = rng.random() < 0.6
                v = _gen_cpf(rng, with_mask)
                text, sp = _insert_in_template(rng, v, "cpf", _TPL_CPF)
            elif cat == "cnpj":
                with_mask = rng.random() < 0.7
                v = _gen_cnpj(rng, with_mask)
                text, sp = _insert_in_template(rng, v, "cnpj", _TPL_CNPJ)
            elif cat == "telefone":
                fmt = rng.choice(["paren", "intl", "no_paren", "intl_split"])
                v = _gen_phone(rng, fmt)
                text, sp = _insert_in_template(rng, v, "telefone", _TPL_PHONE)
            elif cat == "matricula":
                v = str(rng.randint(1000, 999999))
                text, sp = _insert_in_template(rng, v, "matricula", _TPL_ENROLL)
            elif cat == "cargo_identificador":
                v = rng.choice(_ROLES_ID)
                text, sp = _insert_in_template(rng, v, "cargo_identificador",
                                                _TPL_ROLE)
            elif cat == "titulo_nome":
                pref = rng.choice(_TITLE_PREFIXES)
                v = f"{pref} {rng.choice(_FIRST_NAMES)} {rng.choice(_LAST_NAMES)}"
                text, sp = _insert_in_template(rng, v, "titulo_nome", _TPL_TITLE)
            elif cat == "nome":
                parts = rng.choice([2, 2, 3, 3, 4])
                v = _gen_name(rng, parts=parts)
                text, sp = _insert_in_template(rng, v, "nome", _TPL_NAME)
            else:
                continue
            cases.append(Case(
                id=f"p_{cat[:5]}_{i+1:03d}",
                text=text,
                gold_spans=[sp],
            ))

    # 20 casos multi-categoria (ex.: nome + cpf + email)
    for j in range(20):
        n_id += 1
        nome = _gen_name(rng, parts=2)
        cpf = _gen_cpf(rng, with_mask=True)
        email = _gen_email(rng)
        text = f"{nome} (CPF {cpf}, email {email}) confirmou presença"
        n_start = 0
        n_end = n_start + len(nome)
        cpf_marker = "CPF "
        cpf_start = text.index(cpf_marker) + len(cpf_marker)
        cpf_end = cpf_start + len(cpf)
        email_marker = "email "
        email_start = text.index(email_marker) + len(email_marker)
        email_end = email_start + len(email)
        cases.append(Case(
            id=f"p_multi_{j+1:03d}",
            text=text,
            gold_spans=[
                Span(n_start, n_end, "nome"),
                Span(cpf_start, cpf_end, "cpf"),
                Span(email_start, email_end, "email"),
            ],
        ))

    return cases


# --------------------- Negativos ---------------------

# Termos institucionais / falsos amigos / genéricos
_NEG_TEXTS_BASE = [
    "colaboradores do setor estão sobrecarregados",
    "a equipe está engajada com os objetivos",
    "a liderança precisa agir com urgência",
    "setor de Produção tem alta demanda no terceiro turno",
    "turno da manhã reportou fadiga acumulada",
    "alta demanda de trabalho impacta o bem-estar geral",
    "reunião semanal continua na agenda",
    "já faz 3 anos nesta função sem promoção",
    "trabalho 8 horas por dia em escala 6x1",
    "o RH avaliou a situação do setor",
    "TI recebeu o alerta de incidente",
    "SESMT vai mapear riscos psicossociais",
    "prazo até 02/04/2026 para resposta",
    "departamento de Marketing reorganizou as células",
    "setor Comercial reportou aumento de reclamações",
    "Recursos Humanos coordenará o projeto integrador",
    "Tecnologia da Informação implementou nova solução",
    "Comissão Interna de Prevenção mediará a reunião",
    "Serviço de Segurança e Medicina realizará avaliação",
    "Programa de Gerenciamento avaliou os riscos psicossociais",
    "Norma Regulamentadora estabelece os parâmetros mínimos",
    "Inventário de Riscos será revisado em 90 dias",
    "Plano de Ação 5W2H será elaborado pela gerência",
    "Lei Geral de Proteção se aplica integralmente",
    "Saúde e Segurança do Trabalho são prioridade",
    "Modelo Demanda Controle aplicado às análises",
    "Esforço Recompensa avaliado em 23 dimensões",
    "as 80 questões foram respondidas pela amostra",
    "26 dimensões contempladas pelo COPSOQ II",
    "escala Likert de 5 pontos foi utilizada",
    "prazo de 30 dias úteis para resposta",
    "carga horária de 44 horas semanais",
    "intervalo de 15 minutos para descanso",
    "salário em faixa de 2 a 5 salários mínimos",
    "índice de absenteísmo 4 por cento no trimestre",
    "indicador de rotatividade 12 por cento ao ano",
    "investimento em treinamento 5 mil reais",
    "média de 8 horas diárias úteis",
    "10 dias úteis para feedback do gestor",
    "100 colaboradores avaliados na onda",
    "score 67 em risco médio para o setor",
    "taxa de resposta 85 por cento na campanha",
    "190 respostas completas no levantamento",
    "8 setores avaliados nesta rodada",
    "23 dimensões pontuadas no instrumento",
    "valor entre 0 e 100 para cada dimensão",
    "thresholds de 33 e 66 separam as faixas",
    "mínimo de 4 respondentes para apurar score",
    "k igual a 3 para agregação por setor",
    "campanha 1 e campanha 2 já encerradas",
    "Plano de Ação não é nome próprio",
    "Norma Brasileira ABNT NBR 14724",
    "Recursos Humanos do grupo empresarial",
    "Centro Universitário de Maceió",
    "Curso de Ciência da Computação",
    "Ministério do Trabalho e Emprego",
    "Organização Mundial da Saúde",
    "Organização Internacional do Trabalho",
    "Lei Geral de Proteção de Dados",
    "Programa de Gerenciamento de Riscos",
    "Modelo Demanda Controle de Karasek",
    "Esforço Recompensa de Siegrist",
    "Saúde Mental no Trabalho",
    "Serviço de Segurança do Trabalho",
    "Diário Oficial da União do dia",
    "Banco Central do Brasil regulamenta",
    "Universidade Federal de Alagoas",
    "Sistema Único de Saúde",
    "Comissão Interna de Prevenção de Acidentes",
    "Tribunal Superior do Trabalho",
    "Conselho Federal de Medicina",
    "Instituto Brasileiro de Geografia e Estatística",
    "Política de Recursos Humanos da empresa",
    "Gestão de Pessoas do grupo",
    "Atendimento ao Cliente premiado",
    "O setor administrativo apresentou sinais de sobrecarga",
    "Recomenda-se revisar a distribuição de tarefas",
    "A dimensão Exigências Cognitivas pontuou 72",
    "O grupo classificado em risco precisa de intervenção",
    "A média do setor Operações foi 76",
    "A taxa de resposta atingiu 92 por cento",
    "Foram identificadas três dimensões vermelhas",
    "Os fatores favoráveis predominam no setor de RH",
    "A liderança do setor de Marketing reportou clima positivo",
    "O nível de exposição classifica-se como elevado",
    "Os trabalhadores do setor Comercial relataram pressão",
    "A organização do trabalho apresentou pontos de atenção",
    "O ritmo de trabalho ultrapassou o limite saudável",
    "O suporte social mostrou-se adequado",
    "A qualidade da liderança foi bem avaliada",
    "A saúde geral percebida foi positiva",
    "As exigências emocionais foram a dimensão mais crítica",
    "Recomenda-se rodízio de funções e pausas estruturadas",
    "A hierarquia de controle prevê eliminação da causa raiz",
    "O plano deve seguir abordagem participativa",
    "Andragogia orienta o engajamento dos adultos",
    "O ciclo de Kolb estrutura a experiência reflexiva",
    "Análise Transacional orienta a comunicação eficaz",
    "Estado de ego Adulto facilita o diálogo",
    "Reconhecimento positivo eleva o engajamento",
    "Indicadores mensuráveis ancoram o acompanhamento",
    "Prazo de implementação em 90 dias úteis",
    "Faixa de custo qualitativa, sem valor monetário",
    "Responsabilidade do perfil de gestor de pessoas",
    "Avaliação reaplicada após seis meses",
    "data 02/04/2026 para revisão",
    "horário 14:30 confirmado em ata",
    "código 1.5.3 da NR-01",
    "seção 7.2.1 do manual",
    "versão 2.0 do plano",
    "documento PGR-2026-Q1",
    "release v1.2 publicada",
    "ID 4567 do ticket interno",
    "lote 1234 processado com sucesso",
    "ID-789 verificado pela equipe",
    "patch 0.0.1 publicado em homologação",
    "Centro de Custo 12345 do setor",
    "Plano de Saúde Bradesco corporativo",
    "Vale Refeição corporativo de 25 reais",
    "Sindicato dos Bancários informou",
    "Federação das Indústrias do Estado",
]


def _gen_negatives(rng: random.Random) -> list[Case]:
    cases: list[Case] = []
    # 1) Base institucional / falsos amigos
    for i, t in enumerate(_NEG_TEXTS_BASE):
        cases.append(Case(id=f"n_inst_{i+1:03d}", text=t, gold_spans=[]))

    # 2) Adversariais: capitalização que não é nome
    adversarial_caps = [
        "Plano de Ação 5W2H definido pelo gestor",
        "Programa de Gerenciamento revisado",
        "Inventário de Riscos atualizado",
        "Política de Cargos aprovada",
        "Modelo Demanda Controle aplicado",
        "Ciclo de Aprendizagem implementado",
        "Mapa de Riscos publicado no quadro",
        "Plano de Trabalho aprovado em ata",
        "Análise de Causa Raiz documentada",
        "Diagrama de Ishikawa para investigação",
        "Hierarquia de Controles aplicada",
        "Sistema de Gestão Integrado em produção",
        "Boletim Técnico do setor de SST",
        "Manual de Procedimentos atualizado",
        "Política de Privacidade revisada",
        "Termo de Consentimento Livre Esclarecido",
        "Lei Geral de Proteção de Dados Pessoais",
        "Constituição Federal artigo 7º",
        "Decreto Legislativo do Senado",
        "Resolução Normativa publicada",
    ]
    for i, t in enumerate(adversarial_caps):
        cases.append(Case(id=f"n_advcaps_{i+1:03d}", text=t, gold_spans=[]))

    # 3) Falsos amigos para CPF/CNPJ/Telefone: sequências numéricas que não são
    adversarial_nums = [
        "código 12345 do produto",
        "Norma 12345-6 da ABNT",
        "ISBN 978-85-1234-567-8 do livro",
        "lote 2024-001 produzido",
        "patrimônio 010203 do setor",
        "número de série 9876543210 do equipamento",
        "registro CNES 1234567 da unidade",
        "matrícula imobiliária 12345-1 (não funcional)",
        "OS 2026-0042 do chamado",
        "BO 123/2026 da delegacia",
    ]
    for i, t in enumerate(adversarial_nums):
        cases.append(Case(id=f"n_advnum_{i+1:03d}", text=t, gold_spans=[]))

    # 4) Cenários narrativos longos sem PII
    narrative = [
        "O índice de absenteísmo elevado no setor administrativo correlaciona-se com a "
        "demanda emocional alta e a baixa previsibilidade reportadas no instrumento.",
        "A análise integrada indica que a dimensão Sentido do Trabalho é protetora "
        "para o setor de Recursos Humanos, contrabalançando outras tensões.",
        "Recomenda-se intervenção organizacional baseada na hierarquia de controles "
        "estabelecida pela NR-01 e em princípios da ergonomia de NR-17.",
        "O instrumento COPSOQ II Brasil em sua versão de 80 itens cobre 26 dimensões "
        "psicossociais agrupadas em sete domínios analíticos.",
        "O Plano de Gerenciamento de Riscos demanda revisão anual conforme calendário "
        "regulatório, com participação obrigatória do SESMT.",
        "Os fatores favoráveis predominam nas dimensões de Confiança Vertical, "
        "Justiça Organizacional e Comunidade Social no Trabalho.",
        "A faixa de exposição classificada como vermelha exige ação no prazo "
        "definido pelo gestor responsável, conforme matriz 5W2H.",
        "Os respondentes do setor Operações relataram exigências quantitativas "
        "elevadas, mas com bom suporte social entre pares.",
        "O programa de educação continuada segue os princípios de Knowles, com "
        "foco em problemas concretos e relevância imediata.",
        "A Análise Transacional, ferramenta de comunicação, orienta os encontros "
        "de feedback estruturado entre gestor e equipe.",
    ]
    for i, t in enumerate(narrative):
        cases.append(Case(id=f"n_narr_{i+1:03d}", text=t, gold_spans=[]))

    # 5) Templates negativos gerados (para completar até 580)
    neg_templates = [
        "score de {n} no setor {s} indica risco moderado",
        "média setorial {s}: {n} pontos",
        "diferença de {n} pontos entre as ondas",
        "intervalo de confiança [{n}; {m}] na dimensão",
        "{n} respondentes na onda atual, {m} na anterior",
        "rotatividade de {n} por cento no semestre",
        "treinamento de {n} horas no plano",
        "índice de {n} pontos na dimensão {d}",
        "redução de {n} por cento esperada",
        "amostra de {n} colaboradores no setor",
    ]
    setores = ["Administrativo", "Operações", "Comercial", "RH", "TI",
               "Marketing", "Logística", "Produção"]
    dims = ["Demanda Quantitativa", "Sentido do Trabalho", "Comunidade Social",
            "Reconhecimento", "Confiança Vertical", "Justiça Organizacional"]

    i = 0
    while len(cases) < 580:
        i += 1
        tpl = rng.choice(neg_templates)
        text = tpl.format(
            n=rng.randint(10, 95),
            m=rng.randint(10, 95),
            s=rng.choice(setores),
            d=rng.choice(dims),
        )
        cases.append(Case(id=f"n_gen_{i:03d}", text=text, gold_spans=[]))

    return cases


def build() -> tuple[list[Case], list[Case]]:
    rng = random.Random(20260527)
    pos = _gen_positives(rng)
    neg = _gen_negatives(rng)
    return pos, neg


POSITIVE_CASES, NEGATIVE_CASES = build()
CASES = POSITIVE_CASES + NEGATIVE_CASES


def all_cases() -> list[Case]:
    return CASES


if __name__ == "__main__":
    print(f"Total: {len(CASES)} (pos={len(POSITIVE_CASES)}, neg={len(NEGATIVE_CASES)})")
    # Distribuição por categoria
    from collections import Counter
    counter: Counter[str] = Counter()
    for c in POSITIVE_CASES:
        for sp in c.gold_spans:
            counter[sp.category] += 1
    print("Spans positivos por categoria:")
    for cat, n in sorted(counter.items()):
        print(f"  {cat:24s} {n}")
    # Validação de offsets
    for c in CASES[:3] + CASES[-3:] + POSITIVE_CASES[:3]:
        for sp in c.gold_spans:
            substr = c.text[sp.start:sp.end]
            print(f"[{c.id}] {sp.category}: '{substr}' @ [{sp.start},{sp.end})")
