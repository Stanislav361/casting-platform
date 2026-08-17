'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { apiCall, ensureAccessToken } from '~/shared/api-client'
import { getActorPhotoFromAssets } from '~/shared/media-url'
import { useSmartBack, syncCurrentNavEntry } from '~/shared/smart-back'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { ActorMetaLine } from '~/shared/actor-meta-line'
import { getAgeFromBirthDate } from '~/shared/age'
import {
	formatGenderLabel,
	formatHairColorLabel,
	formatHairLengthLabel,
	formatLookTypeLabel,
	LOOK_TYPE_OPTIONS,
} from '~/shared/profile-labels'
import { mergeCityOptions, useRussianCities } from '~/shared/use-russian-cities'
import {
	IconArrowLeft,
	IconUsers,
	IconLoader,
	IconSearch,
	IconChevronLeft,
	IconChevronRight,
	IconX,
	IconCheck,
	IconHeart,
	IconStar,
	IconSend,
	IconEye,
	IconFilter,
} from '~packages/ui/icons'
import styles from './actors.module.scss'

type AdvFilters = {
	city: string
	metro_station: string
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
	city: '', metro_station: '', gender: '', look_type: '', hair_color: '', hair_length: '',
	ageFrom: '', ageTo: '', expFrom: '', expTo: '',
	heightFrom: '', heightTo: '', clothingFrom: '', clothingTo: '',
	shoeFrom: '', shoeTo: '', bustFrom: '', bustTo: '',
	waistFrom: '', waistTo: '', hipFrom: '', hipTo: '',
}

const ADV_FILTER_MAP: Array<[keyof AdvFilters, string]> = [
	['city', 'city'], ['metro_station', 'metro_station'], ['gender', 'gender'],
	['look_type', 'look_type'], ['hair_color', 'hair_color'], ['hair_length', 'hair_length'],
	['ageFrom', 'age_from'], ['ageTo', 'age_to'], ['expFrom', 'exp_from'], ['expTo', 'exp_to'],
	['heightFrom', 'height_from'], ['heightTo', 'height_to'],
	['clothingFrom', 'clothing_from'], ['clothingTo', 'clothing_to'],
	['shoeFrom', 'shoe_from'], ['shoeTo', 'shoe_to'],
	['bustFrom', 'bust_from'], ['bustTo', 'bust_to'],
	['waistFrom', 'waist_from'], ['waistTo', 'waist_to'],
	['hipFrom', 'hip_from'], ['hipTo', 'hip_to'],
]

function readAdvFromParams(searchParams: { get(key: string): string | null }): AdvFilters {
	const next = { ...EMPTY_ADV }
	for (const [stateKey, queryKey] of ADV_FILTER_MAP) {
		const value = searchParams.get(queryKey)
		if (value) next[stateKey] = value
	}
	return next
}

function toNum(v: number | string | null | undefined): number | null {
	if (v == null) return null
	const n = typeof v === 'string' ? parseFloat(v) : v
	return Number.isFinite(n) ? (n as number) : null
}

function inRange(v: number | null | undefined, from: string, to: string): boolean {
	if (v == null) return !from && !to
	const f = from ? parseFloat(from) : null
	const t = to ? parseFloat(to) : null
	if (f != null && v < f) return false
	if (t != null && v > t) return false
	return true
}

export default function ActorsPageWrapper() {
	return (
		<Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Загрузка...</div>}>
			<ActorsPage />
		</Suspense>
	)
}

