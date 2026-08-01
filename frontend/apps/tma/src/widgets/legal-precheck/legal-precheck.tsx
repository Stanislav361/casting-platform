'use client'

/**
 * Принятие документов Платформы до регистрации.
 *
 * Показывается на экране входа первым шагом — раньше выбора роли, чтобы
 * человек соглашался с Пользовательским соглашением и Публичной офертой до
 * того, как начнёт создавать аккаунт. Аккаунта ещё нет, поэтому акцепт
 * сохраняется локально (см. shared/legal-preconsent), а на сервер его
 * отправляет `legal-consent-gate` сразу после входа.
 */
import { useCallback, useEffect, useState } from 'react'
import { publicGet } from '~/shared/api-client'
import {
	LEGAL_DOC_TYPES,
	setLegalPreConsent,
	type LegalDocType,
} from '~/shared/legal-preconsent'
import { IconCheck, IconFileText, IconLoader } from '~packages/ui/icons'
import styles from './legal-precheck.module.scss'

const DOC_LABELS: Record<LegalDocType, { title: string; linkLabel: string }> = {
	user_agreement: {
		title: 'Пользовательское соглашение',
		linkLabel: 'Открыть и прочитать полностью',
	},
	public_offer: {
		title: 'Публичная оферта',
		linkLabel: 'Открыть условия платного доступа',
	},
}

// Если метаданные документов не удалось загрузить, показываем сами документы
// по публичным адресам: регистрация не должна упираться в сетевой сбой.
// Версия остаётся пустой, поэтому после входа согласие подтвердится ещё раз.
const FALLBACK_DOCS: Record<LegalDocType, { version: string; url: string }> = {
	user_agreement: { version: '', url: '/legal/agreement' },
	public_offer: { version: '', url: '/legal/offer' },
}

type DocMeta = { version: string; url: string }

export default function LegalPrecheck({ onAccepted }: { onAccepted: () => void }) {
	const [docs, setDocs] = useState<Record<LegalDocType, DocMeta> | null>(null)
	const [checked, setChecked] = useState<Record<string, boolean>>({})

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

	const allChecked = LEGAL_DOC_TYPES.every((doc) => checked[doc])

	const handleContinue = useCallback(() => {
		if (!allChecked || !docs) return
		setLegalPreConsent({
			user_agreement: docs.user_agreement.version,
			public_offer: docs.public_offer.version,
		})
		onAccepted()
	}, [allChecked, docs, onAccepted])

	if (!docs) {
		return (
			<div className={styles.loadingRow}>
				<IconLoader size={16} />
				Загружаем документы...
			</div>
		)
	}

	return (
		<>
			<div className={styles.docList}>
				{LEGAL_DOC_TYPES.map((doc) => (
					<label key={doc} className={styles.docItem}>
						<input
							type="checkbox"
							checked={!!checked[doc]}
							onChange={(e) => setChecked((prev) => ({ ...prev, [doc]: e.target.checked }))}
						/>
						<span className={styles.docCheckbox}>
							{checked[doc] && <IconCheck size={14} />}
						</span>
						<span className={styles.docText}>
							<strong>Я принимаю «{DOC_LABELS[doc].title}»</strong>
							<a href={docs[doc].url} target="_blank" rel="noopener noreferrer">
								<IconFileText size={13} />
								{DOC_LABELS[doc].linkLabel}
							</a>
							{docs[doc].version && <small>Редакция от {docs[doc].version}</small>}
						</span>
					</label>
				))}
			</div>

			<button
				type="button"
				className={styles.continueBtn}
				disabled={!allChecked}
				onClick={handleContinue}
			>
				Продолжить
			</button>
		</>
	)
}
