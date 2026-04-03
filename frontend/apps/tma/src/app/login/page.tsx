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
import {
	IconTelegram,
	IconMail,
	IconFilm,
	IconAlertCircle,
	IconLoader,
	IconYandex,
	IconSmartphone,
	IconMask,
	IconBriefcase,
	IconClipboard,
	IconDiamond,
	IconArrowLeft,
} from '~packages/ui/icons'
import styles from './login.module.scss'

export default function LoginPage() {
	const router = useRouter()
	const [loading, setLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [selectedRole, setSelectedRole] = useState<PendingRole | null>(null)

	const isTelegramWebApp =
		typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp?.initData

	useEffect(() => {
		const pendingRole = getPendingRole()
		if (pendingRole) setSelectedRole(pendingRole)

		const token = $session.getState().access_token
		if (token) {
			router.replace(pendingRole ? '/login/role?auto=1' : '/login/role')
		}
	}, [router])

	const selectRole = useCallback((role: PendingRole) => {
		setPendingRole(role)
		setSelectedRole(role)
		setError(null)
	}, [])

	const resetRole = useCallback(() => {
		clearPendingRole()
		setSelectedRole(null)
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
					body: JSON.stringify({ init_str: `tma ${initData}` }),
				})
				const data = await res.json()
				if (data) {
					login({ access_token: data })
					router.replace('/login/role?auto=1')
					return
				}
			} catch {}
		}

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
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(null)
	}, [isTelegramWebApp, router])

	const handleYandexLogin = useCallback(async () => {
		setLoading('yandex')
		setError(null)
		try {
			const res = await fetch(`${API_URL}auth/oauth/yandex/url/`, {
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
		} catch {
			setError('Ошибка подключения к серверу')
		}
		setLoading(null)
	}, [])

	const handleEmailLogin = useCallback(() => {
		router.push('/login/email')
	}, [router])

	const handlePhoneLogin = useCallback(() => {
		router.push('/login/phone')
	}, [router])

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<div className={styles.logoIcon}>
						<IconFilm size={28} />
					</div>
					<h1>
						prosto<span>probuy</span>
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
								className={`${styles.btn} ${styles.btnYandex}`}
								onClick={handleYandexLogin}
								disabled={!!loading}
							>
								{loading === 'yandex' ? (
									<IconLoader size={18} />
								) : (
									<IconYandex size={18} />
								)}
								Яндекс
							</button>

							<button
								className={`${styles.btn} ${styles.btnEmail}`}
								onClick={handleEmailLogin}
								disabled={!!loading}
							>
								<IconMail size={18} />
								Email
							</button>

							<button
								className={`${styles.btn} ${styles.btnPhone}`}
								onClick={handlePhoneLogin}
								disabled={!!loading}
							>
								<IconSmartphone size={18} />
								Телефон
							</button>

							<button className={`${styles.btn} ${styles.btnEmail}`} onClick={resetRole} disabled={!!loading}>
								<IconArrowLeft size={16} />
								Выбрать другую роль
							</button>
						</>
					) : (
						<div className={styles.roleList}>
							<button className={styles.roleOption} onClick={() => selectRole('user')}>
								<span className={`${styles.roleIcon} ${styles.roleIconActor}`}><IconMask size={18} /></span>
								<span className={styles.roleText}>
									<strong>Актёр</strong>
									<small>Отклики на кастинги и создание анкеты</small>
								</span>
							</button>
							<button className={styles.roleOption} onClick={() => selectRole('agent')}>
								<span className={`${styles.roleIcon} ${styles.roleIconAgent}`}><IconBriefcase size={18} /></span>
								<span className={styles.roleText}>
									<strong>Агент</strong>
									<small>Ведение актёров и работа с профилями</small>
								</span>
							</button>
							<button className={styles.roleOption} onClick={() => selectRole('admin')}>
								<span className={`${styles.roleIcon} ${styles.roleIconAdmin}`}><IconClipboard size={18} /></span>
								<span className={styles.roleText}>
									<strong>Администратор кастинга</strong>
									<small>Публикация кастингов и работа с откликами</small>
								</span>
							</button>
							<button className={styles.roleOption} onClick={() => selectRole('admin_pro')}>
								<span className={`${styles.roleIcon} ${styles.roleIconPro}`}><IconDiamond size={18} /></span>
								<span className={styles.roleText}>
									<strong>Администратор PRO</strong>
									<small>Полная база актёров и расширенный поиск</small>
								</span>
							</button>
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
