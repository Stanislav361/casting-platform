from abc import ABC, abstractmethod
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo


class ChannelPostButton(ABC):

    @abstractmethod
    def get_button(self, *args, **kwargs) -> InlineKeyboardMarkup:
        pass