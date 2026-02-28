from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Optional, Union
from reports.schemas.producer import SReportActorsSorts, SReportActorsFilters, SFullReportData
from reports.services.producer.service import ProducerReportsService

class ProducerReportRouter:
    def __init__(self):
        self.router = APIRouter(tags=["producer & reports"], prefix="/reports")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_get_report_route()
        self.add_add_favorite_route()
        self.add_delete_favorite_route()
        self.add_full_delete_favorite_route()

    def add_get_report_route(self, ):
        @self.router.get('/{public_id}/')
        async def get_report(
            public_id: str,
            search: Optional[str] = Query(default=None, ),
            filters: SReportActorsFilters = Depends(),
            sort_by: SReportActorsSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
        )-> SFullReportData:

            return await ProducerReportsService.get_report(
                public_id=public_id,
                filters=filters,
                sort_by=sort_by,
                search=search,
                page_size=page_size,
                page_number=page_number,
            )

    def add_add_favorite_route(self, ):
        @self.router.post('/favorite/{public_id}/create/')
        async def add_favorite(
            public_id: str,
            actor_id: int,
        )-> int:

            await ProducerReportsService.add_favorite(
                public_id=public_id,
                actor_id=actor_id,
            )
            return status.HTTP_201_CREATED

    def add_delete_favorite_route(self, ):
        @self.router.post('/favorite/{public_id}/delete/')
        async def delete_favorite(
            public_id: str,
            actor_id: int,
        )-> int:

            await ProducerReportsService.delete_favorite(
                public_id=public_id,
                actor_id=actor_id,
            )
            return status.HTTP_204_NO_CONTENT

    def add_full_delete_favorite_route(self, ):
        @self.router.post('/favorite/{public_id}/full-delete/')
        async def delete_favorite(
            public_id: str,
        )-> int:

            await ProducerReportsService.full_delete_favorite(
                public_id=public_id,
            )
            return status.HTTP_204_NO_CONTENT