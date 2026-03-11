'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { $session, login as doLogin } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from './role.module.scss'

export default function RoleSelectPage() {
	const router = useRouter()
	const [loading, setLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const session = $session.getState()
	const token = session?.access_token

	let currentRole = 'user'
	try {
		if (token) {
			currentRole = JSON.parse(atob(token.split('.')[1])).role || 'user'
		}
	} catch {}

	const selectRole = async (plan: string | null, redirectTo: string) => {
		setLoading(plan || 'actor')
		setError(null)

		if (!token) {
			router.replace('/login')
			return
		}

		try {
			if (plan) {
				const res = await fetch(
					`${API_URL}subscriptions/activate/?plan=${plan}&days=30`,
					{
						method: 'POST',
						headers: { Authorization: `Bearer ${token}` },
					}
				)
				const data = await res.json()

				if (data.access_token) {
					doLogin({ access_token: data.access_token })
					router.replace(redirectTo)
					return
				} else {
					const msg = typeof data.detail === 'string' ? data.detail : data.detail?.message || data.detail?.event || JSON.stringify(data.detail) || 'Ошибка активации подписки'
					setError(msg)
					setLoading(null)
					return
				}
			}

			router.replace(redirectTo)
		} catch (e) {
			setError('Ошибка подключения к серверу')
			setLoading(null)
		}
	}

	const selectBaseRole = async (role: 'user' | 'agent', redirectTo: string) => {
		setLoading(role)
		setError(null)

		if (!token) {
			router.replace('/login')
			return
		}

		try {
			const res = await fetch(
				`${API_URL}subscriptions/switch-role/?role=${role}`,
				{
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
				}
			)
			const data = await res.json()
			if (data.access_token) {
				doLogin({ access_token: data.access_token })
				router.replace(redirectTo)
				return
			}
			const msg = typeof data.detail === 'string' ? data.detail : data.detail?.message || data.detail?.event || JSON.stringify(data.detail) || 'Ошибка переключения роли'
			setError(msg)
			setLoading(null)
		} catch (e) {
			setError('Ошибка подключения к серверу')
			setLoading(null)
		}
	}

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<h1>prosto<span>probuy</span></h1>
				</div>

				<div className={styles.card}>
					<h2>Выберите роль</h2>
					<p className={styles.subtitle}>Как вы хотите использовать платформу?</p>

					{error && <div className={styles.error}>{typeof error === 'string' ? error : JSON.stringify(error)}</div>}

					{currentRole === 'owner' && (
						<button
							className={`${styles.roleCard} ${styles.superadmin}`}
							onClick={() => selectRole(null, '/dashboard/admin')}
							disabled={!!loading}
						>
							<div className={styles.roleIcon}>👑</div>
							<div className={styles.roleInfo}>
								<h3>SuperAdmin</h3>
								<p>Полный доступ к платформе, управление всеми пользователями</p>
							</div>
							<div className={styles.roleBadgeSA}>Owner</div>
						</button>
					)}

					<button
						className={`${styles.roleCard} ${styles.actor}`}
						onClick={() => selectBaseRole('user', '/cabinet')}
						disabled={!!loading}
					>
						<div className={styles.roleIcon}>🎭</div>
						<div className={styles.roleInfo}>
							<h3>Актёр</h3>
							<p>Создайте анкету, откликайтесь на кастинги</p>
						</div>
						<div className={styles.roleBadge}>Бесплатно</div>
					</button>

					<button
						className={`${styles.roleCard} ${styles.agent}`}
						onClick={() => selectBaseRole('agent', '/cabinet')}
						disabled={!!loading}
					>
						<div className={styles.roleIcon}>🧑‍💼</div>
						<div className={styles.roleInfo}>
							<h3>Агент</h3>
							<p>Создайте профиль агента и регистрируйте своих актёров</p>
						</div>
						<div className={styles.roleBadge}>Бесплатно</div>
					</button>

					<button
						className={`${styles.roleCard} ${styles.admin}`}
						onClick={() => selectRole('admin', '/dashboard')}
						disabled={!!loading}
					>
						<div className={styles.roleIcon}>📋</div>
						<div className={styles.roleInfo}>
							<h3>Админ</h3>
							<p>Публикуйте кастинги, работайте с откликнувшимися актёрами</p>
						</div>
						<div className={styles.roleBadge}>Подписка</div>
					</button>

					<button
						className={`${styles.roleCard} ${styles.adminPro}`}
						onClick={() => selectRole('admin_pro', '/dashboard')}
						disabled={!!loading}
					>
						<div className={styles.roleIcon}>⭐</div>
						<div className={styles.roleInfo}>
							<h3>Админ PRO</h3>
							<p>Все актёры в базе, шорт-листы из любых, полный поиск</p>
						</div>
						<div className={styles.roleBadge}>PRO</div>
					</button>
				</div>

				{loading && (
					<p className={styles.loadingText}>
						{loading === 'admin' || loading === 'admin_pro' ? 'Активация подписки...' : 'Переход в кабинет...'}
					</p>
				)}
			</div>
		</div>
	)
}
