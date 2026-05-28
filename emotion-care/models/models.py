from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, TypeDecorator, DateTime, Text, JSON, Index, Float
from sqlalchemy.orm import relationship, deferred
from config.database import Base
from datetime import datetime
from zoneinfo import ZoneInfo
import enum

# Fuso horário local: UTC-3
LOCAL_TIMEZONE = ZoneInfo('America/Sao_Paulo')  # UTC-3


class OnboardingStatus(str, enum.Enum):
    PENDING_SETUP = "pending_setup"
    WELCOME_COMPLETED = "welcome_completed"
    DEPARTMENTS_CONFIGURED = "departments_configured"
    EMPLOYEES_IMPORTED = "employees_imported"
    CALL_SCHEDULED = "call_scheduled"
    COMPLETED = "completed"


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "superAdmin"
    COMPANY_ADMIN = "companyAdmin"
    MEDICAL_TECHNICAL = "medicalTechnical"
    VIEWER = "viewer"


class UserRoleType(TypeDecorator):
    """Type decorator para mapear corretamente os valores do enum UserRole"""
    impl = String
    cache_ok = True

    def __init__(self, length=30):
        super().__init__(length=length)

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, UserRole):
            return value.value
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        # Mapear valores antigos para novos (compatibilidade com migration)
        role_mapping = {
            "admin": UserRole.COMPANY_ADMIN,
            "superAdmin": UserRole.SUPER_ADMIN,
        }
        # Se for um valor antigo, mapear para o novo
        if value in role_mapping:
            return role_mapping[value]
        # Mapear o valor do banco para o enum
        for role in UserRole:
            if role.value == value:
                return role
        # Se não encontrar, retornar como string (para debug)
        return value


