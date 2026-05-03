'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconChat,
	IconLoader,
	IconSearch,
	IconChevronRight,
} from '~packages/ui/icons'
import styles from './chats.module.scss'

interface Project {
	id: number
	title: string
	description?: string
	status?: string
	image_url?: string | null
	team_size?: number
	collaborator_count?: number
	response_count?: number
	updated_at?: string
	created_at?: string
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
	const [projects, setProjects] = useState<Project[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'employer/projects/?page=1&page_size=50')
		if (data && !data.detail) {
			setProjects(data.projects || data.items || [])
		}
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const filtered = projects.filter(p => {
		if (!query.trim()) return true
		const q = query.toLowerCase()
		return (p.title || '').toLowerCase().includes(q) ||
		       (p.description || '').toLowerCase().includes(q)
	})

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Чаты проектов</h1>
			</header>

			<div className={styles.subtitle}>
				Внутренний чат команды проекта — для обсуждения актёров,
				координации и оперативной связи.
			</div>

			<div className={styles.searchBox}>
				<IconSearch size={16} />
				<input
					className={styles.searchInput}
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Поиск по проекту..."
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
					<h3>{projects.length === 0 ? 'У вас пока нет проектов' : 'Ничего не найдено'}</h3>
					<p>
						{projects.length === 0
							? 'Чаты появятся после создания первого проекта. Каждый проект получает внутренний чат для команды.'
							: 'Попробуйте изменить запрос.'}
					</p>
					{projects.length === 0 && (
						<button className={styles.emptyBtn} onClick={() => router.push('/dashboard')}>
							Создать проект
						</button>
					)}
				</div>
			) : (
				<div className={styles.list}>
					{filtered.map(p => (
						<button
							key={p.id}
							className={styles.chatRow}
							onClick={() => router.push(`/chats/${p.id}`)}
						>
							<div className={styles.cover}>
								<img src={getCoverImage(p.image_url, p.id)} alt="" />
							</div>
							<div className={styles.body}>
								<div className={styles.rowHead}>
									<p className={styles.name}>{p.title}</p>
									{p.updated_at && <span className={styles.time}>{formatTime(p.updated_at)}</span>}
								</div>
								<p className={styles.snippet}>
									{p.description
										? p.description.slice(0, 140) + (p.description.length > 140 ? '…' : '')
										: 'Откройте, чтобы начать общение с командой проекта'}
								</p>
								<div className={styles.metaRow}>
									<span className={styles.meta}>👥 {(p.team_size ?? (p.collaborator_count ?? 0) + 1)} в команде</span>
									{p.response_count !== undefined && (
										<span className={styles.meta}>✉ {p.response_count} откликов</span>
									)}
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
