'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiCall } from '~/shared/api-client'
import { IconLoader, IconSend, IconX } from '~packages/ui/icons'
import styles from './support-chat.module.scss'

export interface SupportMessage {
	id: number
	sender_id: number
	sender_name: string
	sender_role?: string
	is_mine?: boolean
	message: string
	created_at: string
}

interface Props {
	open: boolean
	onClose: () => void
}

export default function SupportChat({ open, onClose }: Props) {
	const [messages, setMessages] = useState<SupportMessage[]>([])
	const [loading, setLoading] = useState(false)
	const [sending, setSending] = useState(false)
	const [input, setInput] = useState('')
	const bodyRef = useRef<HTMLDivElement>(null)
	const pollRef = useRef<number | null>(null)

	const load = useCallback(async () => {
		const data = await apiCall('GET', 'employer/support/my/')
		if (data && !data.detail) {
			setMessages(data.messages || [])
		}
	}, [])

	useEffect(() => {
		if (!open) return
		setLoading(true)
		load().finally(() => setLoading(false))
		pollRef.current = window.setInterval(load, 8000) as unknown as number
		return () => {
			if (pollRef.current) window.clearInterval(pollRef.current)
		}
	}, [open, load])

	useEffect(() => {
		if (open) {
			bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
		}
	}, [messages, open])

	const send = async () => {
		const msg = input.trim()
		if (!msg || sending) return
		setSending(true)
		const res = await apiCall('POST', `employer/support/message/?message=${encodeURIComponent(msg)}`)
		setSending(false)
		if (res?.sent) {
			setInput('')
			await load()
		} else if (res?.detail) {
			alert(typeof res.detail === 'string' ? res.detail : 'Не удалось отправить')
		}
	}

	if (!open) return null

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.sheet} onClick={e => e.stopPropagation()}>
				<div className={styles.header}>
					<div>
						<h3>Поддержка</h3>
						<p>Пишите здесь — SuperAdmin ответит</p>
					</div>
					<button className={styles.closeBtn} onClick={onClose}>
						<IconX size={16} />
					</button>
				</div>

				<div className={styles.body} ref={bodyRef}>
					{loading ? (
						<div className={styles.state}>
							<IconLoader size={18} /> Загрузка…
						</div>
					) : messages.length === 0 ? (
						<div className={styles.empty}>
							<div className={styles.emptyEmoji}>💬</div>
							<p>Опишите проблему или вопрос</p>
							<span>Мы ответим в кратчайшие сроки</span>
						</div>
					) : (
						messages.map((m) => (
							<div
								key={m.id}
								className={`${styles.msg} ${m.is_mine ? styles.msgMine : styles.msgOther}`}
							>
								{!m.is_mine && (
									<span className={styles.msgAuthor}>{m.sender_name}</span>
								)}
								<div className={styles.msgBubble}>{m.message}</div>
								<span className={styles.msgTime}>
									{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}
								</span>
							</div>
						))
					)}
				</div>

				<div className={styles.inputRow}>
					<input
						className={styles.input}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
						placeholder="Напишите сообщение…"
						disabled={sending}
					/>
					<button
						className={styles.sendBtn}
						onClick={send}
						disabled={sending || !input.trim()}
					>
						{sending ? <IconLoader size={16} /> : <IconSend size={16} />}
					</button>
				</div>
			</div>
		</div>
	)
}
