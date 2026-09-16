"""Выбор анкеты актёра, когда у аккаунта несколько детей.

Запуск:

    cd services/core && ./.venv/bin/python tests/test_actor_lookup.py
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from employer.actor_lookup import pick_actor_profile  # noqa: E402


def _ap(id, first_name, last_name, is_deleted=False):
    return SimpleNamespace(
        id=id,
        first_name=first_name,
        last_name=last_name,
        is_deleted=is_deleted,
    )


def test_requested_id_wins_over_latest():
    arneaud = _ap(11, "Arneaud", "Nikolaj")
    mikhail = _ap(22, "Михаил", "Бунчич")
    # «Последняя созданная» — Михаил. Карточка просила Арно.
    picked = pick_actor_profile([arneaud, mikhail], requested_id=11)
    assert picked is arneaud


def test_missing_requested_id_does_not_fall_back_to_sibling():
    arneaud = _ap(11, "Arneaud", "Nikolaj")
    mikhail = _ap(22, "Михаил", "Бунчич")
    assert pick_actor_profile([arneaud, mikhail], requested_id=99) is None


def test_single_profile_is_used():
    only = _ap(5, "Иван", "Иванов")
    assert pick_actor_profile([only]) is only


def test_name_match_when_id_unknown():
    arneaud = _ap(11, "Arneaud", "Nikolaj")
    mikhail = _ap(22, "Михаил", "Бунчич")
    picked = pick_actor_profile(
        [arneaud, mikhail],
        first_name="Arneaud",
        last_name="Nikolaj",
    )
    assert picked is arneaud


def test_ambiguous_siblings_return_none():
    a = _ap(11, "Аня", "Иванова")
    b = _ap(22, "Петя", "Иванов")
    assert pick_actor_profile([a, b]) is None


def test_deleted_requested_is_ignored():
    gone = _ap(11, "Arneaud", "Nikolaj", is_deleted=True)
    other = _ap(22, "Михаил", "Бунчич")
    assert pick_actor_profile([gone, other], requested_id=11) is None


if __name__ == "__main__":
    tests = [
        test_requested_id_wins_over_latest,
        test_missing_requested_id_does_not_fall_back_to_sibling,
        test_single_profile_is_used,
        test_name_match_when_id_unknown,
        test_ambiguous_siblings_return_none,
        test_deleted_requested_is_ignored,
    ]
    for fn in tests:
        fn()
        print(f"ok  {fn.__name__}")
    print(f"{len(tests)} passed")
