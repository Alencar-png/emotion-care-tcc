
from fastapi.middleware.cors import CORSMiddleware
from routers.users import user
from routers.security import security
from routers.companies import company
from routers.departments import department
from routers.job_roles import job_role
from routers.employees import employee
from routers.questionnaires import questionnaire
from routers.campaigns import campaign_router
from routers.responses import response_router
from routers.analytics import analytics_router
from routers.admin_responses import admin_response_router
from routers.pgr import pgr_router
from routers.ai import ai_router
from routers.webhooks import webhook_router
from routers.onboarding import onboarding_router
from routers.qualitative import qualitative_router
from contextlib import asynccontextmanager
from fastapi import FastAPI
from services.resend_scheduler import start_resend_scheduler
from services.deadline_scheduler import start_deadline_scheduler
from services.reevaluation_scheduler import start_reevaluation_scheduler
import os
import uvicorn


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_resend_scheduler()
    start_deadline_scheduler()
    start_reevaluation_scheduler()
    yield


app = FastAPI(
    title="Emotion Care — Plataforma de Gestão de Saúde Mental no Trabalho",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.include_router(security, prefix='/api', tags=['security'])
app.include_router(user, prefix='/api', tags=['users'])
app.include_router(company, prefix='/api', tags=['companies'])
app.include_router(department, prefix='/api', tags=['departments'])
app.include_router(job_role, prefix='/api', tags=['job-roles'])
app.include_router(employee, prefix='/api', tags=['employees'])
app.include_router(questionnaire, prefix='/api', tags=['questionnaires'])
app.include_router(campaign_router, prefix='/api', tags=['campaigns'])
app.include_router(response_router, prefix='/api', tags=['responses'])
app.include_router(analytics_router, prefix='/api', tags=['analytics'])
app.include_router(admin_response_router, prefix='/api', tags=['admin-responses'])
app.include_router(pgr_router, prefix='/api', tags=['pgr'])
app.include_router(ai_router, prefix='/api', tags=['ai'])
app.include_router(webhook_router, prefix='/api', tags=['webhooks'])
app.include_router(onboarding_router, prefix='/api', tags=['onboarding'])
app.include_router(qualitative_router, prefix='/api', tags=['qualitative'])

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*']
)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 4200))
    uvicorn.run(app, host="0.0.0.0", port=port)
