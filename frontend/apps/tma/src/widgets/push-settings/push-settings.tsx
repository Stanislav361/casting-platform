'use client'

import { useEffect, useState, useCallback } from 'react'
import { IconBell, IconCheck, IconLoader, IconX } from '~packages/ui/icons'
import {
	isPushSupported,
	getPushPermission,
	subscribeToPush,
	unsubscribeFromPush,
} from '~/shared/web-push'
import styles from './push-settings.module.scss'

type State = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'

export default function PushSettings() {
	const [state, setState] = useState<State>('default')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		if (!isPushSupported()) {
			setState('unsupported')
			return
		}
		const perm = getPushPermission()
		if (perm === 'denied') {
			setState('denied')
			return
		}
		if (perm === 'default') {
			setState('default')
			return
		}
		try {
			const reg = await navigator.serviceWorker.ready
			const sub = await reg.pushManager.getSubscription()
			setState(sub ? 'subscribed' : 'granted')
		} catch {
			setState('granted')
		}
	}, [])

	useEffect(() => {
		refresh()
	}, [refresh])

	const enable = async () => {
		setBusy(true)
		setError(null)
		const res = await subscribeToPush()
		setBusy(false)
		if (res.ok) {
			setState('subscribed')
		} else if (res.reason === 'unsupported') {
			setState('unsupported')
		} else if (res.reason === 'denied' || res.reason === 'permission-denied') {
			setState('denied')
			setError('Разрешение запрещено. Включите его в настройках браузера.')
		} else if (res.reason === 'no-vapid') {
			setError('Push-уведомления пока недоступны на сервере.')
		} else {
			setError('Не удалось подключить уведомления.')
		}
	}

	const disable = async () => {
		setBusy(true)
		setError(null)
		try {
			await unsubscribeFromPush()
			setState('granted')
		} catch {
			setError('Не удалось отключить.')
		}
		setBusy(false)
	}

	if (state === 'unsupported') {
		return (
			<section className={styles.section}>
				<header className={styles.head}>
					<div className={styles.icon}><IconBell size={16} /></div>
					<div>
						<h3 className={styles.title}>Push-уведомления</h3>
						<p className={styles.hint}>
							Ваш браузер пока не поддерживает push-уведомления. Установите приложение
							через «Добавить на экран Домой» — на iOS push доступен в режиме PWA.
						</p>
					</div>
				</header>
			</section>
		)
	}

	const isOn = state === 'subscribed'

	return (
		<section className={styles.section}>
			<header className={styles.head}>
				<div className={`${styles.icon} ${isOn ? styles.iconOn : ''}`}>
					<IconBell size={16} />
				</div>
				<div className={styles.headBody}>
					<h3 className={styles.title}>Уведомления на устройство</h3>
					<p className={styles.hint}>
						Получайте оповещения мгновенно — даже когда приложение закрыто.
					</p>
				</div>
				<span className={`${styles.status} ${isOn ? styles.statusOn : ''}`}>
					{isOn ? (<><IconCheck size={12} /> Включено</>) : 'Выключено'}
				</span>
			</header>

			{error && <p className={styles.error}><IconX size={12} /> {error}</p>}

			<div className={styles.actions}>
				{!isOn ? (
					<button className={styles.btnPrimary} onClick={enable} disabled={busy || state === 'denied'}>
						{busy ? <><IconLoader size={14} /> Подключаем…</> : 'Включить уведомления'}
					</button>
				) : (
					<button className={styles.btnSecondary} onClick={disable} disabled={busy}>
						{busy ? <><IconLoader size={14} /> Отключаем…</> : 'Отключить уведомления'}
					</button>
				)}
				{state === 'denied' && (
					<p className={styles.hintInline}>
						Разрешение запрещено. Откройте настройки сайта в браузере и разрешите уведомления.
					</p>
				)}
			</div>
		</section>
	)
}
