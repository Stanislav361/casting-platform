'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { $session, login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { IconCrown, IconLoader, IconAlertCircle, IconSmartphone, IconEye, IconEyeOff } from '~packages/ui/icons'
import styles from './admin-login.module.scss'

export default function AdminLoginPage() {
	const router = useRouter()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [installPrompt, setInstallPrompt] = useState<any>(null)
	const [isStandalone, setIsStandalone] = useState(false)
	const [isIOS, setIsIOS] = useState(false)
	const [showIosHint, setShowIosHint] = useState(false)

	// «Добавить на экран Домой»: ловим системное событие установки (Android/Chrome)
	// и определяем iOS, где установка делается вручную через «Поделиться».
	useEffect(() => {
		if (typeof window === 'undefined') return
		const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
			|| (window.navigator as any).standalone === true
		setIsStandalone(Boolean(standalone))

		const ua = window.navigator.userAgent || ''
		const iOS = /iphone|ipad|ipod/i.test(ua)
			|| (/Macintosh/.test(ua) && 'ontouchend' in document)
		setIsIOS(Boolean(iOS))

		const onBeforeInstall = (e: Event) => {
			e.preventDefault()
			setInstallPrompt(e)
		}
		window.addEventListener('beforeinstallprompt', onBeforeInstall)
		return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
	}, [])

	const handleInstall = useCallback(async () => {
		if (installPrompt) {
			installPrompt.prompt()
			try { await installPrompt.userChoice } catch {}
			setInstallPrompt(null)
			return
		}
		if (isIOS) setShowIosHint(v => !v)
	}, [installPrompt, isIOS])

	// Если уже есть валидная сессия владельца — сразу открываем панель,
	// чтобы ссылка /admin-login всегда вела супер-админа в его панель.
	useEffect(() => {
		const session = $session.getState()
		if (session?.access_token) {
			try {
				const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
				const notExpired = !payload.exp || payload.exp * 1000 > Date.now()
				if (payload.role === 'owner' && notExpired) {
					router.replace('/dashboard/admin')
				}
			} catch {}
		}
	}, [router])

	const handleLogin = useCallback(async () => {
		if (!email || !password) return
		setLoading(true)
		setError(null)

		try {
			const doLogin = async () => {
				const res = await fetch(`${API_URL}auth/v2/login/`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ email, password }),
				})
				return res.json()
			}

			let data = await doLogin()

			if (data.access_token) {
				let payload: any = {}
				try {
					payload = JSON.parse(atob(data.access_token.split('.')[1] || ''))
				} catch {}

				if (payload.role === 'owner') {
					login({ access_token: data.access_token })
					router.replace('/dashboard/admin')
					return
				}

				// Role isn't owner — try to promote and re-login
				try {
					await fetch(`${API_URL}auth/v2/init-owner/?email=${encodeURIComponent(email)}`, {
						method: 'POST',
					})
					data = await doLogin()
					if (data.access_token) {
						try {
							payload = JSON.parse(atob(data.access_token.split('.')[1] || ''))
						} catch {}
						if (payload.role === 'owner') {
							login({ access_token: data.access_token })
							router.replace('/dashboard/admin')
							return
						}
					}
				} catch {}

				setError('Не удалось активировать SuperAdmin. Попробуйте ещё раз.')
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
						<div className={styles.passwordField}>
							<input
								type={showPassword ? 'text' : 'password'}
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
								className={`${styles.input} ${styles.passwordInput}`}
							/>
							<button
								type="button"
								className={styles.passwordToggle}
								onClick={() => setShowPassword(prev => !prev)}
								aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
							>
								{showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
							</button>
						</div>
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

				{!isStandalone && (installPrompt || isIOS) && (
					<div style={{ marginTop: 16, textAlign: 'center' }}>
						<button
							type="button"
							onClick={handleInstall}
							style={{
								display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
								width: '100%', padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
								background: 'rgba(255,255,255,0.06)', color: 'inherit',
								border: '1px solid rgba(255,255,255,0.14)', fontSize: 14, fontWeight: 600,
							}}
						>
							<IconSmartphone size={18} /> Добавить на экран «Домой»
						</button>
						{showIosHint && isIOS && (
							<p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45, opacity: 0.75 }}>
								Нажмите кнопку «Поделиться» в браузере, затем выберите
								{' '}«На экран „Домой“» — появится иконка SuperAdmin.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
