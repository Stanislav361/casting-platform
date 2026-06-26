'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { useSmartBack } from '~/shared/smart-back'
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
	LOOK_TYPE_OPTIONS,
	formatLookTypeLabel,
} from '~/shared/profile-labels'
import { mergeCityOptions, useRussianCities } from '~/shared/use-russian-cities'
import { getProfileSocials } from '~/shared/social-links'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { useRole } from '~/shared/use-role'
import toast from 'react-hot-toast'
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
	review_status?: ReviewStatus | string | null
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
	actor_profile_id?: number | null
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
	media_assets?: any[] | null
	images?: any[] | null
	responded_at?: string | null
	actor_status?: string | null
	actor_status_label?: string | null
}

type FilterMode = 'responded' | 'not_responded' | 'in_report' | 'all'
type ReviewStatus = 'new' | 'accepted' | 'reserve'
type SortMode =
	| 'default'
	| 'age_asc'
	| 'age_desc'
	| 'height_asc'
	| 'height_desc'
	| 'clothing_asc'
	| 'clothing_desc'

function reportActorKey(profileId?: number | null, actorProfileId?: number | null): string {
	return actorProfileId ? `${profileId || 0}:${actorProfileId}` : `${profileId || 0}:legacy`
}

const FILTER_LABELS: Record<FilterMode, string> = {
	responded: 'Откликнувшиеся',
	not_responded: 'Не откликнувшиеся',
	in_report: 'В отчёте',
	all: 'Все',
}

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
	new: 'Без решения',
	accepted: 'Принят',
	reserve: 'Резерв',
}

const REVIEW_STATUS_HINTS: Record<ReviewStatus, string> = {
	new: 'Получатель ещё не перенёс актёра в принят или резерв',
	accepted: 'Получатель добавил актёра в принятые',
	reserve: 'Получатель оставил актёра в резерве',
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
	{ value: 'default', label: 'По умолчанию' },
	{ value: 'age_asc', label: 'Возраст: младше сначала' },
	{ value: 'age_desc', label: 'Возраст: старше сначала' },
	{ value: 'height_asc', label: 'Рост: ниже сначала' },
	{ value: 'height_desc', label: 'Рост: выше сначала' },
	{ value: 'clothing_asc', label: 'Одежда: меньше сначала' },
	{ value: 'clothing_desc', label: 'Одежда: больше сначала' },
]