function ActorsPage() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const startWithFavorites = searchParams.get('favorites') === 'true'
	const castingIdParam = searchParams.get('casting_id')
	const teamOwnerId = searchParams.get('team_owner_id')
	const teamQuery = teamOwnerId ? `team_owner_id=${encodeURIComponent(teamOwnerId)}` : ''
	const withTeamQuery = (path: string) => {
		if (!teamQuery) return path
		const separator = path.includes('?') ? '&' : '?'
		return `${path}${separator}${teamQuery}`
	}
	const isTeamMode = Boolean(teamOwnerId)
	const goBack = useSmartBack()
	const dialog = useDialog()
	const initialPage = (() => {
		const raw = Number(searchParams.get('page'))
		return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
	})()
	const initialSearch = searchParams.get('search') || ''

	const [token, setToken] = useState<string | null>(null)
	const [actors, setActors] = useState<any[]>([])
	const [loading, setLoading] = useState(true)
	const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({})
	const [loadError, setLoadError] = useState<string | null>(null)
	const [serverTotal, setServerTotal] = useState(0)
	const [search, setSearch] = useState(initialSearch)
	const [searchDebounced, setSearchDebounced] = useState(initialSearch)
	const [showFilters, setShowFilters] = useState(false)
	const [adv, setAdv] = useState<AdvFilters>(() => readAdvFromParams(searchParams))
	const russianCities = useRussianCities()
	const [page, setPage] = useState(initialPage)
	const PAGE_SIZE = 30
	const skipNextPageResetRef = useRef(true)
	const [favorites, setFavorites] = useState<Set<number>>(new Set())
	const [showFavOnly, setShowFavOnly] = useState(startWithFavorites)
	const [reportId, setReportId] = useState<number | null>(null)
	const [reportTitle, setReportTitle] = useState<string>('')
	const [reportCastingId, setReportCastingId] = useState<number | null>(null)
	const [availableReports, setAvailableReports] = useState<any[]>([])
	const [reportsTotal, setReportsTotal] = useState(0)
	const [showReportPicker, setShowReportPicker] = useState(false)
	const [pendingProfileId, setPendingProfileId] = useState<number | null>(null)
	const [addedToReport, setAddedToReport] = useState<Set<number>>(new Set())
	const [addingToReport, setAddingToReport] = useState<number | null>(null)
	const [reportHintOpen, setReportHintOpen] = useState(false)

	useEffect(() => {
		let cancelled = false

		const restore = async () => {
			const accessToken = await ensureAccessToken()
			if (cancelled) return
			if (!accessToken) {
				router.replace('/login')
				return
			}
			setToken(accessToken)
		}

		restore()
		return () => { cancelled = true }
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		try {
			return await apiCall(method, path, body)
		} catch {
			return null
		}
	}, [])

	useEffect(() => {
		if (!token) return
		api('GET', `employer/favorites/ids/${teamQuery ? `?${teamQuery}` : ''}`).then((data) => {
			if (data?.profile_ids) setFavorites(new Set(data.profile_ids))
		})
	}, [token, api, teamQuery])

	useEffect(() => {
		if (!token) return
		api('GET', `employer/reports/?page=1&page_size=100${teamQuery ? `&${teamQuery}` : ''}`).then(async (data) => {
			const reports = data?.reports || []
			setAvailableReports(reports)
			setReportsTotal(data?.total || reports.length)
			if (castingIdParam) {
				const existing = reports.find((r: any) => String(r.casting_id) === castingIdParam)
				if (existing) {
					setReportId(existing.id)
					setReportTitle(existing.title || 'Каст лист')
					setReportCastingId(existing.casting_id)
					const detail = await api('GET', `employer/reports/${existing.id}/`)
					if (detail?.actors) {
						setAddedToReport(new Set(detail.actors.map((a: any) => a.profile_id)))
					}
				} else {
					const res = await api('POST', `employer/reports/create/?casting_id=${castingIdParam}&title=${encodeURIComponent('Каст лист')}`)
					if (res?.id) {
						setReportId(res.id)
						setReportTitle('Каст лист')
						setReportCastingId(Number(castingIdParam))
						setAvailableReports(prev => [{ id: res.id, casting_id: Number(castingIdParam), title: 'Каст лист' }, ...prev])
						setReportsTotal(prev => Math.max(prev + 1, 1))
					}
				}
			}
		})
	}, [token, castingIdParam, api, teamQuery])

	useEffect(() => {
		const t = setTimeout(() => setSearchDebounced(search), 350)
		return () => clearTimeout(t)
	}, [search])

	useEffect(() => {
		if (!token) return
		let cancelled = false
		setLoading(true)
		setLoadError(null)

		const loadPage = async () => {
			const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
			if (searchDebounced.trim()) params.set('search', searchDebounced.trim())
			if (showFavOnly) params.set('profile_ids', Array.from(favorites).join(','))
			for (const [stateKey, queryKey] of ADV_FILTER_MAP) {
				const value = adv[stateKey]
				if (value) params.set(queryKey, value)
			}

			const data = await api('GET', `employer/actors/all/?${params.toString()}`)
			if (cancelled) return
			if (!Array.isArray(data?.respondents)) {
				setActors([])
				setServerTotal(0)
				setLoadError(typeof data?.detail === 'string' ? data.detail : 'Не удалось загрузить базу актёров')
				setLoading(false)
				return
			}
			setActors(data.respondents)
			setServerTotal(Number(data.total) || 0)
			setLoading(false)
		}

		loadPage()
		return () => { cancelled = true }
	}, [token, api, page, searchDebounced, adv, showFavOnly, favorites])

	const updateAdv = (k: keyof AdvFilters, v: string) => setAdv(prev => ({ ...prev, [k]: v }))
	const resetAdv = () => setAdv(EMPTY_ADV)
	const advActive = useMemo(() => Object.values(adv).some(Boolean), [adv])

	// Опции для селектов фильтра строим по всей загруженной базе актёров
	const uniqueOptions = useMemo(() => {
		const cities = new Set<string>()
		const genders = new Set<string>()
		const lookTypes = new Set<string>()
		const hairColors = new Set<string>()
		const hairLengths = new Set<string>()
		for (const a of actors) {
			if (a.city) cities.add(a.city)
			if (a.gender) genders.add(a.gender)
			if (a.look_type) lookTypes.add(a.look_type)
			if (a.hair_color) hairColors.add(a.hair_color)
			if (a.hair_length) hairLengths.add(a.hair_length)
		}
		return {
			cities: mergeCityOptions(russianCities, Array.from(cities)),
			genders: Array.from(new Set(['male', 'female', ...genders])),
			lookTypes: Array.from(new Set([...LOOK_TYPE_OPTIONS.map(o => o.value), ...lookTypes])),
			hairColors: Array.from(new Set(['blonde', 'brunette', 'brown', 'light_brown', 'black', 'red', 'gray', 'other', ...hairColors])),
			hairLengths: Array.from(new Set(['short', 'medium', 'long', 'bald', ...hairLengths])),
		}
	}, [actors, russianCities])

	// Станции метро зависят от выбранного города — если город не выбран, показываем все
	const metroOptions = useMemo(() => {
		const pool = adv.city ? actors.filter(a => a.city === adv.city) : actors
		const set = new Set<string>()
		for (const a of pool) {
			if (a.metro_station) set.add(String(a.metro_station))
		}
		if (adv.metro_station) set.add(adv.metro_station)
		return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru-RU'))
	}, [actors, adv.city])

	// Если сменили город и текущая станция метро больше не подходит — сбрасываем её
	useEffect(() => {
		if (adv.metro_station && !metroOptions.includes(adv.metro_station)) {
			setAdv(prev => ({ ...prev, metro_station: '' }))
		}
	}, [metroOptions, adv.metro_station])

	const matchAdv = useCallback((a: any): boolean => {
		if (adv.city && a.city !== adv.city) return false
		if (adv.metro_station && a.metro_station !== adv.metro_station) return false
		if (adv.gender && a.gender !== adv.gender) return false
		if (adv.look_type && a.look_type !== adv.look_type) return false
		if (adv.hair_color && a.hair_color !== adv.hair_color) return false
		if (adv.hair_length && a.hair_length !== adv.hair_length) return false
		const ageValue = typeof a.age === 'number' ? a.age : Number(a.age)
		const age = Number.isFinite(ageValue) && ageValue > 0 ? ageValue : getAgeFromBirthDate(a.date_of_birth)
		if (!inRange(age, adv.ageFrom, adv.ageTo)) return false
		if (!inRange(toNum(a.experience), adv.expFrom, adv.expTo)) return false
		if (!inRange(toNum(a.height), adv.heightFrom, adv.heightTo)) return false
		if (!inRange(toNum(a.clothing_size), adv.clothingFrom, adv.clothingTo)) return false
		if (!inRange(toNum(a.shoe_size), adv.shoeFrom, adv.shoeTo)) return false
		if (!inRange(toNum(a.bust_volume), adv.bustFrom, adv.bustTo)) return false
		if (!inRange(toNum(a.waist_volume), adv.waistFrom, adv.waistTo)) return false
		if (!inRange(toNum(a.hip_volume), adv.hipFrom, adv.hipTo)) return false
		return true
	}, [adv])

	const filteredActors = actors
	const total = serverTotal

	// Сбрасываем на первую страницу только при осмысленном изменении поиска/
	// фильтров пользователем — не при первом монтировании (иначе номер
	// страницы, восстановленный из URL при возврате назад, сразу же сбросится).
	useEffect(() => {
		if (skipNextPageResetRef.current) {
			skipNextPageResetRef.current = false
			return
		}
		setPage(1)
	}, [searchDebounced, adv, showFavOnly])

	// Отражаем текущую страницу/поиск/фильтры в адресе страницы, чтобы кнопка
	// «Назад» из профиля актёра возвращала ровно туда, где был пользователь.
	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams()
		if (teamOwnerId) params.set('team_owner_id', teamOwnerId)
		if (castingIdParam) params.set('casting_id', castingIdParam)
		if (showFavOnly) params.set('favorites', 'true')
		if (page > 1) params.set('page', String(page))
		if (searchDebounced.trim()) params.set('search', searchDebounced.trim())
		for (const [stateKey, queryKey] of ADV_FILTER_MAP) {
			const value = adv[stateKey]
			if (value) params.set(queryKey, value)
		}

		const qs = params.toString()
		const target = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
		const current = `${window.location.pathname}${window.location.search}`
		if (target === current) return

		window.history.replaceState(window.history.state, '', target)
		syncCurrentNavEntry()
	}, [page, searchDebounced, adv, showFavOnly, teamOwnerId, castingIdParam])

	const totalPages = Math.ceil(total / PAGE_SIZE) || 1
	const formatReportDate = (raw?: string | null) => {
		if (!raw) return ''
		const d = new Date(raw)
		if (Number.isNaN(d.getTime())) return ''
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
	}
	const safeText = (value: unknown) => {
		if (value === null || value === undefined) return null
		if (typeof value === 'string') return value.trim() || null
		if (typeof value === 'number') return String(value)
		if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
		try {
			const normalized = String(value).trim()
			return normalized && normalized !== '[object Object]' ? normalized : null
		} catch {
			return null
		}
	}
	const formatGender = (gender?: string | null) => {
		const normalized = safeText(gender)
		if (!normalized) return null
		if (normalized === 'male') return 'Мужчина'
		if (normalized === 'female') return 'Женщина'
		return normalized
	}

	const addToReport = async (profileId: number, e?: React.MouseEvent, actorProfileId?: number | null) => {
		e?.stopPropagation()
		e?.preventDefault()
		if (!profileId || addedToReport.has(profileId)) return
		if (!reportId) {
			if (availableReports.length === 0) {
				dialog.warn({
					title: 'Сначала создайте каст лист',
					message: 'Чтобы добавить актёра в каст лист, сначала создайте каст лист по кастингу.',
				})
				return
			}
			setPendingProfileId(profileId)
			setShowReportPicker(true)
			return
		}
		setAddingToReport(profileId)
		const actorParam = actorProfileId ? `&actor_profile_ids=${actorProfileId}` : ''
		const res = await api('POST', `employer/reports/${reportId}/add-actors/?profile_ids=${profileId}${actorParam}`)
		if (Number(res?.added) > 0 || Number(res?.already_exists) > 0) {
			setAddedToReport(prev => new Set(prev).add(profileId))
		} else if (res?.detail) {
			dialog.error({
				title: 'Не получилось добавить в каст лист',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		} else {
			dialog.info({
				title: 'Актёр не добавлен',
				message: 'Возможно, он уже есть в этом каст листе или выбран не тот каст лист. Нажмите «Сменить» сверху и проверьте выбор.',
			})
		}
		setAddingToReport(null)
	}

	const selectReportAndAdd = async (rId: number) => {
		const chosen = availableReports.find(r => r.id === rId)
		setReportId(rId)
		setReportTitle(chosen?.title || 'Каст лист')
		setReportCastingId(chosen?.casting_id || null)
		setShowReportPicker(false)
		const detail = await api('GET', `employer/reports/${rId}/`)
		const reportActorIds = new Set<number>()
		if (detail?.actors) {
			detail.actors.forEach((a: any) => {
				if (a.profile_id) reportActorIds.add(a.profile_id)
			})
			setAddedToReport(reportActorIds)
		}
		if (pendingProfileId && !reportActorIds.has(pendingProfileId)) {
			setAddingToReport(pendingProfileId)
			const res = await api('POST', `employer/reports/${rId}/add-actors/?profile_ids=${pendingProfileId}`)
			if (Number(res?.added) > 0 || Number(res?.already_exists) > 0) {
				setAddedToReport(prev => new Set(prev).add(pendingProfileId!))
			} else if (res?.detail) {
				dialog.error({
					title: 'Не получилось добавить в каст лист',
					message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
				})
			} else {
				dialog.info({
					title: 'Актёр не добавлен',
					message: 'Проверьте выбранный каст лист. Возможно, актёр уже был добавлен ранее.',
				})
			}
			setAddingToReport(null)
		}
		if (pendingProfileId && reportActorIds.has(pendingProfileId)) {
			setAddedToReport(prev => new Set(prev).add(pendingProfileId))
		}
		setPendingProfileId(null)
	}

	const openActor = (a: any) => {
		router.push(withTeamQuery(`/dashboard/actors/${a.profile_id}`))
	}

	const getActorPreviewPhoto = (actor: any) => getActorPhotoFromAssets(actor)

	// Недогрузившееся фото показываем инициалами, а не иконкой битой картинки.
	const markPhotoBroken = (url: string) => {
		setBrokenPhotos(prev => (prev[url] ? prev : { ...prev, [url]: true }))
	}

	const displayActors = filteredActors

	if (!token) return null

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button onClick={() => castingIdParam ? router.replace(withTeamQuery(`/dashboard/castings/${castingIdParam}`)) : goBack()} className={styles.backBtn}>
					<IconArrowLeft size={14} /> Назад
				</button>
				<div className={styles.headerTitle}>
					{showFavOnly ? <IconHeart size={16} /> : <IconUsers size={16} />}
					<h1>{showFavOnly ? (isTeamMode ? 'Избранные команды' : 'Избранные актёры') : isTeamMode ? 'База актёров команды' : 'База актёров'}</h1>
				</div>
				<span className={styles.headerCount}>{total}</span>
			</header>

			<div className={styles.content}>
				{reportId ? (
					<div className={styles.reportModeBanner}>
						<IconSend size={14} style={{ flexShrink: 0 }} />
						<div className={styles.reportModeBannerInfo}>
							<span>Актёры добавляются в каст лист: <b>{reportTitle || 'Без названия'}</b></span>
							{addedToReport.size > 0 && (
								<span className={styles.reportModeCount}>{addedToReport.size} актёров добавлено</span>
							)}
						</div>
						<div className={styles.reportModeBannerActions}>
							{availableReports.length > 0 && (
								<button
									className={styles.reportModeBannerBtn}
									onClick={() => setShowReportPicker(true)}
								>
									Сменить каст лист
								</button>
							)}
							{reportCastingId && (
								<button
									className={`${styles.reportModeBannerBtn} ${styles.reportModeBannerBtnGold}`}
									onClick={() => router.push(withTeamQuery(`/dashboard/castings/${reportCastingId}`))}
								>
									Перейти к кастингу →
								</button>
							)}
						</div>
					</div>
				) : availableReports.length > 0 ? (
					<div className={styles.reportModeBanner}>
						<IconSend size={14} style={{ flexShrink: 0 }} />
						<div className={styles.reportModeBannerInfo}>
							<span>Выберите каст лист, куда добавлять актёров</span>
							<span className={styles.reportModeCount}>Доступно каст листов: {reportsTotal || availableReports.length}</span>
						</div>
						<button
							className={`${styles.reportModeBannerBtn} ${styles.reportModeBannerBtnGold}`}
							onClick={() => setShowReportPicker(true)}
						>
							Выбрать каст лист
						</button>
					</div>
			) : null}

			{/* Inline instruction: how to add actor to report */}
			<div className={styles.reportHint}>
				<button
					type="button"
					className={styles.reportHintTitle}
					onClick={() => setReportHintOpen(open => !open)}
					aria-expanded={reportHintOpen}
				>
					<span>Как добавить актёра в каст лист</span>
					<IconChevronRight size={14} className={reportHintOpen ? styles.reportHintChevronOpen : ''} />
				</button>
				{reportHintOpen && (
					<div className={styles.reportHintSteps}>
						<div className={styles.reportHintStep}>
							<span className={styles.reportHintNum}>1</span>
							<span>Нажмите «Выбрать каст лист» в панели выше</span>
						</div>
						<div className={styles.reportHintDivider} />
						<div className={styles.reportHintStep}>
							<span className={styles.reportHintNum}>2</span>
							<span>На карточке актёра нажмите <IconCheck size={12} style={{ verticalAlign: 'middle', marginInline: 2 }} /> в правом верхнем углу</span>
						</div>
						<div className={styles.reportHintDivider} />
						<div className={styles.reportHintStep}>
							<span className={styles.reportHintNum}>3</span>
							<span>Иконка станет зелёной — актёр добавлен в каст лист</span>
						</div>
					</div>
				)}
			</div>

			<div className={styles.toolbar}>
					<div className={styles.searchWrap}>
						<IconSearch size={15} />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Поиск по имени, городу, метро или описанию..."
							className={styles.searchInput}
						/>
					</div>

					<div className={styles.filterRow}>
						<button
							className={`${styles.filterBtn} ${advActive ? styles.filterBtnActive : ''}`}
							onClick={() => setShowFilters(true)}
						>
							<IconFilter size={14} />
							<span>Фильтры</span>
							{advActive && <span className={styles.filterDot} />}
						</button>
						<button
							className={`${styles.favFilterBtn} ${!showFavOnly ? styles.favFilterBtnActive : ''}`}
							onClick={() => setShowFavOnly(false)}
						>
							Все актёры
						</button>
						{(favorites.size > 0 || showFavOnly) && (
							<button
								className={`${styles.favFilterBtn} ${showFavOnly ? styles.favFilterBtnActive : ''}`}
								onClick={() => setShowFavOnly(!showFavOnly)}
							>
								<IconHeart size={13} style={showFavOnly ? { fill: 'currentColor' } : {}} />
								Избранные ({favorites.size})
							</button>
						)}
						{advActive && (
							<button className={styles.resetFilterBtn} onClick={resetAdv} title="Сбросить фильтры">
								<IconX size={14} />
							</button>
						)}
					</div>
				</div>

				{loading ? (
					<p className={styles.center}>
						<IconLoader size={20} /> Загрузка...
					</p>
				) : loadError ? (
					<div className={styles.empty}>
						<IconUsers size={40} />
						<h3>Не удалось загрузить актёров</h3>
						<p>{loadError}</p>
					</div>
				) : displayActors.length === 0 ? (
					<div className={styles.empty}>
						<IconUsers size={40} />
						<h3>{searchDebounced ? 'Ничего не найдено' : showFavOnly ? 'Нет избранных' : 'Нет актёров'}</h3>
						<p>{searchDebounced ? 'Попробуйте изменить запрос' : showFavOnly ? 'Добавьте актёров в избранное' : 'Актёры появятся после регистрации'}</p>
					</div>
				) : (
					<>
						<div className={styles.actorGrid}>
							{displayActors.map((a: any) => {
								const firstName = safeText(a.first_name) || ''
								const lastName = safeText(a.last_name) || ''
								const displayName = safeText(a.display_name)
								const city = safeText(a.city)
								const aboutMe = safeText(a.about_me)
								const ageValue = typeof a.age === 'number' ? a.age : Number(a.age)
								const age = Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null
								const actorAge = age ?? getAgeFromBirthDate(a.date_of_birth)
								const height = safeText(a.height)
								const clothingSize = safeText(a.clothing_size)
								const shoeSize = safeText(a.shoe_size)
								const name = displayName || `${lastName} ${firstName}`.trim() || 'Актёр'
								const initials = (firstName[0] || '') + (lastName[0] || '')
								const previewPhoto = getActorPreviewPhoto(a)
								return (
									<div key={a.profile_id} className={styles.actorCard} onClick={() => openActor(a)}>
									<div className={styles.actorPhotoWrap}>
										<div className={styles.actorPhoto}>
											{previewPhoto && !brokenPhotos[previewPhoto] ? (
												<img
													src={previewPhoto}
													alt={name}
													// Явные width/height — чтобы браузер знал пропорции рамки
													// фото сразу, а не подстраивал её под конкретный снимок.
													width={480}
													height={640}
													onError={() => markPhotoBroken(previewPhoto)}
												/>
											) : (
												initials.toUpperCase() || '?'
											)}
										</div>
										<div className={styles.cardGradient}>
											<div className={styles.actorName}>{name}</div>
											<ActorMetaLine as="div" className={styles.actorSubtitle} age={actorAge} city={city} fallback="Профиль актёра" />
										</div>
										<button
											type="button"
											className={`${styles.reportBtn} ${addedToReport.has(a.profile_id) ? styles.reportBtnDone : ''}`}
											onClick={(e) => addToReport(a.profile_id, e, a.actor_profile_id)}
											disabled={addingToReport === a.profile_id || addedToReport.has(a.profile_id)}
											title={addedToReport.has(a.profile_id) ? 'В каст листе' : 'В каст лист'}
										>
											{addingToReport === a.profile_id
												? <IconLoader size={14} />
												: <IconCheck size={14} style={addedToReport.has(a.profile_id) ? { opacity: 1 } : undefined} />
											}
										</button>
									</div>
									<div className={styles.actorBody}>
										<div className={styles.actorMeta}>
										{height && (
											<span title="Рост">📏 {height} см</span>
										)}
										{clothingSize && (
											<span title="Размер одежды">👕 {clothingSize}</span>
										)}
										{shoeSize && (
											<span title="Размер обуви">👟 {shoeSize}</span>
										)}
									</div>
										<div className={styles.actorFooter}>
											<div className={styles.actorRating}>
												<IconStar size={13} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
												<span>{a.avg_rating ?? '5.0'}</span>
												{(a.review_count ?? 0) > 0 && <span className={styles.ratingCount}>({a.review_count})</span>}
											</div>
											<div className={styles.actorViewCta}>
												<IconEye size={14} />
												Открыть анкету
											</div>
										</div>
										{aboutMe && (
											<div className={styles.actorAbout}>
												{aboutMe.length > 120 ? aboutMe.slice(0, 120) + '…' : aboutMe}
											</div>
										)}
									</div>
									</div>
								)
							})}
						</div>

						{totalPages > 1 && (
							<div className={styles.pagination}>
								<button
									className={styles.pageBtn}
									disabled={page <= 1}
									onClick={() => setPage(p => p - 1)}
								>
									<IconChevronLeft size={14} /> Назад
								</button>
								<span className={styles.pageInfo}>{page} / {totalPages}</span>
								<button
									className={styles.pageBtn}
									disabled={page >= totalPages}
									onClick={() => setPage(p => p + 1)}
								>
									Далее <IconChevronRight size={14} />
								</button>
							</div>
						)}
					</>
				)}
		</div>

		{showReportPicker && (
			<div className={styles.modalOverlay} onClick={() => { setShowReportPicker(false); setPendingProfileId(null) }}>
				<div className={styles.reportPickerModal} onClick={(e) => e.stopPropagation()}>
					<div className={styles.reportPickerHeader}>
						<span>Выберите каст лист</span>
						<button className={styles.modalClose} onClick={() => { setShowReportPicker(false); setPendingProfileId(null) }}>
							<IconX size={16} />
						</button>
					</div>
				<div className={styles.reportPickerList}>
					{availableReports.map((r: any) => {
						const title = (r.title || 'Каст лист').toString().trim()
						const castingTitle = (r.casting_title || '').toString().trim()
						const titleNorm = title.toLocaleLowerCase('ru-RU')
						const castingNorm = castingTitle.toLocaleLowerCase('ru-RU')
						const showCastingTitle =
							castingTitle &&
							castingNorm !== titleNorm &&
							!titleNorm.startsWith(castingNorm) &&
							!castingNorm.startsWith(titleNorm)
						return (
							<button
								key={r.id}
								className={`${styles.reportPickerItem} ${reportId === r.id ? styles.reportPickerItemActive : ''}`}
								onClick={() => selectReportAndAdd(r.id)}
							>
								<span className={styles.reportPickerIcon}><IconSend size={15} /></span>
								<span className={styles.reportPickerInfo}>
									<span className={styles.reportPickerTitle}>{title}</span>
									{(showCastingTitle || r.created_at) && (
										<span className={styles.reportPickerMeta}>
											{showCastingTitle && (
												<span className={styles.reportPickerSub}>{castingTitle}</span>
											)}
											{r.created_at && (
												<span className={styles.reportPickerDate}>{formatReportDate(r.created_at)}</span>
											)}
										</span>
									)}
								</span>
							</button>
						)
					})}
					</div>
				</div>
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
							<label>Станция метро</label>
							<select className={styles.filterSelect} value={adv.metro_station} onChange={e => updateAdv('metro_station', e.target.value)}>
								<option value="">Все станции метро</option>
								{metroOptions.map(station => <option key={station} value={station}>м. {station}</option>)}
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
							Показать ({total})
						</button>
					</div>
				</aside>
			</div>
		)}
	</div>
	)
}
