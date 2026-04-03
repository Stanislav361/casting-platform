'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { API_URL } from '~/shared/api-url'
import {
	IconLoader,
	IconUser,
	IconX,
	IconArrowLeft,
	IconChevronUp,
	IconChevronDown,
	IconSearch,
	IconFilter,
	IconHeart,
	IconEye,
	IconCheck,
	IconClock,
	IconSortDesc,
} from '~packages/ui/icons'
import {
	formatGenderLabel,
	formatHairColorLabel,
	formatHairLengthLabel,
	formatLookTypeLabel,
	formatQualificationLabel,
} from '~/shared/profile-labels'
import styles from './page.module.scss'

type ProfileImage = {
	id: number
	photo_url: string
	crop_photo_url?: string | null
	image_type?: string | null
}

type PublicReportProfile = {
	id: number
	first_name?: string | null
	last_name?: string | null
	gender?: string | null
	height?: number | null
	date_of_birth?: string | null
	city?: string | null
	qualification?: string | null
	look_type?: string | null
	about_me?: string | null
	experience?: number | null
	clothing_size?: number | null
	shoe_size?: number | null
	hair_color?: string | null
	hair_length?: string | null
	bust_volume?: number | null
	waist_volume?: number | null
	hip_volume?: number | null
	video_intro?: string | null
	images?: ProfileImage[]
	is_favorite?: boolean
	review_status?: string
}

type PublicReportResponse = {
	report_id: number
	title: string
	profiles: PublicReportProfile[]
	updated_at?: string | null
}

type Filters = {
	city: string
	gender: string
	look_type: string
	hair_color: string
	hair_length: string
	ageFrom: string
	ageTo: string
	expFrom: string
	expTo: string
	heightFrom: string
	heightTo: string
	clothingFrom: string
	clothingTo: string
}

const EMPTY_FILTERS: Filters = {
	city: '', gender: '', look_type: '', hair_color: '', hair_length: '',
	ageFrom: '', ageTo: '', expFrom: '', expTo: '',
	heightFrom: '', heightTo: '', clothingFrom: '', clothingTo: '',
}

type TabKey = 'new' | 'accepted' | 'reserve'
type SortKey =
	| 'default'
	| 'name'
	| 'city'
	| 'gender'
	| 'age'
	| 'height'
	| 'experience'
	| 'qualification'
	| 'look_type'
	| 'hair_color'
	| 'hair_length'
	| 'clothing_size'
	| 'shoe_size'
	| 'bust_volume'
	| 'waist_volume'
	| 'hip_volume'

