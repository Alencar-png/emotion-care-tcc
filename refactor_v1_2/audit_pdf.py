"""Audit deep da acentuacao no PDF final."""
from pypdf import PdfReader
import re

PDF = r'C:\Users\Pichau\Documents\Dev\tcc\TCC - MF e G - v2.5.pdf'
r = PdfReader(PDF)
full = ''
for page in r.pages:
    full += page.extract_text() + '\n'

# Pares (sem_acento, correto) — apenas casos a verificar
PAIRS = [
    ('portugues', 'português'), ('Portugues', 'Português'),
    ('tecnica', 'técnica'), ('tecnicas', 'técnicas'),
    ('tecnico', 'técnico'), ('tecnicos', 'técnicos'),
    ('metrica', 'métrica'), ('metricas', 'métricas'),
    ('auditavel', 'auditável'), ('auditaveis', 'auditáveis'),
    ('grafico', 'gráfico'), ('grafica', 'gráfica'),
    ('graficos', 'gráficos'), ('graficas', 'gráficas'),
    ('teorico', 'teórico'), ('teorica', 'teórica'),
    ('teoricos', 'teóricos'), ('teoricas', 'teóricas'),
    ('Teorico', 'Teórico'), ('Teoricos', 'Teóricos'),
    ('automatico', 'automático'), ('automatica', 'automática'),
    ('logico', 'lógico'), ('logica', 'lógica'),
    ('publico', 'público'), ('publica', 'pública'),
    ('historico', 'histórico'), ('historica', 'histórica'),
    ('cientifico', 'científico'), ('cientifica', 'científica'),
    ('especifico', 'específico'), ('especifica', 'específica'),
    ('especificos', 'específicos'), ('especificas', 'específicas'),
    ('psicologico', 'psicológico'), ('psicologica', 'psicológica'),
    ('analitico', 'analítico'), ('analitica', 'analítica'),
    ('deterministico', 'determinístico'), ('deterministica', 'determinística'),
    ('estatistico', 'estatístico'), ('estatistica', 'estatística'),
    ('eletronico', 'eletrônico'), ('eletronica', 'eletrônica'),
    ('economico', 'econômico'), ('economica', 'econômica'),
    ('anonimo', 'anônimo'), ('anonima', 'anônima'),
    ('Maceio', 'Maceió'),
    ('Ciencia', 'Ciência'), ('ciencia', 'ciência'),
    ('Computacao', 'Computação'), ('computacao', 'computação'),
    ('Universitario', 'Universitário'),
    ('Inventario', 'Inventário'), ('inventario', 'inventário'),
    ('Sumario', 'Sumário'),
    ('Conclusao', 'Conclusão'), ('conclusao', 'conclusão'),
    ('Discussao', 'Discussão'), ('discussao', 'discussão'),
    ('versao', 'versão'),
    ('expansao', 'expansão'),
    ('confusao', 'confusão'),
    ('decisao', 'decisão'),
    ('Comissao', 'Comissão'), ('comissao', 'comissão'),
    ('submissao', 'submissão'),
    ('frequencia', 'frequência'),
    ('referencia', 'referência'),
    ('experiencia', 'experiência'),
    ('eficiencia', 'eficiência'),
    ('inteligencia', 'inteligência'),
    ('codigo', 'código'),
    ('periodo', 'período'),
    ('proprio', 'próprio'), ('propria', 'própria'),
    ('proximo', 'próximo'), ('proxima', 'próxima'),
    ('Geracao', 'Geração'), ('geracao', 'geração'),
    ('Recuperacao', 'Recuperação'), ('recuperacao', 'recuperação'),
    ('Avaliacao', 'Avaliação'), ('avaliacao', 'avaliação'),
    ('Validacao', 'Validação'), ('validacao', 'validação'),
    ('Anonimizacao', 'Anonimização'), ('anonimizacao', 'anonimização'),
    ('Interpretacao', 'Interpretação'),
    ('Implementacao', 'Implementação'),
    ('Classificacao', 'Classificação'),
    ('serao', 'serão'),
    ('estao', 'estão'),
    ('viavel', 'viável'),
    ('inviavel', 'inviável'),
    ('aceitavel', 'aceitável'),
    ('disponivel', 'disponível'),
    ('possivel', 'possível'),
    ('inviolavel', 'inviolável'),
    ('inegociavel', 'inegociável'),
    ('hipotese', 'hipótese'),
    ('matematica', 'matemática'), ('matematicas', 'matemáticas'),
    ('semantica', 'semântica'),
    ('semantico', 'semântico'),
    ('parametros', 'parâmetros'),
    ('etica', 'ética'),
    ('alem', 'além'), ('apos', 'após'),
    ('ate', 'até'), ('ja', 'já'), ('ha', 'há'),
    ('nao', 'não'), ('sao', 'são'),
    ('Nao', 'Não'), ('Sao', 'São'),
    ('Alem', 'Além'), ('Apos', 'Após'),
    ('Ate', 'Até'), ('Ja', 'Já'), ('Ha', 'Há'),
    ('tres', 'três'),
]

found = {}
for s, w in PAIRS:
    if s == w:
        continue
    pat = r'\b' + re.escape(s) + r'\b'
    for m in re.finditer(pat, full):
        pos = m.start()
        ctx = full[max(0, pos-50):pos+len(s)+50].replace('\n', ' ')
        found.setdefault(s, []).append(ctx[:130])

print(f'PT-BR sem acento detectados no PDF: {len(found)} tipos')
print()
for s, ctxs in sorted(found.items(), key=lambda x: -len(x[1]))[:30]:
    print(f'  [{s!r}] ({len(ctxs)}x)')
    print(f'    ex: ...{ctxs[0]}...')
print()
print(f'Total ocorrencias: {sum(len(c) for c in found.values())}')