class Company(Base):
    """Empresa contratante (tenant)"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)  # Razão social
    trade_name = Column(String(255), nullable=True)  # Nome fantasia
    cnpj = Column(String(14), unique=True, nullable=False)  # Apenas dígitos
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(255), nullable=True)
    state = Column(String(2), nullable=True)  # UF
    zip_code = Column(String(8), nullable=True)  # Apenas dígitos
    responsible_name = Column(String(255), nullable=False)  # Responsável técnico
    responsible_email = Column(String(255), nullable=True)
    responsible_phone = Column(String(20), nullable=True)
    max_employees = Column(Integer, nullable=False, default=50)  # Licença máx. funcionários
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Onboarding
    onboarding_status = Column(String(50), nullable=True, default=OnboardingStatus.PENDING_SETUP.value)
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)
    onboarding_current_step = Column(Integer, nullable=True, default=1)
    plan_type = Column(String(50), nullable=True)

    # Relacionamentos
    users = relationship("User", back_populates="company")
    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")
    job_roles = relationship("JobRole", back_populates="company", cascade="all, delete-orphan")
    employees = relationship("Employee", back_populates="company", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    email = Column(String(255), unique=True, nullable=False)
    password = deferred(Column(String(255), nullable=False))
    role = Column(UserRoleType(), nullable=False, default=UserRole.VIEWER)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=True)  # NULL para SUPER_ADMIN
    must_change_password = Column(Boolean, nullable=False, default=False)

    # Relacionamento com Company
    company = relationship("Company", back_populates="users")


class Department(Base):
    """Setor dentro da empresa"""
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", back_populates="departments")
    employees = relationship("Employee", back_populates="department")


class JobRole(Base):
    """Função/Cargo dentro da empresa"""
    __tablename__ = "job_roles"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", back_populates="job_roles")
    employees = relationship("Employee", back_populates="job_role")


class Employee(Base):
    """Colaborador da empresa"""
    __tablename__ = "employees"
    __table_args__ = (
        Index('ix_employees_company_id', 'company_id'),
        Index('ix_employees_department_id', 'department_id'),
        Index('ix_employees_company_active', 'company_id', 'is_active'),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    cpf = Column(String(11), nullable=True)  # Apenas dígitos
    phone = Column(String(20), nullable=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    job_role_id = Column(Integer, ForeignKey('job_roles.id'), nullable=True)
    location = Column(String(255), nullable=True)  # Localidade / unidade
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", back_populates="employees")
    department = relationship("Department", back_populates="employees")
    job_role = relationship("JobRole", back_populates="employees")


class AccessLogType(str, enum.Enum):
    """Tipos de log de acesso"""
    LOGIN = "login"
    LOGOUT = "logout"
    LOGOUT_EXPIRATION = "logout_expiration"


class AccessLog(Base):
    __tablename__ = "access_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    log_type = Column(String(50), nullable=False)  # login, logout, logout_expiration
    logged_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))  # UTC-3
    ip_address = Column(String(45), nullable=True)  # IPv4 ou IPv6
    user_agent = Column(String(500), nullable=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=True)

    # Relacionamento com User
    user = relationship("User", backref="access_logs")
    company = relationship("Company")


# ========================
# Módulo 02 — Questionários
# ========================

class Periodicity(str, enum.Enum):
    """Periodicidade da avaliação"""
    MONTHLY = "monthly"
    SEMIANNUAL = "semiannual"
    ANNUAL = "annual"
    MANUAL = "manual"


class QuestionnaireStatus(str, enum.Enum):
    """Status da configuração do questionário"""
    DRAFT = "draft"
    READY = "ready"
    ACTIVE = "active"
    CLOSED = "closed"


class ScaleType(str, enum.Enum):
    """Tipos de escala Likert usados nos instrumentos psicossociais"""
    LIKERT_5_FREQUENCY = "likert_5_frequency"          # Sempre / Frequentemente / Às vezes / Raramente / Nunca
    LIKERT_5_INTENSITY = "likert_5_intensity"            # Em grande medida / ... / Em nenhuma medida
    LIKERT_5_SATISFACTION = "likert_5_satisfaction"      # Muito satisfeito / ... / Muito insatisfeito
    LIKERT_5_AGREEMENT = "likert_5_agreement"            # Concordo totalmente / ... / Discordo totalmente
    LIKERT_5_HEALTH = "likert_5_health"                  # Excelente / Muito boa / Boa / Razoável / Deficiente
    LIKERT_5_AMOUNT = "likert_5_amount"                  # Enormemente / Muito / ... / Nada
    LIKERT_5_FREQUENCY_RISK = "likert_5_frequency_risk"  # Nunca / Raramente / Eventualmente / Com Frequência / Com Muita Frequência


class CustomQuestionType(str, enum.Enum):
    """Tipos de perguntas customizadas"""
    OPEN_TEXT = "open_text"
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    DEMOGRAPHIC = "demographic"


class Instrument(Base):
    """Instrumento de avaliação psicossocial (ex: COPSOQ-II)"""
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False)       # ex: "copsoq_ii"
    name = Column(String(255), nullable=False)                    # ex: "COPSOQ-II"
    description = Column(Text, nullable=True)
    version = Column(String(50), nullable=True)                   # ex: "Brasileira v2"
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    dimensions = relationship("Dimension", back_populates="instrument", cascade="all, delete-orphan",
                              order_by="Dimension.display_order")
    questionnaire_configs = relationship("QuestionnaireConfig", back_populates="instrument")


class Dimension(Base):
    """Dimensão psicossocial de um instrumento (ex: Exigências Quantitativas)"""
    __tablename__ = "dimensions"

    id = Column(Integer, primary_key=True)
    instrument_id = Column(Integer, ForeignKey('instruments.id'), nullable=False)
    code = Column(String(100), nullable=False)                    # ex: "quantitative_demands"
    name = Column(String(255), nullable=False)                    # ex: "Exigências Quantitativas"
    description = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False, default=0)

    # Relacionamentos
    instrument = relationship("Instrument", back_populates="dimensions")
    questions = relationship("Question", back_populates="dimension", cascade="all, delete-orphan",
                             order_by="Question.display_order")
    config_dimensions = relationship("ConfigDimension", back_populates="dimension")


class Question(Base):
    """Pergunta individual dentro de uma dimensão"""
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True)
    dimension_id = Column(Integer, ForeignKey('dimensions.id'), nullable=False)
    code = Column(String(100), nullable=False)                    # ex: "qt_01"
    text = Column(Text, nullable=False)                           # Texto da pergunta
    scale_type = Column(String(50), nullable=False)               # Tipo de escala Likert
    scale_labels = Column(JSON, nullable=True)                    # Labels da escala em JSON
    display_order = Column(Integer, nullable=False, default=0)
    is_reverse_scored = Column(Boolean, nullable=False, default=False)  # Pontuação invertida

    # Relacionamentos
    dimension = relationship("Dimension", back_populates="questions")


class QuestionnaireConfig(Base):
    """Configuração de questionário por empresa"""
    __tablename__ = "questionnaire_configs"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    instrument_id = Column(Integer, ForeignKey('instruments.id'), nullable=False)
    name = Column(String(255), nullable=False)                    # ex: "Avaliação Anual 2026"
    description = Column(Text, nullable=True)
    periodicity = Column(String(30), nullable=False, default=Periodicity.ANNUAL.value)
    status = Column(String(30), nullable=False, default=QuestionnaireStatus.DRAFT.value)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", backref="questionnaire_configs")
    instrument = relationship("Instrument", back_populates="questionnaire_configs")
    selected_dimensions = relationship("ConfigDimension", back_populates="config", cascade="all, delete-orphan")
    custom_questions = relationship("CustomQuestion", back_populates="config", cascade="all, delete-orphan",
                                    order_by="CustomQuestion.display_order")


class ConfigDimension(Base):
    """Associação entre configuração e dimensões selecionadas"""
    __tablename__ = "config_dimensions"

    id = Column(Integer, primary_key=True)
    config_id = Column(Integer, ForeignKey('questionnaire_configs.id'), nullable=False)
    dimension_id = Column(Integer, ForeignKey('dimensions.id'), nullable=False)

    # Relacionamentos
    config = relationship("QuestionnaireConfig", back_populates="selected_dimensions")
    dimension = relationship("Dimension", back_populates="config_dimensions")


class CustomQuestion(Base):
    """Pergunta customizada adicionada pela empresa"""
    __tablename__ = "custom_questions"

    id = Column(Integer, primary_key=True)
    config_id = Column(Integer, ForeignKey('questionnaire_configs.id'), nullable=False)
    text = Column(Text, nullable=False)
    question_type = Column(String(30), nullable=False, default=CustomQuestionType.OPEN_TEXT.value)
    options = Column(JSON, nullable=True)                         # Opções para single/multiple choice
    display_order = Column(Integer, nullable=False, default=0)
    is_required = Column(Boolean, nullable=False, default=False)

    # Relacionamentos
    config = relationship("QuestionnaireConfig", back_populates="custom_questions")


# ========================
# Módulo 03 — Campanhas e Coleta de Respostas
# ========================

class CampaignStatus(str, enum.Enum):
    """Status da campanha de avaliação"""
    DRAFT = "draft"
    SENDING = "sending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ParticipantStatus(str, enum.Enum):
    """Status do participante na campanha"""
    PENDING = "pending"
    SENT = "sent"
    OPENED = "opened"
    STARTED = "started"
    COMPLETED = "completed"
    EXPIRED = "expired"


class ChannelType(str, enum.Enum):
    """Canal de envio do questionário"""
    EMAIL = "email"
    SMS = "sms"
    LINK = "link"


class RiskLevel(str, enum.Enum):
    """Classificação de nível de risco psicossocial"""
    HEALTHY = "healthy"           # Verde — Saudável (0-33)
    INTERMEDIATE = "intermediate" # Amarelo — Intermediário (34-66)
    RISK = "risk"                 # Vermelho — Risco à Saúde (67-100)


class Campaign(Base):
    """Campanha / Rodada de avaliação"""
    __tablename__ = "campaigns"
    __table_args__ = (
        Index('ix_campaigns_company_active', 'company_id', 'is_active'),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    config_id = Column(Integer, ForeignKey('questionnaire_configs.id'), nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(255), nullable=False)                    # ex: "Avaliação Anual 2026 — Rodada 1"
    description = Column(Text, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), nullable=False, default=CampaignStatus.DRAFT.value)
    channels = Column(JSON, nullable=False, default=["link"])     # Lista de canais habilitados
    auto_resend_enabled = Column(Boolean, nullable=False, default=False)
    auto_resend_interval_days = Column(Integer, nullable=True, default=7)
    anonymization_threshold = Column(Integer, nullable=False, default=5)  # LGPD: mínimo de respondentes

    # Campos de processo de coleta (NR-01 — participação dos trabalhadores)
    collection_channel = Column(String(100), nullable=True)        # ex: "Link web", "QR Code", "E-mail", "SMS"
    communication_method = Column(Text, nullable=True)             # Como os trabalhadores foram comunicados
    cipa_involved = Column(String(30), nullable=True)              # "sim" | "nao" | "nao_possui"
    cipa_details = Column(Text, nullable=True)                     # De que forma a CIPA foi envolvida
    anonymity_guaranteed = Column(Boolean, nullable=True)          # Anonimato garantido e comunicado

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", backref="campaigns")
    config = relationship("QuestionnaireConfig", backref="campaigns")
    creator = relationship("User", backref="created_campaigns")
    participants = relationship("CampaignParticipant", back_populates="campaign", cascade="all, delete-orphan")
    responses = relationship("Response", back_populates="campaign", cascade="all, delete-orphan")
    result = relationship("CampaignResult", back_populates="campaign", uselist=False, cascade="all, delete-orphan")


class CampaignParticipant(Base):
    """Participante de uma campanha (link entre campanha e colaborador)"""
    __tablename__ = "campaign_participants"
    __table_args__ = (
        Index('ix_cp_campaign_id', 'campaign_id'),
        Index('ix_cp_campaign_status', 'campaign_id', 'status'),
        Index('ix_cp_employee_id', 'employee_id'),
    )

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    employee_id = Column(Integer, ForeignKey('employees.id'), nullable=False)
    token = Column(String(64), unique=True, nullable=False)       # UUID v4 para acesso público
    access_code = Column(String(8), nullable=True)                # Código curto de 6 dígitos para acesso via landing page
    status = Column(String(30), nullable=False, default=ParticipantStatus.PENDING.value)
    channel = Column(String(30), nullable=False, default=ChannelType.LINK.value)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    resend_count = Column(Integer, nullable=False, default=0)

    # Relacionamentos
    campaign = relationship("Campaign", back_populates="participants")
    employee = relationship("Employee", backref="campaign_participations")
    response = relationship("Response", back_populates="participant", uselist=False)


class Response(Base):
    """Resposta completa de um participante a uma campanha"""
    __tablename__ = "responses"
    __table_args__ = (
        Index('ix_responses_campaign_complete', 'campaign_id', 'is_complete'),
    )

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    participant_id = Column(Integer, ForeignKey('campaign_participants.id'), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_complete = Column(Boolean, nullable=False, default=False)

    # Relacionamentos
    campaign = relationship("Campaign", back_populates="responses")
    participant = relationship("CampaignParticipant", back_populates="response")
    answers = relationship("ResponseAnswer", back_populates="response", cascade="all, delete-orphan")


class ResponseAnswer(Base):
    """Resposta individual a uma pergunta"""
    __tablename__ = "response_answers"
    __table_args__ = (
        Index('ix_ra_response_id', 'response_id'),
    )

    id = Column(Integer, primary_key=True)
    response_id = Column(Integer, ForeignKey('responses.id'), nullable=False)
    question_id = Column(Integer, ForeignKey('questions.id'), nullable=True)          # Pergunta do instrumento
    custom_question_id = Column(Integer, ForeignKey('custom_questions.id'), nullable=True)  # Pergunta customizada
    numeric_value = Column(Integer, nullable=True)                # Valor numérico (escala Likert)
    text_value = Column(Text, nullable=True)                      # Resposta aberta

    # Relacionamentos
    response = relationship("Response", back_populates="answers")
    question = relationship("Question")
    custom_question = relationship("CustomQuestion")


# ========================
# Módulo 04 — Motor de Análise e Indicadores
# ========================

class CampaignResult(Base):
    """Resultado agregado de uma campanha"""
    __tablename__ = "campaign_results"

    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False, unique=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    computed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    total_invited = Column(Integer, nullable=False, default=0)
    total_responses = Column(Integer, nullable=False, default=0)
    response_rate = Column(Integer, nullable=False, default=0)    # Percentual 0-100
    overall_risk_score = Column(Integer, nullable=False, default=0)  # Score 0-100
    risk_level = Column(String(30), nullable=False, default=RiskLevel.HEALTHY.value)

    # Relacionamentos
    campaign = relationship("Campaign", back_populates="result")
    company = relationship("Company", backref="campaign_results")
    dimension_results = relationship("DimensionResult", back_populates="campaign_result", cascade="all, delete-orphan")
    sector_dimension_results = relationship("SectorDimensionResult", back_populates="campaign_result", cascade="all, delete-orphan")


class DimensionResult(Base):
    """Resultado por dimensão psicossocial"""
    __tablename__ = "dimension_results"

    id = Column(Integer, primary_key=True)
    campaign_result_id = Column(Integer, ForeignKey('campaign_results.id'), nullable=False)
    dimension_id = Column(Integer, ForeignKey('dimensions.id'), nullable=False)
    average_score = Column(Integer, nullable=False, default=0)    # Score 0-100
    risk_level = Column(String(30), nullable=False, default=RiskLevel.HEALTHY.value)
    response_count = Column(Integer, nullable=False, default=0)

    # Relacionamentos
    campaign_result = relationship("CampaignResult", back_populates="dimension_results")
    dimension = relationship("Dimension")


class SectorDimensionResult(Base):
    """Resultado por setor x dimensão (com anonimização LGPD)"""
    __tablename__ = "sector_dimension_results"

    id = Column(Integer, primary_key=True)
    campaign_result_id = Column(Integer, ForeignKey('campaign_results.id'), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=False)
    dimension_id = Column(Integer, ForeignKey('dimensions.id'), nullable=False)
    average_score = Column(Integer, nullable=False, default=0)    # Score 0-100
    risk_level = Column(String(30), nullable=False, default=RiskLevel.HEALTHY.value)
    response_count = Column(Integer, nullable=False, default=0)
    is_anonymized = Column(Boolean, nullable=False, default=False)  # True se response_count < threshold

    # Relacionamentos
    campaign_result = relationship("CampaignResult", back_populates="sector_dimension_results")
    department = relationship("Department")
    dimension = relationship("Dimension")


# ========================
# Módulo 06 — Integração ao PGR
# ========================

class ActionPlanStatus(str, enum.Enum):
    """Status do plano de ação"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class PGRRisk(Base):
    """Inventário de Riscos Psicossociais (NR-01)"""
    __tablename__ = "pgr_risks"
    __table_args__ = (
        Index('ix_pgr_risks_company_campaign', 'company_id', 'campaign_id'),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    dimension_id = Column(Integer, ForeignKey('dimensions.id'), nullable=False)
    risk_axis = Column(String(255), nullable=False)         # Nome da dimensão (snapshot)
    source = Column(Text, nullable=True)                     # Fonte do risco
    possible_damages = Column(Text, nullable=True)           # Danos possíveis
    severity = Column(Integer, nullable=False, default=1)    # 1-5
    probability = Column(Integer, nullable=False, default=1) # 1-5
    risk_level = Column(String(30), nullable=False, default="low")  # low/medium/high/critical
    control_measures = Column(Text, nullable=True)           # Medidas de controle sugeridas
    average_score = Column(Integer, nullable=False, default=0)       # Score 0-100 da dimensão
    original_risk_level = Column(String(30), nullable=False, default="healthy")  # healthy/intermediate/risk
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", backref="pgr_risks")
    campaign = relationship("Campaign", backref="pgr_risks")
    dimension = relationship("Dimension")
    action_plans = relationship("ActionPlan", back_populates="pgr_risk", cascade="all, delete-orphan")


class ActionPlan(Base):
    """Plano de Ação vinculado a um risco do PGR"""
    __tablename__ = "action_plans"

    id = Column(Integer, primary_key=True)
    pgr_risk_id = Column(Integer, ForeignKey('pgr_risks.id'), nullable=False)
    measure = Column(Text, nullable=False)                        # Medida de controle
    responsible_person = Column(String(255), nullable=True)       # Responsável pela ação
    deadline = Column(DateTime(timezone=True), nullable=True)     # Prazo
    status = Column(String(30), nullable=False, default=ActionPlanStatus.PENDING.value)
    classification = Column(String(100), nullable=True)           # Ex: organizacional, administrativa
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    # NC_ACTION_EDIT — campos 5W2H (v2.0)
    what_action = Column(Text, nullable=True)                     # O quê
    why_action = Column(Text, nullable=True)                      # Por quê
    who_responsible = Column(String(500), nullable=True)          # Quem
    where_action = Column(String(500), nullable=True)             # Onde
    when_action = Column(String(255), nullable=True)              # Quando
    how_action = Column(Text, nullable=True)                      # Como
    how_much = Column(String(500), nullable=True)                 # Quanto (custo)
    indicator = Column(Text, nullable=True)                       # Indicador de sucesso
    last_edited_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    last_edited_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    pgr_risk = relationship("PGRRisk", back_populates="action_plans")
    evidences = relationship("ActionEvidence", back_populates="action_plan", cascade="all, delete-orphan")
    editor = relationship("User", foreign_keys=[last_edited_by])
    versions = relationship(
        "ActionPlanVersion",
        back_populates="action_plan",
        cascade="all, delete-orphan",
        order_by="ActionPlanVersion.edited_at.desc()",
    )


class ActionPlanVersionType(str, enum.Enum):
    """Origem de uma versão do plano 5W2H."""
    AI_ORIGINAL = "ai_original"
    MANUAL_EDIT = "manual_edit"
    AI_REGENERATED = "ai_regenerated"


class ActionPlanVersion(Base):
    """Histórico de edições de um plano 5W2H (NC_ACTION_EDIT).

    Usa tabela própria por conveniência de join com `action_plans`. Para
    versionamento genérico de outros documentos (CIPA comm, laudo) a Fase A3
    oferece `GeneratedDocumentVersion`.
    """
    __tablename__ = "action_plan_versions"
    __table_args__ = (
        Index('ix_action_plan_versions_plan_id', 'action_plan_id'),
    )

    id = Column(Integer, primary_key=True)
    action_plan_id = Column(Integer, ForeignKey('action_plans.id'), nullable=False)
    version_type = Column(String(20), nullable=False)
    data_json = Column(JSON, nullable=False)
    edited_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    edited_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=LOCAL_TIMEZONE),
    )
    notes = Column(Text, nullable=True)

    # Relacionamentos
    action_plan = relationship("ActionPlan", back_populates="versions")
    editor = relationship("User")


