'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { ensureAccessToken } from '~/shared/api-client'
import {
	clearPendingRole,
	getPendingRole,
	getPendingRoleLabel,
	setPendingRole,
	type PendingRole,
} from '~/shared/pending-role'
import { setPendingReturnUrl } from '~/shared/pending-return-url'
import {
	IconTelegram,
	IconMail,
	IconAlertCircle,
	IconLoader,
	IconMask,
	IconBriefcase,
	IconClipboard,
	IconDiamond,
	IconArrowLeft,
} from '~packages/ui/icons'
import styles from './login.module.scss'

// Временно скрыта регистрация администратора и Админа PRO.
// Чтобы вернуть — поставить true (код блока сохранён ниже).
const SHOW_ADMIN_REGISTRATION = false

const ADMIN_LINK_VALUES = ['1', 'true', 'pro', 'solo', 'admin']
const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager', 'admin', 'admin_pro']
const ADMIN_REGISTRATION_PWA_KEY = 'pp_admin_registration_pwa'
const ADMIN_REGISTRATION_MANIFEST = '/admin-register-manifest.webmanifest'

const getRoleFromToken = (token: string): string => {
	try {
		const rawToken = token.includes(' ') ? token.split(' ').pop() : token
		return JSON.parse(atob(rawToken?.split('.')[1] || '')).role || 'user'
	} catch {
		return 'user'
	}
}

const getSessionTarget = (token: string, next?: string | null): string => {
	const role = getRoleFromToken(token)
	if (role === 'owner') return '/dashboard/admin'
	if (ADMIN_ROLES.includes(role)) return '/dashboard'
	return next || '/actor-home'
}

const preselectedAdminRole = (adminParam: string): PendingRole | null => {
	if (adminParam === 'pro') return 'admin_pro'
	if (adminParam === 'solo') return 'admin'
	return null
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

const enableAdminRegistrationPwaInstall = () => {
	if (typeof window === 'undefined') return

	try {
		window.localStorage.setItem(ADMIN_REGISTRATION_PWA_KEY, '1')
		document.cookie = `${ADMIN_REGISTRATION_PWA_KEY}=1; Max-Age=31536000; Path=/; SameSite=Lax`
	} catch {}

	const manifest =
		document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ||
		document.head.appendChild(document.createElement('link'))
	manifest.rel = 'manifest'
	manifest.href = ADMIN_REGISTRATION_MANIFEST

	const appleTitle =
		document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]') ||
		document.head.appendChild(document.createElement('meta'))
	appleTitle.name = 'apple-mobile-web-app-title'
	appleTitle.content = 'Админ.pro'
}

export default function LoginPageWrapper() {
	return (
		<Suspense fallback={<div className={styles.root} />}>
			<LoginPage />
		</Suspense>
	)
}

