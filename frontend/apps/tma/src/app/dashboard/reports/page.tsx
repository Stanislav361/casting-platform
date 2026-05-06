'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useSmartBack } from '~/shared/smart-back'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconArrowLeft,
	IconReport,
	IconLoader,
	IconSearch,
	IconFilm,
	IconCalendar,
	IconCheck,
	IconEdit,
	IconGlobe,
	IconFolder,
	IconUsers,
	IconPlus,
	IconX,
	IconFilter,
	IconSortDesc,
	IconChevronDown,
} from '~packages/ui/icons'
import styles from './reports.module.scss'

interface ReportItem {
	id: number
	title: string
	casting_id: number
	casting_title?: string | null
	project_title?: string | null
	casting_image_url?: string | null
	public_id?: string | null
	created_at: string
	actors_total?: number
	actors_via_casting?: number
	actors_without_casting?: number
}

interface CastingOption {
	id: number
	title: string
	status?: string
}

function formatDate(raw?: string): string {
	if (!raw) return ''
	try {
		const d = new Date(raw)
		if (isNaN(d.getTime())) return raw.split('T')[0] || raw
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
	} catch {
		return raw
	}
}

function todayStr(): string {
	return new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ReportsPage() {
	const router = useRouter()
	const goBack = useSmartBack('/dashboard')
	const [reports, setReports] = useState<ReportItem[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	// ─── Sort & filters ───────────────────────────────────────────────
	type SortField = 'created_at' | 'title' | 'casting_title' | 'actors_total'
	type SortOrder = 'desc' | 'asc'
	const [sortField, setSortField] = useState<SortField>('created_at')
	const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [filterCastingId, setFilterCastingId] = useState<number | ''>('')
	const [filterPublic, setFilterPublic] = useState<'all' | 'public' | 'private'>('all')
	const [filterDateFrom, setFilterDateFrom] = useState('')
	const [filterDateTo, setFilterDateTo] = useState('')

	const filtersActive = Boolean(filterCastingId || filterPublic !== 'all' || filterDateFrom || filterDateTo)
	const resetFilters = () => {
		setFilterCastingId('')
		setFilterPublic('all')
		setFilterDateFrom('')
		setFilterDateTo('')
	}

	// ─── New report modal state ───────────────────────────────────────
	const [modalOpen, setModalOpen] = useState(false)
	const [castings, setCastings] = useState<CastingOption[]>([])
	const [castingsLoading, setCastingsLoading] = useState(false)
	const [selectedCastingId, setSelectedCastingId] = useState<number | ''>('')
	const [reportTitle, setReportTitle] = useState('')
	const [creating, setCreating] = useState(false)
	const [createError, setCreateError] = useState('')
	const titleInputRef = useRef<HTMLInputElement>(null)

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'employer/reports/?page=1&page_size=100')
		setReports(data?.reports || [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const loadCastings = useCallback(async () => {
		setCastingsLoading(true)
		try {
			const projectsData = await apiCall('GET', 'employer/projects/?page=1&page_size=100')
			const projects = projectsData?.projects || projectsData?.items || []
			const allCastings = await Promise.all(
				projects.map(async (p: any) => {
					const data = await apiCall('GET', `employer/projects/${p.id}/castings/`)
					return (data?.castings || data?.items || []) as CastingOption[]
				})
			)
			setCastings(allCastings.flat())
		} catch {}
		setCastingsLoading(false)
	}, [])

	const openModal = () => {
		setModalOpen(true)
		setSelectedCastingId('')
		setReportTitle('')
		setCreateError('')
		loadCastings()
	}

	const closeModal = () => {
		if (creating) return
		setModalOpen(false)
	}

	// Auto-fill title when casting is selected
	const handleCastingSelect = (id: number | '') => {
		setSelectedCastingId(id)
		if (id) {
			const c = castings.find(c => c.id === id)
			if (c) {
				setReportTitle(`${c.title} — ${todayStr()}`)
				setTimeout(() => titleInputRef.current?.focus(), 50)
			}
		}
	}

	const createReport = async () => {
		if (!selectedCastingId || !reportTitle.trim()) return
		setCreating(true)
		setCreateError('')
		try {
			const params = new URLSearchParams({
				casting_id: String(selectedCastingId),
				title: reportTitle.trim(),
			})
			const res = await apiCall('POST', `employer/reports/create/?${params}`)
			if (res?.id) {
				setModalOpen(false)
				router.push(`/dashboard/reports/${res.id}`)
			} else {
				setCreateError(res?.detail || 'Не удалось создать отчёт')
			}
		} catch (e: any) {
			setCreateError('Ошибка при создании отчёта')
		}
		setCreating(false)
	}
	// ─────────────────────────────────────────────────────────────────

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		const dFrom = filterDateFrom ? new Date(filterDateFrom).getTime() : null
		const dTo   = filterDateTo   ? new Date(filterDateTo + 'T23:59:59').getTime() : null

		const arr = reports.filter(r => {
			if (q) {
				const pool = [r.title, r.casting_title, r.project_title].filter(Boolean).join(' ').toLowerCase()
				if (!pool.includes(q)) return false
			}
			if (filterCastingId && r.casting_id !== filterCastingId) return false
			if (filterPublic === 'public'  && !r.public_id) return false
			if (filterPublic === 'private' &&  r.public_id) return false
			if (dFrom != null) {
				const t = new Date(r.created_at).getTime()
				if (Number.isFinite(t) && t < dFrom) return false
			}
			if (dTo != null) {
				const t = new Date(r.created_at).getTime()
				if (Number.isFinite(t) && t > dTo) return false
			}
			return true
		})

		const dir = sortOrder === 'asc' ? 1 : -1
		arr.sort((a, b) => {
			let cmp = 0
			switch (sortField) {
				case 'created_at':
					cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
					break
				case 'title':
					cmp = (a.title || '').localeCompare(b.title || '', 'ru')
					break
				case 'casting_title':
					cmp = (a.casting_title || '').localeCompare(b.casting_title || '', 'ru')
					break
				case 'actors_total':
					cmp = (a.actors_total ?? 0) - (b.actors_total ?? 0)
					break
			}
			return cmp * dir
		})

		return arr
	}, [reports, query, filterCastingId, filterPublic, filterDateFrom, filterDateTo, sortField, sortOrder])

	const openReport = (r: ReportItem) => router.push(`/dashboard/reports/${r.id}`)

	const copyPublicLink = (r: ReportItem, e: React.MouseEvent) => {
		e.stopPropagation()
		if (!r.public_id) return
		const url = `${window.location.origin}/report/${r.public_id}`
		navigator.clipboard.writeText(url)
			.then(() => alert('Ссылка на отчёт скопирована'))
			.catch(() => prompt('Скопируйте ссылку:', url))
	}

	const goProject = (r: ReportItem, e: React.MouseEvent) => {
		e.stopPropagation()
		router.push(`/dashboard/castings/${r.casting_id}`)
	}

	// Уникальные кастинги для select (из загруженных отчётов)
	const castingOptions = useMemo(() => {
		const map = new Map<number, string>()
		reports.forEach(r => {
			if (r.casting_id && !map.has(r.casting_id)) {
				map.set(r.casting_id, r.casting_title || `Кастинг #${r.casting_id}`)
			}
		})
		return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
			.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
	}, [reports])

	const SORT_FIELD_LABELS: Record<SortField, string> = {
		created_at:    'По дате создания',
		title:         'По названию',
		casting_title: 'По кастингу',
		actors_total:  'По кол-ву актёров',
	}

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Отчёты</h1>
				<span className={styles.headerBadge}>{reports.length}</span>

				<button className={styles.newBtn} onClick={openModal}>
					<IconPlus size={15} />
					<span>Новый</span>
				</button>
			</div>

			<div className={styles.toolbar}>
				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						className={styles.searchInput}
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="Поиск по отчёту, кастингу или проекту…"
					/>
				</div>

				<div className={styles.toolbarRow}>
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
							<IconX size={14} />
							<span>Сбросить</span>
						</button>
					)}
				</div>
			</div>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка отчётов…
				</div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconReport size={28} /></div>
					<h3>Отчётов пока нет</h3>
					<p>Создайте первый отчёт — выберите кастинг и сформируйте шорт-лист актёров для заказчика.</p>
					<button className={styles.emptyBtn} onClick={openModal}>
						<IconPlus size={14} /> Создать отчёт
					</button>
				</div>
			) : (
				<div className={styles.cardList}>
					{filtered.map(r => {
						const cover = getCoverImage(r.casting_image_url, r.casting_id || r.title)
						const projectLabel = r.project_title || r.casting_title || '—'
						return (
							<div
								key={r.id}
								className={styles.card}
								onClick={() => openReport(r)}
								role="button"
								tabIndex={0}
							>
								<div className={styles.cardCover}>
									{cover ? (
										<img src={cover} alt="" loading="lazy" />
									) : (
										<div className={styles.cardCoverStub}><IconFilm size={26} /></div>
									)}
								</div>

								<div className={styles.cardBody}>
									<div className={styles.cardMain}>
										<h3 className={styles.cardTitle}>{r.title || 'Отчёт без названия'}</h3>

										<div className={styles.cardStats}>
											<div className={styles.stat}>
												<span className={styles.statIcon}><IconFilm size={13} /></span>
												<span className={styles.statLabel}>Кастинг</span>
												<span className={styles.statValue}>{r.casting_title || '—'}</span>
											</div>
											<div className={styles.stat}>
												<span className={styles.statIcon}><IconFolder size={13} /></span>
												<span className={styles.statLabel}>Проект</span>
												<span className={styles.statValue}>{projectLabel}</span>
											</div>
											<div className={styles.stat}>
												<span className={styles.statIcon}><IconCalendar size={13} /></span>
												<span className={styles.statLabel}>Дата</span>
												<span className={styles.statValue}>{formatDate(r.created_at)}</span>
											</div>
											<div className={styles.stat}>
												<span className={`${styles.statIcon} ${styles.statIconOk}`}><IconCheck size={13} /></span>
												<span className={styles.statLabel}>Актёры через кастинг</span>
												<span className={styles.statValue}><b>{r.actors_via_casting ?? 0}</b></span>
											</div>
											<div className={styles.stat}>
												<span className={`${styles.statIcon} ${styles.statIconMuted}`}><IconUsers size={13} /></span>
												<span className={styles.statLabel}>Актёры без кастинга</span>
												<span className={styles.statValue}><b>{r.actors_without_casting ?? 0}</b></span>
											</div>
										</div>
									</div>

									<div className={styles.cardActions} onClick={e => e.stopPropagation()}>
										<button
											className={`${styles.actionBtn} ${styles.actionPrimary}`}
											onClick={() => openReport(r)}
											title="Редактировать отчёт"
										>
											<IconEdit size={14} />
											<span>Редактировать</span>
										</button>
										<button
											className={styles.actionIcon}
											onClick={(e) => copyPublicLink(r, e)}
											disabled={!r.public_id}
											title="Скопировать публичную ссылку"
										>
											<IconGlobe size={15} />
										</button>
										<button
											className={styles.actionIcon}
											onClick={(e) => goProject(r, e)}
											title="Перейти к кастингу"
										>
											<IconFolder size={15} />
										</button>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}

			{/* ─── New Report Modal ─────────────────────────────── */}
			{modalOpen && (
				<div className={styles.modalOverlay} onClick={closeModal}>
					<div className={styles.modal} onClick={e => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<h2 className={styles.modalTitle}>Новый отчёт</h2>
							<button className={styles.modalClose} onClick={closeModal} disabled={creating}>
								<IconX size={16} />
							</button>
						</div>

						<div className={styles.modalBody}>
							<label className={styles.modalLabel}>
								Кастинг *
							</label>
							{castingsLoading ? (
								<div className={styles.modalLoading}>
									<IconLoader size={16} /> Загрузка кастингов…
								</div>
							) : castings.length === 0 ? (
								<p className={styles.modalHint}>Нет доступных кастингов. Сначала создайте кастинг.</p>
							) : (
								<select
									className={styles.modalSelect}
									value={selectedCastingId}
									onChange={e => handleCastingSelect(e.target.value ? Number(e.target.value) : '')}
								>
									<option value="">— Выберите кастинг —</option>
									{castings.map(c => (
										<option key={c.id} value={c.id}>
											{c.title}{c.status ? ` (${c.status})` : ''}
										</option>
									))}
								</select>
							)}

							<label className={styles.modalLabel} style={{ marginTop: 16 }}>
								Название отчёта *
							</label>
							<input
								ref={titleInputRef}
								className={styles.modalInput}
								value={reportTitle}
								onChange={e => setReportTitle(e.target.value)}
								placeholder="Например: Шорт-лист — Терешкова"
								maxLength={120}
								onKeyDown={e => { if (e.key === 'Enter') createReport() }}
							/>

							{createError && (
								<p className={styles.modalError}>{createError}</p>
							)}
						</div>

						<div className={styles.modalFooter}>
							<button
								className={styles.modalCancelBtn}
								onClick={closeModal}
								disabled={creating}
							>
								Отмена
							</button>
							<button
								className={styles.modalCreateBtn}
								onClick={createReport}
								disabled={creating || !selectedCastingId || !reportTitle.trim()}
							>
								{creating ? (
									<><IconLoader size={14} /> Создание…</>
								) : (
									<><IconPlus size={14} /> Создать</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ─── Filters Drawer ─────────────────────────────────── */}
			{filtersOpen && (
				<div className={styles.modalOverlay} onClick={() => setFiltersOpen(false)}>
					<div className={styles.modal} onClick={e => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<h2 className={styles.modalTitle}>
								<IconFilter size={16} /> Фильтры отчётов
							</h2>
							<button className={styles.modalClose} onClick={() => setFiltersOpen(false)}>
								<IconX size={16} />
							</button>
						</div>

						<div className={styles.modalBody}>
							<label className={styles.modalLabel}>Кастинг</label>
							<select
								className={styles.modalSelect}
								value={filterCastingId === '' ? '' : String(filterCastingId)}
								onChange={e => setFilterCastingId(e.target.value ? Number(e.target.value) : '')}
							>
								<option value="">Все кастинги</option>
								{castingOptions.map(c => (
									<option key={c.id} value={c.id}>{c.title}</option>
								))}
							</select>

							<label className={styles.modalLabel} style={{ marginTop: 14 }}>Видимость</label>
							<select
								className={styles.modalSelect}
								value={filterPublic}
								onChange={e => setFilterPublic(e.target.value as 'all' | 'public' | 'private')}
							>
								<option value="all">Все</option>
								<option value="public">С публичной ссылкой</option>
								<option value="private">Без публичной ссылки</option>
							</select>

							<label className={styles.modalLabel} style={{ marginTop: 14 }}>Дата создания</label>
							<div style={{ display: 'flex', gap: 8 }}>
								<input
									type="date"
									className={styles.modalInput}
									value={filterDateFrom}
									onChange={e => setFilterDateFrom(e.target.value)}
									placeholder="С"
									style={{ flex: 1 }}
								/>
								<input
									type="date"
									className={styles.modalInput}
									value={filterDateTo}
									onChange={e => setFilterDateTo(e.target.value)}
									placeholder="По"
									style={{ flex: 1 }}
								/>
							</div>
						</div>

						<div className={styles.modalFooter}>
							<button className={styles.modalCancelBtn} onClick={resetFilters}>
								Сбросить
							</button>
							<button className={styles.modalCreateBtn} onClick={() => setFiltersOpen(false)}>
								<IconCheck size={14} /> Применить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
