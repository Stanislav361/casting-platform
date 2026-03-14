'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'

const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '14px 16px',
	borderRadius: 10,
	border: '1px solid #444',
	background: '#111',
	color: '#fff',
	fontSize: 15,
	marginBottom: 14,
	outline: 'none',
}

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
		<div style={{
			display: 'flex', alignItems: 'center', justifyContent: 'center',
			minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif',
			padding: 20,
		}}>
			<div style={{
				width: '100%', maxWidth: 400, background: '#141414',
				borderRadius: 16, padding: 32, border: '1px solid #222',
			}}>
				<div style={{ textAlign: 'center', marginBottom: 28 }}>
					<div style={{ fontSize: 32, marginBottom: 8 }}>👑</div>
					<h1 style={{ color: '#fff', fontSize: 22, margin: 0, fontWeight: 700 }}>
						SuperAdmin
					</h1>
					<p style={{ color: '#666', fontSize: 14, margin: '6px 0 0' }}>
						Панель управления платформой
					</p>
				</div>

				{error && (
					<div style={{
						background: '#2a1515', border: '1px solid #5a2020', borderRadius: 8,
						padding: '10px 14px', marginBottom: 16, color: '#f87171', fontSize: 13,
					}}>
						{error}
					</div>
				)}

				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
					style={inputStyle}
					autoFocus
				/>
				<input
					type="password"
					placeholder="Пароль"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
					style={inputStyle}
				/>

				<button
					onClick={handleLogin}
					disabled={loading || !email || !password}
					style={{
						width: '100%', padding: '14px 0', borderRadius: 10,
						border: 'none', background: '#f5c518', color: '#000',
						fontSize: 16, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
						opacity: loading || !email || !password ? 0.5 : 1,
						marginTop: 4,
					}}
				>
					{loading ? '⏳ Вход...' : 'Войти в панель'}
				</button>
			</div>
		</div>
	)
}
