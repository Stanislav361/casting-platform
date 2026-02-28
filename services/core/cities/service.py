from postgres.database import transaction
from cities.repository import CitiesRepository
from cities.schemas import SCitiesList
from typing import Optional

class CitiesService:

    @classmethod
    @transaction
    async def search(
            cls,
            session,
            search: Optional[str],
            page_size: int,
            page_number: int
    ) -> SCitiesList:
        cities, query = await CitiesRepository.search(
            session=session,
            search=search,
            page_size=page_size,
            page_number=page_number
        )

        meta = await CitiesRepository.get_meta(
            session=session,
            query=query,
            page_number=page_number,
            page_size=page_size,
        )

        return SCitiesList(meta=meta, response=cities)