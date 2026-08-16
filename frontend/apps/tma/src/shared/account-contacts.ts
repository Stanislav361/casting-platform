/**
 * Сохранение контактов аккаунта (телефон, Telegram, ВКонтакте, MAX).
 *
 * Мессенджеры хранятся не в анкете, а в аккаунте: у одного аккаунта может быть
 * несколько анкет, а способ связи с человеком один. Поэтому анкета сохраняется
 * в два запроса — контакты в аккаунт, затем сама анкета.
 *
 * Зачем отдельный модуль. `apiCall` не бросает исключение на 4xx, а возвращает
 * тело ответа. Страницы писали `await apiCall('PATCH', 'auth/v2/me/', ...)` и
 * результат не смотрели — если сохранение контактов отклонялось, человек об
 * этом не узнавал: контакты не сохранялись, а следом бэкенд отказывался
 * создавать анкету без способа связи. Получался тупик «всё заполнено, а анкета
 * не создаётся». Теперь причина отказа всегда доходит до человека.
 */
import { apiCall } from '~/shared/api-client'
import { normalizeMessengers } from '~/shared/contacts'

export type AccountContactsPayload = {
	first_name?: string
	last_name?: string
	phone_number?: string | null
	email?: string
	telegram_nick?: string | null
	vk_nick?: string | null
	max_nick?: string | null
}

export type SaveContactsResult = {
	ok: boolean
	/** Причина отказа — показываем человеку, когда `ok = false`. */
	error?: string
}

function errorMessage(res: any): string | null {
	const detail = res?.detail
	if (typeof detail === 'string') return detail
	if (typeof detail?.message === 'string') return detail.message
	if (Array.isArray(detail)) {
		// Ошибка валидации pydantic: [{ loc: [...], msg: '...' }]
		const first = detail[0]
		if (typeof first?.msg === 'string') return first.msg
	}
	return null
}

export async function saveAccountContacts(
	original: AccountContactsPayload,
): Promise<SaveContactsResult> {
	// Мессенджеры приводим к тому же виду, в котором их хранит сервер, чтобы
	// «t.me/nick» и «@nick» не считались разными контактами.
	const payload: AccountContactsPayload = { ...original, ...normalizeMessengers(original) }
	const res = await apiCall('PATCH', 'auth/v2/me/', payload)

	if (res?.id) return { ok: true }

	if (!res) {
		return {
			ok: false,
			error: 'Не удалось сохранить способы связи: нет связи с сервером. Попробуйте ещё раз.',
		}
	}

	return {
		ok: false,
		error: errorMessage(res) || 'Не удалось сохранить способы связи. Попробуйте ещё раз.',
	}
}
