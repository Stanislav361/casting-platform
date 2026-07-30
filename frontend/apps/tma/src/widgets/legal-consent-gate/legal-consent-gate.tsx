'use client'

/**
 * Экран принятия юридических документов Платформы.
 *
 * Показывается любому авторизованному пользователю (актёр, агент, админ,
 * админ PRO, супер-админ), который ещё не принял действующую редакцию
 * Пользовательского соглашения и/или не ознакомился с Публичной офертой.
 * Полностью блокирует доступ к остальному интерфейсу до принятия — это
 * соответствует определению акцепта в самих документах («установка
 * соответствующего чек-бокса... после предоставления возможности
 * ознакомиться с Соглашением»).
 *
 * Публичные страницы /legal/* и экраны входа /login* исключены — там гейт
 * не нужен (либо пользователь ещё не авторизован, либо это сама страница
 * документа).
 */
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { apiCall, getToken } from '~/shared/api-client'
import { $session } from '@prostoprobuy/models'
import { IconCheck, IconFileText, IconLoader, IconShield } from '~packages/ui/icons'
import styles from './legal-consent-gate.module.scss'

type ConsentStatusEntry = {
	version: string
	url: string
	accepted: boolean
	accepted_at: string | null
}

type ConsentStatus = {
	user_agreement: ConsentStatusEntry
	public_offer: ConsentStatusEntry
	all_accepted: boolean
}

const DOC_LABELS: Record<'user_agreement' | 'public_offer', { title: string; linkLabel: string }> = {
	user_agreement: {
		title: 'Пользовательское соглашение',
		linkLabel: 'Открыть и прочитать полностью',
	},
	public_offer: {
		title: 'Публичная оферта',
		linkLabel: 'Открыть условия платного доступа',
	},
}

const EXCLUDED_PREFIXES = ['/legal', '/login', '/admin-login']

export default function LegalConsentGate() {
	const pathname = usePathname()
	const [status, setStatus] = useState<ConsentStatus | null>(null)
	const [checked, setChecked] = useState<Record<string, boolean>>({})
	const [loading, setLoading] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const isExcludedRoute = Boolean(pathname && EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p)))

	const checkStatus = useCallback(async () => {
		if (!getToken()) {
			setStatus(null)
			return
		}
		setLoading(true)
		try {
			const data = await apiCall('GET', 'legal/consent/status/')
			if (data && typeof data === 'object' && 'all_accepted' in data) {
				setStatus(data as ConsentStatus)
			}
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		if (isExcludedRoute) return
		checkStatus()
		// Токен появляется/меняется после логина, восстановления сессии или
		// refresh — переслушиваем сессию, чтобы гейт сработал сразу же.
		const unsubscribe = $session.watch(() => checkStatus())
		return unsubscribe
	}, [isExcludedRoute, checkStatus])

	const pendingDocs = status
		? (['user_agreement', 'public_offer'] as const).filter((d) => !status[d].accepted)
		: []

	const allChecked = pendingDocs.length > 0 && pendingDocs.every((d) => checked[d])

	const handleAccept = useCallback(async () => {
		if (!allChecked || submitting) return
		setSubmitting(true)
		setError(null)
		try {
			const data = await apiCall('POST', 'legal/consent/accept/', { documents: pendingDocs })
			if (data && typeof data === 'object' && 'all_accepted' in data) {
				setStatus(data as ConsentStatus)
			} else {
				setError('Не удалось сохранить согласие. Попробуйте ещё раз.')
			}
		} catch {
			setError('Не удалось сохранить согласие. Проверьте подключение и попробуйте ещё раз.')
		} finally {
			setSubmitting(false)
		}
	}, [allChecked, submitting, pendingDocs])

	if (isExcludedRoute || loading || !status || pendingDocs.length === 0) {
		return null
	}

	return (
		<div className={styles.overlay} role="dialog" aria-modal="true">
			<div className={styles.card}>
				<div className={styles.iconWrap}>
					<IconShield size={26} />
				</div>
				<h2 className={styles.title}>Обновление документов Платформы</h2>
				<p className={styles.subtitle}>
					Чтобы продолжить, ознакомьтесь и примите действующую редакцию документов ниже.
				</p>

				<div className={styles.docList}>
					{pendingDocs.map((doc) => (
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
								<a href={status[doc].url} target="_blank" rel="noopener noreferrer">
									<IconFileText size={13} />
									{DOC_LABELS[doc].linkLabel}
								</a>
								<small>Редакция от {status[doc].version}</small>
							</span>
						</label>
					))}
				</div>

				{error && <div className={styles.error}>{error}</div>}

				<button
					type="button"
					className={styles.continueBtn}
					disabled={!allChecked || submitting}
					onClick={handleAccept}
				>
					{submitting ? <IconLoader size={18} /> : 'Продолжить'}
				</button>
			</div>
		</div>
	)
}
