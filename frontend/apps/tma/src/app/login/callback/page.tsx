'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { getPendingRole } from '~/shared/pending-role'
import { IconLoader, IconAlertCircle, IconArrowLeft } from '~packages/ui/icons'
import styles from '../login.module.scss'

const getErrorMessage = (data: any, fallback: string) => {
	if (!data) return fallback
	if (typeof data.detail === 'string') return data.detail
	if (typeof data.detail?.message === 'string') return data.detail.message
	if (typeof data.message === 'string') return data.message
	return fallback
}

const TG_FIELDS = [
	'id',
	'first_name',
	'last_name',
	'username',
	'photo_url',
	'auth_date',
	'hash',
] as const

type TgData = Record<string, string>

const decodeBase64Url = (input: string): string => {
	const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
	const padded = normalized + '==='.slice((normalized.length + 3) % 4)
	if (typeof window !== 'undefined' && typeof window.atob === 'function') {
		try {
			return decodeURIComponent(escape(window.atob(padded)))
		} catch {
			try {
				return window.atob(padded)
			} catch {
				return ''
			}
		}
	}
	return ''
}

const extractTgFromQuery = (
	params: { get: (key: string) => string | null },
): TgData => {
	const tg: TgData = {}
	for (const key of TG_FIELDS) {
		const value = params.get(key)
		if (value !== null) tg[key] = value
	}
	return tg
}

const extractTgFromHash = (): TgData => {
	if (typeof window === 'undefined' || !window.location.hash) return {}
	const raw = window.location.hash.replace(/^#/, '')
	if (!raw) return {}

	const tg: TgData = {}

	const hashParams = new URLSearchParams(raw)
	for (const key of TG_FIELDS) {
		const value = hashParams.get(key)
		if (value !== null) tg[key] = value
	}

	const tgAuthResult = hashParams.get('tgAuthResult')
	if (tgAuthResult) {
		const decoded = decodeBase64Url(tgAuthResult)
		if (decoded) {
			try {
				const parsed = JSON.parse(decoded)
				for (const key of TG_FIELDS) {
					if (parsed[key] !== undefined && parsed[key] !== null) {
						tg[key] = String(parsed[key])
					}
				}
			} catch {
				// ignore JSON parse errors, keep what we have
			}
		}
	}

	return tg
}

function CallbackHandler() {
	const router = useRouter()
	const params = useSearchParams()
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const queryTg = extractTgFromQuery(params)
		const hashTg = extractTgFromHash()
		const tgData: TgData = { ...queryTg, ...hashTg }

		const code = params.get('code')
		const state = params.get('state')
		const isTelegram = Boolean(tgData.hash && tgData.id && tgData.auth_date)

		async function process() {
			try {
				const nextRoute = getPendingRole() ? '/login/role?auto=1' : '/login/role'
				if (isTelegram) {
					const id = parseInt(tgData.id, 10)
					const auth_date = parseInt(tgData.auth_date, 10)
					if (Number.isNaN(id) || Number.isNaN(auth_date)) {
						setError('Telegram вернул некорректные данные. Попробуйте ещё раз.')
						return
					}

					const payload: Record<string, unknown> = { ...tgData, id, auth_date }

					const res = await fetch(
						`${API_URL}auth/oauth/telegram/verify/`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payload),
						},
					)
					const data = await res.json().catch(() => null)
					if (data?.access_token) {
						login({ access_token: data.access_token })
						router.replace(nextRoute)
						return
					}
					setError(
						getErrorMessage(
							data,
							`Telegram-вход не сработал (HTTP ${res.status}). Попробуйте ещё раз.`,
						),
					)
					return
				}

				if (code) {
					const providers = ['yandex', 'telegram'] as const
					let provider = 'telegram'
					for (const p of providers) {
						if (state?.startsWith(p)) {
							provider = p
							break
						}
					}
					const res = await fetch(
						`${API_URL}auth/oauth/${provider}/callback/`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								code,
								redirect_uri: `${window.location.origin}/login/callback`,
								state,
							}),
						},
					)
					const data = await res.json().catch(() => null)
					if (data?.access_token) {
						login({ access_token: data.access_token })
						router.replace(nextRoute)
						return
					}
					setError(
						getErrorMessage(
							data,
							`Не удалось авторизоваться (HTTP ${res.status}). Попробуйте ещё раз.`,
						),
					)
					return
				}

				setError(
					'Telegram не вернул данные авторизации. Закройте окно и попробуйте войти заново.',
				)
			} catch {
				setError('Ошибка подключения к серверу')
			}
		}

		process()
	}, [params, router])

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.card}>
					{error ? (
						<>
							<h2>Ошибка</h2>
							<div className={styles.error}>
								<IconAlertCircle size={16} />
								{error}
							</div>
							<button
								className={`${styles.btn} ${styles.btnEmail}`}
								onClick={() => router.push('/login')}
							>
								<IconArrowLeft size={16} />
								Назад к выбору входа
							</button>
						</>
					) : (
						<>
							<h2>Авторизация...</h2>
							<p className={styles.subtitle}>
								<IconLoader size={18} />
								Подождите, обрабатываем данные
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	)
}

export default function CallbackPage() {
	return (
		<Suspense
			fallback={
				<div className={styles.root}>
					<div className={styles.container}>
						<div className={styles.card}>
							<IconLoader size={24} />
							<p className={styles.subtitle}>Загрузка...</p>
						</div>
					</div>
				</div>
			}
		>
			<CallbackHandler />
		</Suspense>
	)
}