const TABS: { key: TabKey; label: string; dot: string }[] = [
	{ key: 'new', label: 'Новые', dot: '#94a3b8' },
	{ key: 'accepted', label: 'Принятые', dot: '#22c55e' },
	{ key: 'reserve', label: 'Резерв', dot: '#f59e0b' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
	{ value: 'default', label: 'Сортировка' },
	{ value: 'name', label: 'По имени' },
	{ value: 'city', label: 'По городу' },
	{ value: 'gender', label: 'По полу' },
	{ value: 'age', label: 'По возрасту' },
	{ value: 'height', label: 'По росту' },
	{ value: 'experience', label: 'По опыту' },
	{ value: 'qualification', label: 'По квалификации' },
	{ value: 'look_type', label: 'По типу внешности' },
	{ value: 'hair_color', label: 'По цвету волос' },
	{ value: 'hair_length', label: 'По длине волос' },
	{ value: 'clothing_size', label: 'По размеру одежды' },
	{ value: 'shoe_size', label: 'По размеру обуви' },
	{ value: 'bust_volume', label: 'По обхвату груди' },
	{ value: 'waist_volume', label: 'По обхвату талии' },
	{ value: 'hip_volume', label: 'По обхвату бёдер' },
]

const API_BASE = API_URL.replace(/\/+$/, '')

const normalizeMediaUrl = (url?: string | null) => {
	if (!url) return null
	if (url.startsWith('http://') || url.startsWith('https://')) return url
	return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

const getAge = (date?: string | null) => {
	if (!date) return null
	const birthDate = new Date(date)
	if (Number.isNaN(birthDate.getTime())) return null
	const now = new Date()
	let age = now.getFullYear() - birthDate.getFullYear()
	const monthDiff = now.getMonth() - birthDate.getMonth()
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1
	return age > 0 ? age : null
}

export default function PublicReportPage() {
	const params = useParams()
	const token = String(params.token || '')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [report, setReport] = useState<PublicReportResponse | null>(null)
	const [selectedActor, setSelectedActor] = useState<PublicReportProfile | null>(null)
	const [carouselIdx, setCarouselIdx] = useState(0)
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ main: true, about: false })
	const [searchTerm, setSearchTerm] = useState('')
	const [activeTab, setActiveTab] = useState<TabKey>('new')

	const [showFilters, setShowFilters] = useState(false)
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
	const [favorites, setFavorites] = useState<Set<number>>(new Set())
	const [showFavOnly, setShowFavOnly] = useState(false)
	const [sortKey, setSortKey] = useState<SortKey>('default')
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
	const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)

	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const fetchReport = useCallback(async () => {
		try {
			const res = await fetch(`${API_BASE}/public/shortlists/view/${token}/`)
			const data = await res.json().catch(() => null)
			if (res.ok && data) setReport(data)
		} catch { /* silent */ }
	}, [token])

	useEffect(() => {
		let mounted = true
		const load = async () => {
			setLoading(true)
			setError(null)
			try {
				const res = await fetch(`${API_BASE}/public/shortlists/view/${token}/`)
				const data = await res.json().catch(() => null)
				if (!res.ok) throw new Error(data?.detail?.message || data?.detail || 'Не удалось открыть отчёт')
				if (mounted) setReport(data)
			} catch (err: any) {
				if (mounted) setError(err?.message || 'Не удалось открыть отчёт')
			} finally {
				if (mounted) setLoading(false)
			}
		}
		if (token) load()
		return () => { mounted = false }
	}, [token])

	useEffect(() => {
		if (!token || error) return
		pollRef.current = setInterval(fetchReport, 30000)
		return () => { if (pollRef.current) clearInterval(pollRef.current) }
	}, [token, error, fetchReport])

	const allActors = useMemo(() => report?.profiles || [], [report])

	const uniqueOptions = useMemo(() => {
		const cities = new Set<string>()
		const genders = new Set<string>()
		const lookTypes = new Set<string>()
		const hairColors = new Set<string>()
		const hairLengths = new Set<string>()
		for (const a of allActors) {
			if (a.city) cities.add(a.city)
			if (a.gender) genders.add(a.gender)
			if (a.look_type) lookTypes.add(a.look_type)
			if (a.hair_color) hairColors.add(a.hair_color)
			if (a.hair_length) hairLengths.add(a.hair_length)
		}
		return {
			cities: [...cities].sort(),
			genders: [...genders],
			lookTypes: [...lookTypes],
			hairColors: [...hairColors],
			hairLengths: [...hairLengths],
		}
	}, [allActors])

	const filtersActive = useMemo(() => Object.values(filters).some(v => v !== ''), [filters])
	const sortActive = sortKey !== 'default'

	const actors = useMemo(() => {
		let list = allActors.filter(a => (a.review_status || 'new') === activeTab)

		if (showFavOnly) {
			list = list.filter(a => favorites.has(a.id))
		}
		if (searchTerm.trim()) {
			const q = searchTerm.toLowerCase()
			list = list.filter(a => {
				const name = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase()
				return name.includes(q) || (a.city || '').toLowerCase().includes(q)
			})
		}
		if (filters.city) list = list.filter(a => a.city === filters.city)
		if (filters.gender) list = list.filter(a => a.gender === filters.gender)
		if (filters.look_type) list = list.filter(a => a.look_type === filters.look_type)
		if (filters.hair_color) list = list.filter(a => a.hair_color === filters.hair_color)
		if (filters.hair_length) list = list.filter(a => a.hair_length === filters.hair_length)

		const numRange = (val: number | null | undefined, from: string, to: string) => {
			if (val == null) return false
			if (from && val < Number(from)) return false
			if (to && val > Number(to)) return false
			return true
		}
		if (filters.ageFrom || filters.ageTo) list = list.filter(a => numRange(getAge(a.date_of_birth), filters.ageFrom, filters.ageTo))
		if (filters.expFrom || filters.expTo) list = list.filter(a => numRange(a.experience, filters.expFrom, filters.expTo))
		if (filters.heightFrom || filters.heightTo) list = list.filter(a => numRange(a.height, filters.heightFrom, filters.heightTo))
		if (filters.clothingFrom || filters.clothingTo) list = list.filter(a => numRange(a.clothing_size, filters.clothingFrom, filters.clothingTo))

		if (sortKey !== 'default') {
			const getSortValue = (actor: PublicReportProfile) => {
				switch (sortKey) {
					case 'name':
						return `${actor.last_name || ''} ${actor.first_name || ''}`.trim().toLowerCase()
					case 'city':
						return (actor.city || '').toLowerCase()
					case 'gender':
						return formatGenderLabel(actor.gender).toLowerCase()
					case 'age':
						return getAge(actor.date_of_birth)
					case 'height':
						return actor.height
					case 'experience':
						return actor.experience
					case 'qualification':
						return formatQualificationLabel(actor.qualification).toLowerCase()
					case 'look_type':
						return formatLookTypeLabel(actor.look_type).toLowerCase()
					case 'hair_color':
						return formatHairColorLabel(actor.hair_color).toLowerCase()
					case 'hair_length':
						return formatHairLengthLabel(actor.hair_length).toLowerCase()
					case 'clothing_size':
						return actor.clothing_size
					case 'shoe_size':
						return actor.shoe_size
					case 'bust_volume':
						return actor.bust_volume
					case 'waist_volume':
						return actor.waist_volume
					case 'hip_volume':
						return actor.hip_volume
					default:
						return null
				}
			}

			list = [...list].sort((a, b) => {
				const left = getSortValue(a)
				const right = getSortValue(b)
				if (left == null && right == null) return 0
				if (left == null) return 1
				if (right == null) return -1
				if (typeof left === 'number' && typeof right === 'number') {
					return sortDir === 'asc' ? left - right : right - left
				}
				const result = String(left).localeCompare(String(right), 'ru', { sensitivity: 'base' })
				return sortDir === 'asc' ? result : -result
			})
		}

		return list
	}, [allActors, searchTerm, filters, showFavOnly, favorites, activeTab, sortKey, sortDir])

	const tabCounts = useMemo(() => ({
		new: allActors.filter(a => (a.review_status || 'new') === 'new').length,
		accepted: allActors.filter(a => a.review_status === 'accepted').length,
		reserve: allActors.filter(a => a.review_status === 'reserve').length,
	}), [allActors])

	const changeStatus = useCallback(async (profileId: number, newStatus: TabKey) => {
		setUpdatingStatus(profileId)
		try {
			const res = await fetch(`${API_BASE}/public/shortlists/view/${token}/profiles/${profileId}/status/?new_status=${newStatus}`, { method: 'PATCH' })
			if (res.ok) {
				setReport(prev => {
					if (!prev) return prev
					return {
						...prev,
						profiles: prev.profiles.map(p => p.id === profileId ? { ...p, review_status: newStatus } : p),
					}
				})
			}
		} catch { /* silent */ }
		setUpdatingStatus(null)
	}, [token])

	const toggleFav = useCallback((id: number, e?: React.MouseEvent) => {
		if (e) e.stopPropagation()
		setFavorites(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}, [])

	const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
	const openActor = (actor: PublicReportProfile) => { setSelectedActor(actor); setCarouselIdx(0); setExpandedSections({ main: true, about: false }) }
	const updateFilter = (key: keyof Filters, value: string) => setFilters(prev => ({ ...prev, [key]: value }))
	const resetFilters = () => {
		setFilters(EMPTY_FILTERS)
		setShowFavOnly(false)
		setSortKey('default')
		setSortDir('asc')
	}

	const SectionHead = ({ id, title }: { id: string; title: string }) => (
		<button className={styles.sectionToggle} onClick={() => toggleSection(id)}>
			<span className={styles.sectionToggleTitle}>{title}</span>
			{expandedSections[id] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
		</button>
	)

	const renderActorModal = () => {
		if (!selectedActor) return null
		const a = selectedActor
		const photos = (a.images || []).filter(img => img.image_type !== 'video')
		const fullName = `${a.last_name || ''} ${a.first_name || ''}`.trim() || 'Актёр'
		const age = getAge(a.date_of_birth)

		return (
			<div className={styles.modalOverlay} onClick={() => setSelectedActor(null)}>
				<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
					<div className={styles.modalHeader}>
						<button className={styles.modalBackBtn} onClick={() => setSelectedActor(null)}><IconArrowLeft size={16} /></button>
						<h3>{fullName}</h3>
						<button className={styles.modalClose} onClick={() => setSelectedActor(null)}><IconX size={14} /></button>
					</div>
					<div className={styles.modalBody}>
						{photos.length > 0 ? (
							<div className={styles.carousel}>
								<div className={styles.carouselMain}>
									<img src={normalizeMediaUrl(photos[carouselIdx]?.photo_url) || ''} alt="" className={styles.carouselImg} />
									{carouselIdx > 0 && <button className={`${styles.carouselNav} ${styles.carouselPrev}`} onClick={() => setCarouselIdx(carouselIdx - 1)}>&#8249;</button>}
									{carouselIdx < photos.length - 1 && <button className={`${styles.carouselNav} ${styles.carouselNext}`} onClick={() => setCarouselIdx(carouselIdx + 1)}>&#8250;</button>}
								</div>
								{photos.length > 1 && (
									<div className={styles.carouselThumbs}>
										{photos.map((img, idx) => (
											<img key={img.id} src={normalizeMediaUrl(img.crop_photo_url || img.photo_url) || ''} alt=""
												className={`${styles.carouselThumb} ${idx === carouselIdx ? styles.carouselThumbActive : ''}`}
												onClick={() => setCarouselIdx(idx)} />
										))}
									</div>
								)}
							</div>
						) : (
							<div className={styles.noPhoto}><IconUser size={48} /></div>
						)}

						<div className={styles.modalActions}>
							{a.review_status !== 'accepted' && (
								<button className={styles.modalActionAccept} onClick={() => { changeStatus(a.id, 'accepted'); setSelectedActor({ ...a, review_status: 'accepted' }) }}>
									<IconCheck size={14} /> Принять
								</button>
							)}
							{a.review_status !== 'reserve' && (
								<button className={styles.modalActionReserve} onClick={() => { changeStatus(a.id, 'reserve'); setSelectedActor({ ...a, review_status: 'reserve' }) }}>
									<IconClock size={14} /> В резерв
								</button>
							)}
							{a.review_status !== 'new' && (
								<button className={styles.modalActionNew} onClick={() => { changeStatus(a.id, 'new'); setSelectedActor({ ...a, review_status: 'new' }) }}>
									Вернуть в новые
								</button>
							)}
						</div>

						<SectionHead id="main" title="ОСНОВНОЕ" />
						{expandedSections.main && (
							<div className={styles.sectionContent}>
								<div className={styles.detailRow}><span>Возраст</span><b>{age ? `${age} лет` : '—'}</b></div>
								<div className={styles.detailRow}><span>Пол</span><b>{formatGenderLabel(a.gender)}</b></div>
								<div className={styles.detailRow}><span>Город</span><b>{a.city || '—'}</b></div>
								<div className={styles.detailRow}><span>Квалификация</span><b>{formatQualificationLabel(a.qualification)}</b></div>
								{a.experience != null && <div className={styles.detailRow}><span>Опыт</span><b>{a.experience} лет</b></div>}
								<div className={styles.detailRow}><span>Тип внешности</span><b>{formatLookTypeLabel(a.look_type, 'feminine')}</b></div>
								<div className={styles.detailRow}><span>Рост</span><b>{a.height ? `${a.height} см` : '—'}</b></div>
								<div className={styles.detailRow}><span>Размер одежды</span><b>{a.clothing_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Размер обуви</span><b>{a.shoe_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Длина волос</span><b>{formatHairLengthLabel(a.hair_length)}</b></div>
								<div className={styles.detailRow}><span>Цвет волос</span><b>{formatHairColorLabel(a.hair_color)}</b></div>
								{a.bust_volume != null && <div className={styles.detailRow}><span>Обхват груди</span><b>{a.bust_volume} см</b></div>}
								{a.waist_volume != null && <div className={styles.detailRow}><span>Обхват талии</span><b>{a.waist_volume} см</b></div>}
								{a.hip_volume != null && <div className={styles.detailRow}><span>Обхват бёдер</span><b>{a.hip_volume} см</b></div>}
							</div>
						)}

						<SectionHead id="about" title="О СЕБЕ" />
						{expandedSections.about && (
							<div className={styles.sectionContent}>
								<p className={styles.aboutText}>{a.about_me || 'Информация отсутствует'}</p>
							</div>
						)}

						{a.video_intro && (
							<>
								<SectionHead id="video" title="ВИДЕО" />
								{expandedSections.video && (
									<div className={styles.sectionContent}>
										<a href={a.video_intro} target="_blank" rel="noreferrer" className={styles.videoLink}>Смотреть видеовизитку</a>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		)
	}

	const renderFilterDrawer = () => {
		if (!showFilters) return null
		const SelectField = ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
			<div className={styles.filterField}>
				<label>{label}</label>
				<select value={value} onChange={e => onChange(e.target.value)} className={styles.filterSelect}>
					<option value="">Не выбрано</option>
					{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
				</select>
			</div>
		)
		const RangeField = ({ label, fromVal, toVal, fromKey, toKey }: { label: string; fromVal: string; toVal: string; fromKey: keyof Filters; toKey: keyof Filters }) => (
			<div className={styles.filterRange}>
				<div className={styles.filterRangeInputs}>
					<div className={styles.filterRangeCol}><label>{label}, от</label><input type="number" value={fromVal} onChange={e => updateFilter(fromKey, e.target.value)} className={styles.filterInput} /></div>
					<div className={styles.filterRangeCol}><label>{label}, до</label><input type="number" value={toVal} onChange={e => updateFilter(toKey, e.target.value)} className={styles.filterInput} /></div>
				</div>
			</div>
		)
		return (
			<div className={styles.filterOverlay} onClick={() => setShowFilters(false)}>
				<div className={styles.filterDrawer} onClick={e => e.stopPropagation()}>
					<div className={styles.filterDrawerHead}>
						<button className={styles.filterDrawerClose} onClick={() => setShowFilters(false)}><IconX size={16} /></button>
						<h3>Фильтры</h3>
						<button className={styles.filterDrawerReset} onClick={resetFilters}>Сбросить</button>
					</div>
					<div className={styles.filterDrawerBody}>
						<SelectField label="Город" value={filters.city} options={uniqueOptions.cities.map(c => ({ value: c, label: c }))} onChange={v => updateFilter('city', v)} />
						<SelectField label="Пол" value={filters.gender} options={uniqueOptions.genders.map(g => ({ value: g, label: formatGenderLabel(g) }))} onChange={v => updateFilter('gender', v)} />
						<SelectField label="Тип внешности" value={filters.look_type} options={uniqueOptions.lookTypes.map(l => ({ value: l, label: formatLookTypeLabel(l) }))} onChange={v => updateFilter('look_type', v)} />
						<SelectField label="Цвет волос" value={filters.hair_color} options={uniqueOptions.hairColors.map(c => ({ value: c, label: formatHairColorLabel(c) }))} onChange={v => updateFilter('hair_color', v)} />
						<SelectField label="Длина волос" value={filters.hair_length} options={uniqueOptions.hairLengths.map(l => ({ value: l, label: formatHairLengthLabel(l) }))} onChange={v => updateFilter('hair_length', v)} />
						<h4 className={styles.filterRangeTitle}>Диапазоны отбора</h4>
						<RangeField label="Возраст" fromVal={filters.ageFrom} toVal={filters.ageTo} fromKey="ageFrom" toKey="ageTo" />
						<RangeField label="Опыт" fromVal={filters.expFrom} toVal={filters.expTo} fromKey="expFrom" toKey="expTo" />
						<RangeField label="Рост" fromVal={filters.heightFrom} toVal={filters.heightTo} fromKey="heightFrom" toKey="heightTo" />
						<RangeField label="Размер одежды" fromVal={filters.clothingFrom} toVal={filters.clothingTo} fromKey="clothingFrom" toKey="clothingTo" />
					</div>
				</div>
			</div>
		)
	}

	if (loading) return (
		<div className={styles.page}>
			<div className={styles.center}>
				<IconLoader size={22} />
				<span>Загружаем отчёт…</span>
			</div>
		</div>
	)

	if (error || !report) return (
		<div className={styles.page}>
			<div className={styles.errorCard}>
				<div className={styles.errorIcon}>🎭</div>
				<h1>Отчёт недоступен</h1>
				<p>{error || 'Ссылка устарела или была отключена.'}</p>
			</div>
		</div>
	)

	const updatedLabel = report?.updated_at
		? new Date(report.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
			+ ' в ' + new Date(report.updated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
		: null

	return (
		<div className={styles.page}>
			<div className={styles.content}>
				<header className={styles.reportHeader}>
					<div className={styles.reportHeaderMain}>
						<div className={styles.reportHeaderInfo}>
							<h1 className={styles.reportTitle}>{report?.title || 'Отчёт'}</h1>
							<div className={styles.reportStats}>
								<span className={styles.reportMeta}>🎭 {allActors.length} актёров</span>
								{updatedLabel && <span className={styles.reportDate}>🕐 {updatedLabel}</span>}
							</div>
						</div>
					</div>
					<div className={styles.reportSearch}>
						<IconSearch size={15} />
						<input
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Поиск по имени или городу…"
							className={styles.reportSearchInput}
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							spellCheck={false}
						/>
						{searchTerm && <button className={styles.reportSearchClear} onClick={() => setSearchTerm('')}><IconX size={12} /></button>}
					</div>
				</header>

				<nav className={styles.tabs}>
					{TABS.map(tab => (
						<button
							key={tab.key}
							className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
							onClick={() => setActiveTab(tab.key)}
						>
							<span className={styles.tabDot} style={{ background: tab.dot }} />
							{tab.label}
							{tabCounts[tab.key] > 0 && <span className={styles.tabCount}>{tabCounts[tab.key]}</span>}
						</button>
					))}
				</nav>

				<div className={styles.toolbar}>
					<button className={`${styles.toolbarBtn} ${showFavOnly ? styles.toolbarBtnActive : ''}`} onClick={() => setShowFavOnly(!showFavOnly)}>
						<IconHeart size={13} style={showFavOnly ? { fill: 'currentColor' } : {}} />
						Избранное{favorites.size > 0 ? ` (${favorites.size})` : ''}
					</button>
					<div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
						<div
							className={`${styles.toolbarBtn} ${sortActive ? styles.toolbarBtnActive : ''}`}
							style={{ maxWidth: '100%' }}
						>
							<IconSortDesc size={13} />
							<select
								value={sortKey}
								onChange={(e) => setSortKey(e.target.value as SortKey)}
								aria-label="Сортировка списка"
								style={{
									flex: 1,
									minWidth: 120,
									border: 'none',
									background: 'transparent',
									color: 'inherit',
									font: 'inherit',
									fontWeight: 600,
									cursor: 'pointer',
									outline: 'none',
									WebkitAppearance: 'none',
									appearance: 'none',
									paddingRight: 4,
								}}
							>
								{SORT_OPTIONS.map(option => (
									<option key={option.value} value={option.value}>{option.label}</option>
								))}
							</select>
						</div>
						{sortActive && (
							<button
								type="button"
								className={`${styles.toolbarBtn} ${styles.toolbarBtnActive}`}
								onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
							>
								{sortDir === 'asc' ? '↑ По возрастанию' : '↓ По убыванию'}
							</button>
						)}
					</div>
					<button className={`${styles.toolbarBtn} ${filtersActive ? styles.toolbarBtnActive : ''}`} onClick={() => setShowFilters(true)}>
						<IconFilter size={13} />
						Фильтры
						{filtersActive && <span className={styles.toolbarFilterDot} />}
					</button>
					{(filtersActive || showFavOnly || sortActive) && (
						<button className={styles.toolbarBtnReset} onClick={resetFilters}>✕ Сбросить</button>
					)}
				</div>

				<section className={styles.grid}>
					{actors.map((actor) => {
						const name = `${actor.last_name || ''} ${actor.first_name || ''}`.trim() || 'Актёр'
						const age = getAge(actor.date_of_birth)
						const primaryPhoto = normalizeMediaUrl(actor.images?.[0]?.photo_url)
						const isFav = favorites.has(actor.id)
						const hasParams = actor.height || actor.clothing_size || actor.shoe_size
						return (
							<article key={actor.id} className={styles.card}>
								<div className={styles.photoWrap} onClick={() => openActor(actor)}>
									{primaryPhoto ? (
										<img src={primaryPhoto} alt={name} className={styles.photo} />
									) : (
										<div className={styles.photoFallback}>{name.slice(0, 1).toUpperCase()}</div>
									)}
									<button className={`${styles.cardFavBtn} ${isFav ? styles.cardFavBtnActive : ''}`} onClick={(e) => toggleFav(actor.id, e)}>
										<IconHeart size={14} style={isFav ? { fill: 'currentColor' } : {}} />
									</button>
									<div className={styles.cardGradient}>
										<p className={styles.cardName}>{name}</p>
										<p className={styles.cardSub}>{[age ? `${age} лет` : null, actor.city].filter(Boolean).join(' · ') || '—'}</p>
									</div>
								</div>

								{hasParams && (
									<div className={styles.cardParams}>
										{actor.height && <span className={styles.cardParam}><i>↕</i>{actor.height} <small>см</small></span>}
										{actor.clothing_size && <span className={styles.cardParam}><i>👔</i>{actor.clothing_size}</span>}
										{actor.shoe_size && <span className={styles.cardParam}><i>👟</i>{actor.shoe_size}</span>}
									</div>
								)}

								<div className={styles.cardActions}>
									{activeTab === 'new' && (
										<>
											<button className={styles.cardAcceptBtn} disabled={updatingStatus === actor.id} onClick={() => changeStatus(actor.id, 'accepted')}>
												{updatingStatus === actor.id ? <IconLoader size={11} /> : '✓'} Принять
											</button>
											<button className={styles.cardReserveBtn} disabled={updatingStatus === actor.id} onClick={() => changeStatus(actor.id, 'reserve')}>
												Резерв
											</button>
										</>
									)}
									{activeTab === 'accepted' && (
										<button className={styles.cardReserveBtn} onClick={() => changeStatus(actor.id, 'new')}>
											← Вернуть
										</button>
									)}
									{activeTab === 'reserve' && (
										<button className={styles.cardAcceptBtn} onClick={() => changeStatus(actor.id, 'accepted')}>
											✓ Принять
										</button>
									)}
									<button className={styles.cardViewBtn} onClick={() => openActor(actor)}>
										Подробнее →
									</button>
								</div>
							</article>
						)
					})}
				</section>

				{actors.length === 0 && (
					<div className={styles.emptyState}>
						<span className={styles.emptyIcon}>
							{activeTab === 'new' ? '🆕' : activeTab === 'accepted' ? '✅' : '⭐'}
						</span>
						<p>
							{filtersActive || showFavOnly || searchTerm
								? 'Нет актёров, подходящих под выбранные фильтры'
								: activeTab === 'new' ? 'Новых актёров пока нет' : activeTab === 'accepted' ? 'Принятых актёров пока нет' : 'Резерв пуст'}
						</p>
					</div>
				)}

				<footer className={styles.reportFooter}>
					<span>Всего в отчёте: <b>{allActors.length}</b></span>
				</footer>
			</div>

			{renderActorModal()}
			{renderFilterDrawer()}
		</div>
	)
}