function LoginPage() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const adminParam = (searchParams.get('admin') || '').toLowerCase()
	const isSuperAdminSource = searchParams.get('source') === 'pwa-admin'
	const isAdminLink = ADMIN_LINK_VALUES.includes(adminParam)
	const preselected = preselectedAdminRole(adminParam)
	const [loading, setLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [selectedRole, setSelectedRole] = useState<PendingRole | null>(preselected)
	const [showAdminOptions, setShowAdminOptions] = useState(isAdminLink)
	const [checkingSession, setCheckingSession] = useState(true)
	// Отдельная ссылка для регистрации администраторов: /login?admin=1
	const [adminMode, setAdminMode] = useState(isAdminLink)

	const isTelegramWebApp =
		typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData

	useEffect(() => {
		let cancelled = false

		if (isSuperAdminSource) {
			router.replace('/admin-login?source=pwa-admin')
			return () => { cancelled = true }
		}

		const next = readNextParam()
		if (next) setPendingReturnUrl(next)

		if (isAdminLink) {
			setAdminMode(true)
			setShowAdminOptions(true)
			enableAdminRegistrationPwaInstall()
		}
		if (preselected) {
			setPendingRole(preselected)
		}

		// В админ-режиме нельзя подхватывать сохранённую роль из прошлой сессии.
		// /login?admin=1 должен ВСЕГДА показывать выбор "Админ / Админ PRO",
		// а /login?admin=pro|solo — предвыбирать конкретную админскую роль.
		const storedRole = getPendingRole()
		let pendingRole: PendingRole | null
		if (isAdminLink) {
			pendingRole = preselected
			if (!preselected || storedRole !== preselected) clearPendingRole()
		} else {
			pendingRole = preselected || storedRole
		}
		if (pendingRole) setSelectedRole(pendingRole)

		const restore = async () => {
			const token = await ensureAccessToken()
			if (cancelled) return
			if (token) {
				if (isAdminLink) {
					const role = getRoleFromToken(token)
					if (role === 'owner') {
						router.replace('/dashboard/admin')
						return
					}
					if (ADMIN_ROLES.includes(role)) {
						router.replace('/dashboard')
						return
					}
					setCheckingSession(false)
					return
				}
				router.replace(getSessionTarget(token, next))
				return
			}
			setCheckingSession(false)
		}

		restore()
		return () => { cancelled = true }
	}, [router, isAdminLink, isSuperAdminSource, preselected])

	const selectRole = useCallback((role: PendingRole) => {
		setPendingRole(role)
		setSelectedRole(role)
		setShowAdminOptions(false)
		setError(null)
	}, [])

	const resetRole = useCallback(() => {
		clearPendingRole()
		setSelectedRole(null)
		setShowAdminOptions(false)
		setError(null)
	}, [])

	const handleTelegramLogin = useCallback(async () => {
		setLoading('telegram')
		setError(null)

		if (isTelegramWebApp) {
			try {
				const initData = (window as any).Telegram.WebApp.initData
				const res = await fetch(`${API_URL}tma/auth/`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ init_str: `tma ${initData}` }),
				})
				const data = await res.json().catch(() => null)
				if (res.ok && typeof data === 'string' && data) {
					login({ access_token: data })
					router.replace('/login/role?auto=1')
					return
				}
			} catch {}
		}

		// Telegram OAuth — make sure we come back to the same `next` URL after callback
		try {
			const next = readNextParam()
			if (next) setPendingReturnUrl(next)
		} catch {}

		try {
			// Таймаут на сам запрос за ссылкой (Railway cold-start бывает долгим,
			// но «вечно» висеть не должен).
			const controller = new AbortController()
			const reqTimer = setTimeout(() => controller.abort(), 20000)
			const res = await fetch(`${API_URL}auth/oauth/telegram/url/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					redirect_uri: `${window.location.origin}/login/callback`,
				}),
				signal: controller.signal,
			})
			clearTimeout(reqTimer)
			const data = await res.json()
			if (data.url) {
				// На части сетей (часто Android в РФ без VPN) домен oauth.telegram.org
				// заблокирован — тогда переход на него «вешает» страницу навсегда.
				// Сначала быстро проверяем доступность: если за 3.5с не достучались,
				// не уходим в вечный спиннер, а показываем понятную подсказку.
				const reachable = await (async () => {
					try {
						const c = new AbortController()
						const t = setTimeout(() => c.abort(), 3500)
						await fetch('https://oauth.telegram.org/auth', {
							mode: 'no-cors',
							cache: 'no-store',
							signal: c.signal,
						})
						clearTimeout(t)
						return true
					} catch {
						return false
					}
				})()
				if (!reachable) {
					setError('Telegram сейчас недоступен в вашей сети. Включите VPN или войдите через Email.')
					setLoading(null)
					return
				}
				// Watchdog: даже если домен доступен, навигация может не случиться.
				// Если через несколько секунд мы всё ещё здесь — возвращаем кнопку
				// с подсказкой. При успешном переходе страница выгрузится раньше.
				window.setTimeout(() => {
					setError('Не удалось открыть Telegram. Включите VPN или войдите через Email.')
					setLoading(null)
				}, 8000)
				window.location.href = data.url
				return
			}
			setError(data.detail?.message || data.detail || 'Telegram-вход временно недоступен')
		} catch (e: any) {
			setError(
				e?.name === 'AbortError'
					? 'Сервер долго не отвечает. Попробуйте ещё раз или войдите через Email.'
					: 'Ошибка подключения к серверу',
			)
		}
		setLoading(null)
	}, [isTelegramWebApp, router])

	const handleEmailLogin = useCallback(() => {
		router.push('/login/email')
	}, [router])

	if (isSuperAdminSource || checkingSession) {
		return <div className={styles.root} />
	}

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<img src="/pwa/icon-192-v3.png" alt="prostoprobuy.pro" className={styles.logoImage} />
					<h1>
						prosto<span>probuy.pro</span>
					</h1>
					<p>Кастинг-платформа</p>
				</div>

				<div className={styles.card}>
					{selectedRole ? (
						<>
							<h2>Вход в систему</h2>
							<p className={styles.subtitle}>Роль: {getPendingRoleLabel(selectedRole)}</p>
							<div className={styles.selectedRoleBadge}>{getPendingRoleLabel(selectedRole)}</div>
						</>
					) : adminMode ? (
						<>
							<h2>Регистрация администратора</h2>
							<p className={styles.subtitle}>Выберите тип администратора для регистрации</p>
						</>
					) : (
						<>
							<h2>Выберите роль</h2>
							<p className={styles.subtitle}>Сначала выберите, как вы хотите использовать платформу</p>
						</>
					)}

					{error && (
						<div className={styles.error}>
							<IconAlertCircle size={16} />
							{error}
						</div>
					)}

					{selectedRole ? (
						<>
							<button
								className={`${styles.btn} ${styles.btnTelegram}`}
								onClick={handleTelegramLogin}
								disabled={!!loading}
							>
								{loading === 'telegram' ? (
									<IconLoader size={18} />
								) : (
									<IconTelegram size={18} />
								)}
								Telegram
							</button>

							<button
								className={`${styles.btn} ${styles.btnEmail}`}
								onClick={handleEmailLogin}
								disabled={!!loading}
							>
								<IconMail size={18} />
								Email
							</button>

							<button className={`${styles.btn} ${styles.btnEmail}`} onClick={resetRole} disabled={!!loading}>
								<IconArrowLeft size={16} />
								Выбрать другую роль
							</button>
						</>
					) : (
						<div className={styles.roleList}>
							{!adminMode && (
								<button className={styles.roleOption} onClick={() => selectRole('user')}>
									<span className={`${styles.roleIcon} ${styles.roleIconActor}`}><IconMask size={18} /></span>
									<span className={styles.roleText}>
										<strong>Актёр</strong>
										<small>Отклики на кастинги и создание профиля</small>
									</span>
								</button>
							)}
							{!adminMode && (
								<button className={styles.roleOption} onClick={() => selectRole('agent')}>
									<span className={`${styles.roleIcon} ${styles.roleIconAgent}`}><IconBriefcase size={18} /></span>
									<span className={styles.roleText}>
										<strong>Агент</strong>
										<small>Ведение актёров и работа с профилями</small>
									</span>
								</button>
							)}
							{(!SHOW_ADMIN_REGISTRATION && !adminMode) ? null : !showAdminOptions ? (
								<button className={`${styles.roleOption} ${styles.adminEntry}`} onClick={() => setShowAdminOptions(true)}>
									<span className={`${styles.roleIcon} ${styles.roleIconAdmin}`}><IconClipboard size={18} /></span>
									<span className={styles.roleText}>
										<strong>Регистрация как администратор</strong>
										<small>Для тех, кто публикует кастинги и работает с актёрами.</small>
									</span>
								</button>
							) : (
								<div className={styles.adminOptions}>
									<div className={styles.adminOptionsHeader}>
										<div>
											<strong>Выберите тип администратора</strong>
											<small>Обычный Админ или PRO с командой и базой актёров.</small>
										</div>
										<button type="button" onClick={() => setShowAdminOptions(false)}>
											<IconArrowLeft size={14} />
										</button>
									</div>
									<button className={styles.roleOption} onClick={() => selectRole('admin')}>
										<span className={`${styles.roleIcon} ${styles.roleIconAdmin}`}><IconClipboard size={18} /></span>
										<span className={styles.roleText}>
											<strong>Администратор кастинга</strong>
											<small>Соло-режим: вы публикуете кастинги и работаете с откликами самостоятельно. Без командной работы.</small>
										</span>
									</button>
									<button className={styles.roleOption} onClick={() => selectRole('admin_pro')}>
										<span className={`${styles.roleIcon} ${styles.roleIconPro}`}><IconDiamond size={18} /></span>
										<span className={styles.roleText}>
											<strong>Администратор PRO</strong>
											<small>Полная база актёров, расширенный поиск и команда: подключайте других админов к своим кастингам.</small>
										</span>
									</button>
								</div>
							)}
						</div>
					)}
				</div>

				<p className={styles.footer}>
					{selectedRole
						? 'Сначала выбрана роль, теперь выберите удобный способ входа'
						: isTelegramWebApp
						? 'Открыто в Telegram — рекомендуем войти через Telegram'
						: 'Войдите любым удобным способом'}
				</p>
			</div>
		</div>
	)
}
