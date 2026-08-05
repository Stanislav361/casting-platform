/**
 * Подтверждение уведомления о конфиденциальности каст-листа получателем
 * публичной ссылки (см. «Комплект по ролям» в инструкции по внедрению
 * документов — строка «Получатель Каст-листа»: уведомление о
 * конфиденциальности и правила использования до просмотра).
 *
 * Получатель ссылки не обязательно авторизован в Платформе (это может быть
 * кастинг-директор без аккаунта), поэтому подтверждение хранится локально,
 * привязанное к конкретному токену каст-листа — не к пользователю.
 */
const STORAGE_KEY = 'pp_report_notice_confirmed'

const readConfirmedTokens = (): string[] => {
	if (typeof window === 'undefined') return []
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export const hasConfirmedReportNotice = (token: string): boolean => {
	if (!token) return false
	return readConfirmedTokens().includes(token)
}

export const confirmReportNotice = (token: string) => {
	if (typeof window === 'undefined' || !token) return
	try {
		const tokens = readConfirmedTokens()
		if (!tokens.includes(token)) {
			// Храним не больше последних 30 токенов, чтобы localStorage не рос бесконечно.
			const next = [...tokens, token].slice(-30)
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
		}
	} catch {}
}
