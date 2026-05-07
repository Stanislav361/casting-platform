'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import { useRole } from '~/shared/use-role'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconLoader,
	IconSearch,
	IconFilm,
	IconPlus,
	IconUsers,
	IconReport,
	IconSortDesc,
	IconCalendar,
	IconChevronDown,
	IconEye,
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
	end_date?: string | null
	deadline?: string | null
	finished_at?: string | null
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

export default function AllCastingsPageWrapper() {
	return (
		<Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Загрузка...</div>}>
			<AllCastingsPage />
		</Suspense>
	)
}

function AllCastingsPage() {
	const router = useRouter()
	const role = useRole()
	const goBack = useSmartBack()
	const [items, setItems] = useState<Casting[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'finished'>('all')

	type SortField = 'created_at' | 'title'
	type SortOrder = 'desc' | 'asc'
	const [sortField, setSortField] = useState<SortField>('created_at')
	const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

	const canCreate = role && ['owner', 'administrator', 'manager', 'employer_pro', 'employer'].includes(role)

	const load = useCallback(async () => {
		setLoading(true)
		// Загружаем все «корневые» проекты пользователя и из каждого — его суб-кастинги.
		// В UI «проекты» больше не показываем — только плоский список кастингов.
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
		const list = items.filter(c => {
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
		const dir = sortOrder === 'asc' ? 1 : -1
		const sorted = [...list].sort((a, b) => {
			if (sortField === 'title') {
				return (a.title || '').localeCompare(b.title || '', 'ru') * dir
			}
			const ad = a.created_at ? new Date(a.created_at).getTime() : 0
			const bd = b.created_at ? new Date(b.created_at).getTime() : 0
			return (ad - bd) * dir
		})
		return sorted
	}, [items, query, filter, sortField, sortOrder])

	const SORT_FIELD_LABELS: Record<SortField, string> = {
		created_at: 'По дате создания',
		title:      'По алфавиту',
	}

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
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Кастинги</h1>
				{canCreate && (
					<button className={styles.createBtn} onClick={() => router.push('/dashboard/castings/new')}>
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

			<div className={styles.sortRow}>
				<label className={styles.sortChip}>
					<IconSortDesc size={14} />
					<select
						className={styles.sortSelect}
						value={sortOrder}
						onChange={e => setSortOrder(e.target.value as SortOrder)}
						aria-label="Направление сортировки"
					>
						<option value="desc">По убыванию</option>
						<option value="asc">По возрастанию</option>
					</select>
					<IconChevronDown size={12} />
				</label>

				<label className={styles.sortChip}>
					<IconCalendar size={14} />
					<select
						className={styles.sortSelect}
						value={sortField}
						onChange={e => setSortField(e.target.value as SortField)}
						aria-label="Поле сортировки"
					>
						{Object.entries(SORT_FIELD_LABELS).map(([key, label]) => (
							<option key={key} value={key}>{label}</option>
						))}
					</select>
					<IconChevronDown size={12} />
				</label>
			</div>

			{loading ? (
				<div className={styles.state}><IconLoader size={22} /><span>Загрузка…</span></div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconFilm size={32} /></div>
					<h3>{items.length === 0 ? 'Пока нет кастингов' : 'Ничего не найдено'}</h3>
					<p>
						{items.length === 0
							? 'Создайте свой первый кастинг.'
							: 'Попробуйте изменить запрос или фильтр.'}
					</p>
					{canCreate && items.length === 0 && (
						<button className={styles.emptyBtn} onClick={() => router.push('/dashboard/castings/new')}>
							Создать кастинг
						</button>
					)}
				</div>
			) : (
				<div className={styles.grid}>
					{filtered.map(c => {
						const st = statusInfo(c.status)
						const goDetails = () => router.push(`/dashboard/castings/${c.id}`)
						const goResponses = () => {
							const projectId = c.parent_project_id || c.id
							const backUrl = `/dashboard/castings`
							router.push(`/dashboard/project/${projectId}?view=responses&back=${encodeURIComponent(backUrl)}`)
						}
						return (
							<article key={c.id} className={styles.card}>
								<div className={styles.cover} onClick={goDetails} role="button">
									<img src={getCoverImage(c.image_url, c.id)} alt="" />
									<span className={`${styles.status} ${styles[st.cls]}`}>{st.label}</span>
								</div>
								<div className={styles.body}>
									<p className={styles.cardTitle} onClick={goDetails}>{c.title}</p>
									{c.description && (
										<p className={styles.cardDesc} onClick={goDetails}>{c.description.slice(0, 90)}{c.description.length > 90 ? '…' : ''}</p>
									)}
									<div className={styles.infoGrid}>
										<div className={styles.infoCell}>
											<span className={styles.infoCellLabel}>Дата создания</span>
											<span className={styles.infoCellValue}>{formatDate(c.created_at) || '—'}</span>
										</div>
										<div className={styles.infoCell}>
											<span className={styles.infoCellLabel}>Дата завершения</span>
											{(c.end_date || c.deadline || c.finished_at)
												? <span className={styles.infoCellValue}>{formatDate(c.end_date || c.deadline || c.finished_at)}</span>
												: <span className={styles.infoCellActive}>Кастинг ещё активен</span>
											}
										</div>
										<div className={styles.infoCell}>
											<span className={styles.infoCellLabel}>Дата публикации</span>
											<span className={styles.infoCellValue}>{formatDate(c.published_at) || '—'}</span>
										</div>
										<div className={styles.infoCell}>
											<span className={styles.infoCellLabel}>Откликнулось</span>
											<span className={styles.infoCellValue}>{c.response_count ?? 0} актёров</span>
										</div>
									</div>
									<div className={styles.cardActions}>
										<button type="button" className={styles.cardActionPrimary} onClick={goDetails}>
											<IconEye size={14} /> Подробнее
										</button>
										<button type="button" className={styles.cardActionSecondary} onClick={goResponses}>
											<IconUsers size={14} /> Отклики
										</button>
									</div>
								</div>
							</article>
						)
					})}
				</div>
			)}
		</div>
	)
}
