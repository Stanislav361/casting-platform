'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { links } from '@prostoprobuy/links'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
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

	const handleSubmit = useCallback(async () => {
		setLoading(true)
		setError(null)

		const endpoint = mode === 'register' ? 'auth/v2/register/' : 'auth/v2/login/'
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
				router.replace('/login/role')
			} else {
				setError(data.detail?.message || data.detail || 'Ошибка авторизации')
			}
		} catch (e) {
			setError('Ошибка подключения к серверу')
		}
		setLoading(false)
	}, [mode, email, password, firstName, lastName, router])

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<h1>prosto<span>probuy</span></h1>
				</div>

				<div className={styles.card}>
					<h2>{mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
					<p className={styles.subtitle}>через Email и пароль</p>

					{error && <div className={styles.error}>{error}</div>}

					{mode === 'register' && (
						<>
							<input
								type="text"
								placeholder="Имя"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								style={inputStyle}
							/>
							<input
								type="text"
								placeholder="Фамилия"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								style={inputStyle}
							/>
						</>
					)}

					<input
						type="email"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						style={inputStyle}
					/>
					<input
						type="password"
						placeholder="Пароль"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						style={inputStyle}
					/>

					<button
						className={`${styles.btn} ${styles.btnEmail}`}
						onClick={handleSubmit}
						disabled={loading || !email || !password}
						style={{ background: '#f5c518', color: '#000', border: 'none' }}
					>
						{loading ? '⏳ ...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
					</button>

					<p style={{ textAlign: 'center', marginTop: 16, color: '#888', fontSize: 14 }}>
						{mode === 'login' ? (
							<>Нет аккаунта? <a onClick={() => setMode('register')} style={{ color: '#f5c518', cursor: 'pointer' }}>Регистрация</a></>
						) : (
							<>Уже есть аккаунт? <a onClick={() => setMode('login')} style={{ color: '#f5c518', cursor: 'pointer' }}>Войти</a></>
						)}
					</p>

					<button
						className={`${styles.btn} ${styles.btnEmail}`}
						onClick={() => router.push('/login')}
						style={{ marginTop: 8 }}
					>
						← Назад
					</button>
				</div>
			</div>
		</div>
	)
}

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '12px 16px',
	borderRadius: 10,
	border: '1px solid #444',
	background: '#111',
	color: '#fff',
	fontSize: 15,
	marginBottom: 12,
	outline: 'none',
}
