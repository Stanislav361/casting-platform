'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { IconBell, IconX } from '~packages/ui/icons'
import type { PushSupportIssue } from '~/shared/web-push'
import {
	getPushIssueMessage,
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
	// После явного нажатия «Включить» прячем кнопку, чтобы человек не тыкал по
	// кругу: либо подписались, либо показали подсказку и больше не навязываемся.
	const [done, setDone] = useState(false)

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return
		if (!isPushSupported()) return

		const t = window.setTimeout(async () => {
			if (!shouldShowPrompt()) return
			if (Notification.permission === 'granted' && await hasPushSubscription()) return
			setVisible(true)
		}, 2000)

		return () => window.clearTimeout(t)
	}, [pathname])

	if (!visible) return null

	const enable = async () => {
		setBusy(true)
		setError(null)
		const res = await subscribeToPush()
		setBusy(false)

		if (res.ok) {
			// Подписка создана. Гасим баннер навсегда (на этом устройстве), чтобы
			// он не выскакивал заново при переходах между страницами.
			suppressPromptFor()
			setVisible(false)
			window.dispatchEvent(new CustomEvent('pp:push-status-changed'))
			return
		}

		const reason = res.reason || ''
		// Временные проблемы сервера — даём повторить, баннер не подавляем.
		const transient =
			reason === 'no-vapid' ||
			reason === 'no-sw' ||
			reason === 'server-error' ||
			reason.includes('server')
		if (transient) {
			setError('Сервер уведомлений ещё настраивается. Попробуйте через пару минут.')
			return
		}

		// Push на этом браузере/устройстве недоступен или запрещён (частый кейс
		// на Android в встроенном браузере). Больше НЕ навязываем баннер на
		// каждой странице и подсказываем, как получать уведомления иначе.
		suppressPromptFor()
		setDone(true)
		const msg = getPushIssueMessage(reason as PushSupportIssue)
		setError(
			msg ||
				'Push на этом устройстве недоступен. Уведомления приходят прямо в приложении, а письма на почту можно включить в Настройках → Уведомления.',
		)
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
				{done ? (
					<button className={styles.btnPrimary} onClick={() => setVisible(false)}>
						Понятно
					</button>
				) : (
					<button className={styles.btnPrimary} onClick={enable} disabled={busy}>
						{busy ? 'Подключаем…' : 'Включить'}
					</button>
				)}
				<button className={styles.btnDismiss} onClick={dismiss} aria-label="Закрыть">
					<IconX size={16} />
				</button>
			</div>
		</div>
	)
}
