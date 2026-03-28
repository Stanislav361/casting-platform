'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from './live-chat.module.scss'

interface ChatMessage {
	id: number
	user_id: number
	message: string
	action?: string
	created_at: string
	user_name?: string
	user_role?: string
}

interface LiveChatProps {
	castingId?: number
}

export default function LiveChat({ castingId = 0 }: LiveChatProps) {
	const [open, setOpen] = useState(false)
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(false)
	const [unread, setUnread] = useState(0)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const intervalRef = useRef<any>(null)

	const token = $session.getState()?.access_token

	const api = useCallback(async (method: string, path: string) => {
		if (!token) return null
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		})
		return res.json().catch(() => null)
	}, [token])

	const isGlobalChat = castingId === 0

	const normalizeMessages = (data: any): ChatMessage[] => {
		if (isGlobalChat) {
			return (data?.messages || []).map((msg: any) => ({
				id: msg.id,
				user_id: msg.sender_id,
				message: msg.message,
				created_at: msg.created_at,
				user_name: msg.sender_name,
				user_role: msg.sender_role,
			}))
		}

		return (data?.logs || []).map((log: any) => ({
			id: log.id,
			user_id: log.user_id,
			message: log.message,
			action: log.action,
			created_at: log.created_at,
			user_name: log.user_name,
			user_role: log.user_role,
		}))
	}

	const loadMessages = useCallback(async () => {
		const data = await api(
			'GET',
			isGlobalChat
				? 'employer/general-chat/?page_size=50'
				: `collaboration/casting/${castingId}/log/?page_size=50`,
		)
		const nextMessages = normalizeMessages(data)
		if (nextMessages.length > 0 || (isGlobalChat ? data?.messages : data?.logs)) {
			const newCount = nextMessages.length - messages.length
			if (!open && newCount > 0 && messages.length > 0) {
				setUnread(prev => prev + newCount)
			}
			setMessages(isGlobalChat ? nextMessages : [...nextMessages].reverse())
		}
	}, [api, castingId, isGlobalChat, messages.length, open])

	useEffect(() => {
		if (!token) return
		loadMessages()
	}, [token])

	useEffect(() => {
		if (!token || !open) return
		intervalRef.current = setInterval(loadMessages, 5000)
		return () => clearInterval(intervalRef.current)
	}, [token, open])

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages, open])

	const send = async () => {
		if (!input.trim() || loading) return
		setLoading(true)
		await api(
			'POST',
			isGlobalChat
				? `employer/general-chat/send/?message=${encodeURIComponent(input)}`
				: `collaboration/casting/${castingId}/comment/?message=${encodeURIComponent(input)}`,
		)
		setInput('')
		await loadMessages()
		setLoading(false)
	}

	const toggleChat = () => {
		setOpen(!open)
		if (!open) setUnread(0)
	}

	return (
		<>
			<button className={styles.chatButton} onClick={toggleChat}>
				{open ? '✕' : '💬'}
				{unread > 0 && !open && (
					<span className={styles.unreadBadge}>{unread}</span>
				)}
			</button>

			{open && (
				<div className={styles.chatWindow}>
					<div className={styles.chatHeader}>
						<div>
							<h3>{isGlobalChat ? 'Общий чат' : 'Чат команды'}</h3>
							<span className={styles.onlineStatus}>● Онлайн</span>
						</div>
						<button onClick={toggleChat} className={styles.closeBtn}>✕</button>
					</div>

					<div className={styles.chatMessages}>
						{messages.length === 0 ? (
							<div className={styles.emptyChat}>
								<p>Нет сообщений</p>
								<span>Напишите первое сообщение</span>
							</div>
						) : (
							messages.map((msg) => {
								const roleBadge = msg.user_role === 'owner' ? '👑 SuperAdmin'
									: msg.user_role === 'employer_pro' ? '⭐ Админ PRO'
									: msg.user_role === 'employer' || msg.user_role === 'administrator' || msg.user_role === 'manager' ? '📋 Админ'
									: ''
								return (
								<div key={msg.id} className={styles.message}>
									<div className={styles.msgHeader}>
										<span className={
											msg.user_role === 'owner' ? styles.msgSuperAdmin :
											msg.user_role === 'employer_pro' ? styles.msgPro :
											styles.msgUser
										}>
											{msg.user_name || `User #${msg.user_id}`}
										</span>
										{roleBadge && <span className={styles.msgRoleBadge}>{roleBadge}</span>}
										<span className={styles.msgTime}>
											{msg.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}
										</span>
									</div>
									<p className={styles.msgText}>{msg.message}</p>
								</div>
								)
							})
						)}
						<div ref={messagesEndRef} />
					</div>

					<div className={styles.chatInputArea}>
						<input
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => e.key === 'Enter' && send()}
							placeholder="Напишите сообщение..."
							className={styles.chatInput}
							disabled={loading}
						/>
						<button
							onClick={send}
							disabled={loading || !input.trim()}
							className={styles.sendBtn}
						>
							{loading ? '...' : '➤'}
						</button>
					</div>
				</div>
			)}
		</>
	)
}
