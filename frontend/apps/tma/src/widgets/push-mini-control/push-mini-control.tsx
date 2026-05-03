'use client'

import { useCallback, useEffect, useState } from 'react'
import { IconBell, IconCheck, IconLoader } from '~packages/ui/icons'
import {
	getPushIssueMessage,
	getPushPermission,
	getPushSupportIssue,
	hasPushSubscription,
	isPushSupported,
	isStandalonePwa,
	subscribeToPush,
} from '~/shared/web-push'
import styles from './push-mini-control.module.scss'

type MiniState = 'unsupported' | 'ios-browser' | 'default' | 'granted' | 'subscribed' | 'denied'

function statusText(state: MiniState): string {
	if (state === 'subscribed') return 'Включены'
	if (state === 'denied') return 'Запрещены'
	if (state === 'unsupported' || state === 'ios-browser') return 'Недоступны'
	return 'Выключены'
}

export default function PushMiniControl() {
	const [state, setState] = useState<MiniState>('default')
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		const issue = getPushSupportIssue()
		if (issue === 'denied') {
			setState('denied')
			setMessage(getPushIssueMessage(issue))
			return
		}
		// iOS in browser (not PWA): PushManager not available
		if (issue === 'no-push-manager' && !isStandalonePwa()) {
			setState('ios-browser')
			setMessage('Добавьте приложение на экран «Домой» — иконка «Поделиться» → «На экран Домой».')
			return
		}
		if (issue) {
			setState('unsupported')
			setMessage(getPushIssueMessage(issue))
			return
		}
		if (!isPushSupported()) {
			setState('unsupported')
			setMessage('Уведомления временно недоступны.')
			return
		}
		const permission = getPushPermission()
		if (permission === 'default') {
			setState('default')
			setMessage(null)
			return
		}
		const subscribed = await hasPushSubscription()
		setState(subscribed ? 'subscribed' : 'granted')
		setMessage(subscribed ? 'Готово: важные события придут на телефон.' : null)
	}, [])

	useEffect(() => {
		refresh()
	}, [refresh])

	useEffect(() => {
		const onStatus = () => refresh()
		window.addEventListener('pp:push-status-changed', onStatus)
		return () => window.removeEventListener('pp:push-status-changed', onStatus)
	}, [refresh])

	const enable = async () => {
		if (state === 'ios-browser') {
			// Re-show the install hint — already visible in message
			return
		}
		setBusy(true)
		setMessage(null)
		const result = await subscribeToPush()
		setBusy(false)
		if (result.ok) {
			setState('subscribed')
			setMessage('Готово: уведомления включены.')
			window.dispatchEvent(new CustomEvent('pp:push-status-changed'))
			return
		}
		if (result.reason === 'denied' || result.reason === 'permission-denied') {
			setState('denied')
			setMessage(getPushIssueMessage('denied'))
			return
		}
		setMessage(result.reason === 'no-vapid'
			? 'Сервер уведомлений ещё настраивается. Попробуйте через пару минут.'
			: 'Не удалось включить. Закройте приложение, откройте снова и повторите.')
	}

	const disabled = busy || state === 'subscribed' || state === 'denied' || state === 'unsupported'

	return (
		<section className={`${styles.root} ${state === 'subscribed' ? styles.rootOn : ''} ${state === 'ios-browser' ? styles.rootIos : ''}`}>
			<div className={styles.icon}>
				{state === 'subscribed' ? <IconCheck size={18} /> : <IconBell size={18} />}
			</div>
			<div className={styles.body}>
				<div className={styles.head}>
					<p className={styles.title}>Уведомления</p>
					<span className={`${styles.status} ${state === 'subscribed' ? styles.statusOn : ''}`}>
						{statusText(state)}
					</span>
				</div>
				<p className={styles.text}>
					{message || (state === 'ios-browser'
						? 'Добавьте на экран «Домой» для получения уведомлений.'
						: 'Включите системные уведомления, чтобы получать события сразу.')}
				</p>
			</div>
			{state !== 'ios-browser' && (
				<button className={styles.action} onClick={enable} disabled={disabled}>
					{busy ? <IconLoader size={14} /> : state === 'subscribed' ? 'ОК' : 'Вкл.'}
				</button>
			)}
		</section>
	)
}
