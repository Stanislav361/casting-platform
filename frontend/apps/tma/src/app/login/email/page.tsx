'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { getPendingRole, getPendingRoleLabel } from '~/shared/pending-role'
import {
	IconMail,
	IconArrowLeft,
	IconUser,
	IconLoader,
	IconAlertCircle,
} from '~packages/ui/icons'
import styles from '../login.module.scss'

export default function EmailLoginPage() {
	const router = useRouter()
	const [mode, setMode] = useState<'login' | 'register'>('login')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [roleLabel, setRoleLabel] = useState('')

	useEffect(() => {
		const pendingRole = getPendingRole()
		if (!pendingRole) {
			router.replace('/login')
			return
		}
		setRoleLabel(getPendingRoleLabel(pendingRole))
	}, [router])

	const handleSubmit = useCallback(async () => {
		setLoading(true)
		setError(null)

		const endpoint =
			mode === 'register' ? 'auth/v2/register/' : 'auth/v2/login/'
		const body: any = { email, password }
		if (mode === 'register') {
			body.first_name = firstName
			body.last_name = lastName
		}

		try {
			const res = await fetch(`${API_URL}${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})
			const data = await res.json()

			if (data.access_token) {
				login({ access_token: data.access_token })
				router.replace('/login/role?auto=1')
			} else {
				setError(
					data.detail?.message || data.detail || 'Ошибка авторизации',
				)
			}
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(false)
	}, [mode, email, password, firstName, lastName, router])

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<div className={styles.logoIcon}>
						<IconMail size={28} />
					</div>
					<h1>
						prosto<span>probuy</span>
					</h1>
				</div>

				<div className={styles.card}>
					<h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
					<p className={styles.subtitle}>{roleLabel ? `${roleLabel} · через Email и пароль` : 'через Email и пароль'}</p>

					{error && (
						<div className={styles.error}>
							<IconAlertCircle size={16} />
							{error}
						</div>
					)}

					{mode === 'register' && (
						<div className={styles.emailFields}>
							<input
								type="text"
								placeholder="Имя"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								className={styles.emailInput}
							/>
							<input
								type="text"
								placeholder="Фамилия"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								className={styles.emailInput}
							/>
						</div>
					)}

					<div className={styles.emailFields}>
						<input
							type="email"
							placeholder="Email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
							className={styles.emailInput}
							autoFocus
						/>
						<input
							type="password"
							placeholder="Пароль"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
							className={styles.emailInput}
						/>
					</div>

					<button
						className={styles.btnSubmit}
						onClick={handleSubmit}
						disabled={loading || !email || !password}
					>
						{loading ? (
							<>
								<IconLoader size={16} /> Загрузка...
							</>
						) : mode === 'login' ? (
							'Войти'
						) : (
							'Зарегистрироваться'
						)}
					</button>

					<p className={styles.toggleMode}>
						{mode === 'login' ? (
							<>
								Нет аккаунта?{' '}
								<a onClick={() => setMode('register')}>Регистрация</a>
							</>
						) : (
							<>
								Уже есть аккаунт?{' '}
								<a onClick={() => setMode('login')}>Войти</a>
							</>
						)}
					</p>

					<button
						className={`${styles.btn} ${styles.btnEmail}`}
						onClick={() => router.push('/login')}
					>
						<IconArrowLeft size={16} />
						Назад
					</button>
				</div>
			</div>
		</div>
	)
}
