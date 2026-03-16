'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState, useRef, useEffect } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import {
	IconSmartphone,
	IconArrowLeft,
	IconLoader,
	IconAlertCircle,
	IconCheck,
} from '~packages/ui/icons'
import styles from '../login.module.scss'

export default function PhoneLoginPage() {
	const router = useRouter()
	const [step, setStep] = useState<'phone' | 'code'>('phone')
	const [phone, setPhone] = useState('')
	const [code, setCode] = useState(['', '', '', '', '', ''])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [countdown, setCountdown] = useState(0)
	const [devCode, setDevCode] = useState<string | null>(null)
	const inputRefs = useRef<(HTMLInputElement | null)[]>([])

	useEffect(() => {
		if (countdown <= 0) return
		const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
		return () => clearTimeout(t)
	}, [countdown])

	const normalizePhone = (raw: string) => {
		const digits = raw.replace(/\D/g, '')
		if (digits.startsWith('8') && digits.length === 11) {
			return '+7' + digits.slice(1)
		}
		if (digits.startsWith('7') && digits.length === 11) {
			return '+' + digits
		}
		if (!raw.startsWith('+')) return '+' + digits
		return '+' + digits
	}

	const handleSendCode = useCallback(async () => {
		if (!phone.trim()) return
		setLoading(true)
		setError(null)
		setDevCode(null)

		try {
			const normalized = normalizePhone(phone.trim())
			const res = await fetch(`${API_URL}auth/v2/otp/phone/send/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ phone: normalized }),
			})
			const data = await res.json()

			if (!res.ok) {
				setError(data.detail?.message || data.detail || 'Ошибка отправки кода')
				setLoading(false)
				return
			}

			if (data.code) setDevCode(data.code)
			setStep('code')
			setCountdown(60)
			setTimeout(() => inputRefs.current[0]?.focus(), 100)
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(false)
	}, [phone])

	const handleVerifyCode = useCallback(
		async (fullCode: string) => {
			setLoading(true)
			setError(null)

			try {
				const normalized = normalizePhone(phone.trim())
				const res = await fetch(`${API_URL}auth/v2/otp/phone/verify/`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ phone: normalized, code: fullCode }),
				})
				const data = await res.json()

				if (data.access_token) {
					login({ access_token: data.access_token })
					router.replace('/login/role')
					return
				}

				setError(data.detail?.message || data.detail || 'Неверный код')
			} catch {
				setError('Ошибка подключения к серверу')
			}
			setLoading(false)
		},
		[phone, router],
	)

	const handleCodeInput = useCallback(
		(index: number, value: string) => {
			if (!/^\d*$/.test(value)) return

			const newCode = [...code]
			newCode[index] = value.slice(-1)
			setCode(newCode)

			if (value && index < 5) {
				inputRefs.current[index + 1]?.focus()
			}

			const fullCode = newCode.join('')
			if (fullCode.length === 6) {
				handleVerifyCode(fullCode)
			}
		},
		[code, handleVerifyCode],
	)

	const handleCodeKeyDown = useCallback(
		(index: number, e: React.KeyboardEvent) => {
			if (e.key === 'Backspace' && !code[index] && index > 0) {
				inputRefs.current[index - 1]?.focus()
			}
		},
		[code],
	)

	const handleCodePaste = useCallback(
		(e: React.ClipboardEvent) => {
			e.preventDefault()
			const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
			if (!pasted) return
			const newCode = [...code]
			for (let i = 0; i < pasted.length; i++) {
				newCode[i] = pasted[i]
			}
			setCode(newCode)
			const nextIdx = Math.min(pasted.length, 5)
			inputRefs.current[nextIdx]?.focus()

			if (pasted.length === 6) {
				handleVerifyCode(pasted)
			}
		},
		[code, handleVerifyCode],
	)

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<div className={styles.logoIcon}>
						<IconSmartphone size={28} />
					</div>
					<h1>
						prosto<span>probuy</span>
					</h1>
				</div>

				<div className={styles.card}>
					{step === 'phone' ? (
						<>
							<h2>Вход по телефону</h2>
							<p className={styles.subtitle}>
								Введите номер — мы отправим SMS с кодом
							</p>

							{error && (
								<div className={styles.error}>
									<IconAlertCircle size={16} />
									{error}
								</div>
							)}

							<div className={styles.emailFields}>
								<input
									type="tel"
									placeholder="+7 (900) 123-45-67"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
									className={styles.emailInput}
									autoFocus
								/>
							</div>

							<button
								className={styles.btnSubmit}
								onClick={handleSendCode}
								disabled={loading || !phone.trim()}
							>
								{loading ? (
									<>
										<IconLoader size={16} /> Отправка...
									</>
								) : (
									'Получить код'
								)}
							</button>
						</>
					) : (
						<>
							<h2>Введите код</h2>
							<p className={styles.subtitle}>
								Код отправлен на {normalizePhone(phone.trim())}
							</p>

							{error && (
								<div className={styles.error}>
									<IconAlertCircle size={16} />
									{error}
								</div>
							)}

							{devCode && (
								<div className={styles.devHint}>
									<IconCheck size={14} />
									DEV-код: <strong>{devCode}</strong>
								</div>
							)}

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
										onKeyDown={(e) => handleCodeKeyDown(i, e)}
										className={styles.otpCell}
										autoFocus={i === 0}
									/>
								))}
							</div>

							{loading && (
								<p className={styles.subtitle}>
									<IconLoader size={16} /> Проверяем...
								</p>
							)}

							<button
								className={`${styles.btn} ${styles.btnEmail}`}
								onClick={() => {
									setStep('phone')
									setCode(['', '', '', '', '', ''])
									setError(null)
									setDevCode(null)
								}}
								disabled={loading}
								style={{ marginTop: 12 }}
							>
								Изменить номер
							</button>

							{countdown > 0 ? (
								<p className={styles.subtitle} style={{ marginTop: 8 }}>
									Повторная отправка через {countdown}с
								</p>
							) : (
								<button
									className={`${styles.btn} ${styles.btnEmail}`}
									onClick={handleSendCode}
									disabled={loading}
									style={{ marginTop: 4 }}
								>
									Отправить код повторно
								</button>
							)}
						</>
					)}

					<button
						className={`${styles.btn} ${styles.btnEmail}`}
						onClick={() => router.push('/login')}
						style={{ marginTop: 8 }}
					>
						<IconArrowLeft size={16} />
						Назад
					</button>
				</div>
			</div>
		</div>
	)
}
