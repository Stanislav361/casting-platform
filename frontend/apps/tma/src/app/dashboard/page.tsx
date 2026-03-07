'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from './dashboard.module.scss'
import LiveChat from './components/live-chat'

export default function DashboardPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [projects, setProjects] = useState<any[]>([])
	const [subscription, setSubscription] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [newTitle, setNewTitle] = useState('')
	const [newDesc, setNewDesc] = useState('')
	const [creating, setCreating] = useState(false)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		if (!token) return null
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: body ? JSON.stringify(body) : undefined,
		})
		return res.json()
	}, [token])

	useEffect(() => {
		if (!token) return
		const load = async () => {
			try {
				const [sub, proj] = await Promise.all([
					api('GET', 'subscriptions/my/'),
					api('GET', 'employer/projects/').catch(() => ({ projects: [] })),
				])
				setSubscription(sub)
				setProjects(proj?.projects || [])
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, api])

	const createProject = async () => {
		if (!newTitle.trim()) return
		setCreating(true)
		const res = await api('POST', 'employer/projects/', {
			title: newTitle, description: newDesc || 'Описание проекта',
		})
		if (res?.id) {
			setProjects(prev => [res, ...prev])
			setNewTitle('')
			setNewDesc('')
		}
		setCreating(false)
	}

	const handleLogout = () => {
		logout()
		router.replace('/login')
	}

	if (loading) {
		return <div className={styles.root}><p className={styles.loading}>Загрузка...</p></div>
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<h1>prosto<span>probuy</span></h1>
				<div className={styles.headerRight}>
					<span className={styles.badge}>
						{subscription?.plan_code === 'pro' ? '⭐ PRO' : '📋 Админ'}
					</span>
					{(() => {
						try {
							const payload = JSON.parse(atob(token?.split('.')[1] || ''))
							if (payload.role === 'owner') return (
								<button onClick={() => router.push('/dashboard/admin')} className={styles.logoutBtn} style={{borderColor:'#ef4444',color:'#ef4444'}}>{'👑'} SuperAdmin</button>
							)
						} catch {}
						return null
					})()}
					<button onClick={handleLogout} className={styles.logoutBtn}>Выход</button>
				</div>
			</header>

			<div className={styles.content}>
				<section className={styles.section}>
					<h2>Мои проекты</h2>

					<div className={styles.createForm}>
						<input
							type="text"
							placeholder="Название кастинга"
							value={newTitle}
							onChange={(e) => setNewTitle(e.target.value)}
							className={styles.input}
						/>
						<input
							type="text"
							placeholder="Описание"
							value={newDesc}
							onChange={(e) => setNewDesc(e.target.value)}
							className={styles.input}
						/>
						<button
							onClick={createProject}
							disabled={creating || !newTitle.trim()}
							className={styles.btnPrimary}
						>
							{creating ? '...' : '+ Создать проект'}
						</button>
					</div>

					{projects.length === 0 ? (
						<p className={styles.empty}>Нет проектов. Создайте первый!</p>
					) : (
						<div className={styles.projectList}>
							{projects.map((p: any) => (
								<div
									key={p.id}
									className={styles.projectCard}
									onClick={() => router.push(`/dashboard/project/${p.id}`)}
									style={{ cursor: 'pointer' }}
								>
									<div className={styles.projectInfo}>
										<h3>{p.title}</h3>
										<p>{p.description}</p>
									</div>
									<div className={styles.projectMeta}>
										<span className={styles.statusBadge}>{p.status}</span>
										<span>{p.response_count || 0} откликов</span>
										<span style={{ color: '#f5c518', fontSize: 11 }}>Открыть →</span>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				<section className={styles.section}>
					<h2>Подписка</h2>
					{subscription?.plan_code ? (
						<div className={styles.subCard}>
							<p><strong>План:</strong> {subscription.plan_name || subscription.plan_code}</p>
							<p><strong>Статус:</strong> {subscription.status}</p>
							<p><strong>Действует до:</strong> {subscription.expires_at?.split('.')[0]}</p>
						</div>
					) : (
						<p className={styles.empty}>Нет активной подписки</p>
					)}
				</section>
			</div>

			<LiveChat />
		</div>
	)
}
