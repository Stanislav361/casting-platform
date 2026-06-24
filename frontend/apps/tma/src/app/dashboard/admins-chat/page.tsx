'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { apiCall } from '~/shared/api-client'
import { useSmartBack } from '~/shared/smart-back'
import { useDialog } from '~/shared/dialog/dialog-provider'
import {
	IconArrowLeft,
	IconLoader,
	IconSend,
	IconChat,
} from '~packages/ui/icons'
import styles from './admins-chat.module.scss'

interface ChatMessage {
	id: number
	sender_id?: number
	sender_name?: string
	sender_role?: string
	is_mine?: boolean
	message: string
	created_at: string
}

const ROLE_COLORS: Record<string, string> = {
	owner:        '#fbbf24',
	employer_pro: '#60a5fa',
	employer:     '#60a5fa',
	administrator:'#60a5fa',
	manager:      '#60a5fa',
	system:       '#94a3b8',
}

function formatTime(raw?: string): string {
	if (!raw) return ''
	try {
		// Бэкенд может вернуть дату с пробелом ("2026-06-24 19:36:00+00:00"),
		// который Safari/iOS не парсит — приводим к ISO с T.
		const d = new Date(raw.replace(' ', 'T'))
		if (isNaN(d.getTime())) return ''
		return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
	} catch { return '' }
}

function initials(name?: string): string {
	const t = (name || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim()
	if (!t) return '?'
	return t.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminsChatPage() {
	const goBack = useSmartBack('/dashboard')
	const dialog = useDialog()

	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [loading, setLoading] = useState(true)
	const [input, setInput] = useState('')
	const [sending, setSending] = useState(false)
	const endRef = useRef<HTMLDivElement>(null)

	const loadChat = useCallback(async () => {
		const data = await apiCall('GET', 'employer/projects/general-chat/?page_size=50')
		if (data && !data.detail && Array.isArray(data.messages)) {
			setMessages(data.messages)
		}
	}, [])

	useEffect(() => {
		;(async () => {
			setLoading(true)
			await loadChat()
			setLoading(false)
		})()
	}, [loadChat])

	useEffect(() => {
		const t = setInterval(() => { loadChat() }, 10000)
		return () => clearInterval(t)
	}, [loadChat])

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	const send = async () => {
		const msg = input.trim()
		if (!msg || sending) return
		setSending(true)
		const res = await apiCall('POST', `employer/projects/general-chat/send/?message=${encodeURIComponent(msg)}`)
		if (res && !res.detail) {
			setInput('')
			await loadChat()
		} else if (res?.detail) {
			dialog.error({
				title: 'Сообщение не отправлено',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		}
		setSending(false)
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<div className={styles.headTitle}>
					<h1>Чат админов</h1>
					<span className={styles.headSub}>Общий чат администраторов</span>
				</div>
			</header>

			<div className={styles.chatBox}>
				{loading ? (
					<div className={styles.state}><IconLoader size={22} /><span>Загрузка…</span></div>
				) : messages.length === 0 ? (
					<div className={styles.emptyChat}>
						<div className={styles.emptyIcon}><IconChat size={28} /></div>
						<p>Пока нет сообщений. Напишите первое сообщение администраторам!</p>
					</div>
				) : (
					<div className={styles.messages}>
						{messages.map(m => {
							const isMine = Boolean(m.is_mine)
							const color = ROLE_COLORS[m.sender_role || 'system'] || ROLE_COLORS.system
							return (
								<div key={m.id} className={`${styles.msg} ${isMine ? styles.msgMine : ''}`}>
									{!isMine && (
										<div className={styles.avatar} style={{ background: color + '22', color }}>
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
					placeholder="Написать админам..."
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