class ActionEvidence(Base):
    """Evidência/documento vinculado a uma ação"""
    __tablename__ = "action_evidences"

    id = Column(Integer, primary_key=True)
    action_plan_id = Column(Integer, ForeignKey('action_plans.id'), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    description = Column(Text, nullable=True)

    # Relacionamentos
    action_plan = relationship("ActionPlan", back_populates="evidences")
    uploader = relationship("User")


class PGRVersion(Base):
    """Histórico de versões do PGR gerado"""
    __tablename__ = "pgr_versions"
    __table_args__ = (
        Index('ix_pgr_versions_company_campaign', 'company_id', 'campaign_id'),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    version_number = Column(Integer, nullable=False)
    # NC_PGR_FILTER (v2.0): quando presente, indica um PGR granular por recorte.
    granular_mode = Column(String(30), nullable=True)  # consolidated|unit|sector|activity
    group_name = Column(String(255), nullable=True)    # nome do recorte para UI
    generated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    generated_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    pdf_path = Column(String(1000), nullable=True)
    notes = Column(Text, nullable=True)

    # Relacionamentos
    company = relationship("Company", backref="pgr_versions")
    campaign = relationship("Campaign", backref="pgr_versions")
    generator = relationship("User")


# ========================
# Módulo 07 — Gestão de Ações e Reavaliações
# ========================

class ReEvaluationSchedule(Base):
    """Agendamento de reavaliação periódica"""
    __tablename__ = "reevaluation_schedules"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    config_id = Column(Integer, ForeignKey('questionnaire_configs.id'), nullable=False)
    last_campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=True)
    next_due_date = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", backref="reevaluation_schedules")
    config = relationship("QuestionnaireConfig")
    last_campaign = relationship("Campaign")


# ========================
# Módulo IA — Rascunhos e Base de Conhecimento
# ========================

class PGRDraftStatus(str, enum.Enum):
    """Status do rascunho de narrativa do PGR"""
    AWAITING_REVIEW = "aguardando_revisao"
    APPROVED = "aprovado"
    REJECTED = "rejeitado"


class PGRDraft(Base):
    """Rascunho da narrativa do PGR gerada pela IA 1 (Narradora)"""
    __tablename__ = "pgr_drafts"
    __table_args__ = (
        Index('ix_pgr_drafts_company_campaign', 'company_id', 'campaign_id'),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    secao_introducao = Column(Text, nullable=True)
    secao_resultados_gerais = Column(Text, nullable=True)
    secao_riscos_criticos = Column(Text, nullable=True)
    secao_riscos_intermediarios = Column(Text, nullable=True)
    secao_fatores_favoraveis = Column(Text, nullable=True)
    secao_analise_por_setor = Column(Text, nullable=True)
    secao_conclusao = Column(Text, nullable=True)
    total_palavras = Column(Integer, nullable=True)
    status = Column(String(30), nullable=False, default=PGRDraftStatus.AWAITING_REVIEW.value)
    approved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", backref="pgr_drafts")
    campaign = relationship("Campaign", backref="pgr_drafts")
    approver = relationship("User")


class ActionPlan5W2HDraft(Base):
    """Rascunho do plano de ação 5W2H gerado pela IA 2"""
    __tablename__ = "action_plan_5w2h_drafts"
    __table_args__ = (
        Index('ix_5w2h_drafts_company_campaign', 'company_id', 'campaign_id'),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    plans_json = Column(JSON, nullable=False)  # Array de planos 5W2H
    status = Column(String(30), nullable=False, default=PGRDraftStatus.AWAITING_REVIEW.value)
    approved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))
    updated_at = Column(DateTime(timezone=True), nullable=True, onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    company = relationship("Company", backref="action_plan_5w2h_drafts")
    campaign = relationship("Campaign", backref="action_plan_5w2h_drafts")
    approver = relationship("User")


class CopilotKnowledge(Base):
    """Base de conhecimento do Copiloto NR-01 (chunks vetorizados)"""
    __tablename__ = "copilot_knowledge"

    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    source = Column(String(500), nullable=False)  # Documento de origem
    section = Column(String(500), nullable=True)  # Seção do documento
    embedding = Column(JSON, nullable=False)  # Array de floats (1536 dims)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))


class CopilotConversation(Base):
    """Log de conversas do Copiloto NR-01"""
    __tablename__ = "copilot_conversations"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    is_fallback = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(tz=LOCAL_TIMEZONE))

    # Relacionamentos
    user = relationship("User", backref="copilot_conversations")


# ========================
# v2.0 — Versionamento de documentos gerados (Fase A3)
# ========================


class GeneratedDocumentType(str, enum.Enum):
    """Tipos de documento versionáveis pela Fase A3.

    Cada tipo é polimórfico: o conteúdo vive em `content_json` e o
    `document_key` identifica a entidade-alvo dentro da campanha (ex.:
    '5w2h:ghe-02' para o plano 5W2H do GHE 02).
    """
    PGR_5W2H = "pgr_5w2h"
    CIPA_COMMUNICATION = "cipa_communication"
    PGR_NARRATIVE = "pgr_narrative"
    RISK_INVENTORY = "risk_inventory"


class GeneratedDocumentSource(str, enum.Enum):
    """Origem da versão do documento.

    AI_GENERATED: IA gerou do zero.
    MANUAL_EDIT: humano editou versão pré-existente.
    AI_REGENERATED: IA gerou sobre edições humanas (reset explícito).
    """
    AI_GENERATED = "ai_generated"
    MANUAL_EDIT = "manual_edit"
    AI_REGENERATED = "ai_regenerated"


class GeneratedDocumentVersion(Base):
    """Histórico imutável de versões de documentos gerados.

    Regras:
    - Versões nunca são alteradas: cada edição cria linha nova apontando para
      a anterior via `parent_version_id`.
    - `version_number` é monotônico por (campaign_id, document_type, document_key).
    - Só uma versão pode ter `superseded_at IS NULL` por documento — esta é a
      "corrente". O unique parcial garante por construção (quando o BD suporta).
    - `content_hash` é SHA-256 do conteúdo canonicalizado — permite detectar
      regeneração idêntica sem diff textual.

    Consumido por NC_ACTION_EDIT (5W2H) e NC_RISK_COMM (CIPA) inicialmente;
    extensível para laudo e inventário.
    """
    __tablename__ = "generated_document_versions"
    __table_args__ = (
        Index(
            'uq_gdv_monotonic',
            'campaign_id', 'document_type', 'document_key', 'version_number',
            unique=True,
        ),
        Index(
            'ix_gdv_company_campaign',
            'company_id', 'campaign_id',
        ),
        Index(
            'ix_gdv_parent',
            'parent_version_id',
        ),
        Index(
            'ix_gdv_current',
            'campaign_id', 'document_type', 'document_key',
        ),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    document_type = Column(String(40), nullable=False)
    document_key = Column(String(120), nullable=False)
    source = Column(String(30), nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    parent_version_id = Column(Integer, ForeignKey('generated_document_versions.id'), nullable=True)
    version_number = Column(Integer, nullable=False)
    content_json = Column(JSON, nullable=False)
    content_hash = Column(String(64), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=LOCAL_TIMEZONE),
    )
    superseded_at = Column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    company = relationship("Company")
    campaign = relationship("Campaign")
    author = relationship("User")
    parent = relationship("GeneratedDocumentVersion", remote_side="GeneratedDocumentVersion.id")


# ========================
# v2.0 — Segregação física de respostas abertas (Fase A4)
# ========================
#
# Respostas abertas NÃO PODEM alimentar PGR/laudo/inventário de riscos
# (plano v2.0, Seção 2.1). A segregação é arquitetural: este modelo vive
# em tabela própria, é servido por um repositório dedicado
# (repositories/open_response_repository.py), e um teste de arquitetura
# barra imports cruzados a partir dos serviços de PGR.
#
# Em PostgreSQL produção, esta tabela deve eventualmente viver num schema
# separado (ex.: `nr1_private.open_response_answers`) com role de BD
# distinto. O modelo SQLAlchemy abaixo continua válido; a migration muda
# apenas o schema físico. Ver docs/v2/ARCHITECTURE.md (seção A4) para o
# plano de deploy em 3 etapas (dual-write → cutover → drop legacy).


class OpenResponseAnswer(Base):
    """Resposta a uma pergunta aberta (texto livre).

    ATENÇÃO: só dois consumidores podem ler este modelo:
      1. services.ai.qualitative_analyzer (NC_OPEN_VIEW) — agrega em clusters.
      2. services.ai.copilot_nr01 (quando marcando 'dado qualitativo não
         validado metodologicamente' no prompt).

    Qualquer outro import é violação de política e será flagrado pelo
    teste `tests/test_open_response_isolation.py`.
    """
    __tablename__ = "open_response_answers"
    __table_args__ = (
        Index('ix_ora_response_id', 'response_id'),
        Index('ix_ora_question', 'custom_question_id'),
    )

    id = Column(Integer, primary_key=True)
    response_id = Column(Integer, ForeignKey('responses.id'), nullable=False)
    # Respostas abertas hoje vêm de custom_questions com question_type=OPEN_TEXT.
    custom_question_id = Column(
        Integer, ForeignKey('custom_questions.id'), nullable=False,
    )
    text_value = Column(Text, nullable=False)
    submitted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(tz=LOCAL_TIMEZONE),
    )

    # Relacionamento tímido: sem back_populates para não expor a coleção
    # a partir de Response (Response.answers continua sendo só ResponseAnswer).
    response = relationship("Response")
    custom_question = relationship("CustomQuestion")


# ========================
# v2.0 — NC_ABSENCE (afastamentos por saúde mental, CID categoria F)
# ========================


class HealthAbsence(Base):
    """Registro de afastamento por saúde mental.

    IMPORTANTE: estes dados NÃO alteram o cálculo de score (Seção 2.3 do
    plano v2.0). São usados apenas como narrativa qualitativa no laudo,
    agregados por GHE (nunca individualizados).
    """
    __tablename__ = "health_absences"
    __table_args__ = (
        Index('ix_health_absences_company_id', 'company_id'),
        Index('ix_health_absences_department_id', 'department_id'),
        Index('ix_health_absences_company_date', 'company_id', 'absence_date'),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=False)
    cid_code = Column(String(10), nullable=False)       # Ex.: F32, F41.1
    cid_description = Column(String(255), nullable=True)
    duration_days = Column(Integer, nullable=False)
    absence_date = Column(DateTime(timezone=True), nullable=False)
    cat_opened = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(tz=LOCAL_TIMEZONE),
    )
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relacionamentos
    company = relationship("Company")
    department = relationship("Department")
    creator = relationship("User", foreign_keys=[created_by])


