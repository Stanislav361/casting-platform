'use client'

/**
 * Согласие с документами Платформы до регистрации.
 *
 * Падает сверху окном над экраном выбора роли — сам экран виден позади,
 * как отдельная страница, к которой человек попадает после согласия.
 * Аккаунта в этот момент ещё нет, поэтому акцепт сохраняется локально
 * (см. shared/legal-preconsent), а на сервер его отправляет
 * `legal-consent-gate` сразу после входа.
 */
import { useCallback, useEffect, useState } from 'react'
import { publicGet } from '~/shared/api-client'
import {
	LEGAL_DOC_TYPES,
	setLegalPreConsent,
	type LegalDocType,
} from '~/shared/legal-preconsent'
import { IconCheck, IconShield } from '~packages/ui/icons'
import styles from './legal-precheck.module.scss'

const DOC_LABELS: Record<LegalDocType, string> = {
	user_agreement: 'Пользовательским соглашением',
	public_offer: 'Публичной офертой',
}

// Если метаданные документов не удалось загрузить, ссылки всё равно ведут на
// сами документы по прямым адресам — регистрация не должна упираться в
// сетевой сбой. Версия остаётся пустой, поэтому после входа согласие
// подтвердится ещё раз с версией, которую отдаст сервер.
const FALLBACK_DOCS: Record<LegalDocType, { version: string; url: string }> = {
	user_agreement: { version: '', url: '/legal/agreement' },
	public_offer: { version: '', url: '/legal/offer' },
}

type DocMeta = { version: string; url: string }

export default function LegalPrecheck({ onAccepted }: { onAccepted: () => void }) {
	const [docs, setDocs] = useState<Record<LegalDocType, DocMeta>>(FALLBACK_DOCS)
	const [checked, setChecked] = useState(false)

	useEffect(() => {
		let cancelled = false

		const load = async () => {
			const data = await publicGet('legal/documents/')
			if (cancelled) return
			const resolved = { ...FALLBACK_DOCS }
			for (const doc of LEGAL_DOC_TYPES) {
				const entry = data?.[doc]
				if (entry && typeof entry.url === 'string') {
					resolved[doc] = {
						version: typeof entry.version === 'string' ? entry.version : '',
						url: entry.url,
					}
				}
			}
			setDocs(resolved)
		}

		load()
		return () => { cancelled = true }
	}, [])

	const handleContinue = useCallback(() => {
		if (!checked) return
		setLegalPreConsent({
			user_agreement: docs.user_agreement.version,
			public_offer: docs.public_offer.version,
		})
		onAccepted()
	}, [checked, docs, onAccepted])

	return (
		<div className={styles.overlay} role="dialog" aria-modal="true">
			<div className={styles.sheet}>
				<div className={styles.iconWrap}>
					<IconShield size={22} />
				</div>

				<p className={styles.intro}>
					Для регистрации в prostoprobuy.pro ознакомьтесь с{' '}
					<a href={docs.user_agreement.url} target="_blank" rel="noopener noreferrer">
						{DOC_LABELS.user_agreement}
					</a>{' '}
					и{' '}
					<a href={docs.public_offer.url} target="_blank" rel="noopener noreferrer">
						{DOC_LABELS.public_offer}
					</a>
					.
				</p>

				<label className={styles.checkRow}>
					<input
						type="checkbox"
						checked={checked}
						onChange={(e) => setChecked(e.target.checked)}
					/>
					<span className={styles.checkbox}>
						{checked && <IconCheck size={14} />}
					</span>
					<span>Я ознакомлен и согласен с условиями использования платформы «prostoprobuy.pro»</span>
				</label>

				<button
					type="button"
					className={styles.continueBtn}
					disabled={!checked}
					onClick={handleContinue}
				>
					Согласен
				</button>
			</div>
		</div>
	)
}
