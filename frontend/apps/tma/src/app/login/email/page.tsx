'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { getPendingRole, getPendingRoleLabel } from '~/shared/pending-role'
import { setPendingReturnUrl } from '~/shared/pending-return-url'
import {
	IconArrowLeft,
	IconUser,
	IconLoader,
	IconAlertCircle,
	IconEye,
	IconEyeOff,
} from '~packages/ui/icons'
import styles from '../login.module.scss'

const readNextParam = (): string | null => {
	if (typeof window === 'undefined') return null
	try {
		const url = new URL(window.location.href)
		const v = url.searchParams.get('next')
		return v && v.startsWith('/') && !v.startsWith('//') ? v : null
	} catch {
		return null
	}
}

export default function EmailLoginPage() {
	const router = useRouter()
	const [mode, setMode] = useState<'login' | 'register'>('login')
	const [step, setStep] = useState<'form' | 'code'>('form')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [code, setCode] = useState(['', '', '', '', '', ''])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [roleLabel, setRoleLabel] = useState('')
	const [codeMessage, setCodeMessage] = useState('')
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])
	const verifyingRef = useRef(false)

	useEffect(() => {
		const next = readNextParam()
		if (next) setPendingReturnUrl(next)

		const pendingRole = getPendingRole()
		if (!pendingRole) {
			router.replace(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
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
				credentials: 'include',
				body: JSON.stringify(body),
			})
			const data = await res.json()

			if (mode === 'register' && data.requires_verification) {
				setCodeMessage(data.message || `Код отправлен на ${email}`)
				setCode(['', '', '', '', '', ''])
				setStep('code')
				setTimeout(() => inputRefs.current[0]?.focus(), 100)
			} else if (data.access_token) {
				login({ access_token: data.access_token })
				router.replace('/login/role?auto=1')
			} else {
				const rawDetail = data?.detail?.message || data?.detail
				let msg = typeof rawDetail === 'string' ? rawDetail : 'Ошибка авторизации'
				if (msg === 'Unauthorized' || res.status === 401 || res.status === 403) {
					msg = mode === 'login'
						? 'Неверный email или пароль. Если у вас ещё нет аккаунта — нажмите «Регистрация».'
						: 'Не удалось войти. Проверьте данные и попробуйте ещё раз.'
				} else if (msg.toLowerCase().includes('deactivated')) {
					msg = 'Аккаунт деактивирован. Обратитесь в поддержку.'
				} else if (msg.toLowerCase().includes('already') || res.status === 409) {
					msg = 'Этот email уже зарегистрирован. Нажмите «Войти».'
				}
				setError(msg)
			}
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(false)
	}, [mode, email, password, firstName, lastName, router])

	const verifyRegisterCode = useCallback(async (fullCode: string) => {
		if (verifyingRef.current) return
		verifyingRef.current = true
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_URL}auth/v2/register/verify/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email, code: fullCode }),
			})
			const data = await res.json().catch(() => null)
			if (data?.access_token) {
				login({ access_token: data.access_token })
				router.replace('/login/role?auto=1')
				return
			}
			setError(data?.detail?.message || data?.detail || `Ошибка подтверждения (${res.status})`)
		} catch {
			setError('Ошибка подключения к серверу')
		} finally {
			verifyingRef.current = false
			setLoading(false)
		}
	}, [email, router])

	const handleCodeInput = useCallback((index: number, value: string) => {
		if (!/^\d*$/.test(value)) return
		const next = [...code]
		next[index] = value.slice(-1)
		setCode(next)
		if (value && index < 5) inputRefs.current[index + 1]?.focus()
		const fullCode = next.join('')
		if (fullCode.length === 6) verifyRegisterCode(fullCode)
	}, [code, verifyRegisterCode])

	const handleCodePaste = useCallback((e: React.ClipboardEvent) => {
		e.preventDefault()
		const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
		if (!pasted) return
		const next = ['', '', '', '', '', '']
		for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
		setCode(next)
		if (pasted.length === 6) verifyRegisterCode(pasted)
		else inputRefs.current[Math.min(pasted.length, 5)]?.focus()
	}, [verifyRegisterCode])

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" className={styles.logoImage} />
					<h1>
						prosto<span>probuy.pro</span>
					</h1>
				</div>

				<div className={styles.card}>
					<h2>{step === 'code' ? 'Введите код' : mode === 'login' ? 'Вход' : 'Регистрация'}</h2>
					<p className={styles.subtitle}>
						{step === 'code'
							? codeMessage || `Код отправлен на ${email}`
							: roleLabel ? `${roleLabel} · через Email и пароль` : 'через Email и пароль'}
					</p>

					{error && (
						<div className={styles.error}>
							<IconAlertCircle size={16} />
							{error}
						</div>
					)}

					{step === 'code' ? (
						<>
							<div className={styles.otpRow} onPaste={handleCodePaste}>
								{code.map((digit, i) => (
									<input
										key={i}
										ref={(el) => { inputRefs.current[i] = el }}
										type="text"
										inputMode="numeric"
										maxLength={1}
										value={digit}
										onChange={(e) => handleCodeInput(i, e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Backspace' && !code[i] && i > 0) inputRefs.current[i - 1]?.focus()
										}}
										className={styles.otpCell}
										autoFocus={i === 0}
									/>
								))}
							</div>
							{loading && <p className={styles.subtitle}><IconLoader size={16} /> Проверяем...</p>}
							<button
								className={`${styles.btn} ${styles.btnEmail}`}
								onClick={() => {
									setStep('form')
									setCode(['', '', '', '', '', ''])
									setError(null)
								}}
								disabled={loading}
							>
								<IconArrowLeft size={16} /> Изменить email
							</button>
						</>
					) : (
						<>
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
						<div className={styles.passwordField}>
							<input
								type={showPassword ? 'text' : 'password'}
								placeholder="Пароль"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
								className={`${styles.emailInput} ${styles.passwordFieldInput}`}
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

					{mode === 'login' && (
						<p className={styles.toggleMode}>
							<a onClick={() => router.push('/login/forgot-password')}>Забыли пароль?</a>
						</p>
					)}

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
						</>
					)}

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
