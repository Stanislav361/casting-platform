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
	IconFilter,
	IconX,
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

const ARCHIVE_STATUSES = new Set(['finished', 'closed'])

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
	draft:      { label: 'Черновик',        cls: 'sMuted' },
	published:  { label: 'Опубликован',     cls: 'sOk'   },
	unpublished:{ label: 'Не опубликован',  cls: 'sWarn' },
	finished:   { label: 'Завершён',        cls: 'sMuted' },
	closed:     { label: 'Закрыт',          cls: 'sMuted' },
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

function toIso(raw: string): string {
	// Convert dd.mm.yyyy → yyyy-mm-dd for comparison
	if (!raw) return ''
	const parts = raw.split('.')
	if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
	return raw
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

	// Active / Archive toggle
	const [archiveMode, setArchiveMode] = useState(false)

	// Status sub-filter (only for active mode)
	type StatusFilter = 'all' | 'published' | 'draft'
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

	// Sort
	type SortField = 'created_at' | 'title'
	type SortOrder = 'desc' | 'asc'
	const [sortField, setSortField] = useState<SortField>('created_at')
	const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

	// Filters drawer
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [filterPubFrom,     setFilterPubFrom]     = useState('')
	const [filterPubTo,       setFilterPubTo]       = useState('')
	const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
	const [filterCreatedTo,   setFilterCreatedTo]   = useState('')

	const filtersActive = !!(filterPubFrom || filterPubTo || filterCreatedFrom || filterCreatedTo)

	const resetFilters = () => {
		setFilterPubFrom('')
		setFilterPubTo('')
		setFilterCreatedFrom('')
		setFilterCreatedTo('')
	}

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

	// Split into active / archive buckets
	const activeItems  = useMemo(() => items.filter(c => !ARCHIVE_STATUSES.has((c.status || '').toLowerCase())), [items])
	const archiveItems = useMemo(() => items.filter(c =>  ARCHIVE_STATUSES.has((c.status || '').toLowerCase())), [items])

	const baseItems = archiveMode ? archiveItems : activeItems

	const counters = useMemo(() => ({
		active:    activeItems.length,
		archive:   archiveItems.length,
		published: activeItems.filter(c => (c.status || '').toLowerCase() === 'published').length,
		draft:     activeItems.filter(c => ['draft', 'unpublished'].includes((c.status || '').toLowerCase())).length,
	}), [activeItems, archiveItems])

	const SORT_FIELD_LABELS: Record<SortField, string> = {
		created_at: 'По дате создания',
		title:      'По алфавиту',
	}

	const inRange = (dateStr: string | undefined | null, from: string, to: string): boolean => {
		if (!dateStr) return true
		const ts = new Date(dateStr).getTime()
		const parseInput = (v: string) => {
			// accept both dd.mm.yyyy and yyyy-mm-dd
			if (!v) return NaN
			if (v.includes('.')) {
				const [d, m, y] = v.split('.')
				return new Date(`${y}-${m}-${d}`).getTime()
			}
			return new Date(v).getTime()
		}
		if (from) { const f = parseInput(from); if (!isNaN(f) && ts < f) return false }
		if (to)   { const t = parseInput(to);   if (!isNaN(t) && ts > t + 86400000 - 1) return false }
		return true
	}

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		const list = baseItems.filter(c => {
			if (q && !((c.title || '').toLowerCase().includes(q) ||
			            (c.description || '').toLowerCase().includes(q))) return false
			if (!archiveMode && statusFilter !== 'all') {
				const s = (c.status || '').toLowerCase()
				if (statusFilter === 'published' && s !== 'published') return false
				if (statusFilter === 'draft' && s !== 'draft' && s !== 'unpublished') return false
			}
			if (!inRange(c.published_at, filterPubFrom, filterPubTo)) return false
			if (!inRange(c.created_at,   filterCreatedFrom, filterCreatedTo)) return false
			return true
		})
		const dir = sortOrder === 'asc' ? 1 : -1
		return [...list].sort((a, b) => {
			if (sortField === 'title') return (a.title || '').localeCompare(b.title || '', 'ru') * dir
			const ad = a.created_at ? new Date(a.created_at).getTime() : 0
			const bd = b.created_at ? new Date(b.created_at).getTime() : 0
			return (ad - bd) * dir
		})
	}, [baseItems, query, archiveMode, statusFilter, sortField, sortOrder, filterPubFrom, filterPubTo, filterCreatedFrom, filterCreatedTo])

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>{archiveMode ? 'Архив кастингов' : 'Кастинги'}</h1>
				{canCreate && (
					<button className={styles.createBtn} onClick={() => router.push('/dashboard/castings/new')}>
						<IconPlus size={14} />
						<span>Новый</span>
					</button>
				)}
			</header>

			{/* Active / Archive toggle */}
			<div className={styles.archiveTabs}>
				<button
					className={`${styles.archiveTab} ${!archiveMode ? styles.archiveTabActive : ''}`}
					onClick={() => { setArchiveMode(false); setStatusFilter('all') }}
				>Активные · {counters.active}</button>
				<button
					className={`${styles.archiveTab} ${archiveMode ? styles.archiveTabActive : ''}`}
					onClick={() => setArchiveMode(true)}
				>Архив · {counters.archive}</button>
			</div>

			{/* Status sub-tabs (active mode only) */}
			{!archiveMode && (
				<div className={styles.tabs}>
					<button className={`${styles.tab} ${statusFilter === 'all' ? styles.tabActive : ''}`} onClick={() => setStatusFilter('all')}>
						Все · {counters.active}
					</button>
					<button className={`${styles.tab} ${statusFilter === 'published' ? styles.tabActive : ''}`} onClick={() => setStatusFilter('published')}>
						Опубликованные · {counters.published}
					</button>
					<button className={`${styles.tab} ${statusFilter === 'draft' ? styles.tabActive : ''}`} onClick={() => setStatusFilter('draft')}>
						Черновики · {counters.draft}
					</button>
				</div>
			)}

			{/* Search */}
			<div className={styles.searchBox}>
				<IconSearch size={16} />
				<input
					className={styles.searchInput}
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Поиск по названию или описанию..."
				/>
			</div>

			{/* Sort + Filters row */}
			<div className={styles.toolbarRow}>
				<label className={styles.sortChip}>
					<IconSortDesc size={14} />
					<select className={styles.sortSelect} value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)} aria-label="Направление">
						<option value="desc">По убыванию</option>
						<option value="asc">По возрастанию</option>
					</select>
					<IconChevronDown size={12} />
				</label>

				<label className={styles.sortChip}>
					<IconCalendar size={14} />
					<select className={styles.sortSelect} value={sortField} onChange={e => setSortField(e.target.value as SortField)} aria-label="Поле сортировки">
						{Object.entries(SORT_FIELD_LABELS).map(([key, label]) => (
							<option key={key} value={key}>{label}</option>
						))}
					</select>
					<IconChevronDown size={12} />
				</label>

				<button
					className={`${styles.filterBtn} ${filtersActive ? styles.filterBtnActive : ''}`}
					onClick={() => setFiltersOpen(true)}
				>
					<IconFilter size={14} />
					<span>Фильтры</span>
					{filtersActive && <span className={styles.filterDot} />}
				</button>

				{filtersActive && (
					<button className={styles.resetBtn} onClick={resetFilters}>
						<IconX size={13} />
						<span>Сбросить</span>
					</button>
				)}
			</div>

			{/* Cards */}
			{loading ? (
				<div className={styles.state}><IconLoader size={22} /><span>Загрузка…</span></div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconFilm size={32} /></div>
					<h3>{baseItems.length === 0 ? (archiveMode ? 'Архив пуст' : 'Пока нет кастингов') : 'Ничего не найдено'}</h3>
					<p>
						{baseItems.length === 0
							? (archiveMode ? 'Завершённые кастинги будут отображаться здесь.' : 'Создайте свой первый кастинг.')
							: 'Попробуйте изменить запрос или фильтры.'}
					</p>
					{canCreate && baseItems.length === 0 && !archiveMode && (
						<button className={styles.emptyBtn} onClick={() => router.push('/dashboard/castings/new')}>
							Создать кастинг
						</button>
					)}
				</div>
			) : (
				<div className={styles.grid}>
					{filtered.map(c => {
						const st = statusInfo(c.status)
						const isPublished = (c.status || '').toLowerCase() === 'published'
						const publishedDate = c.published_at || (isPublished ? (c.updated_at || c.created_at) : null)
						const goDetails = () => router.push(`/dashboard/castings/${c.id}`)
						const goResponses = () => {
							const projectId = c.parent_project_id || c.id
							router.push(`/dashboard/project/${projectId}?view=responses&back=${encodeURIComponent('/dashboard/castings')}`)
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
											<span className={styles.infoCellValue}>{formatDate(publishedDate) || '—'}</span>
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

			{/* Filters drawer */}
			{filtersOpen && (
				<div className={styles.drawerOverlay} onClick={() => setFiltersOpen(false)}>
					<div className={styles.drawer} onClick={e => e.stopPropagation()}>
						<div className={styles.drawerHead}>
							<button className={styles.drawerClose} onClick={() => setFiltersOpen(false)}><IconX size={16} /></button>
							<h3>Фильтры</h3>
							<button className={styles.drawerReset} onClick={resetFilters}>
								Сбросить
							</button>
						</div>
						<div className={styles.drawerBody}>
							<div className={styles.filterGrid}>
								<div className={styles.filterCell}>
									<label className={styles.filterCellLabel}>Дата публикации, от</label>
									<input
										type="text"
										className={styles.filterInput}
										placeholder="дд.мм.гггг"
										value={filterPubFrom}
										onChange={e => setFilterPubFrom(e.target.value)}
										maxLength={10}
									/>
								</div>
								<div className={styles.filterCell}>
									<label className={styles.filterCellLabel}>Дата публикации, до</label>
									<input
										type="text"
										className={styles.filterInput}
										placeholder="дд.мм.гггг"
										value={filterPubTo}
										onChange={e => setFilterPubTo(e.target.value)}
										maxLength={10}
									/>
								</div>
								<div className={styles.filterCell}>
									<label className={styles.filterCellLabel}>Дата создания, от</label>
									<input
										type="text"
										className={styles.filterInput}
										placeholder="дд.мм.гггг"
										value={filterCreatedFrom}
										onChange={e => setFilterCreatedFrom(e.target.value)}
										maxLength={10}
									/>
								</div>
								<div className={styles.filterCell}>
									<label className={styles.filterCellLabel}>Дата создания, до</label>
									<input
										type="text"
										className={styles.filterInput}
										placeholder="дд.мм.гггг"
										value={filterCreatedTo}
										onChange={e => setFilterCreatedTo(e.target.value)}
										maxLength={10}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
