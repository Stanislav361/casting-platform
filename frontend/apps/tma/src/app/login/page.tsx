'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import {
	IconTelegram,
	IconMail,
	IconFilm,
	IconAlertCircle,
	IconLoader,
	IconYandex,
	IconSmartphone,
} from '~packages/ui/icons'
import styles from './login.module.scss'

export default function LoginPage() {
	const router = useRouter()
	const [loading, setLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const isTelegramWebApp =
		typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData

	const handleTelegramLogin = useCallback(async () => {
		setLoading('telegram')
		setError(null)

		if (isTelegramWebApp) {
			try {
				const initData = (window as any).Telegram.WebApp.initData
				const res = await fetch(`${API_URL}tma/auth/`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ init_str: `tma ${initData}` }),
				})
				const data = await res.json()
				if (data) {
					login({ access_token: data })
					router.replace('/login/role')
					return
				}
			} catch {}
		}

		try {
			const res = await fetch(`${API_URL}auth/oauth/telegram/url/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					redirect_uri: `${window.location.origin}/login/callback`,
				}),
			})
			const data = await res.json()
			if (data.url) {
				window.location.href = data.url
				return
			}
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(null)
	}, [isTelegramWebApp, router])

	const handleYandexLogin = useCallback(async () => {
		setLoading('yandex')
		setError(null)
		try {
			const res = await fetch(`${API_URL}auth/oauth/yandex/url/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					redirect_uri: `${window.location.origin}/login/callback`,
				}),
			})
			const data = await res.json()
			if (data.url) {
				window.location.href = data.url
				return
			}
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(null)
	}, [])

	const handleEmailLogin = useCallback(() => {
		router.push('/login/email')
	}, [router])

	const handlePhoneLogin = useCallback(() => {
		router.push('/login/phone')
	}, [router])

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<div className={styles.logoIcon}>
						<IconFilm size={28} />
					</div>
					<h1>
						prosto<span>probuy</span>
					</h1>
					<p>Кастинг-платформа</p>
				</div>

				<div className={styles.card}>
					<h2>Вход в систему</h2>
					<p className={styles.subtitle}>Выберите способ авторизации</p>

					{error && (
						<div className={styles.error}>
							<IconAlertCircle size={16} />
							{error}
						</div>
					)}

					<button
						className={`${styles.btn} ${styles.btnTelegram}`}
						onClick={handleTelegramLogin}
						disabled={!!loading}
					>
						{loading === 'telegram' ? (
							<IconLoader size={18} />
						) : (
							<IconTelegram size={18} />
						)}
						Telegram
					</button>

					<button
						className={`${styles.btn} ${styles.btnYandex}`}
						onClick={handleYandexLogin}
						disabled={!!loading}
					>
						{loading === 'yandex' ? (
							<IconLoader size={18} />
						) : (
							<IconYandex size={18} />
						)}
						Яндекс
					</button>

					<button
						className={`${styles.btn} ${styles.btnEmail}`}
						onClick={handleEmailLogin}
						disabled={!!loading}
					>
						<IconMail size={18} />
						Email
					</button>

					<button
						className={`${styles.btn} ${styles.btnPhone}`}
						onClick={handlePhoneLogin}
						disabled={!!loading}
					>
						<IconSmartphone size={18} />
						Телефон
					</button>
				</div>

				<p className={styles.footer}>
					{isTelegramWebApp
						? 'Открыто в Telegram — рекомендуем войти через Telegram'
						: 'Войдите любым удобным способом'}
				</p>
			</div>
		</div>
	)
}
