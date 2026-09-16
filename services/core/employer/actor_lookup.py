"""Какую анкету актёра открыть, когда у аккаунта их несколько.

Один User (агент или родитель) владеет несколькими ActorProfile.
Старый Profile.id у всех детей общий. Если брать «последнюю созданную»
анкету этого user_id, карточка Арно открывает Михаила.
"""


def _norm_name(value) -> str:
    if not value:
        return ""
    return " ".join(str(value).casefold().replace("ё", "е").split())


def pick_actor_profile(
    candidates,
    requested_id=None,
    first_name=None,
    last_name=None,
):
    """Вернуть анкету карточки. Никогда не подменять её соседней.

    * `requested_id` — id конкретной анкеты (из отклика / каст-листа).
      Если её нет или она удалена, не берём другую.
    * Одна живая анкета у аккаунта — её и открываем.
    * Несколько — только если имя и фамилия однозначно совпали со старым Profile.
    * Иначе None: лучше пустые поля старого профиля, чем чужое фото.
    """
    alive = [ap for ap in candidates if not getattr(ap, "is_deleted", False)]
    if requested_id is not None:
        for ap in alive:
            if ap.id == requested_id:
                return ap
        return None
    if len(alive) == 1:
        return alive[0]
    fn = _norm_name(first_name)
    ln = _norm_name(last_name)
    if fn or ln:
        matches = [
            ap
            for ap in alive
            if _norm_name(getattr(ap, "first_name", None)) == fn
            and _norm_name(getattr(ap, "last_name", None)) == ln
        ]
        if len(matches) == 1:
            return matches[0]
    return None
