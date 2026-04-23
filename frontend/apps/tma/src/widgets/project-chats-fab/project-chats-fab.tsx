'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconChat,
	IconX,
	IconArrowLeft,
	IconLoader,
	IconSend,
	IconFilm,
} from '~packages/ui/icons'
import styles from './project-chats-fab.module.scss'

interface Project {
	id: number
	title: string
	image_url?: string | null
}

interface ChatMessage {
	id: number
	user_id: number
	user_name?: string
	user_role?: string
	message: string
	action?: string
	created_at: string
}

interface ProjectChatsFabProps {
	castingId?: number // если задан — сразу открывает чат конкретного проекта
}

const roleBadge = (role?: string): string => {
	if (role === 'owner') return '👑 SuperAdmin'
	if (role === 'employer_pro') return '⭐ Админ PRO'
	if (['employer', 'administrator', 'manager'].includes(role || '')) return '📋 Админ'
	return ''
}

export default function ProjectChatsFab({ castingId }: ProjectChatsFabProps = {}) {
	const [open, setOpen] = useState(false)
	const [view, setView] = useState<'list' | 'chat'>(castingId ? 'chat' : 'list')
	const [projects, setProjects] = useState<Project[]>([])
	const [loadingList, setLoadingList] = useState(false)
	const [activeId, setActiveId] = useState<number | null>(castingId ?? null)
	const [activeTitle, setActiveTitle] = useState<string>('')

	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [loadingChat, setLoadingChat] = useState(false)
	const [input, setInput] = useState('')
	const [sending, setSending] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const pollRef = useRef<number | null>(null)

	const loadProjects = useCallback(async () => {
		setLoadingList(true)
		try {
			const data = await apiCall('GET', 'employer/projects/?page=1&page_size=50')
			const list = (data?.projects || data?.items || []) as Project[]
			setProjects(list)
		} catch {
			setProjects([])
		}
		setLoadingList(false)
	}, [])

	const loadMessages = useCallback(async (cid: number) => {
		try {
			const data = await apiCall('GET', `collaboration/casting/${cid}/log/?page_size=100`)
			const logs = Array.isArray(data?.logs) ? data.logs : []
			setMessages(
				[...logs]
					.map((log: any) => ({
						id: log.id,
						user_id: log.user_id,
						message: log.message,
						action: log.action,
						created_at: log.created_at,
						user_name: log.user_name,
						user_role: log.user_role,
					}))
					.reverse()
			)
		} catch {
			setMessages([])
		}
	}, [])

	const openProject = useCallback(async (p: Project) => {
		setActiveId(p.id)
		setActiveTitle(p.title)
		setView('chat')
		setLoadingChat(true)
		await loadMessages(p.id)
		setLoadingChat(false)
	}, [loadMessages])

	const backToList = () => {
		setView('list')
		setActiveId(null)
		setMessages([])
		setInput('')
	}

	const send = async () => {
		const msg = input.trim()
		if (!msg || !activeId || sending) return
		setSending(true)
		await apiCall('POST', `collaboration/casting/${activeId}/comment/?message=${encodeURIComponent(msg)}`)
		setSending(false)
		setInput('')
		await loadMessages(activeId)
	}

	// Открытие панели
	useEffect(() => {
		if (!open) return
		if (view === 'list') loadProjects()
		if (view === 'chat' && activeId) loadMessages(activeId)
	}, [open, view, activeId, loadProjects, loadMessages])

	// Polling для чата
	useEffect(() => {
		if (!open || view !== 'chat' || !activeId) return
		pollRef.current = window.setInterval(() => {
			loadMessages(activeId)
		}, 6000) as unknown as number
		return () => {
			if (pollRef.current) window.clearInterval(pollRef.current)
		}
	}, [open, view, activeId, loadMessages])

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages, open])

	return (
		<>
			<button
				className={styles.fab}
				onClick={() => setOpen(o => !o)}
				aria-label={open ? 'Закрыть' : 'Чаты проектов'}
			>
				{open ? <IconX size={20} /> : <IconChat size={22} />}
			</button>

			{open && (
				<div className={styles.window}>
					{view === 'list' ? (
						<>
							<div className={styles.header}>
								<div>
									<h3>Чаты проектов</h3>
									<span className={styles.hint}>Выберите проект</span>
								</div>
								<button className={styles.closeBtn} onClick={() => setOpen(false)}>
									<IconX size={16} />
								</button>
							</div>
							<div className={styles.body}>
								{loadingList ? (
									<div className={styles.state}>
										<IconLoader size={18} /> Загрузка…
									</div>
								) : projects.length === 0 ? (
									<div className={styles.empty}>
										<IconFilm size={28} />
										<p>Нет доступных проектов</p>
									</div>
								) : (
									<ul className={styles.projectList}>
										{projects.map((p) => (
											<li key={p.id}>
												<button
													className={styles.projectItem}
													onClick={() => openProject(p)}
												>
													<img
														className={styles.projectCover}
														src={getCoverImage(p.image_url, p.id || p.title)}
														alt=""
													/>
													<div className={styles.projectInfo}>
														<span className={styles.projectTitle}>{p.title}</span>
														<span className={styles.projectHint}>Открыть чат →</span>
													</div>
												</button>
											</li>
										))}
									</ul>
								)}
							</div>
						</>
					) : (
						<>
							<div className={styles.header}>
								{!castingId && (
									<button className={styles.closeBtn} onClick={backToList} title="К списку">
										<IconArrowLeft size={16} />
									</button>
								)}
								<div className={styles.headerTitle}>
									<h3>{activeTitle || 'Чат проекта'}</h3>
									<span className={styles.hint}>Команда проекта + SuperAdmin</span>
								</div>
								<button className={styles.closeBtn} onClick={() => setOpen(false)}>
									<IconX size={16} />
								</button>
							</div>

							<div className={styles.body}>
								{loadingChat ? (
									<div className={styles.state}>
										<IconLoader size={18} /> Загрузка сообщений…
									</div>
								) : messages.length === 0 ? (
									<div className={styles.empty}>
										<IconChat size={28} />
										<p>Нет сообщений</p>
										<span>Напишите первым</span>
									</div>
								) : (
									<div className={styles.messages}>
										{messages.map((m) => {
											const badge = roleBadge(m.user_role)
											return (
												<div key={m.id} className={styles.msg}>
													<div className={styles.msgHeader}>
														<span
															className={
																m.user_role === 'owner'
																	? styles.msgSuperAdmin
																	: m.user_role === 'employer_pro'
																		? styles.msgPro
																		: styles.msgUser
															}
														>
															{m.user_name || `User #${m.user_id}`}
														</span>
														{badge && <span className={styles.msgBadge}>{badge}</span>}
														<span className={styles.msgTime}>
															{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}
														</span>
													</div>
													<p className={styles.msgText}>{m.message}</p>
												</div>
											)
										})}
										<div ref={messagesEndRef} />
									</div>
								)}
							</div>

							<div className={styles.inputRow}>
								<input
									className={styles.input}
									value={input}
									onChange={e => setInput(e.target.value)}
									onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
									placeholder="Сообщение…"
									disabled={sending}
								/>
								<button
									className={styles.sendBtn}
									onClick={send}
									disabled={!input.trim() || sending}
								>
									{sending ? <IconLoader size={16} /> : <IconSend size={16} />}
								</button>
							</div>
						</>
					)}
				</div>
			)}
		</>
	)
}
