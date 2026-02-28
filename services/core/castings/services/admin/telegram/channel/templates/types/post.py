from shared.services.telegram.channel.templates.types.post import ChannelPostText
from castings.schemas.admin import SCastingData
from bs4 import BeautifulSoup
from bs4.element import Tag


def _html_tag_adapter(text: str) -> str:
    soup = BeautifulSoup(text, "html.parser")
    parts = []

    for p in soup.find_all("p"):
        chunks = []
        for child in p.children:
            if isinstance(child, Tag) and child.name == "br":
                chunks.append("\n")
            else:
                chunks.append(str(child))
        content = "".join(chunks)

        if content.replace("\n", "").strip() == "":
            parts.append("")  # пустой <p> -> пустой блок (не сворачиваем)
        else:
            parts.append(content.strip())

    return "\n".join(parts)


class BaseCastingPostText(ChannelPostText):

    def __init__(self, casting: SCastingData):
        self._casting = casting

    @property
    def casting(self) -> SCastingData:
        return  self._casting

    def get_message(self, *args, **kwargs) -> str:
        pass


class OpenCastingPostText(BaseCastingPostText):

    def get_message(self) -> str:
        title = f"<p><b>{self.casting.title}</b></p>"
        description = self.casting.description
        indent = "<p><br></p>"
        message = _html_tag_adapter(title + indent + description)
        return message

class EditCastingPostText(BaseCastingPostText):

    def get_message(self) -> str:
        title = f"<p><b>{self.casting.title}</b></p>"
        description = self.casting.description
        indent = "<p><br></p>"
        message = _html_tag_adapter(title + indent + description)
        return message


class CloseCastingPostText(BaseCastingPostText):

    def get_message(self) -> str:
        title = f"<p><b>{self.casting.title}</b></p>"
        indent = "<p><br></p>"
        description = '<p>Кастинг завершен! ✅</p>'
        message = _html_tag_adapter(title + indent + description)
        return message