# ========================
# v2.0 — NC_RISK_COMM (Comunicação de riscos IA para CIPA/trabalhadores)
# ========================


class RiskCommunicationStatus(str, enum.Enum):
    DRAFT = "draft"
    EDITED = "edited"
    PUBLISHED = "published"


class RiskCommunication(Base):
    """Comunicado gerado por IA para transparência com trabalhadores e CIPA.

    Limite de conteúdo: 450–500 caracteres, até 4 parágrafos.
    Validação anti-PII obrigatória antes de persistir/publicar.
    """
    __tablename__ = "risk_communications"
    __table_args__ = (
        Index('ix_risk_comm_company_campaign', 'company_id', 'campaign_id'),
    )

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'), nullable=False)
    content_text = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default=RiskCommunicationStatus.DRAFT.value)
    generated_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(tz=LOCAL_TIMEZONE),
    )
    edited_at = Column(DateTime(timezone=True), nullable=True)
    edited_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(tz=LOCAL_TIMEZONE),
    )
    updated_at = Column(
        DateTime(timezone=True), nullable=True,
        onupdate=lambda: datetime.now(tz=LOCAL_TIMEZONE),
    )

    # Relacionamentos
    company = relationship("Company")
    campaign = relationship("Campaign")
    editor = relationship("User", foreign_keys=[edited_by])
