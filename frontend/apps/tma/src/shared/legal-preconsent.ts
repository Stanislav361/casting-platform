/**
 * Согласие с документами Платформы, полученное ДО авторизации.
 *
 * Новый пользователь принимает Пользовательское соглашение и Публичную оферту
 * на самом первом экране — раньше выбора роли и входа. Аккаунта в этот момент
 * ещё нет, поэтому зафиксировать акцепт на сервере нельзя: сохраняем отметку
 * локально вместе с редакциями документов. После входа `legal-consent-gate`
 * отправляет её на сервер, чтобы не спрашивать согласие второй раз.
 */
export type LegalDocType = 'user_agreement' | 'public_offer'

export const LEGAL_DOC_TYPES: readonly LegalDocType[] = ['user_agreement', 'public_offer']

export type LegalPreConsent = {
	versions: Partial<Record<LegalDocType, string>>
	accepted_at: string
}

const STORAGE_KEY = 'pp_legal_preconsent'

export const getLegalPreConsent = (): LegalPreConsent | null => {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object' || typeof parsed.versions !== 'object') return null
		return parsed as LegalPreConsent
	} catch {
		return null
	}
}

export const setLegalPreConsent = (versions: Partial<Record<LegalDocType, string>>) => {
	if (typeof window === 'undefined') return
	try {
		const payload: LegalPreConsent = { versions, accepted_at: new Date().toISOString() }
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
	} catch {}
}

export const clearLegalPreConsent = () => {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.removeItem(STORAGE_KEY)
	} catch {}
}

/**
 * Принята ли локально именно та редакция документа, которую требует сервер.
 *
 * Сравниваем версии: после выпуска новой редакции старая отметка не должна
 * закрывать экран принятия — человек обязан ознакомиться с изменениями.
 */
export const isPreConsentedFor = (doc: LegalDocType, version: string): boolean => {
	if (!version) return false
	const stored = getLegalPreConsent()
	return stored?.versions?.[doc] === version
}
