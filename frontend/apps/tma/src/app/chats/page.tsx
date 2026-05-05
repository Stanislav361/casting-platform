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

interface Casting {
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
	parent_project_id?: number
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
	const [castings, setCastings] = useState<Casting[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const load = useCallback(async () => {
		setLoading(true)
		// Загружаем все сабкастинги пользователя плоско: каждый кастинг имеет
		// собственный внутренний чат команды.
		const projectsData = await apiCall('GET', 'employer/projects/?page=1&page_size=200')
		if (projectsData && !projectsData.detail) {
			const projects = projectsData.projects || projectsData.items || []
			const castingsByProject = await Promise.all(
				projects.map(async (project: Casting) => {
					const data = await apiCall('GET', `employer/projects/${project.id}/castings/`)
					const list = data?.castings || data?.items || []
					return list.map((c: Casting) => ({ ...c, parent_project_id: project.id }))
				}),
			)
			setCastings(castingsByProject.flat())
		} else {
			setCastings([])
		}
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const filtered = castings.filter(c => {
		if (!query.trim()) return true
		const q = query.toLowerCase()
		return (c.title || '').toLowerCase().includes(q) ||
		       (c.description || '').toLowerCase().includes(q)
	})

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Чаты кастингов</h1>
			</header>

			<div className={styles.subtitle}>
				Внутренний чат команды кастинга — для обсуждения актёров,
				координации и оперативной связи.
			</div>

			<div className={styles.searchBox}>
				<IconSearch size={16} />
				<input
					className={styles.searchInput}
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Поиск по кастингу..."
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
					<h3>{castings.length === 0 ? 'У вас пока нет кастингов' : 'Ничего не найдено'}</h3>
					<p>
						{castings.length === 0
							? 'Чаты появятся после создания первого кастинга. Каждый кастинг получает внутренний чат для команды.'
							: 'Попробуйте изменить запрос.'}
					</p>
					{castings.length === 0 && (
						<button className={styles.emptyBtn} onClick={() => router.push('/dashboard/castings/new')}>
							Создать кастинг
						</button>
					)}
				</div>
			) : (
				<div className={styles.list}>
					{filtered.map(c => (
						<button
							key={c.id}
							className={styles.chatRow}
							onClick={() => router.push(`/chats/${c.id}`)}
						>
							<div className={styles.cover}>
								<img src={getCoverImage(c.image_url, c.id)} alt="" />
							</div>
							<div className={styles.body}>
								<div className={styles.rowHead}>
									<p className={styles.name}>{c.title}</p>
									{c.updated_at && <span className={styles.time}>{formatTime(c.updated_at)}</span>}
								</div>
								<p className={styles.snippet}>
									{c.description
										? c.description.slice(0, 140) + (c.description.length > 140 ? '…' : '')
										: 'Откройте, чтобы начать общение с командой кастинга'}
								</p>
								<div className={styles.metaRow}>
									<span className={styles.meta}>👥 {(c.team_size ?? (c.collaborator_count ?? 0) + 1)} в команде</span>
									{c.response_count !== undefined && (
										<span className={styles.meta}>✉ {c.response_count} откликов</span>
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
