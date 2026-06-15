'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { API_URL } from '~/shared/api-url'
import {
	IconArrowLeft,
	IconLoader,
	IconAlertCircle,
	IconEye,
	IconEyeOff,
} from '~packages/ui/icons'
import styles from '../login.module.scss'

const getErrorMessage = (data: any, fallback: string) => {
	const detail = data?.detail
	if (typeof detail === 'string') return detail
	if (typeof detail?.message === 'string') return detail.message
	if (Array.isArray(detail)) {
		const message = detail.map((item: any) => item?.msg || item?.message).find(Boolean)
		if (message) return String(message)
	}
	return fallback
}

export default function ForgotPasswordPage() {
	const router = useRouter()
	const [step, setStep] = useState<'email' | 'confirm' | 'done'>('email')
	const [email, setEmail] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [showNewPassword, setShowNewPassword] = useState(false)
	const [code, setCode] = useState(['', '', '', '', '', ''])
	const [message, setMessage] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])
	const confirmingRef = useRef(false)

	const requestReset = useCallback(async () => {
		if (!email.trim() || loading) return
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_URL}auth/v2/password-reset/request/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email: email.trim().toLowerCase() }),
			})
			const data = await res.json().catch(() => null)
			if (!res.ok) {
				setError(getErrorMessage(data, 'Не удалось отправить код восстановления'))
				return
			}
			setMessage(data?.message || 'Если аккаунт существует, код отправлен на email.')
			setCode(['', '', '', '', '', ''])
			setStep('confirm')
			setTimeout(() => inputRefs.current[0]?.focus(), 100)
		} catch {
			setError('Ошибка подключения к серверу')
		} finally {
			setLoading(false)
		}
	}, [email, loading])

	const confirmReset = useCallback(async (fullCode?: string) => {
		const codeValue = fullCode || code.join('')
		if (confirmingRef.current || codeValue.length !== 6 || newPassword.length < 8) return
		confirmingRef.current = true
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(`${API_URL}auth/v2/password-reset/confirm/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					email: email.trim().toLowerCase(),
					code: codeValue,
					new_password: newPassword,
				}),
			})
			const data = await res.json().catch(() => null)
			if (!res.ok) {
				setError(getErrorMessage(data, 'Не удалось изменить пароль'))
				return
			}
			setMessage(data?.message || 'Пароль успешно изменён')
			setStep('done')
		} catch {
			setError('Ошибка подключения к серверу')
		} finally {
			confirmingRef.current = false
			setLoading(false)
		}
	}, [code, email, newPassword])

	const handleCodeInput = useCallback((index: number, value: string) => {
		if (!/^\d*$/.test(value)) return
		const next = [...code]
		next[index] = value.slice(-1)
		setCode(next)
		if (value && index < 5) inputRefs.current[index + 1]?.focus()
	}, [code])

	const handleCodePaste = useCallback((e: React.ClipboardEvent) => {
		e.preventDefault()
		const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
		if (!pasted) return
		const next = ['', '', '', '', '', '']
		for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
		setCode(next)
		if (pasted.length < 6) inputRefs.current[Math.min(pasted.length, 5)]?.focus()
	}, [])

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
					<h2>{step === 'done' ? 'Пароль изменён' : 'Восстановление пароля'}</h2>
					<p className={styles.subtitle}>
						{step === 'email'
							? 'Введите email аккаунта, и мы отправим код восстановления'
							: step === 'confirm'
								? message || `Код отправлен на ${email}`
								: 'Теперь можно войти с новым паролем'}
					</p>

					{error && (
						<div className={styles.error}>
							<IconAlertCircle size={16} />
							{error}
						</div>
					)}

					{step === 'email' && (
						<>
							<div className={styles.emailFields}>
								<input
									type="email"
									placeholder="Email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && requestReset()}
									className={styles.emailInput}
									autoFocus
								/>
							</div>
							<button
								className={styles.btnSubmit}
								onClick={requestReset}
								disabled={loading || !email.trim()}
							>
								{loading ? <><IconLoader size={16} /> Отправляем...</> : 'Получить код'}
							</button>
						</>
					)}

					{step === 'confirm' && (
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
							<div className={styles.emailFields}>
								<div className={styles.passwordField}>
									<input
										type={showNewPassword ? 'text' : 'password'}
										placeholder="Новый пароль"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && confirmReset()}
										className={`${styles.emailInput} ${styles.passwordFieldInput}`}
									/>
									<button
										type="button"
										className={styles.passwordToggle}
										onClick={() => setShowNewPassword(prev => !prev)}
										aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
									>
										{showNewPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
									</button>
								</div>
							</div>
							<button
								className={styles.btnSubmit}
								onClick={() => confirmReset()}
								disabled={loading || code.join('').length !== 6 || newPassword.length < 8}
							>
								{loading ? <><IconLoader size={16} /> Сохраняем...</> : 'Изменить пароль'}
							</button>
							<button
								className={`${styles.btn} ${styles.btnEmail}`}
								onClick={() => {
									setStep('email')
									setCode(['', '', '', '', '', ''])
									setError(null)
								}}
								disabled={loading}
							>
								<IconArrowLeft size={16} /> Изменить email
							</button>
						</>
					)}

					{step === 'done' && (
						<button className={styles.btnSubmit} onClick={() => router.replace('/login/email')}>
							Войти
						</button>
					)}

					<button
						className={`${styles.btn} ${styles.btnEmail}`}
						onClick={() => router.push('/login/email')}
					>
						<IconArrowLeft size={16} />
						Назад ко входу
					</button>
				</div>
			</div>
		</div>
	)
}
