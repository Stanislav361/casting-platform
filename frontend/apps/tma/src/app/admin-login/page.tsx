'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { IconCrown, IconMail, IconLoader, IconAlertCircle } from '~packages/ui/icons'
import styles from './admin-login.module.scss'

export default function AdminLoginPage() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleLogin = useCallback(async () => {
		if (!email || !password) return
		setLoading(true)
		setError(null)

		try {
			const res = await fetch(`${API_URL}auth/v2/login/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})
			const data = await res.json()

			if (data.access_token) {
				login({ access_token: data.access_token })
				try {
					const payload = JSON.parse(atob(data.access_token.split('.')[1] || ''))
					if (payload.role === 'owner') {
						router.replace('/dashboard/admin')
						return
					}
				} catch {}
				setError('Этот аккаунт не является SuperAdmin')
			} else {
				setError(data.detail?.message || data.detail || 'Неверный email или пароль')
			}
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(false)
	}, [email, password, router])

	return (
		<div className={styles.root}>
			<div className={styles.card}>
				<div className={styles.logoSection}>
					<div className={styles.crownIcon}>
						<IconCrown size={28} />
					</div>
					<h1>SuperAdmin</h1>
					<p>Панель управления платформой</p>
				</div>

				{error && (
					<div className={styles.error}>
						<IconAlertCircle size={16} />
						{error}
					</div>
				)}

				<div className={styles.form}>
					<div className={styles.field}>
						<label>Email</label>
						<input
							type="email"
							placeholder="superadmin@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
							className={styles.input}
							autoFocus
						/>
					</div>
					<div className={styles.field}>
						<label>Пароль</label>
						<input
							type="password"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
							className={styles.input}
						/>
					</div>

					<button
						onClick={handleLogin}
						disabled={loading || !email || !password}
						className={styles.btn}
					>
						{loading ? (
							<>
								<IconLoader size={18} /> Вход...
							</>
						) : (
							<>
								<IconCrown size={18} /> Войти в панель
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	)
}
