'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import {
	IconArrowLeft,
	IconLoader,
	IconSend,
	IconChat,
} from '~packages/ui/icons'
import styles from './chat.module.scss'

interface ChatMessage {
	id: number
	sender_id?: number
	sender_name?: string
	sender_role?: string
	message: string
	created_at: string
}

interface Project {
	id: number
	title: string
	description?: string
	image_url?: string | null
	team_size?: number
}

const ROLE_COLORS: Record<string, string> = {
	owner:        '#fbbf24',
	employer_pro: '#60a5fa',
	employer:     '#60a5fa',
	administrator:'#60a5fa',
	manager:      '#60a5fa',
	agent:        '#c084fc',
	user:         '#4ade80',
	system:       '#94a3b8',
}

function formatTime(raw?: string): string {
	if (!raw) return ''
	try {
		const d = new Date(raw)
		if (isNaN(d.getTime())) return ''
		return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
	} catch { return '' }
}

function initials(name?: string): string {
	const t = (name || '').trim()
	if (!t) return '?'
	return t.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

export default function ChatDetailPage() {
	const router = useRouter()
	const params = useParams<{ id: string }>()
	const projectId = Number(params?.id)

	const [project, setProject] = useState<Project | null>(null)
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [loading, setLoading] = useState(true)
	const [input, setInput] = useState('')
	const [sending, setSending] = useState(false)
	const [currentUserId, setCurrentUserId] = useState<number | null>(null)
	const endRef = useRef<HTMLDivElement>(null)

	const loadChat = useCallback(async () => {
		const data = await apiCall('GET', `employer/projects/${projectId}/chat/`)
		if (data && !data.detail) {
			setMessages(data.messages || [])
		}
	}, [projectId])

	const loadProject = useCallback(async () => {
		const data = await apiCall('GET', `employer/projects/${projectId}/detail/`)
		if (data && !data.detail) setProject(data)
	}, [projectId])

	const loadMe = useCallback(async () => {
		const me = await apiCall('GET', 'auth/v2/me/')
		if (me && !me.detail && me.id) setCurrentUserId(Number(me.id))
	}, [])

	useEffect(() => {
		if (!Number.isFinite(projectId)) return
		;(async () => {
			setLoading(true)
			await Promise.all([loadChat(), loadProject(), loadMe()])
			setLoading(false)
		})()
	}, [projectId, loadChat, loadProject, loadMe])

	useEffect(() => {
		const t = setInterval(() => { loadChat() }, 15000)
		return () => clearInterval(t)
	}, [loadChat])

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	const send = async () => {
		const msg = input.trim()
		if (!msg || sending) return
		setSending(true)
		const res = await apiCall('POST', `employer/projects/${projectId}/chat/?message=${encodeURIComponent(msg)}`)
		if (res && !res.detail) {
			setInput('')
			await loadChat()
		} else if (res?.detail) {
			alert(res.detail)
		}
		setSending(false)
	}

	if (!Number.isFinite(projectId)) {
		return <div className={styles.root}><div className={styles.state}>Неверный проект</div></div>
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.push('/chats')}>
					<IconArrowLeft size={16} />
					<span>Чаты</span>
				</button>
				<div className={styles.headTitle}>
					<h1>{project?.title || 'Чат кастинга'}</h1>
					{project?.team_size !== undefined && (
						<span className={styles.headSub}>{project.team_size} в команде</span>
					)}
				</div>
				<button className={styles.openBtn} onClick={() => router.push(`/dashboard/castings/${projectId}`)}>
					Открыть кастинг
				</button>
			</header>

			<div className={styles.chatBox}>
				{loading ? (
					<div className={styles.state}><IconLoader size={22} /><span>Загрузка…</span></div>
				) : messages.length === 0 ? (
					<div className={styles.emptyChat}>
						<div className={styles.emptyIcon}><IconChat size={28} /></div>
						<p>Пока нет сообщений. Начните общение с командой!</p>
					</div>
				) : (
					<div className={styles.messages}>
						{messages.map(m => {
							const isMine = currentUserId !== null && m.sender_id === currentUserId
							return (
								<div key={m.id} className={`${styles.msg} ${isMine ? styles.msgMine : ''}`}>
									{!isMine && (
										<div className={styles.avatar} style={{ background: ROLE_COLORS[m.sender_role || 'system'] + '22', color: ROLE_COLORS[m.sender_role || 'system'] }}>
											{initials(m.sender_name)}
										</div>
									)}
									<div className={styles.msgBody}>
										{!isMine && (
											<div className={styles.msgMeta}>
												<span className={styles.msgSender}>{m.sender_name || 'Система'}</span>
												<span className={styles.msgTime}>{formatTime(m.created_at)}</span>
											</div>
										)}
										<div className={`${styles.bubble} ${isMine ? styles.bubbleMine : ''}`}>
											{m.message}
										</div>
										{isMine && (
											<div className={styles.msgMetaRight}>
												<span className={styles.msgTime}>{formatTime(m.created_at)}</span>
											</div>
										)}
									</div>
								</div>
							)
						})}
						<div ref={endRef} />
					</div>
				)}
			</div>

			<div className={styles.inputBar}>
				<input
					value={input}
					onChange={e => setInput(e.target.value)}
					placeholder="Написать команде..."
					onKeyDown={e => { if (e.key === 'Enter') send() }}
					disabled={sending}
					className={styles.inputField}
				/>
				<button className={styles.sendBtn} onClick={send} disabled={!input.trim() || sending}>
					{sending ? <IconLoader size={16} /> : <IconSend size={16} />}
				</button>
			</div>
		</div>
	)
}
