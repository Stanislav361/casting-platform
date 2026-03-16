'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import {
	IconFilm,
	IconLogOut,
	IconPlus,
	IconFolder,
	IconLoader,
	IconSend,
	IconShield,
	IconZap,
	IconCheck,
	IconX,
	IconMessageSquare,
} from '~packages/ui/icons'
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
	const [ticketStatus, setTicketStatus] = useState<string | null>(null)

	const [formStep, setFormStep] = useState<'form' | 'chat'>('form')
	const [companyName, setCompanyName] = useState('')
	const [aboutText, setAboutText] = useState('')
	const [projectsText, setProjectsText] = useState('')
	const [experienceText, setExperienceText] = useState('')
	const [submitting, setSubmitting] = useState(false)

	const [ticketMessages, setTicketMessages] = useState<any[]>([])
	const [chatInput, setChatInput] = useState('')
	const [chatSending, setChatSending] = useState(false)
	const chatEndRef = useRef<HTMLDivElement>(null)

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
		try {
			return await apiCall(method, path, body)
		} catch (err) {
			console.error(`[API] ${method} ${path}`, err)
			return null
		}
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
				setTicketStatus(verif?.ticket_status || null)
				if (verif?.ticket_status === 'open' || verif?.ticket_status === 'approved') {
					setFormStep('chat')
					loadTicketMessages()
				}
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, api])

	const loadTicketMessages = async () => {
		const data = await api('GET', 'employer/projects/my-ticket/')
		if (data?.messages) {
			setTicketMessages(data.messages)
			if (data.ticket?.status === 'approved') {
				setIsVerified(true)
				setTicketStatus('approved')
			}
		}
	}

	useEffect(() => {
		if (formStep === 'chat' && ticketStatus === 'open') {
			const interval = setInterval(loadTicketMessages, 5000)
			return () => clearInterval(interval)
		}
	}, [formStep, ticketStatus])

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [ticketMessages])

	const submitVerificationRequest = async () => {
		setSubmitting(true)
		try {
			const params = new URLSearchParams({
				company_name: companyName,
				about_text: aboutText,
				projects_text: projectsText,
				experience_text: experienceText,
			})
			const res = await api('POST', `employer/projects/verification-request/?${params}`)
			if (res?.ticket_id) {
				setTicketStatus('open')
				setFormStep('chat')
				await loadTicketMessages()
			} else {
				const msg = typeof res?.detail === 'string' ? res.detail : (res?.detail?.message || 'Ошибка отправки заявки')
				alert(msg)
			}
		} catch (err) {
			console.error('[Verification] submit error:', err)
			alert('Ошибка подключения к серверу')
		}
		setSubmitting(false)
	}

	const sendTicketMessage = async () => {
		if (!chatInput.trim() || chatSending) return
		setChatSending(true)
		try {
			const res = await api('POST', `employer/projects/my-ticket/message/?message=${encodeURIComponent(chatInput)}`)
			if (res?.sent) {
				setChatInput('')
				await loadTicketMessages()
			} else {
				console.error('[Ticket msg]', res?.detail)
			}
		} catch (err) {
			console.error('[Ticket msg] error:', err)
		}
		setChatSending(false)
	}

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
			alert(typeof res.detail === 'string' ? res.detail : res.detail.event || res.detail.message || 'Ошибка')
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
		return (
			<div className={styles.root}>
				<p className={styles.loading}>
					<IconLoader size={18} /> Загрузка...
				</p>
			</div>
		)
	}

	const showVerificationBlock = isVerified === false && !isOwner

	return (
		<>
			<div className={styles.root}>
				<header className={styles.header}>
					<div className={styles.brand}>
						<div className={styles.brandIcon}><IconFilm size={18} /></div>
						<h1>prosto<span>probuy</span></h1>
					</div>
					<div className={styles.headerRight}>
						<span className={styles.badge}>
							{subscription?.plan_code === 'pro' ? 'PRO' : 'Админ'}
						</span>
						{isOwner && (
							<button onClick={() => router.push('/dashboard/admin')} className={styles.logoutBtn} style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
								SuperAdmin
							</button>
						)}
						<button onClick={handleLogout} className={styles.logoutBtn}>
							<IconLogOut size={14} /> Выход
						</button>
					</div>
				</header>

				<div className={styles.content}>
					<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}><IconFolder size={17} /></span>
							Мои проекты
						</h2>

						<div className={styles.createForm}>
							<input type="text" placeholder="Название кастинга" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={styles.input} />
							<input type="text" placeholder="Описание" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={styles.input} />
							<button onClick={createProject} disabled={creating || !newTitle.trim()} className={styles.btnPrimary}>
								{creating ? <><IconLoader size={15} /> Создание...</> : <><IconPlus size={15} /> Создать проект</>}
							</button>
						</div>

						{projects.length === 0 ? (
							<p className={styles.empty}>
								<span className={styles.emptyIcon}><IconFolder size={28} /></span>
								Нет проектов. Создайте первый!
							</p>
						) : (
							<div className={styles.projectList}>
								{projects.map((p: any) => (
									<div key={p.id} className={styles.projectCard} onClick={() => router.push(`/dashboard/project/${p.id}`)}>
										<div className={styles.projectInfo}>
											<h3>{p.title}</h3>
											<p>{p.description}</p>
										</div>
										<div className={styles.projectMeta}>
											<span className={`${styles.statusBadge} ${p.status === 'published' ? styles.statusPublished : ''}`}>{p.status}</span>
											<span>{p.response_count || 0} откликов</span>
											{p.status !== 'published' && (
												<button onClick={(event) => publishProjectFromList(event, p.id)} className={styles.btnPublishSmall} disabled={publishingProjectId === p.id}>
													{publishingProjectId === p.id ? <IconLoader size={11} /> : <IconZap size={11} />}
													{publishingProjectId === p.id ? 'Публикация...' : 'Опубликовать'}
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}><IconShield size={17} /></span>
							Подписка
						</h2>
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
						{formStep === 'form' && !ticketStatus ? (
							<>
								<div className={styles.verifyIconWrap}><IconShield size={32} /></div>
								<h2 className={styles.verifyTitle}>Заявка на верификацию</h2>
								<p className={styles.verifyText}>
									Заполните анкету, чтобы получить доступ к публикации кастингов
								</p>
								<div className={styles.verifyFormFields}>
									<input type="text" placeholder="Название компании / студии" value={companyName} onChange={e => setCompanyName(e.target.value)} className={styles.verifyInput} />
									<textarea placeholder="Расскажите о себе и чем занимаетесь" value={aboutText} onChange={e => setAboutText(e.target.value)} className={styles.verifyTextarea} rows={3} />
									<textarea placeholder="Какие проекты планируете размещать?" value={projectsText} onChange={e => setProjectsText(e.target.value)} className={styles.verifyTextarea} rows={3} />
									<textarea placeholder="Ваш опыт работы в индустрии" value={experienceText} onChange={e => setExperienceText(e.target.value)} className={styles.verifyTextarea} rows={3} />
								</div>
								<button className={styles.verifySubmitBtn} onClick={submitVerificationRequest} disabled={submitting || (!aboutText.trim() && !companyName.trim())}>
									{submitting ? <><IconLoader size={16} /> Отправка...</> : <><IconSend size={16} /> Отправить заявку</>}
								</button>
								{process.env.NODE_ENV === 'development' && (
									<button className={styles.verifySkipBtn} onClick={() => setIsVerified(true)}>
										Далее (dev-режим)
									</button>
								)}
							</>
						) : (
							<>
								<div className={styles.verifyIconWrap}>
									{ticketStatus === 'approved' ? <IconCheck size={32} /> : ticketStatus === 'rejected' ? <IconX size={32} /> : <IconMessageSquare size={32} />}
								</div>
								<h2 className={styles.verifyTitle}>
									{ticketStatus === 'approved' ? 'Верификация пройдена!' : ticketStatus === 'rejected' ? 'Заявка отклонена' : 'Чат с SuperAdmin'}
								</h2>
								{ticketStatus === 'approved' && (
									<p className={styles.verifyText}>Вы можете публиковать кастинги. Страница обновится автоматически.</p>
								)}

								<div className={styles.ticketChat}>
									<div className={styles.ticketMessages}>
										{ticketMessages.map((m: any) => (
											<div key={m.id} className={`${styles.ticketMsg} ${m.is_mine ? styles.ticketMsgMine : styles.ticketMsgOther}`}>
												<div className={styles.ticketMsgHeader}>
													<span className={styles.ticketMsgName}>{m.sender_name}</span>
													<span className={styles.ticketMsgTime}>{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}</span>
												</div>
												<p className={styles.ticketMsgText}>{m.message}</p>
											</div>
										))}
										<div ref={chatEndRef} />
									</div>
									{ticketStatus === 'open' && (
										<div className={styles.ticketInputArea}>
											<input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendTicketMessage()} placeholder="Напишите сообщение..." className={styles.ticketInput} disabled={chatSending} />
											<button onClick={sendTicketMessage} disabled={chatSending || !chatInput.trim()} className={styles.ticketSendBtn}>
												{chatSending ? <IconLoader size={14} /> : <IconSend size={14} />}
											</button>
										</div>
									)}
								</div>
								{ticketStatus === 'approved' && (
									<button className={styles.verifySubmitBtn} onClick={() => { setIsVerified(true); window.location.reload() }}>
										Продолжить →
									</button>
								)}
								{process.env.NODE_ENV === 'development' && (
									<button className={styles.verifySkipBtn} onClick={() => setIsVerified(true)}>
										Далее (dev-режим)
									</button>
								)}
							</>
						)}
					</div>
				</div>
			)}
		</>
	)
}
