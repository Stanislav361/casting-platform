'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, type MouseEvent } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
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
	const [publishingProjectId, setPublishingProjectId] = useState<number | null>(null)
	const [isVerified, setIsVerified] = useState<boolean | null>(null)
	const [isOwner, setIsOwner] = useState(false)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
		try {
			const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
			if (payload.role === 'owner') setIsOwner(true)
		} catch {}
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		return apiCall(method, path, body)
	}, [])

	useEffect(() => {
		if (!token) return
		const load = async () => {
			try {
				const [sub, proj, verif] = await Promise.all([
					api('GET', 'subscriptions/my/'),
					api('GET', 'employer/projects/').catch(() => ({ projects: [] })),
					api('GET', 'employer/projects/verification-status/').catch(() => ({ is_verified: true })),
				])
				setSubscription(sub)
				setProjects(proj?.projects || [])
				setIsVerified(verif?.is_verified ?? false)
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, api])

	const createProject = async () => {
		if (!newTitle.trim()) return
		setCreating(true)
		const res = await api('POST', 'employer/projects/', {
			title: newTitle, description: newDesc || '',
		})
		if (res?.id) {
			setProjects(prev => [res, ...prev])
			setNewTitle('')
			setNewDesc('')
		} else if (res?.detail === 'employer_not_verified') {
			setIsVerified(false)
		} else if (res?.detail) {
			alert(typeof res.detail === 'string' ? res.detail : res.detail.event || res.detail.message || 'Ошибка. Попробуйте перелогиниться.')
		}
		setCreating(false)
	}

	const handleLogout = () => {
		logout()
		router.replace('/login')
	}

	const publishProjectFromList = async (event: MouseEvent, projectId: number) => {
		event.stopPropagation()
		setPublishingProjectId(projectId)
		const res = await api('POST', `employer/projects/${projectId}/publish/`)
		if (res?.id) {
			setProjects(prev => prev.map(project => (
				project.id === projectId ? { ...project, status: res.status } : project
			)))
		} else if (res?.detail === 'employer_not_verified') {
			setIsVerified(false)
		} else {
			alert(res?.detail || 'Не удалось опубликовать проект')
		}
		setPublishingProjectId(null)
	}

	if (loading) {
		return <div className={styles.root}><p className={styles.loading}>Загрузка...</p></div>
	}

	const showVerificationBlock = isVerified === false && !isOwner

	return (
		<>
			<div className={styles.root}>
				<header className={styles.header}>
					<h1>prosto<span>probuy</span></h1>
					<div className={styles.headerRight}>
						<span className={styles.badge}>
							{subscription?.plan_code === 'pro' ? '⭐ PRO' : '📋 Админ'}
						</span>
						{isOwner && (
							<button onClick={() => router.push('/dashboard/admin')} className={styles.logoutBtn} style={{borderColor:'#ef4444',color:'#ef4444'}}>{'👑'} SuperAdmin</button>
						)}
						<button onClick={handleLogout} className={styles.logoutBtn}>Выход</button>
					</div>
				</header>

				<div className={styles.content}>
					<section className={styles.section}>
						<h2>Мои проекты</h2>

						<div className={styles.createForm}>
							<input type="text" placeholder="Название кастинга" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={styles.input} />
							<input type="text" placeholder="Описание" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={styles.input} />
							<button onClick={createProject} disabled={creating || !newTitle.trim()} className={styles.btnPrimary}>
								{creating ? '...' : '+ Создать проект'}
							</button>
						</div>

						{projects.length === 0 ? (
							<p className={styles.empty}>Нет проектов. Создайте первый!</p>
						) : (
							<div className={styles.projectList}>
								{projects.map((p: any) => (
									<div key={p.id} className={styles.projectCard} onClick={() => router.push(`/dashboard/project/${p.id}`)} style={{ cursor: 'pointer' }}>
										<div className={styles.projectInfo}>
											<h3>{p.title}</h3>
											<p>{p.description}</p>
										</div>
										<div className={styles.projectMeta}>
											<span className={styles.statusBadge}>{p.status}</span>
											<span>{p.response_count || 0} откликов</span>
											{p.status !== 'published' && (
												<button onClick={(event) => publishProjectFromList(event, p.id)} className={styles.btnPublishSmall} disabled={publishingProjectId === p.id}>
													{publishingProjectId === p.id ? '...' : '🚀 Опубликовать'}
												</button>
											)}
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

			{showVerificationBlock && (
				<div className={styles.verifyOverlay}>
					<div className={styles.verifyCard}>
						<div className={styles.verifyIcon}>🔒</div>
						<h2 className={styles.verifyTitle}>Требуется верификация</h2>
						<p className={styles.verifyText}>
							Перед тем как размещать объявления о кастингах, вам необходимо пройти короткое собеседование.
						</p>
						<div className={styles.verifyAction}>
							<p className={styles.verifyInstruction}>
								Напишите <strong>SuperAdmin</strong> и расскажите о себе:
							</p>
							<ul className={styles.verifyList}>
								<li>Кто вы и чем занимаетесь</li>
								<li>Какие проекты планируете размещать</li>
								<li>Ваш опыт работы в индустрии</li>
							</ul>
						</div>
						<div className={styles.verifyContact}>
							<span>📩</span>
							<span>Свяжитесь через внутренний чат (кнопка 💬 справа внизу)</span>
						</div>
						<p className={styles.verifyNote}>
							После проверки SuperAdmin одобрит ваш аккаунт и вы сможете публиковать кастинги
						</p>
						{process.env.NODE_ENV === 'development' && (
							<button className={styles.verifySkipBtn} onClick={() => setIsVerified(true)}>
								Далее (dev-режим)
							</button>
						)}
					</div>
				</div>
			)}
		</>
	)
}
