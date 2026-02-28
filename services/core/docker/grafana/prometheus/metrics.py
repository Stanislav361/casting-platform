from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
from fastapi import  APIRouter, FastAPI
from docker.grafana.prometheus.middlewares import PrometheusMiddleware
from prometheus_client import REGISTRY


router = APIRouter()

@router.get("/metrics")
def metrics():
    return Response(generate_latest(REGISTRY), headers={"Content-Type": CONTENT_TYPE_LATEST})

def init_metrics(app: FastAPI):
    app.add_middleware(PrometheusMiddleware)
    app.include_router(router)