/**
 * Сохранение контактов аккаунта (телефон, Telegram, ВКонтакте, MAX).
 *
 * Мессенджеры хранятся не в анкете, а в аккаунте: у одного аккаунта может быть
 * несколько анкет, а способ связи с человеком один. Поэтому анкета сохраняется
 * в два запроса — контакты в аккаунт, затем сама анкета.
 *
 * Зачем отдельный модуль. `apiCall` не бросает исключение на 4xx, а возвращает
 * тело ответа. Страницы писали `await apiCall('PATCH', 'auth/v2/me/', ...)` и
 * результат не смотрели — если сохранение контактов отклонялось (например, ник
 * Telegram занят другим аккаунтом из перенесённой базы), человек об этом не
 * узнавал. Контакты не сохранялись, а следом бэкенд отказывался создавать
 * анкету без способа связи — получался тупик: «всё заполнено, а анкета не
 * создаётся». Теперь ошибка всегда доходит до человека.
 */
import { apiCall } from '~/shared/api-client'
import { hasVk, hasMax, normalizeMessengers } from '~/shared/contacts'

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
	/** Сохранилось не всё, но анкету это не блокирует (например, занят ник Telegram). */
	warning?: string
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

function hasOtherMessenger(payload: AccountContactsPayload): boolean {
	return hasVk(payload.vk_nick) || hasMax(payload.max_nick)
}

/** Предупреждение сервера о том, что сохранилось не всё (например, занят Telegram). */
function serverWarning(res: any): string | undefined {
	const warnings = res?.contact_warnings
	if (Array.isArray(warnings) && typeof warnings[0] === 'string') return warnings[0]
	return undefined
}

export async function saveAccountContacts(
	original: AccountContactsPayload,
): Promise<SaveContactsResult> {
	// Мессенджеры приводим к тому же виду, в котором их хранит сервер, чтобы
	// «t.me/nick» и «@nick» не считались разными контактами.
	const payload: AccountContactsPayload = { ...original, ...normalizeMessengers(original) }
	const res = await apiCall('PATCH', 'auth/v2/me/', payload)

	if (res?.id) return { ok: true, warning: serverWarning(res) }

	if (!res) {
		return {
			ok: false,
			error: 'Не удалось сохранить способы связи: нет связи с сервером. Попробуйте ещё раз.',
		}
	}

	// Ник Telegram занят другим аккаунтом. Если человек указал ещё ВКонтакте или
	// MAX, сохраняем их и идём дальше — иначе анкету не создать вообще. Про
	// занятый Telegram обязательно предупреждаем, чтобы он не считал, что
	// кастинг-директор напишет ему туда.
	if (res?.detail?.code === 'telegram_taken' && hasOtherMessenger(payload)) {
		const retry = await apiCall('PATCH', 'auth/v2/me/', {
			...payload,
			telegram_nick: undefined,
		})
		if (retry?.id) {
			return {
				ok: true,
				warning:
					'Указанный Telegram уже привязан к другому аккаунту, поэтому мы его не сохранили. ' +
					'Связываться будут через ВКонтакте или MAX. Если Telegram ваш — войдите в тот аккаунт.',
			}
		}
	}

	return {
		ok: false,
		error: errorMessage(res) || 'Не удалось сохранить способы связи. Попробуйте ещё раз.',
	}
}
