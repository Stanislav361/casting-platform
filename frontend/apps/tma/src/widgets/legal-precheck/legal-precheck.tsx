'use client'

/**
 * Небольшая панель снизу с принятием документов Платформы.
 *
 * Выезжает снизу над экраном выбора роли: сам экран виден целиком, но до
 * нажатия «Согласен» выбрать роль нельзя (блокировкой управляет страница
 * входа). По кнопке «Подробнее» раскрываются ссылки на Пользовательское
 * соглашение и Публичную оферту.
 *
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
import { IconChevronRight, IconFileText, IconShield } from '~packages/ui/icons'
import styles from './legal-precheck.module.scss'

const DOC_TITLES: Record<LegalDocType, string> = {
	user_agreement: 'Пользовательское соглашение',
	public_offer: 'Публичная оферта',
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
	const [expanded, setExpanded] = useState(false)

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

	const handleAccept = useCallback(() => {
		setLegalPreConsent({
			user_agreement: docs.user_agreement.version,
			public_offer: docs.public_offer.version,
		})
		onAccepted()
	}, [docs, onAccepted])

	return (
		<div className={styles.bar} role="dialog" aria-label="Условия использования">
			<div className={styles.inner}>
				<div className={styles.head}>
					<span className={styles.iconWrap}>
						<IconShield size={15} />
					</span>
					<p className={styles.text}>
						Чтобы продолжить, примите Пользовательское соглашение и Публичную оферту
					</p>
				</div>

				{expanded && (
					<div className={styles.docList}>
						{LEGAL_DOC_TYPES.map((doc) => (
							<a
								key={doc}
								className={styles.docLink}
								href={docs[doc].url}
								target="_blank"
								rel="noopener noreferrer"
							>
								<IconFileText size={14} />
								<span className={styles.docText}>
									<strong>{DOC_TITLES[doc]}</strong>
									{docs[doc].version && <small>Редакция от {docs[doc].version}</small>}
								</span>
								<IconChevronRight size={14} />
							</a>
						))}
					</div>
				)}

				<div className={styles.actions}>
					<button
						type="button"
						className={styles.moreBtn}
						onClick={() => setExpanded((prev) => !prev)}
					>
						{expanded ? 'Свернуть' : 'Подробнее'}
					</button>
					<button type="button" className={styles.acceptBtn} onClick={handleAccept}>
						Согласен
					</button>
				</div>
			</div>
		</div>
	)
}
