'use client'

/**
 * Плашка «Придумайте пароль» для аккаунтов без пароля.
 *
 * Людям из перенесённой базы пароль никогда не выдавали: они входят по коду
 * из письма или через Telegram. Сразу после входа предлагаем задать пароль,
 * чтобы в следующий раз можно было войти обычным способом — через Telegram
 * или email с паролем, не запрашивая код каждый раз.
 *
 * Экраны входа и публичные страницы исключены: там пользователь либо ещё не
 * авторизован, либо документ открыт по ссылке без аккаунта.
 */
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { apiCall, getToken } from '~/shared/api-client'
import { $session } from '@prostoprobuy/models'
import { IconEye, IconEyeOff, IconLoader, IconLock } from '~packages/ui/icons'
import styles from './set-password-prompt.module.scss'

const EXCLUDED_PREFIXES = ['/legal', '/login', '/admin-login', '/report']
const SKIP_STORAGE_KEY = 'pp_set_password_skipped'
const MIN_LENGTH = 8

export default function SetPasswordPrompt() {
	const pathname = usePathname()
	const [needsPassword, setNeedsPassword] = useState(false)
	const [password, setPassword] = useState('')
	const [repeat, setRepeat] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [skipped, setSkipped] = useState(false)

	const isExcludedRoute = Boolean(pathname && EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p)))

	const checkStatus = useCallback(async () => {
		if (!getToken()) {
			setNeedsPassword(false)
			return
		}
		const data = await apiCall('GET', 'auth/v2/me/')
		if (data && !data.detail && typeof data === 'object') {
			// Плашка нужна только тем, у кого пароля ещё нет и есть куда его
			// привязать — то есть указан email для входа с паролем.
			setNeedsPassword(data.has_password === false && Boolean(data.email))
		}
	}, [])

	useEffect(() => {
		try {
			setSkipped(sessionStorage.getItem(SKIP_STORAGE_KEY) === '1')
		} catch {}
	}, [])

	useEffect(() => {
		if (isExcludedRoute) return
		checkStatus()
		const unsubscribe = $session.watch(() => checkStatus())
		return unsubscribe
	}, [isExcludedRoute, checkStatus])

	const handleSave = useCallback(async () => {
		if (saving) return
		if (password.length < MIN_LENGTH) {
			setError(`Пароль должен быть не короче ${MIN_LENGTH} символов`)
			return
		}
		if (password !== repeat) {
			setError('Пароли не совпадают')
			return
		}

		setSaving(true)
		setError(null)
		const res = await apiCall('POST', 'auth/v2/set-password/', { new_password: password })
		setSaving(false)

		if (res?.message) {
			setNeedsPassword(false)
			setPassword('')
			setRepeat('')
			return
		}

		const detail = res?.detail
		setError(
			(typeof detail === 'string' && detail) ||
			detail?.message ||
			'Не удалось сохранить пароль. Попробуйте ещё раз.',
		)
	}, [saving, password, repeat])

	const handleLater = useCallback(() => {
		try {
			sessionStorage.setItem(SKIP_STORAGE_KEY, '1')
		} catch {}
		setSkipped(true)
	}, [])

	if (isExcludedRoute || skipped || !needsPassword) return null

	return (
		<div className={styles.overlay} role="dialog" aria-modal="true">
			<div className={styles.card}>
				<div className={styles.iconWrap}>
					<IconLock size={24} />
				</div>
				<h2 className={styles.title}>Придумайте пароль</h2>
				<p className={styles.subtitle}>
					Ваша анкета уже на платформе. Задайте пароль — и в следующий раз
					сможете входить через Telegram или по email с паролем, без кода из письма.
				</p>

				{error && <div className={styles.error}>{error}</div>}

				<div className={styles.fields}>
					<div className={styles.passwordField}>
						<input
							className={styles.input}
							type={showPassword ? 'text' : 'password'}
							placeholder="Новый пароль"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete="new-password"
						/>
						<button
							type="button"
							className={styles.toggle}
							onClick={() => setShowPassword((prev) => !prev)}
							aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
						>
							{showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
						</button>
					</div>
					<div className={styles.passwordField}>
						<input
							className={styles.input}
							type={showPassword ? 'text' : 'password'}
							placeholder="Повторите пароль"
							value={repeat}
							onChange={(e) => setRepeat(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSave()}
							autoComplete="new-password"
						/>
					</div>
				</div>

				<p className={styles.hint}>Минимум {MIN_LENGTH} символов.</p>

				<button
					type="button"
					className={styles.saveBtn}
					onClick={handleSave}
					disabled={saving || !password || !repeat}
				>
					{saving ? <IconLoader size={18} /> : 'Сохранить пароль'}
				</button>
				<button type="button" className={styles.laterBtn} onClick={handleLater}>
					Позже
				</button>
			</div>
		</div>
	)
}
