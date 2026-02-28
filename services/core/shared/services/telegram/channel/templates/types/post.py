from abc import ABC, abstractmethod


class ChannelPostText(ABC):

    @abstractmethod
    def get_message(self, *args, **kwargs) -> str:
        pass