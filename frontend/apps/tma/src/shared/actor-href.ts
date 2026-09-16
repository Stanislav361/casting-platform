/**
 * Ссылка на карточку актёра в кабинете.
 *
 * `profile_id` — id старой таблицы profiles. У агента он общий на всех детей.
 * `actor_profile_id` — конкретная анкета. Без неё бэкенд раньше открывал
 * последнюю созданную анкету аккаунта — карточку одного ребёнка, профиль другого.
 */
export function actorCabinetHref(
	profileId: number,
	actorProfileId?: number | null,
): string {
	const base = `/dashboard/actors/${profileId}`
	if (actorProfileId) {
		return `${base}?actor_profile_id=${actorProfileId}`
	}
	return base
}

export function actorByProfileApiPath(
	profileId: number,
	actorProfileId?: number | null,
): string {
	const base = `employer/actors/by-profile/${profileId}/`
	if (actorProfileId) {
		return `${base}?actor_profile_id=${actorProfileId}`
	}
	return base
}
