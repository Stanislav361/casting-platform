'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { $session, login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from './admin-login.module.scss'

export default function AdminLoginPage() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [checking, setChecking] = useState(true)

	useEffect(() => {
		const session = $session.getState()
		if (session?.access_token) {
			try {
				const payload = JSON.parse(atob(session.access_token.split('.')[1]))
				if (payload.role === 'owner') {
					router.replace('/dashboard/admin')
					return
				}
			} catch {}
		}
		setChecking(false)
	}, [router])

	const handleLogin = async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_URL}auth/v2/login/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})
			const data = await res.json()

			if (!data.access_token) {
				setError('Неверный email или пароль')
				setLoading(false)
				return
			}

			const payload = JSON.parse(atob(data.access_token.split('.')[1]))
			if (payload.role !== 'owner') {
				setError('Доступ только для SuperAdmin')
				setLoading(false)
				return
			}

			login({ access_token: data.access_token })
			router.replace('/dashboard/admin')
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(false)
	}

	if (checking) return <div className={styles.root}><p className={styles.loading}>Проверка...</p></div>

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<span className={styles.crown}>{'👑'}</span>
					<h1>Super<span>Admin</span></h1>
					<p>Панель управления платформой</p>
				</div>

				<div className={styles.card}>
					{error && <div className={styles.error}>{error}</div>}

					<div className={styles.field}>
						<label>Email</label>
						<input
							type="email"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="admin@prostoprobuy.ru"
							className={styles.input}
							onKeyDown={e => e.key === 'Enter' && handleLogin()}
						/>
					</div>

					<div className={styles.field}>
						<label>Пароль</label>
						<input
							type="password"
							value={password}
							onChange={e => setPassword(e.target.value)}
							placeholder="Введите пароль"
							className={styles.input}
							onKeyDown={e => e.key === 'Enter' && handleLogin()}
						/>
					</div>

					<button
						onClick={handleLogin}
						disabled={loading || !email || !password}
						className={styles.btn}
					>
						{loading ? 'Вход...' : 'Войти в панель управления'}
					</button>
				</div>

				<p className={styles.footer}>Доступ только для владельца платформы</p>
			</div>
		</div>
	)
}
