from typing import Protocol
from abc import ABC, abstractmethod
from typing import Any


class GoogleCommandsProtocol(ABC):

    @abstractmethod
    def execute(self, *args, **kwargs) -> Any:
        pass