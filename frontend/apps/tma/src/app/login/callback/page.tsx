'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { links } from '@prostoprobuy/links'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from '../login.module.scss'

function CallbackHandler() {
	const router = useRouter()
	const params = useSearchParams()
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const code = params.get('code')
		const state = params.get('state')

		const tgData: Record<string, string> = {}
		let isTelegram = false
		for (const [key, value] of params.entries()) {
			if (['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].includes(key)) {
				tgData[key] = value
				isTelegram = true
			}
		}

		async function process() {
			try {
				if (isTelegram && tgData.hash) {
					const res = await fetch(`${API_URL}auth/oauth/telegram/verify/`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							...tgData,
							id: parseInt(tgData.id),
							auth_date: parseInt(tgData.auth_date),
						}),
					})
					const data = await res.json()
					if (data.access_token) {
						login({ access_token: data.access_token })
						router.replace('/login/role')
						return
					}
				}

				if (code) {
					const provider = state?.startsWith('vk') ? 'vk' : 'telegram'
					const res = await fetch(`${API_URL}auth/oauth/${provider}/callback/`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							code,
							redirect_uri: `${window.location.origin}/login/callback`,
							state,
						}),
					})
					const data = await res.json()
					if (data.access_token) {
						login({ access_token: data.access_token })
						router.replace('/login/role')
						return
					}
				}

				setError('Не удалось авторизоваться. Попробуйте ещё раз.')
			} catch (e) {
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
							<div className={styles.error}>{error}</div>
							<button
								className={`${styles.btn} ${styles.btnEmail}`}
								onClick={() => router.push('/login')}
							>
								← Назад к выбору входа
							</button>
						</>
					) : (
						<>
							<h2>Авторизация...</h2>
							<p className={styles.subtitle}>Подождите, обрабатываем данные</p>
						</>
					)}
				</div>
			</div>
		</div>
	)
}

export default function CallbackPage() {
	return (
		<Suspense fallback={<div className={styles.root}><p>Загрузка...</p></div>}>
			<CallbackHandler />
		</Suspense>
	)
}
