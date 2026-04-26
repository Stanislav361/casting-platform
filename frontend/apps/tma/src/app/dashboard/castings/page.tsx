'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import { useRole } from '~/shared/use-role'
import {
	IconArrowLeft,
	IconLoader,
	IconSearch,
	IconFilm,
	IconPlus,
	IconUsers,
	IconReport,
} from '~packages/ui/icons'
import styles from './castings.module.scss'

interface Casting {
	id: number
	title: string
	description?: string
	status?: string
	image_url?: string | null
	response_count?: number
	report_count?: number
	parent_project_id?: number
	project_title?: string
	city?: string | null
	project_category?: string | null
	collaborator_count?: number
	team_size?: number
	published_at?: string | null
	created_at?: string
	updated_at?: string
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
	draft:      { label: 'Черновик',    cls: 'sMuted' },
	published:  { label: 'Опубликован', cls: 'sOk'    },
	unpublished:{ label: 'Не опубликован', cls: 'sWarn' },
	finished:   { label: 'Завершён',    cls: 'sMuted' },
	closed:     { label: 'Закрыт',      cls: 'sMuted' },
}

function statusInfo(raw?: string): { label: string; cls: string } {
	if (!raw) return { label: '—', cls: 'sMuted' }
	return STATUS_LABELS[raw.toLowerCase()] || { label: raw, cls: 'sMuted' }
}

function formatDate(raw?: string | null): string {
	if (!raw) return ''
	try {
		const d = new Date(raw)
		if (isNaN(d.getTime())) return ''
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
	} catch { return '' }
}

export default function AllCastingsPage() {
	const router = useRouter()
	const role = useRole()
	const [items, setItems] = useState<Casting[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'finished'>('all')

	const canCreate = role && ['owner', 'administrator', 'manager', 'employer_pro', 'employer'].includes(role)

	const load = useCallback(async () => {
		setLoading(true)
		const projectsData = await apiCall('GET', 'employer/projects/?page=1&page_size=100')
		if (projectsData && !projectsData.detail) {
			const projects = projectsData.projects || projectsData.items || []
			const castingsByProject = await Promise.all(
				projects.map(async (project: Casting) => {
					const data = await apiCall('GET', `employer/projects/${project.id}/castings/`)
					const castings = data?.castings || data?.items || []
					return castings.map((casting: Casting) => ({
						...casting,
						parent_project_id: project.id,
						project_title: project.title,
					}))
				}),
			)
			setItems(castingsByProject.flat())
		} else {
			setItems([])
		}
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		return items.filter(c => {
			if (q && !((c.title || '').toLowerCase().includes(q) ||
			            (c.description || '').toLowerCase().includes(q))) return false
			if (filter !== 'all') {
				const s = (c.status || '').toLowerCase()
				if (filter === 'published' && s !== 'published') return false
				if (filter === 'draft' && s !== 'draft' && s !== 'unpublished') return false
				if (filter === 'finished' && s !== 'finished' && s !== 'closed') return false
			}
			return true
		})
	}, [items, query, filter])

	const counters = useMemo(() => {
		const c = { all: items.length, published: 0, draft: 0, finished: 0 }
		for (const it of items) {
			const s = (it.status || '').toLowerCase()
			if (s === 'published') c.published++
			else if (s === 'draft' || s === 'unpublished') c.draft++
			else if (s === 'finished' || s === 'closed') c.finished++
		}
		return c
	}, [items])

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.back()}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Кастинги</h1>
				{canCreate && (
					<button className={styles.createBtn} onClick={() => router.push('/dashboard')}>
						<IconPlus size={14} />
						<span>Новый</span>
					</button>
				)}
			</header>

			<div className={styles.tabs}>
				<button
					className={`${styles.tab} ${filter === 'all' ? styles.tabActive : ''}`}
					onClick={() => setFilter('all')}
				>Все · {counters.all}</button>
				<button
					className={`${styles.tab} ${filter === 'published' ? styles.tabActive : ''}`}
					onClick={() => setFilter('published')}
				>Опубликованные · {counters.published}</button>
				<button
					className={`${styles.tab} ${filter === 'draft' ? styles.tabActive : ''}`}
					onClick={() => setFilter('draft')}
				>Черновики · {counters.draft}</button>
				<button
					className={`${styles.tab} ${filter === 'finished' ? styles.tabActive : ''}`}
					onClick={() => setFilter('finished')}
				>Завершённые · {counters.finished}</button>
			</div>

			<div className={styles.searchBox}>
				<IconSearch size={16} />
				<input
					className={styles.searchInput}
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Поиск по названию или описанию..."
				/>
			</div>

			{loading ? (
				<div className={styles.state}><IconLoader size={22} /><span>Загрузка…</span></div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconFilm size={32} /></div>
					<h3>{items.length === 0 ? 'Пока нет кастингов' : 'Ничего не найдено'}</h3>
					<p>
						{items.length === 0
							? 'Кастинги создаются внутри проекта. Откройте проект и добавьте первый кастинг для подбора актёров.'
							: 'Попробуйте изменить запрос или фильтр.'}
					</p>
					{canCreate && items.length === 0 && (
						<button className={styles.emptyBtn} onClick={() => router.push('/dashboard')}>
							Перейти к проектам
						</button>
					)}
				</div>
			) : (
				<div className={styles.grid}>
					{filtered.map(c => {
						const st = statusInfo(c.status)
						return (
							<button
								key={c.id}
								className={styles.card}
								onClick={() => router.push(`/dashboard/project/${c.id}`)}
							>
								<div className={styles.cover}>
									<img src={getCoverImage(c.image_url, c.id)} alt="" />
									<span className={`${styles.status} ${styles[st.cls]}`}>{st.label}</span>
								</div>
								<div className={styles.body}>
									<p className={styles.cardTitle}>{c.title}</p>
									{c.description && (
										<p className={styles.cardDesc}>{c.description.slice(0, 90)}{c.description.length > 90 ? '…' : ''}</p>
									)}
									<div className={styles.metaRow}>
										<span className={styles.metaItem}><IconUsers size={12} /> {c.response_count ?? 0}</span>
										<span className={styles.metaItem}><IconReport size={12} /> {c.report_count ?? 0}</span>
										{c.project_title && <span className={styles.metaItem}>{c.project_title}</span>}
									</div>
									<p className={styles.dateLine}>
										{c.published_at ? `Опубликован: ${formatDate(c.published_at)}` :
										 c.created_at ? `Создан: ${formatDate(c.created_at)}` : ''}
									</p>
								</div>
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}
