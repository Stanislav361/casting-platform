'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import {
	IconArrowLeft,
	IconReport,
	IconLoader,
	IconSearch,
	IconUser,
	IconUsers,
	IconCheck,
	IconSend,
	IconGlobe,
	IconFolder,
	IconEye,
	IconFilter,
	IconX,
} from '~packages/ui/icons'
import {
	formatGenderLabel,
	formatHairColorLabel,
	formatHairLengthLabel,
	formatLookTypeLabel,
} from '~/shared/profile-labels'
import styles from './report-detail.module.scss'

interface ReportActor {
	profile_id: number
	actor_profile_id?: number | null
	first_name?: string | null
	last_name?: string | null
	display_name?: string | null
	gender?: string | null
	age?: number | null
	city?: string | null
	height?: number | null
	clothing_size?: number | null
	shoe_size?: number | null
	look_type?: string | null
	hair_color?: string | null
	hair_length?: string | null
	bust_volume?: number | null
	waist_volume?: number | null
	hip_volume?: number | null
	experience?: number | null
	photo_url?: string | null
	favorite?: boolean
}

interface ReportDetail {
	id: number
	title: string
	public_id?: string | null
	casting_id: number
	actors: ReportActor[]
	total: number
}

interface ActorLike {
	profile_id?: number
	id?: number
	first_name?: string | null
	last_name?: string | null
	age?: number | null
	city?: string | null
	gender?: string | null
	height?: number | null
	clothing_size?: number | string | null
	shoe_size?: number | string | null
	look_type?: string | null
	hair_color?: string | null
	hair_length?: string | null
	bust_volume?: number | null
	waist_volume?: number | null
	hip_volume?: number | null
	experience?: number | null
	photo_url?: string | null
	responded_at?: string | null
	actor_status?: string | null
	actor_status_label?: string | null
}

type FilterMode = 'responded' | 'not_responded' | 'in_report' | 'all'

const FILTER_LABELS: Record<FilterMode, string> = {
	responded: 'Откликнувшиеся',
	not_responded: 'Не откликнувшиеся',
	in_report: 'В отчёте',
	all: 'Все',
}

// ─── Advanced filters ──────────────────────────────────────
type AdvFilters = {
	city: string
	gender: string
	look_type: string
	hair_color: string
	hair_length: string
	ageFrom: string; ageTo: string
	expFrom: string; expTo: string
	heightFrom: string; heightTo: string
	clothingFrom: string; clothingTo: string
	shoeFrom: string; shoeTo: string
	bustFrom: string; bustTo: string
	waistFrom: string; waistTo: string
	hipFrom: string; hipTo: string
}

const EMPTY_ADV: AdvFilters = {
	city: '', gender: '', look_type: '', hair_color: '', hair_length: '',
	ageFrom: '', ageTo: '', expFrom: '', expTo: '',
	heightFrom: '', heightTo: '', clothingFrom: '', clothingTo: '',
	shoeFrom: '', shoeTo: '', bustFrom: '', bustTo: '',
	waistFrom: '', waistTo: '', hipFrom: '', hipTo: '',
}

function inRange(v: number | null | undefined, from: string, to: string): boolean {
	if (v == null) return !from && !to
	const f = from ? parseFloat(from) : null
	const t = to ? parseFloat(to) : null
	if (f != null && v < f) return false
	if (t != null && v > t) return false
	return true
}

function toNum(v: number | string | null | undefined): number | null {
	if (v == null) return null
	const n = typeof v === 'string' ? parseFloat(v) : v
	return Number.isFinite(n) ? (n as number) : null
}

// Нормализация URL медиа: http://localhost / относительные пути → текущий API
function normalizeMediaUrl(url?: string | null): string | null {
	if (!url) return null
	try {
		const apiBase = new URL(API_URL, typeof window !== 'undefined' ? window.location.origin : undefined)
		const parsed = new URL(url, apiBase)
		if (parsed.pathname.startsWith('/uploads/')) {
			return `${apiBase.origin}${parsed.pathname}${parsed.search}`
		}
		return parsed.toString()
	} catch {
		return url
	}
}

