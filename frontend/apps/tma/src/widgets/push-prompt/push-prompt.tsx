'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { IconBell, IconX } from '~packages/ui/icons'
import {
	hasPushSubscription,
	isPushSupported,
	shouldShowPrompt,
	subscribeToPush,
	suppressPromptFor,
} from '~/shared/web-push'
import styles from './push-prompt.module.scss'

const HIDDEN_PATHS = [
	'/login',
	'/error',
	'/alert',
	'/admin-login',
	'/admin',
	'/report/',
	'/invite/',
]

export default function PushPrompt() {
	const pathname = usePathname() || ''
	const [visible, setVisible] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return
		if (!isPushSupported()) return

		const t = window.setTimeout(async () => {
			if (!shouldShowPrompt()) return
			if (Notification.permission === 'granted' && await hasPushSubscription()) return
			setVisible(true)
		}, 4500)

		return () => window.clearTimeout(t)
	}, [pathname])

	if (!visible) return null

	const enable = async () => {
		setBusy(true)
		setError(null)
		const res = await subscribeToPush()
		setBusy(false)
		if (res.ok) {
			setVisible(false)
		} else if (res.reason === 'denied' || res.reason === 'permission-denied') {
			suppressPromptFor()
			setVisible(false)
		} else if (res.reason === 'no-vapid') {
			setError('Сервер уведомлений ещё настраивается. Попробуйте через пару минут.')
		} else {
			setError('Не удалось включить. Попробуйте позже.')
		}
	}

	const dismiss = () => {
		suppressPromptFor()
		setVisible(false)
	}

	return (
		<div className={styles.root} role="dialog" aria-live="polite">
			<div className={styles.iconWrap}>
				<IconBell size={20} />
			</div>
			<div className={styles.body}>
				<p className={styles.title}>Включите уведомления</p>
				<p className={styles.subtitle}>
					Узнавайте о новых откликах, кастингах и сообщениях мгновенно.
				</p>
				{error && <p className={styles.error}>{error}</p>}
			</div>
			<div className={styles.actions}>
				<button className={styles.btnPrimary} onClick={enable} disabled={busy}>
					{busy ? 'Подключаем…' : 'Включить'}
				</button>
				<button className={styles.btnDismiss} onClick={dismiss} aria-label="Закрыть">
					<IconX size={16} />
				</button>
			</div>
		</div>
	)
}
