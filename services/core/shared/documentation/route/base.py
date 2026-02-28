from abc import ABC, abstractmethod
from fastapi import APIRouter

class BaseRouteDoc(ABC):

    def __init__(self, router: APIRouter):
        self.router = router