export default function ReportDetailPage() {
	const router = useRouter()
	const params = useParams()
	const reportId = Number(params?.id)

	const [report, setReport] = useState<ReportDetail | null>(null)
	const [respondents, setRespondents] = useState<ActorLike[]>([])
	const [allActors, setAllActors] = useState<ActorLike[]>([])

	const [loading, setLoading] = useState(true)
	const [loadingAll, setLoadingAll] = useState(false)
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState<FilterMode>('responded')
	const [adding, setAdding] = useState<number | null>(null)
	const [removing, setRemoving] = useState<number | null>(null)
	const [showFilters, setShowFilters] = useState(false)
	const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV)

	// Модалка с деталями анкеты актёра (открывается по кнопке "Анкета")
	const [actorDetail, setActorDetail] = useState<any | null>(null)
	const [actorLoading, setActorLoading] = useState(false)

	const openActorProfile = useCallback(async (profileId: number) => {
		setActorLoading(true)
		setActorDetail({ profile_id: profileId })
		const data = await apiCall('GET', `employer/actors/by-profile/${profileId}/`)
		if (data && !data.detail) {
			setActorDetail(data)
		}
		setActorLoading(false)
	}, [])

	const load = useCallback(async () => {
		setLoading(true)
		const rep: ReportDetail | null = await apiCall('GET', `employer/reports/${reportId}/`)
		setReport(rep)
		if (rep?.casting_id) {
			const resp = await apiCall('GET', `employer/projects/${rep.casting_id}/respondents/?page=1&page_size=200`)
			setRespondents(resp?.respondents || resp?.items || [])
		}
		setLoading(false)
	}, [reportId])

	useEffect(() => {
		if (reportId) load()
	}, [reportId, load])

	// Лениво подгружаем всех актёров когда фильтр требует
	useEffect(() => {
		if (filter !== 'not_responded' && filter !== 'all') return
		if (allActors.length > 0) return
		let cancelled = false
		;(async () => {
			setLoadingAll(true)
			const data = await apiCall('GET', 'employer/actors/all/?page=1&page_size=500')
			if (!cancelled) {
				setAllActors((data?.respondents || data?.actors || data?.items || []) as ActorLike[])
			}
			setLoadingAll(false)
		})()
		return () => { cancelled = true }
	}, [filter, allActors.length])

	// Опции для select'ов — строим по текущему пулу (респонденты + база + отчёт)
	const uniqueOptions = useMemo(() => {
		const cities = new Set<string>()
		const genders = new Set<string>()
		const lookTypes = new Set<string>()
		const hairColors = new Set<string>()
		const hairLengths = new Set<string>()
		const feed: ActorLike[] = [
			...(report?.actors || []),
			...respondents,
			...allActors,
		]
		for (const a of feed) {
			if (a.city) cities.add(a.city)
			if (a.gender) genders.add(a.gender)
			if (a.look_type) lookTypes.add(a.look_type)
			if (a.hair_color) hairColors.add(a.hair_color)
			if (a.hair_length) hairLengths.add(a.hair_length)
		}
		return {
			cities: Array.from(cities).sort(),
			genders: Array.from(genders),
			lookTypes: Array.from(lookTypes),
			hairColors: Array.from(hairColors),
			hairLengths: Array.from(hairLengths),
		}
	}, [report, respondents, allActors])

	const updateAdv = (k: keyof AdvFilters, v: string) => setAdv(prev => ({ ...prev, [k]: v }))
	const resetAdv = () => setAdv(EMPTY_ADV)
	const advActive = useMemo(() => Object.values(adv).some(Boolean), [adv])

	const matchAdv = useCallback((a: ActorLike): boolean => {
		if (adv.city && a.city !== adv.city) return false
		if (adv.gender && a.gender !== adv.gender) return false
		if (adv.look_type && a.look_type !== adv.look_type) return false
		if (adv.hair_color && a.hair_color !== adv.hair_color) return false
		if (adv.hair_length && a.hair_length !== adv.hair_length) return false
		if (!inRange(a.age ?? null, adv.ageFrom, adv.ageTo)) return false
		if (!inRange(a.experience ?? null, adv.expFrom, adv.expTo)) return false
		if (!inRange(a.height ?? null, adv.heightFrom, adv.heightTo)) return false
		if (!inRange(toNum(a.clothing_size), adv.clothingFrom, adv.clothingTo)) return false
		if (!inRange(toNum(a.shoe_size), adv.shoeFrom, adv.shoeTo)) return false
		if (!inRange(a.bust_volume ?? null, adv.bustFrom, adv.bustTo)) return false
		if (!inRange(a.waist_volume ?? null, adv.waistFrom, adv.waistTo)) return false
		if (!inRange(a.hip_volume ?? null, adv.hipFrom, adv.hipTo)) return false
		return true
	}, [adv])

	const respondedIds = useMemo(
		() => new Set(respondents.map(r => r.profile_id)),
		[respondents],
	)
	const inReportIds = useMemo(
		() => new Set((report?.actors || []).map(a => a.profile_id)),
		[report],
	)

	const filteredList = useMemo(() => {
		const q = query.trim().toLowerCase()
		const matchQuery = (a: ActorLike) => {
			if (!q) return true
			const full = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
			const city = (a.city || '').toLowerCase()
			return full.includes(q) || city.includes(q)
		}
		const match = (a: ActorLike) => matchQuery(a) && matchAdv(a)

		if (filter === 'in_report' && report) {
			return report.actors.filter(match).map(a => ({ ...a, _kind: 'in_report' as const }))
		}
		if (filter === 'responded') {
			return respondents.filter(match).map(r => ({ ...r, _kind: 'responded' as const }))
		}
		if (filter === 'not_responded') {
			return allActors
				.filter(a => !respondedIds.has((a.profile_id ?? a.id) as number))
				.filter(match)
				.map(a => ({ ...a, _kind: 'not_responded' as const }))
		}
		// all — склеиваем (уникально по profile_id)
		const map = new Map<number, any>()
		respondents.forEach(r => map.set(r.profile_id as number, { ...r, _kind: 'responded' }))
		allActors.forEach(a => {
			const pid = (a.profile_id ?? a.id) as number
			if (!map.has(pid)) map.set(pid, { ...a, profile_id: pid, _kind: 'not_responded' })
		})
		return Array.from(map.values()).filter(match)
	}, [filter, respondents, allActors, report, query, respondedIds, matchAdv])

	const counters = useMemo(() => ({
		responded: respondents.length,
		not_responded: Math.max(0, allActors.length - respondents.filter(r => allActors.some(a => (a.profile_id ?? a.id) === r.profile_id)).length),
		in_report: report?.actors.length || 0,
		all: allActors.length,
	}), [respondents, allActors, report])

	const addToReport = useCallback(async (profileId: number) => {
		if (!report) return
		setAdding(profileId)
		const res = await apiCall('POST', `employer/reports/${report.id}/add-actors/?profile_ids=${profileId}`)
		if (res?.added !== undefined) {
			await load()
		} else if (res?.detail) {
			alert(typeof res.detail === 'string' ? res.detail : 'Не удалось добавить актёра')
		}
		setAdding(null)
	}, [report, load])

	const removeFromReport = useCallback(async (profileId: number) => {
		if (!report) return
		setRemoving(profileId)
		const res = await apiCall('DELETE', `employer/reports/${report.id}/remove-actors/?profile_ids=${profileId}`)
		if (res?.removed !== undefined) {
			await load()
		}
		setRemoving(null)
	}, [report, load])

	if (loading) {
		return (
			<div className={styles.root}>
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка отчёта…
				</div>
			</div>
		)
	}

	if (!report) {
		return (
			<div className={styles.root}>
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconReport size={28} /></div>
					<h3>Отчёт не найден</h3>
					<button className={styles.emptyBtn} onClick={() => router.push('/dashboard/reports')}>
						К списку отчётов
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.push('/dashboard/reports')}>
					<IconArrowLeft size={16} /> Отчёты
				</button>
				<div className={styles.headerMain}>
					<h1 className={styles.headerTitle}>{report.title}</h1>
					<div className={styles.headerMeta}>
						<button className={styles.metaChip} onClick={() => router.push(`/dashboard/project/${report.casting_id}`)}>
							<IconFolder size={13} /> Проект
						</button>
						{report.public_id && (
							<>
								<button
									className={styles.metaChip}
									onClick={() => window.open(`/report/${report.public_id}`, '_blank')}
								>
									<IconEye size={13} /> Публичный вид
								</button>
								<button
									className={styles.metaChip}
									onClick={() => {
										const url = `${window.location.origin}/report/${report.public_id}`
										navigator.clipboard.writeText(url).then(() => alert('Ссылка скопирована'))
											.catch(() => prompt('Скопируйте:', url))
									}}
								>
									<IconGlobe size={13} /> Скопировать ссылку
								</button>
							</>
						)}
					</div>
				</div>
			</div>

			<div className={styles.tabs}>
				{(['responded', 'not_responded', 'in_report', 'all'] as FilterMode[]).map(key => {
					const count = counters[key]
					return (
						<button
							key={key}
							className={`${styles.tab} ${filter === key ? styles.tabActive : ''}`}
							onClick={() => setFilter(key)}
						>
							{FILTER_LABELS[key]}
							<span className={styles.tabCount}>
								{key === 'not_responded' && loadingAll ? '…' : count}
							</span>
						</button>
					)
				})}
			</div>

			<div className={styles.toolbar}>
				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						className={styles.searchInput}
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="Поиск по имени или городу…"
					/>
				</div>
				<button
					className={`${styles.filterBtn} ${advActive ? styles.filterBtnActive : ''}`}
					onClick={() => setShowFilters(true)}
				>
					<IconFilter size={14} />
					<span>Фильтры</span>
					{advActive && <span className={styles.filterDot} />}
				</button>
				{advActive && (
					<button className={styles.resetBtn} onClick={resetAdv} title="Сбросить фильтры">
						<IconX size={14} />
					</button>
				)}
			</div>

			{(filter === 'not_responded' || filter === 'all') && loadingAll && allActors.length === 0 && (
				<div className={styles.state}>
					<IconLoader size={18} /> Загружаем базу актёров…
				</div>
			)}

			{filteredList.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}>
						{filter === 'responded' ? <IconSend size={26} /> : <IconUsers size={26} />}
					</div>
					<h3>
						{filter === 'responded' && 'Никто пока не откликнулся'}
						{filter === 'not_responded' && 'Все актёры уже откликнулись'}
						{filter === 'in_report' && 'В отчёте пока нет актёров'}
						{filter === 'all' && 'Актёры не найдены'}
					</h3>
					<p>
						{filter === 'responded' && 'Когда актёры откликнутся на кастинг, они появятся здесь.'}
						{filter === 'not_responded' && 'В вашей базе все актёры уже связаны с этим кастингом.'}
						{filter === 'in_report' && 'Добавляйте актёров из списка откликнувшихся.'}
						{filter === 'all' && 'Попробуйте изменить поиск.'}
					</p>
				</div>
			) : (
				<div className={styles.grid}>
					{filteredList.map((a: any) => {
						const pid = a.profile_id
						const inReport = inReportIds.has(pid)
						const responded = respondedIds.has(pid)
						const fullName = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Актёр'
						const photoUrl = normalizeMediaUrl(a.photo_url)
						return (
						<div key={`${a._kind}-${pid}`} className={`${styles.card} ${inReport ? styles.cardInReportActive : ''}`}>
							<div className={styles.cardPhoto}>
								{photoUrl ? (
									<img src={photoUrl} alt="" loading="lazy" />
								) : (
									<div className={styles.cardPhotoStub}><IconUser size={22} /></div>
								)}
								{/* Toggle "В отчёт" — правый верхний угол */}
								<button
									className={`${styles.reportToggle} ${inReport ? styles.reportToggleOn : ''}`}
									disabled={adding === pid || removing === pid}
									onClick={e => { e.stopPropagation(); inReport ? removeFromReport(pid) : addToReport(pid) }}
									title={inReport ? 'Убрать из отчёта' : 'Добавить в отчёт'}
								>
									{(adding === pid || removing === pid)
										? <IconLoader size={14} />
										: <IconCheck size={14} />}
								</button>
							</div>
							<div className={styles.cardBody}>
								<div className={styles.cardNameRow}>
									<p className={styles.cardName}>{fullName}</p>
									<span className={`${styles.respondedDot} ${responded ? styles.respondedDotGreen : styles.respondedDotGray}`}>
										<IconCheck size={10} />
									</span>
								</div>
								<div className={styles.cardMeta}>
									{a.age != null && <span>{a.age} лет</span>}
									{a.city && <span>· {a.city}</span>}
									{a.gender && <span>· {a.gender === 'female' ? 'Ж' : a.gender === 'male' ? 'М' : ''}</span>}
								</div>
								<div className={styles.cardActions}>
									<button
										className={styles.cardBtnGhost}
										onClick={() => openActorProfile(pid)}
									>
										Анкета
									</button>
								</div>
							</div>
						</div>
						)
					})}
				</div>
			)}

			{showFilters && (
				<div className={styles.filterOverlay} onClick={() => setShowFilters(false)}>
					<aside className={styles.filterPanel} onClick={e => e.stopPropagation()}>
						<div className={styles.filterHead}>
							<button className={styles.filterClose} onClick={() => setShowFilters(false)}>
								<IconX size={16} />
							</button>
							<h3>Фильтры</h3>
							<button className={styles.filterReset} onClick={resetAdv} disabled={!advActive}>
								Сбросить
							</button>
						</div>

						<div className={styles.filterBody}>
							<div className={styles.filterField}>
								<label>Город</label>
								<select className={styles.filterSelect} value={adv.city} onChange={e => updateAdv('city', e.target.value)}>
									<option value="">Не выбрано</option>
									{uniqueOptions.cities.map(c => <option key={c} value={c}>{c}</option>)}
								</select>
							</div>
							<div className={styles.filterField}>
								<label>Пол</label>
								<select className={styles.filterSelect} value={adv.gender} onChange={e => updateAdv('gender', e.target.value)}>
									<option value="">Не выбрано</option>
									{uniqueOptions.genders.map(g => <option key={g} value={g}>{formatGenderLabel(g)}</option>)}
								</select>
							</div>
							<div className={styles.filterField}>
								<label>Тип внешности</label>
								<select className={styles.filterSelect} value={adv.look_type} onChange={e => updateAdv('look_type', e.target.value)}>
									<option value="">Не выбрано</option>
									{uniqueOptions.lookTypes.map(l => <option key={l} value={l}>{formatLookTypeLabel(l)}</option>)}
								</select>
							</div>
							<div className={styles.filterField}>
								<label>Цвет волос</label>
								<select className={styles.filterSelect} value={adv.hair_color} onChange={e => updateAdv('hair_color', e.target.value)}>
									<option value="">Не выбрано</option>
									{uniqueOptions.hairColors.map(c => <option key={c} value={c}>{formatHairColorLabel(c)}</option>)}
								</select>
							</div>
							<div className={styles.filterField}>
								<label>Длина волос</label>
								<select className={styles.filterSelect} value={adv.hair_length} onChange={e => updateAdv('hair_length', e.target.value)}>
									<option value="">Не выбрано</option>
									{uniqueOptions.hairLengths.map(l => <option key={l} value={l}>{formatHairLengthLabel(l)}</option>)}
								</select>
							</div>

							<h4 className={styles.filterGroupTitle}>Диапазоны отбора</h4>

							{[
								{ label: 'Возраст', fromK: 'ageFrom', toK: 'ageTo' },
								{ label: 'Опыт', fromK: 'expFrom', toK: 'expTo' },
								{ label: 'Рост', fromK: 'heightFrom', toK: 'heightTo' },
								{ label: 'Размер одежды', fromK: 'clothingFrom', toK: 'clothingTo' },
								{ label: 'Размер обуви', fromK: 'shoeFrom', toK: 'shoeTo' },
								{ label: 'Объём груди', fromK: 'bustFrom', toK: 'bustTo' },
								{ label: 'Объём талии', fromK: 'waistFrom', toK: 'waistTo' },
								{ label: 'Объём бёдер', fromK: 'hipFrom', toK: 'hipTo' },
							].map(({ label, fromK, toK }) => (
								<div key={label} className={styles.filterRange}>
									<div className={styles.filterRangeCol}>
										<label>{label}, от</label>
										<input
											type="number"
											inputMode="decimal"
											className={styles.filterInput}
											value={adv[fromK as keyof AdvFilters]}
											onChange={e => updateAdv(fromK as keyof AdvFilters, e.target.value)}
										/>
									</div>
									<div className={styles.filterRangeCol}>
										<label>{label}, до</label>
										<input
											type="number"
											inputMode="decimal"
											className={styles.filterInput}
											value={adv[toK as keyof AdvFilters]}
											onChange={e => updateAdv(toK as keyof AdvFilters, e.target.value)}
										/>
									</div>
								</div>
							))}
						</div>

						<div className={styles.filterFooter}>
							<button className={styles.filterApply} onClick={() => setShowFilters(false)}>
								Показать ({filteredList.length})
							</button>
						</div>
					</aside>
				</div>
			)}

			{/* Модалка просмотра анкеты актёра */}
			{actorDetail && (
				<div className={styles.actorOverlay} onClick={() => setActorDetail(null)}>
					<div className={styles.actorModal} onClick={(e) => e.stopPropagation()}>
						<button className={styles.actorClose} onClick={() => setActorDetail(null)}>
							<IconX size={18} />
						</button>

						{actorLoading && !actorDetail.first_name ? (
							<div className={styles.state}>
								<IconLoader size={22} /> Загрузка анкеты…
							</div>
						) : (
							<>
								<div className={styles.actorHeader}>
									<div className={styles.actorPhotoLarge}>
										{normalizeMediaUrl(actorDetail.photo_url) ? (
											<img src={normalizeMediaUrl(actorDetail.photo_url)!} alt="" />
										) : (
											<div className={styles.cardPhotoStub}><IconUser size={36} /></div>
										)}
									</div>
									<div className={styles.actorHeadInfo}>
										<h2 className={styles.actorName}>
											{[actorDetail.first_name, actorDetail.last_name].filter(Boolean).join(' ') || 'Актёр'}
										</h2>
										<div className={styles.actorMetaRow}>
											{actorDetail.age != null && <span>{actorDetail.age} лет</span>}
											{actorDetail.city && <span>· {actorDetail.city}</span>}
											{actorDetail.gender && <span>· {actorDetail.gender === 'female' ? 'Ж' : actorDetail.gender === 'male' ? 'М' : actorDetail.gender}</span>}
										</div>
										{actorDetail.has_agent && actorDetail.agent_name && (
											<p className={styles.actorAgentBadge}>🤝 Агент: {actorDetail.agent_name}</p>
										)}
									</div>
								</div>

								{actorDetail.about_me && (
									<div className={styles.actorBlock}>
										<h4>О себе</h4>
										<p>{actorDetail.about_me}</p>
									</div>
								)}

								<div className={styles.actorStatsGrid}>
									{actorDetail.height != null && <div><span>Рост</span><b>{actorDetail.height} см</b></div>}
									{actorDetail.clothing_size && <div><span>Размер одежды</span><b>{actorDetail.clothing_size}</b></div>}
									{actorDetail.shoe_size && <div><span>Размер обуви</span><b>{actorDetail.shoe_size}</b></div>}
									{actorDetail.hair_color && <div><span>Цвет волос</span><b>{formatHairColorLabel(actorDetail.hair_color)}</b></div>}
									{actorDetail.hair_length && <div><span>Длина волос</span><b>{formatHairLengthLabel(actorDetail.hair_length)}</b></div>}
									{actorDetail.look_type && <div><span>Тип внешности</span><b>{formatLookTypeLabel(actorDetail.look_type)}</b></div>}
									{actorDetail.bust_volume != null && <div><span>Грудь</span><b>{actorDetail.bust_volume} см</b></div>}
									{actorDetail.waist_volume != null && <div><span>Талия</span><b>{actorDetail.waist_volume} см</b></div>}
									{actorDetail.hip_volume != null && <div><span>Бёдра</span><b>{actorDetail.hip_volume} см</b></div>}
									{actorDetail.experience != null && <div><span>Опыт</span><b>{actorDetail.experience} лет</b></div>}
								</div>

								{/* Контакты */}
								{(actorDetail.phone_number || actorDetail.email) && (
									<div className={styles.actorBlock}>
										<h4>Контакты</h4>
										{actorDetail.phone_number && <p>📞 {actorDetail.phone_number}</p>}
										{actorDetail.email && <p>✉ {actorDetail.email}</p>}
									</div>
								)}

								{/* Фото */}
								{Array.isArray(actorDetail.media_assets) && actorDetail.media_assets.filter((m: any) => m.file_type === 'photo').length > 0 && (
									<div className={styles.actorBlock}>
										<h4>Фото</h4>
										<div className={styles.actorPhotoGrid}>
											{actorDetail.media_assets
												.filter((m: any) => m.file_type === 'photo')
												.map((m: any) => {
													const src = normalizeMediaUrl(m.processed_url || m.original_url)
													if (!src) return null
													return (
														<a key={m.id} href={src} target="_blank" rel="noreferrer" className={styles.actorPhotoTile}>
															<img src={src} alt="" loading="lazy" />
														</a>
													)
												})}
										</div>
									</div>
								)}

								{actorDetail.video_intro && (
									<div className={styles.actorBlock}>
										<h4>Видеовизитка</h4>
										<a href={actorDetail.video_intro} target="_blank" rel="noreferrer" className={styles.videoLink}>
											{actorDetail.video_intro}
										</a>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
