from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from users.dependencies.auth_depends import admin_authorized
from users.services.auth_token.types.jwt import JWT
from reports.schemas.admin import *
from reports.services.admin.service import AdminReportsService
# from reports.routes.doc import AdminRouteDoc


class AdminReportRouter:

    def __init__(self):
        self.router = APIRouter(tags=["admin & reports"], prefix="/reports")
        # self.doc = AdminRouteDoc(router=self.router)
        self.include_routers()

    def include_routers(self) -> None:
        self.add_get_report_route()
        self.add_get_report_widget_route()
        self.add_get_all_route()
        self.add_get_actors_route()
        self.add_get_actors_id_route()
        # self.add_generate_report_route()
        self.add_create_report_route()
        self.add_edit_report_route()
        self.add_actors_for_report_router()
        self.add_delete_actors_from_report_router()
        self.add_full_delete_actors_from_report_router()
        self.add_delete_report_route()


    def add_get_report_route(self, ):
        @self.router.get('/{report_id}/')
        async def get_report(
            report_id: int,
            search: Optional[str] = Query(default=None, ),
            filters: SReportActorsFilters = Depends(),
            sort_by: SReportActorsSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            authorized: JWT = Depends(admin_authorized),
        )-> Union[SWidgetReportData, SFullReportData]:

            return await AdminReportsService.get_report(
                report_id=report_id,
                filters=filters,
                sort_by=sort_by,
                search=search,
                page_size=page_size,
                page_number=page_number,
            )


    def add_get_report_widget_route(self, ):
        @self.router.get('/{report_id}/widget')
        async def get_report_widget(
            report_id: int,
            authorized: JWT = Depends(admin_authorized),
        )-> Union[SWidgetReportData, SFullReportData]:
            return await AdminReportsService.get_report_extra(
                report_id=report_id,
            )

    def add_get_all_route(self, ):
        @self.router.get('/')
        async def get_all_reports(
            search: Optional[str] = Query(default=None,),
            filters: SReportFilters = Depends(),
            sort_by: SReportSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            authorized: JWT = Depends(admin_authorized),
        )-> SReportList:

            return await AdminReportsService.get_all_reports(
                search=search,
                filters=filters,
                sort_by=sort_by,
                page_size=page_size,
                page_number=page_number,
            )

    def add_get_actors_id_route(self, ):
        @self.router.get('/{report_id}/id')
        async def get_actors_id_route(
            report_id: int,
            search: Optional[str] = Query(default=None, ),
            filters: SReportActorsFilters = Depends(),
            sort_by: SReportActorsSorts = Depends(),
            authorized: JWT = Depends(admin_authorized),
        )-> SReportActorsListIds:

            return await AdminReportsService.get_actors_id(
                report_id=report_id,
                filters=filters,
                sort_by=sort_by,
                search=search,
                in_report=True,
            )

    def add_get_actors_route(self,):
        @self.router.get('/actors/{report_id}/', )
        async def get_actors_route(
            report_id: int,
            search: Optional[str] = Query(default=None, ),
            filters: SReportActorsFilters = Depends(),
            sort_by: SReportActorsSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            authorized: JWT = Depends(admin_authorized),
        ) -> Union[SReportActorsList, SReportActorsListIds]:
            """
            - Если дернешь эту ручку, когда отчет еще не заполнялся актерами, то тебе придут все возможные актеры
            по соответствующим фильтрам

            - Если дернешь эту ручку, когда отчет уже заполнен актерами, например, при редактировании отчета, то тебе
            будут приходить только те актеры, которые не были добавлены в него ранее. Так ты можешь отправлять запрос
            на актуализацию листинга после каждого действия внутри отчета
            """
            return await AdminReportsService.get_actors(
                report_id=report_id,
                search=search,
                filters=filters,
                sort_by=sort_by,
                page_size=page_size,
                page_number=page_number,
                in_report=False,
            )

    # def add_generate_report_route(self, ):
    #     @self.router.post('/{report_id}/generate/')
    #     async def generate_report(
    #             report_id: int,
    #             authorized: JWT = Depends(admin_authorized),
    #     ) -> HttpUrl:
    #         report_link = await AdminReportsService.generate_report(
    #             report_id=report_id,
    #         )
    #         return report_link

    def add_create_report_route(self, ):
        @self.router.post('/create/')
        async def create_report(
            report_data: SReportCreate,
            authorized: JWT = Depends(admin_authorized),
        ) -> JSONResponse:
            return await AdminReportsService.create_report(
                report_data=report_data,
            )

    def add_edit_report_route(self):
        @self.router.patch('/{report_id}/edit/')
        async def edit_report(
            report_id: int,
            data: SReportEdit,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            return await AdminReportsService.edit_report(
                report_id=report_id,
                data=data
            )

    def add_actors_for_report_router(self, ):
        @self.router.post('/actors/{report_id}/create/')
        async def edit_actors_for_report(
            report_id: int,
            data: SActorsDataForReport,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            return await AdminReportsService.add_actors_for_report(
                report_id=report_id,
                data=data,
            )


    def add_delete_actors_from_report_router(self, ):
        @self.router.post('/actors/{report_id}/delete/')
        async def delete_actors_from_report(
            report_id: int,
            data: SActorsDataForReport,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            return await AdminReportsService.delete_actors_from_report(
                report_id=report_id,
                data=data,
            )

    def add_full_delete_actors_from_report_router(self, ):
        @self.router.post('/actors/{report_id}/full-delete/')
        async def delete_actors_from_report(
            report_id: int,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            return await AdminReportsService.full_delete_actors_from_report(
                report_id=report_id,
            )

    def add_delete_report_route(self):
        @self.router.delete('/{report_id}/delete/')
        async def delete_report(
            report_id: int,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            return await AdminReportsService.delete_report(
                report_id=report_id,
            )