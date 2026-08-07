/**
 * ВАЖНО: значения здесь ДОЛЖНЫ совпадать со строками в
 * services/core/legal/documents.py -> CURRENT_VERSIONS.
 *
 * Экран принятия (legal-consent-gate) не хранит версию локально — он всегда
 * спрашивает backend (/legal/consent/status/), какая версия действующая, и
 * backend же фиксирует её при акцепте. Эти константы используются только
 * для отображения номера редакции в подвале страниц /legal/agreement и
 * /legal/offer, чтобы посетитель видел ту же дату, что указана в самом тексте.
 */
export const LEGAL_DOCUMENT_VERSIONS = {
	user_agreement: '27.07.2026 №1',
	public_offer: '27.07.2026 №1',
	privacy_policy: '07.08.2026 №2',
	data_processing_consent: '07.08.2026 №2',
	marketing_consent: '02.08.2026 №1',
	image_consent: '07.08.2026 №2',
	cookie_policy: '02.08.2026 №1',
	distribution_consent: '06.08.2026 №1',
	cross_border_consent: '07.08.2026 №1',
	agent_authority_consent: '07.08.2026 №2',
	minor_representative_consent: '07.08.2026 №2',
} as const
