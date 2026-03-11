'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from './live-chat.module.scss'

interface ChatMessage {
	id: number
	user_id: number
	message: string
	action: string
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

	const loadMessages = useCallback(async () => {
		const data = await api('GET', `collaboration/casting/${castingId}/log/?page_size=50`)
		if (data?.logs) {
			const newCount = data.logs.length - messages.length
			if (!open && newCount > 0 && messages.length > 0) {
				setUnread(prev => prev + newCount)
			}
			setMessages(data.logs.reverse())
		}
	}, [api, castingId, messages.length, open])

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
		await api('POST', `collaboration/casting/${castingId}/comment/?message=${encodeURIComponent(input)}`)
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
							<h3>Чат команды</h3>
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
							messages.map((msg) => (
								<div key={msg.id} className={styles.message}>
									<div className={styles.msgHeader}>
										<span className={
											msg.user_role === 'owner' ? styles.msgSuperAdmin :
											msg.user_role === 'employer_pro' ? styles.msgPro :
											styles.msgUser
										}>
											{msg.user_name || `User #${msg.user_id}`}
										</span>
										<span className={styles.msgTime}>
											{msg.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}
										</span>
									</div>
									<p className={styles.msgText}>{msg.message}</p>
								</div>
							))
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
