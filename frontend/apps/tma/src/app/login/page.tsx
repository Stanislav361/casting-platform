'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { $session, login } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
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

export default function LoginPage() {
	const router = useRouter()
	const [loading, setLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [selectedRole, setSelectedRole] = useState<PendingRole | null>(null)
	const [showAdminOptions, setShowAdminOptions] = useState(false)
	// Отдельная ссылка для регистрации администраторов: /login?admin=1
	const [adminMode, setAdminMode] = useState(false)

	const isTelegramWebApp =
		typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData

	useEffect(() => {
		const next = readNextParam()
		if (next) setPendingReturnUrl(next)

		// Отдельные ссылки для регистрации администраторов:
		//   /login?admin=1     — показать оба типа (Админ и Админ PRO)
		//   /login?admin=pro   — сразу Администратор PRO
		//   /login?admin=solo  — сразу Администратор кастинга
		let adminParam = ''
		try {
			adminParam = (new URL(window.location.href).searchParams.get('admin') || '').toLowerCase()
		} catch {}
		const isAdminLink = ['1', 'true', 'pro', 'solo', 'admin'].includes(adminParam)
		const preselected: PendingRole | null =
			adminParam === 'pro' ? 'admin_pro' : adminParam === 'solo' ? 'admin' : null

		if (isAdminLink) {
			setAdminMode(true)
			setShowAdminOptions(true)
		}
		if (preselected) {
			setPendingRole(preselected)
		}

		const pendingRole = preselected || getPendingRole()
		if (pendingRole) setSelectedRole(pendingRole)

		const token = $session.getState().access_token
		if (token) {
			router.replace(
				pendingRole
					? `/login/role?auto=1${isAdminLink ? '&admin=1' : ''}`
					: `/login/role${isAdminLink ? '?admin=1' : ''}`,
			)
		}
	}, [router])

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
			const res = await fetch(`${API_URL}auth/oauth/telegram/url/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					redirect_uri: `${window.location.origin}/login/callback`,
				}),
			})
			const data = await res.json()
			if (data.url) {
				window.location.href = data.url
				return
			}
			setError(data.detail?.message || data.detail || 'Telegram-вход временно недоступен')
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(null)
	}, [isTelegramWebApp, router])

	const handleEmailLogin = useCallback(() => {
		router.push('/login/email')
	}, [router])

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