function normalizeReviewStatus(status?: string | null): ReviewStatus {
	return status === 'accepted' || status === 'reserve' ? status : 'new'
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

function sortActorValue(actor: ActorLike, sortMode: SortMode): number | null {
	if (sortMode.startsWith('age')) return toNum(actor.age)
	if (sortMode.startsWith('height')) return toNum(actor.height)
	if (sortMode.startsWith('clothing')) return toNum(actor.clothing_size)
	return null
}

function sortActorName(actor: ActorLike): string {
	return `${actor.first_name || ''} ${actor.last_name || ''}`.trim().toLocaleLowerCase('ru-RU')
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

function getMediaAssetUrl(asset?: any): string | null {
	if (!asset) return null
	return normalizeMediaUrl(
		asset.processed_url ||
		asset.thumbnail_url ||
		asset.original_url ||
		asset.crop_photo_url ||
		asset.photo_url ||
		null,
	)
}

function isPhotoAsset(asset: any): boolean {
	const type = String(asset?.file_type || asset?.image_type || 'photo').toLowerCase()
	return type === 'photo' || type === 'image'
}

function getActorPhotoUrl(actor?: any): string | null {
	if (!actor) return null
	const direct = normalizeMediaUrl(actor.photo_url || actor.avatar_url || actor.profile_photo_url)
	if (direct) return direct

	const media = Array.isArray(actor.media_assets) ? actor.media_assets : []
	const primaryAsset = media.find((m: any) => isPhotoAsset(m) && m.is_primary)
	const firstAsset = media.find((m: any) => isPhotoAsset(m))
	const mediaUrl = getMediaAssetUrl(primaryAsset || firstAsset)
	if (mediaUrl) return mediaUrl

	const images = Array.isArray(actor.images) ? actor.images : []
	const firstImage = images.find((img: any) => img?.crop_photo_url || img?.photo_url)
	return normalizeMediaUrl(firstImage?.crop_photo_url || firstImage?.photo_url || null)
}

export default function ReportDetailPage() {
	return (
		<Suspense fallback={<div className={styles.root}><div className={styles.state}><IconLoader size={22} /> Загрузка отчёта…</div></div>}>
			<ReportDetailPageInner />
		</Suspense>
	)
}

function ReportDetailPageInner() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const goBack = useSmartBack('/dashboard/reports')
	const params = useParams()
	const reportId = Number(params?.id)
	const dialog = useDialog()
	const role = useRole()
	const teamOwnerId = searchParams.get('team_owner_id')
	const teamParam = teamOwnerId ? `team_owner_id=${encodeURIComponent(teamOwnerId)}` : ''
	const withTeamQuery = (path: string) => {
		if (!teamParam) return path
		const separator = path.includes('?') ? '&' : '?'
		return `${path}${separator}${teamParam}`
	}

	const [report, setReport] = useState<ReportDetail | null>(null)
	const [respondents, setRespondents] = useState<ActorLike[]>([])
	const [allActors, setAllActors] = useState<ActorLike[]>([])

	const [loading, setLoading] = useState(true)
	const [loadingAll, setLoadingAll] = useState(false)
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState<FilterMode>('all')
	const [sortMode, setSortMode] = useState<SortMode>('default')
	const [adding, setAdding] = useState<number | null>(null)
	const [removing, setRemoving] = useState<number | null>(null)
	const [showFilters, setShowFilters] = useState(false)
	const [adv, setAdv] = useState<AdvFilters>(EMPTY_ADV)
	const russianCities = useRussianCities()
	const [clientSummaryOpen, setClientSummaryOpen] = useState(false)

	// Модалка с деталями анкеты актёра (открывается по кнопке "Анкета")
	const [actorDetail, setActorDetail] = useState<any | null>(null)
	const [actorLoading, setActorLoading] = useState(false)
	const canUseFullActorBase = Boolean(teamOwnerId) || ['owner', 'employer_pro', 'administrator', 'manager'].includes(role || '')

	useEffect(() => {
		if (!canUseFullActorBase && (filter === 'all' || filter === 'not_responded')) {
			setFilter('responded')
		}
	}, [canUseFullActorBase, filter])

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
		if (!Number.isFinite(reportId) || reportId <= 0) {
			setReport(null)
			setRespondents([])
			setLoading(false)
			return
		}
		setLoading(true)
		const rep: ReportDetail | null = await apiCall('GET', `employer/reports/${reportId}/`)
		if (!rep || (rep as any).detail || !rep.id) {
			setReport(null)
			setRespondents([])
			setLoading(false)
			return
		}
		setReport(rep)
		if (rep?.casting_id) {
			const resp = await apiCall('GET', `employer/projects/${rep.casting_id}/respondents/?page=1&page_size=200`)
			setRespondents(resp?.respondents || resp?.items || [])
		}
		setLoading(false)
	}, [reportId])

	useEffect(() => {
		load()
	}, [reportId, load])

	// Лениво подгружаем всех актёров когда фильтр требует
	useEffect(() => {
		if (!canUseFullActorBase) return
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
	}, [filter, allActors.length, canUseFullActorBase])

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
			cities: mergeCityOptions(russianCities, Array.from(cities)),
			genders: Array.from(genders),
			lookTypes: Array.from(new Set([...LOOK_TYPE_OPTIONS.map(o => o.value), ...lookTypes])),
			hairColors: Array.from(hairColors),
			hairLengths: Array.from(hairLengths),
		}
	}, [report, respondents, allActors, russianCities])

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
		() => new Set(respondents.map(r => reportActorKey(r.profile_id, r.actor_profile_id))),
		[respondents],
	)
	const inReportIds = useMemo(
		() => new Set((report?.actors || []).map(a => reportActorKey(a.profile_id, a.actor_profile_id))),
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

		let list: any[]
		if (filter === 'in_report' && report) {
			list = report.actors.filter(match).map(a => ({ ...a, _kind: 'in_report' as const }))
		} else if (filter === 'responded') {
			list = respondents.filter(match).map(r => ({ ...r, _kind: 'responded' as const }))
		} else if (filter === 'not_responded') {
			list = allActors
				.filter(a => !respondedIds.has(reportActorKey((a.profile_id ?? a.id) as number, a.actor_profile_id)))
				.filter(match)
				.map(a => ({ ...a, _kind: 'not_responded' as const }))
		} else {
			// all — склеиваем уникально по паре profile_id + actor_profile_id.
			const map = new Map<string, any>()
			respondents.forEach(r => map.set(reportActorKey(r.profile_id, r.actor_profile_id), { ...r, _kind: 'responded' }))
			allActors.forEach(a => {
				const pid = (a.profile_id ?? a.id) as number
				const key = reportActorKey(pid, a.actor_profile_id)
				if (!map.has(key)) map.set(key, { ...a, profile_id: pid, _kind: 'not_responded' })
			})
			list = Array.from(map.values()).filter(match)
		}

		if (sortMode === 'default') return list
		const direction = sortMode.endsWith('_desc') ? -1 : 1
		return [...list].sort((a, b) => {
			const av = sortActorValue(a, sortMode)
			const bv = sortActorValue(b, sortMode)
			if (av == null && bv == null) return sortActorName(a).localeCompare(sortActorName(b), 'ru')
			if (av == null) return 1
			if (bv == null) return -1
			if (av === bv) return sortActorName(a).localeCompare(sortActorName(b), 'ru')
			return (av - bv) * direction
		})
	}, [filter, respondents, allActors, report, query, respondedIds, matchAdv, sortMode])

	const counters = useMemo(() => ({
		responded: respondents.length,
		not_responded: Math.max(0, allActors.length - respondents.filter(r => allActors.some(a => (a.profile_id ?? a.id) === r.profile_id)).length),
		in_report: report?.actors.length || 0,
		all: allActors.length,
	}), [respondents, allActors, report])

	const reviewCounters = useMemo(() => {
		const initial: Record<ReviewStatus, number> = { new: 0, accepted: 0, reserve: 0 }
		for (const actor of report?.actors || []) {
			initial[normalizeReviewStatus(actor.review_status)] += 1
		}
		return initial
	}, [report])

	// Добавление/удаление обновляет состояние ЛОКАЛЬНО (без полной перезагрузки
	// через load()), иначе страница ставит loading=true, перерисовывает список и
	// прокрутка прыгает наверх. Так переключатель работает мгновенно и не сбивает
	// позицию прокрутки.
	const addToReport = useCallback(async (profileId: number, actor?: any) => {
		if (!report) return
		setAdding(profileId)
		const actorProfileId = actor?.actor_profile_id || null
		const actorParam = actorProfileId ? `&actor_profile_ids=${actorProfileId}` : ''
		const res = await apiCall('POST', `employer/reports/${report.id}/add-actors/?profile_ids=${profileId}${actorParam}`)
		if (Number(res?.added) > 0 || Number(res?.already_exists) > 0) {
			setReport(prev => {
				if (!prev) return prev
				const key = reportActorKey(profileId, actorProfileId)
				if (prev.actors.some(x => reportActorKey(x.profile_id, x.actor_profile_id) === key)) return prev
				const base = actor || { profile_id: profileId }
				const newActor = {
					...base,
					profile_id: profileId,
					actor_profile_id: actorProfileId,
					review_status: base.review_status || 'new',
				}
				return { ...prev, actors: [...prev.actors, newActor] }
			})
		} else if (res?.detail) {
			dialog.error({
				title: 'Не получилось добавить',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		} else {
			dialog.info({
				title: 'Актёр не добавлен',
				message: 'Возможно, он уже есть в отчёте или у вас нет доступа к добавлению этого актёра.',
			})
		}
		setAdding(null)
	}, [dialog, report])

	const removeFromReport = useCallback(async (profileId: number, actorProfileId?: number | null) => {
		if (!report) return
		setRemoving(profileId)
		const actorParam = actorProfileId ? `&actor_profile_ids=${actorProfileId}` : ''
		const res = await apiCall('DELETE', `employer/reports/${report.id}/remove-actors/?profile_ids=${profileId}${actorParam}`)
		if (res?.removed !== undefined) {
			setReport(prev =>
				prev ? { ...prev, actors: prev.actors.filter(x => reportActorKey(x.profile_id, x.actor_profile_id) !== reportActorKey(profileId, actorProfileId)) } : prev,
			)
		} else if (res?.detail) {
			dialog.error({
				title: 'Не получилось убрать актёра',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		} else {
			dialog.error({
				title: 'Не получилось убрать актёра',
				message: 'Попробуйте ещё раз через минуту.',
			})
		}
		setRemoving(null)
	}, [dialog, report])

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
					<button className={styles.emptyBtn} onClick={() => router.replace('/dashboard/reports')}>
						К списку отчётов
					</button>
				</div>
			</div>
		)
	}

	const openSentReport = () => {
		if (!report.public_id) return
		const returnTo = withTeamQuery(`/dashboard/reports/${report.id}`)
		window.open(`/report/${report.public_id}?return_to=${encodeURIComponent(returnTo)}`, '_blank')
	}

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Отчёты
				</button>
				<div className={styles.headerMain}>
					<h1 className={styles.headerTitle}>{report.title}</h1>
					<div className={styles.headerMeta}>
						<button className={styles.metaChip} onClick={() => router.push('/dashboard/reports/help')}>
							<IconReport size={13} /> Инструкция
						</button>
						<button className={styles.metaChip} onClick={() => router.push(withTeamQuery(`/dashboard/castings/${report.casting_id}`))}>
							<IconFolder size={13} /> Кастинг
						</button>
						{report.public_id && (
							<>
								<button
									className={styles.metaChip}
									onClick={openSentReport}
								>
									<IconEye size={13} /> Отправленный отчёт
								</button>
								<button
									className={styles.metaChip}
									onClick={() => {
										const url = `${window.location.origin}/report/${report.public_id}`
										navigator.clipboard
											.writeText(url)
											.then(() => toast.success('Ссылка скопирована'))
											.catch(() => {
												dialog.info({
													title: 'Скопируйте ссылку вручную',
													message: url,
												})
											})
									}}
								>
									<IconGlobe size={13} /> Скопировать ссылку
								</button>
							</>
						)}
					</div>
				</div>
			</div>

			{report.public_id && (
				<section className={`${styles.clientSummary} ${clientSummaryOpen ? styles.clientSummaryOpen : ''}`}>
					<div className={styles.clientSummaryHead}>
						<button
							type="button"
							className={styles.clientSummaryToggle}
							onClick={() => setClientSummaryOpen(prev => !prev)}
							aria-expanded={clientSummaryOpen}
						>
							<p className={styles.clientSummaryEyebrow}>Выбор получателя</p>
							<h2>Что отметили по отправленной ссылке</h2>
							<span>{clientSummaryOpen ? 'Скрыть статистику' : 'Показать статистику'}</span>
						</button>
						<button className={styles.clientSummaryOpenBtn} onClick={openSentReport}>
							<IconEye size={14} /> Открыть отчёт
						</button>
					</div>
					{clientSummaryOpen && (
						<div className={styles.clientStatusGrid}>
							{(['accepted', 'reserve', 'new'] as ReviewStatus[]).map(status => (
								<div key={status} className={`${styles.clientStatusCard} ${styles[`clientStatusCard_${status}`]}`}>
									<span className={styles.clientStatusCount}>{reviewCounters[status]}</span>
									<span className={styles.clientStatusName}>{REVIEW_STATUS_LABELS[status]}</span>
									<small>{REVIEW_STATUS_HINTS[status]}</small>
								</div>
							))}
						</div>
					)}
				</section>
			)}

			<div className={styles.tabs}>
				{((canUseFullActorBase ? ['all', 'responded', 'not_responded', 'in_report'] : ['responded', 'in_report']) as FilterMode[]).map(key => {
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
				<label className={styles.sortBox}>
					<span>Сортировка</span>
					<select
						className={styles.sortSelect}
						value={sortMode}
						onChange={e => setSortMode(e.target.value as SortMode)}
					>
						{SORT_OPTIONS.map(option => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
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
						const actorProfileId = a.actor_profile_id || null
						const actorKey = reportActorKey(pid, actorProfileId)
						const inReport = inReportIds.has(actorKey)
						const responded = respondedIds.has(actorKey)
						const fullName = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Актёр'
						const photoUrl = getActorPhotoUrl(a)
						const reviewStatus = normalizeReviewStatus(a.review_status)
						const cardMeta = [
							a.city ? `📍 ${a.city}` : null,
							a.age != null ? `🎂 ${a.age} лет` : null,
							a.height ? `📏 ${a.height} см` : null,
							a.clothing_size ? `👕 ${a.clothing_size}` : null,
							a.shoe_size ? `👟 ${a.shoe_size}` : null,
						].filter(Boolean)
						return (
						<div key={`${a._kind}-${actorKey}`} className={`${styles.card} ${inReport ? styles.cardInReportActive : ''}`}>
							<div className={styles.cardPhoto}>
								{photoUrl ? (
									<img src={photoUrl} alt="" loading="lazy" />
								) : (
									<div className={styles.cardPhotoStub}><IconUser size={22} /></div>
								)}
								{/* Toggle "В отчёт" — правый верхний угол */}
								<button
									type="button"
									className={`${styles.reportToggle} ${inReport ? styles.reportToggleOn : ''}`}
									disabled={adding === pid || removing === pid}
									onClick={e => { e.stopPropagation(); inReport ? removeFromReport(pid, actorProfileId) : addToReport(pid, a) }}
									title={inReport ? 'Убрать из отчёта' : 'Добавить в отчёт'}
									aria-label={inReport ? 'Убрать актёра из отчёта' : 'Добавить актёра в отчёт'}
								>
									{(adding === pid || removing === pid)
										? <IconLoader size={14} />
										: <IconCheck size={14} />}
								</button>
							</div>
							<div className={styles.cardBody}>
								<div className={styles.cardNameRow}>
									<p className={styles.cardName}>{fullName}</p>
								</div>
								<span className={`${styles.responseState} ${responded ? styles.responseStateGreen : styles.responseStateGray}`}>
									{responded ? 'Откликнулся' : 'Не откликался'}
								</span>
								<span className={`${styles.reportStateBadge} ${inReport ? styles.reportStateBadgeOn : styles.reportStateBadgeOff}`}>
									{inReport ? 'Добавлен' : 'Не добавлен'}
								</span>
								{inReport && reviewStatus !== 'new' && (
									<span className={`${styles.clientStatusBadge} ${styles[`clientStatusBadge_${reviewStatus}`]}`}>
										{REVIEW_STATUS_LABELS[reviewStatus]}
									</span>
								)}
								<div className={styles.cardMeta}>
									{cardMeta.map(item => <span key={String(item)}>{item}</span>)}
								</div>
								<div className={styles.cardActions}>
									<button
										className={styles.cardBtnGhost}
										onClick={() => openActorProfile(pid)}
									>
										Профиль
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
								<IconLoader size={22} /> Загрузка профиля…
							</div>
						) : (
							<>
								<div className={styles.actorHeader}>
									<div className={styles.actorPhotoLarge}>
										{getActorPhotoUrl(actorDetail) ? (
											<img src={getActorPhotoUrl(actorDetail)!} alt="" />
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
								{(actorDetail.phone_number || actorDetail.email || getProfileSocials(actorDetail).length > 0) && (
									<div className={styles.actorBlock}>
										<h4>Контакты</h4>
										{actorDetail.phone_number && <p>📞 {actorDetail.phone_number}</p>}
										{actorDetail.email && <p>✉ {actorDetail.email}</p>}
										{getProfileSocials(actorDetail).map(s => (
											<p key={s.key}>
												{s.label}:{' '}
												{s.href
													? <a href={s.href} target="_blank" rel="noopener noreferrer">{s.value}</a>
													: s.value}
											</p>
										))}
									</div>
								)}

								{/* Фото */}
								{Array.isArray(actorDetail.media_assets) && actorDetail.media_assets.filter(isPhotoAsset).length > 0 && (
									<div className={styles.actorBlock}>
										<h4>Фото</h4>
										<div className={styles.actorPhotoGrid}>
											{actorDetail.media_assets
												.filter(isPhotoAsset)
												.map((m: any) => {
													const src = getMediaAssetUrl(m)
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
