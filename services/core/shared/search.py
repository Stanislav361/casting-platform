"""Поиск людей по имени, городу и прочим текстовым полям.

Имя человека на платформе лежит не в одном поле, а сразу в нескольких: в
аккаунте (`User.first_name`, `User.last_name`), в анкете (`ActorProfile`), а у
перенесённых анкет ещё и в `display_name`, собранном в обратном порядке —
«Фамилия Имя». Поэтому «Александр Кулик» не находилось ничем: такой строки нет
целиком ни в одном поле.

Здесь два правила, общих для всех списков:

* запрос разбивается на слова, и каждое слово должно найтись хоть в одном поле —
  тогда «Кулик», «Александр Кулик» и «Кулик Александр» находят одного человека;
* «ё» и «е» считаются одной буквой, иначе «Артем» не находит Артёма (и наоборот),
  а такие опечатки в русских именах — норма.

Фронтенд повторяет ту же логику для списков, которые фильтруются на клиенте:
см. `frontend/apps/tma/src/shared/actor-search.ts`.
"""

from sqlalchemy import func

# Больше слов в запросе — это уже не поиск по имени, а случайно вставленный
# текст. Ограничение защищает от запроса на сотню условий LIKE.
MAX_SEARCH_WORDS = 6

# Символы, которые LIKE понимает как шаблон. Без экранирования поиск «50%» вернул
# бы вообще всех, а «_» совпадал бы с любой буквой.
LIKE_ESCAPE_CHAR = "\\"
_LIKE_SPECIAL = ("%", "_")


def search_words(value: str | None) -> list[str]:
    """Слова запроса без пустышек и лишних пробелов."""
    if not value:
        return []
    return value.split()[:MAX_SEARCH_WORDS]


def like_pattern(word: str) -> str:
    """Шаблон LIKE для одного слова: подстрока в любом месте поля."""
    escaped = word.replace(LIKE_ESCAPE_CHAR, LIKE_ESCAPE_CHAR * 2)
    for special in _LIKE_SPECIAL:
        escaped = escaped.replace(special, f"{LIKE_ESCAPE_CHAR}{special}")
    return f"%{_fold(escaped)}%"


def search_match(column, pattern: str):
    """Условие «в этом поле встречается слово из запроса».

    Регистр и «ё» приводим к одному виду с обеих сторон: сравнивать нужно то же,
    что мы сделали с запросом в `like_pattern`.
    """
    normalized = func.translate(func.lower(column), "ё", "е")
    return normalized.like(pattern, escape=LIKE_ESCAPE_CHAR)


def _fold(value: str) -> str:
    return value.lower().replace("ё", "е")
