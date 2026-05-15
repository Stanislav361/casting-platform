'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useSmartBack } from '~/shared/smart-back'
import { useRole, canManageTeam } from '~/shared/use-role'
import {
	IconArrowLeft,
	IconChat,
	IconLoader,
	IconSearch,
	IconChevronRight,
	IconUsers,
} from '~packages/ui/icons'
import styles from './chats.module.scss'

interface TeamChat {
	owner_id: number
	title: string
	owner_name?: string | null
	owner_role?: string | null
	member_count?: number
	last_message?: string | null
	last_message_at?: string | null
}

function formatTime(raw?: string): string {
	if (!raw) return ''
	try {
		const d = new Date(raw)
		if (isNaN(d.getTime())) return ''
		const now = new Date()
		const diff = (now.getTime() - d.getTime()) / 1000
		if (diff < 60)     return 'только что'
		if (diff < 3600)   return `${Math.floor(diff / 60)} мин`
		if (diff < 86400)  return `${Math.floor(diff / 3600)} ч`
		if (diff < 604800) return `${Math.floor(diff / 86400)} дн`
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
	} catch { return '' }
}

export default function ChatsPage() {
	const router = useRouter()
	const goBack = useSmartBack()
	const role = useRole()
	const [chats, setChats] = useState<TeamChat[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'employer/projects/team-chats/')
		setChats(data && !data.detail ? (data.chats || []) : [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const filtered = chats.filter(c => {
		if (!query.trim()) return true
		const q = query.toLowerCase()
		return (c.title || '').toLowerCase().includes(q) ||
		       (c.owner_name || '').toLowerCase().includes(q) ||
		       (c.last_message || '').toLowerCase().includes(q)
	})

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Чаты команд</h1>
			</header>

			<div className={styles.subtitle}>
				Командный чат для админов одной команды. Здесь владелец команды и приглашённые админы
				могут обсуждать работу между собой.
			</div>

			<div className={styles.searchBox}>
				<IconSearch size={16} />
				<input
					className={styles.searchInput}
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Поиск по команде..."
				/>
			</div>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} />
					<span>Загрузка…</span>
				</div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconChat size={32} /></div>
					<h3>{chats.length === 0 ? 'Командных чатов пока нет' : 'Ничего не найдено'}</h3>
					<p>
						{chats.length === 0
							? canManageTeam(role)
								? 'Чат появится, когда вы создадите свою команду или вас добавят в команду Админ PRO.'
								: 'Чат появится, когда Админ PRO добавит вас в свою команду.'
							: 'Попробуйте изменить запрос.'}
					</p>
				</div>
			) : (
				<div className={styles.list}>
					{filtered.map((c) => (
						<button
							key={c.owner_id}
							className={styles.chatRow}
							onClick={() => router.push(`/chats/${c.owner_id}`)}
						>
							<div className={styles.cover}>
								<IconUsers size={22} />
							</div>
							<div className={styles.body}>
								<div className={styles.rowHead}>
									<p className={styles.name}>{c.title}</p>
									{c.last_message_at && <span className={styles.time}>{formatTime(c.last_message_at)}</span>}
								</div>
								<p className={styles.snippet}>
									{c.last_message || 'Откройте, чтобы начать общение с командой'}
								</p>
								<div className={styles.metaRow}>
									<span className={styles.meta}>👥 {c.member_count || 1} в команде</span>
									{c.owner_name && <span className={styles.meta}>Владелец: {c.owner_name}</span>}
								</div>
							</div>
							<IconChevronRight size={16} />
						</button>
					))}
				</div>
			)}
		</div>
	)
}
