'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { getPendingRole, getPendingRoleLabel } from '~/shared/pending-role'
import { isAdminRegistration } from '~/shared/admin-registration'
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

const MODE_HINTS: Record<'login' | 'register' | 'code', string> = {
	code: 'по коду из письма — пароль не нужен',
	login: 'по email и паролю',
	register: 'новый аккаунт по email и паролю',
}

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
	// `code` — вход по одноразовому коду из письма. Он нужен людям из
	// перенесённой базы: аккаунт у них есть, а пароля никогда не было.
	const [mode, setMode] = useState<'login' | 'register' | 'code'>('code')
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
	// Бэкенд отдаёт код в ответе только когда письмо отправить не удалось и
	// аккаунт новый — иначе вход стал бы тупиком.
	const [shownCode, setShownCode] = useState<string | null>(null)
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])
	const verifyingRef = useRef(false)

	useEffect(() => {
		const next = readNextParam()
		if (next) setPendingReturnUrl(next)

		const pendingRole = getPendingRole()
		if (!pendingRole) {
			// Возвращаем на тот же экран, с которого человек пришёл. Без `admin=1`
			// админ увидел бы выбор «Актёр / Агент» вместо типа администратора.
			const query = [
				isAdminRegistration() ? 'admin=1' : '',
				next ? `next=${encodeURIComponent(next)}` : '',
			].filter(Boolean).join('&')
			router.replace(query ? `/login?${query}` : '/login')
			return
		}
		setRoleLabel(getPendingRoleLabel(pendingRole))
	}, [router])

	const requestLoginCode = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_URL}auth/v2/otp/send/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ destination: email, destination_type: 'email' }),
			})
			const data = await res.json().catch(() => null)
			if (res.ok) {
				setCodeMessage(data?.message || `Код отправлен на ${email}`)
				setShownCode(typeof data?.code === 'string' ? data.code : null)
				setCode(['', '', '', '', '', ''])
				setStep('code')
				setTimeout(() => inputRefs.current[0]?.focus(), 100)
			} else {
				const rawDetail = data?.detail?.message || data?.detail
				setError(
					(typeof rawDetail === 'string' && rawDetail) ||
					'Не удалось отправить код. Попробуйте ещё раз.',
				)
			}
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(false)
	}, [email])

	const handleSubmit = useCallback(async () => {
		if (mode === 'code') {
			await requestLoginCode()
			return
		}

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
						? 'Неверный email или пароль. Если пароль вы никогда не задавали — войдите по коду из письма.'
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
	}, [mode, email, password, firstName, lastName, router, requestLoginCode])

	const verifyCode = useCallback(async (fullCode: string) => {
		if (verifyingRef.current) return
		verifyingRef.current = true
		setLoading(true)
		setError(null)

		const isLoginByCode = mode === 'code'
		const endpoint = isLoginByCode ? 'auth/v2/otp/verify/' : 'auth/v2/register/verify/'
		const body = isLoginByCode
			? { destination: email, code: fullCode }
			: { email, code: fullCode }

		try {
			const res = await fetch(`${API_URL}${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body),
			})
			const data = await res.json().catch(() => null)
			if (data?.access_token) {
				login({ access_token: data.access_token })
				router.replace('/login/role?auto=1')
				return
			}
			const rawDetail = data?.detail?.message || data?.detail
			let msg = typeof rawDetail === 'string' ? rawDetail : `Ошибка подтверждения (${res.status})`
			if (msg.toLowerCase().includes('invalid or expired')) {
				msg = 'Код неверный или устарел. Запросите новый код.'
			}
			setError(msg)
		} catch {
			setError('Ошибка подключения к серверу')
		} finally {
			verifyingRef.current = false
			setLoading(false)
		}
	}, [mode, email, router])

	const handleCodeInput = useCallback((index: number, value: string) => {
		if (!/^\d*$/.test(value)) return
		const next = [...code]
		next[index] = value.slice(-1)
		setCode(next)
		if (value && index < 5) inputRefs.current[index + 1]?.focus()
		const fullCode = next.join('')
		if (fullCode.length === 6) verifyCode(fullCode)
	}, [code, verifyCode])

	const handleCodePaste = useCallback((e: React.ClipboardEvent) => {
		e.preventDefault()
		const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
		if (!pasted) return
		const next = ['', '', '', '', '', '']
		for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
		setCode(next)
		if (pasted.length === 6) verifyCode(pasted)
		else inputRefs.current[Math.min(pasted.length, 5)]?.focus()
	}, [verifyCode])

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
					<h2>
						{step === 'code'
							? 'Введите код'
							: mode === 'register' ? 'Регистрация' : 'Вход'}
					</h2>
					<p className={styles.subtitle}>
						{step === 'code'
							? codeMessage || `Код отправлен на ${email}`
							: [roleLabel, MODE_HINTS[mode]].filter(Boolean).join(' · ')}
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
							{shownCode && <p className={styles.devHint}>Ваш код: {shownCode}</p>}
							{loading && <p className={styles.subtitle}><IconLoader size={16} /> Проверяем...</p>}
							{mode === 'code' && (
								<p className={styles.toggleMode}>
									Письмо не пришло?{' '}
									<a onClick={() => { if (!loading) requestLoginCode() }}>Отправить код снова</a>
								</p>
							)}
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
						{mode !== 'code' && (
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
						)}
					</div>

					<button
						className={styles.btnSubmit}
						onClick={handleSubmit}
						disabled={loading || !email || (mode !== 'code' && !password)}
					>
						{loading ? (
							<>
								<IconLoader size={16} /> Загрузка...
							</>
						) : mode === 'code' ? (
							'Получить код'
						) : mode === 'login' ? (
							'Войти'
						) : (
							'Зарегистрироваться'
						)}
					</button>

					{mode === 'code' && (
						<p className={styles.toggleMode}>
							Есть пароль?{' '}
							<a onClick={() => { setMode('login'); setError(null) }}>Войти с паролем</a>
						</p>
					)}

					{mode === 'login' && (
						<>
							<p className={styles.toggleMode}>
								Нет пароля или забыли его?{' '}
								<a onClick={() => { setMode('code'); setError(null) }}>Войти по коду из письма</a>
							</p>
							<p className={styles.toggleMode}>
								<a onClick={() => router.push('/login/forgot-password')}>Забыли пароль?</a>
							</p>
						</>
					)}

					<p className={styles.toggleMode}>
						{mode === 'register' ? (
							<>
								Уже есть аккаунт?{' '}
								<a onClick={() => { setMode('code'); setError(null) }}>Войти</a>
							</>
						) : (
							<>
								Нет аккаунта?{' '}
								<a onClick={() => { setMode('register'); setError(null) }}>Регистрация</a>
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
