"""Проверка поиска людей по имени (shared/search.py).

Поиск ломается незаметно: ошибок нет, просто список оказывается пустым, и
администратор решает, что актёра в базе нет. Именно так и было — запрос
«Александр Кулик» не находил никого, потому что искался одной подстрокой, а имя
и фамилия лежат в разных полях; а у перенесённых анкет имя вообще заполнено
только в display_name, причём как «Фамилия Имя».

Поэтому проверяем не текст SQL, а результат: заполняем таблицу анкетами всех
встречающихся видов и смотрим, кого находит запрос. Работаем на SQLite, поэтому
`lower` и `translate` подменяем питоновскими — в PostgreSQL они есть штатно и
ведут себя так же.

Запуск (pytest не нужен):

    cd services/core && ./.venv/bin/python tests/test_search.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import Column, Integer, String, event, or_, select  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, declarative_base  # noqa: E402

from shared.search import like_pattern, search_match, search_words  # noqa: E402

Base = declarative_base()


class Actor(Base):
    __tablename__ = "actors"

    id = Column(Integer, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    display_name = Column(String)
    city = Column(String)


# Анкеты всех видов, которые реально живут в базе.
ACTORS = [
    # Заполнена в приложении.
    Actor(id=1, first_name="Александр", last_name="Кулик", city="Москва"),
    # Перенесена из старой базы: имя только в display_name, порядок обратный.
    Actor(id=2, display_name="Кулик Александра", city="Москва"),
    # Однофамилец в другом городе.
    Actor(id=3, first_name="Пётр", last_name="Кулик", city="Казань"),
    # Имя с «ё».
    Actor(id=4, first_name="Артём", last_name="Семёнов", city="Москва"),
    # Никакого отношения к остальным.
    Actor(id=5, first_name="Иван", last_name="Петров", city="Тверь"),
]


def build_engine():
    engine = create_engine("sqlite://")

    # SQLite не знает translate, а lower умеет только латиницу. В PostgreSQL обе
    # функции работают с юникодом, поэтому подменяем их, чтобы проверять логику
    # поиска, а не особенности SQLite.
    @event.listens_for(engine, "connect")
    def register_functions(dbapi_connection, _record):
        dbapi_connection.create_function("lower", 1, lambda v: v.lower() if v is not None else None)
        dbapi_connection.create_function(
            "translate",
            3,
            lambda value, source, target: (
                None if value is None else value.translate(str.maketrans(source, target))
            ),
        )

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add_all(ACTORS)
        session.commit()
    return engine


def found_ids(engine, query: str | None) -> set[int]:
    """Кого находит поиск — так же, как это делают ручки в employer."""
    stmt = select(Actor.id)
    for word in search_words(query):
        pattern = like_pattern(word)
        stmt = stmt.where(
            or_(
                search_match(Actor.first_name, pattern),
                search_match(Actor.last_name, pattern),
                search_match(Actor.display_name, pattern),
                search_match(Actor.city, pattern),
            )
        )
    with Session(engine) as session:
        return set(session.execute(stmt).scalars().all())


def main() -> int:
    engine = build_engine()
    failures = 0

    def check(name: str, expected: set[int], query: str | None):
        nonlocal failures
        actual = found_ids(engine, query)
        ok = actual == expected
        if not ok:
            failures += 1
        print(f"{'OK  ' if ok else 'FAIL'} {name}" + ("" if ok else f" — ждали {sorted(expected)}, получили {sorted(actual)}"))

    check("фамилия находит всех однофамильцев", {1, 2, 3}, "Кулик")
    # «Александр» — начало «Александры», и это правильно: человек дописывает имя
    # постепенно и должен видеть подходящих по ходу набора.
    check("имя и фамилия отсекают лишних", {1, 2}, "Александр Кулик")
    check("порядок слов не важен", {1, 2}, "Кулик Александр")
    check("лишние пробелы не мешают", {1, 2}, "  Кулик   Александр ")
    check("полное имя находит ровно одного", {3}, "Пётр Кулик")
    check("перенесённая анкета находится по имени и фамилии", {2}, "Кулик Александра")
    check("город сужает выборку", {3}, "Кулик Казань")
    check("«Артем» находит Артёма", {4}, "Артем")
    check("«Семенов» находит Семёнова", {4}, "Семенов")
    check("«Артём» тоже находит", {4}, "Артём")
    check("пустой запрос показывает всех", {1, 2, 3, 4, 5}, "   ")
    check("None показывает всех", {1, 2, 3, 4, 5}, None)
    check("незнакомая фамилия не находит никого", set(), "Сидоров")
    check("одно неверное слово из двух отсекает", set(), "Александр Петров")
    # Спецсимволы LIKE не должны превращаться в «найти всё».
    check("процент ничего не находит", set(), "%")
    check("подчёркивание ничего не находит", set(), "_")

    print("\nВсе проверки пройдены." if failures == 0 else f"\nПровалено проверок: {failures}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
