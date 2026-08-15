'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getActorPhotoFromAssets } from '~/shared/media-url'
import { useSmartBack } from '~/shared/smart-back'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { getAgeFromBirthDate } from '~/shared/age'
import { ActorMetaLine } from '~/shared/actor-meta-line'
import {
	IconArrowLeft,
	IconCheck,
	IconEye,
	IconFilter,
	IconLoader,
	IconReport,
	IconSearch,
	IconSend,
	IconSortDesc,
	IconUsers,
	IconX,
} from '~packages/ui/icons'
import styles from './responses.module.scss'

interface Respondent {
	profile_id: number
	actor_profile_id?: number | null
	first_name?: string | null
	last_name?: string | null
	display_name?: string | null
	age?: number | null
	date_of_birth?: string | null
	city?: string | null
	metro_station?: string | null
	height?: number | string | null
	clothing_size?: number | string | null
	shoe_size?: number | string | null
	experience?: number | string | null
	bust_volume?: number | string | null
	waist_volume?: number | string | null
	hip_volume?: number | string | null
	created_at?: string | null
	photo_url?: string | null
	media_assets?: Array<{
		file_type?: string | null
		processed_url?: string | null
		thumbnail_url?: string | null
		original_url?: string | null
		is_primary?: boolean | null
	}>
	responded_at?: string | null
}

interface ReportItem {
	id: number
	title?: string | null
	casting_id?: number | null
	casting_title?: string | null
	created_at?: string | null
}

type SortField =
	| 'age'
	| 'experience'
	| 'height'
	| 'clothing_size'
	| 'shoe_size'
	| 'bust_volume'
	| 'waist_volume'
	| 'hip_volume'
	| 'created_at'
	| 'response_at'

/** Набор сортировок такой же, как в админ-панели, чтобы не путать людей. */
const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
	{ value: 'response_at', label: 'По дате отклика' },
	{ value: 'created_at', label: 'По дате регистрации' },
	{ value: 'age', label: 'По возрасту' },
	{ value: 'experience', label: 'По опыту' },
	{ value: 'height', label: 'По росту' },
	{ value: 'clothing_size', label: 'По размеру одежды' },
	{ value: 'shoe_size', label: 'По размеру обуви' },
	{ value: 'bust_volume', label: 'По обхвату груди' },
	{ value: 'waist_volume', label: 'По обхвату талии' },
	{ value: 'hip_volume', label: 'По обхвату бёдер' },
]

function getActorPhoto(actor: Respondent): string | null {
	return getActorPhotoFromAssets(actor)
}

/**
 * Размеры в анкетах хранятся текстом и бывают диапазоном («46-48»),
 * поэтому для сортировки берём первое число.
 */
function numericValue(raw?: number | string | null): number | null {
	if (raw === null || raw === undefined || raw === '') return null
	if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
	const match = String(raw).match(/\d+([.,]\d+)?/)
	if (!match) return null
	const parsed = Number(match[0].replace(',', '.'))
	return Number.isFinite(parsed) ? parsed : null
}

function dateValue(raw?: string | null): number | null {
	if (!raw) return null
	const time = new Date(raw).getTime()
	return Number.isNaN(time) ? null : time
}

function sortValue(actor: Respondent, field: SortField): number | null {
	switch (field) {
		case 'age': return actor.age ?? getAgeFromBirthDate(actor.date_of_birth)
		case 'experience': return numericValue(actor.experience)
		case 'height': return numericValue(actor.height)
		case 'clothing_size': return numericValue(actor.clothing_size)
		case 'shoe_size': return numericValue(actor.shoe_size)
		case 'bust_volume': return numericValue(actor.bust_volume)
		case 'waist_volume': return numericValue(actor.waist_volume)
		case 'hip_volume': return numericValue(actor.hip_volume)
		case 'created_at': return dateValue(actor.created_at)
		case 'response_at': return dateValue(actor.responded_at)
		default: return null
	}
}

const RESPONDENTS_PAGE_SIZE = 200
/** Страховка от бесконечного цикла, если бэкенд начнёт возвращать одну и ту же страницу. */
const RESPONDENTS_MAX_PAGES = 15

function reportActorKey(profileId?: number | null, actorProfileId?: number | null): string {
	return actorProfileId ? `${profileId || 0}:${actorProfileId}` : `${profileId || 0}:legacy`
}

function formatDate(raw?: string | null): string {
	if (!raw) return ''
	const date = new Date(raw)
	if (Number.isNaN(date.getTime())) return ''
	return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

function initials(name: string): string {
	return name
		.split(/\s+/)
		.map(part => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join('')
		.toUpperCase() || '?'
}

export default function CastingResponsesPage() {
	return (
		<Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Загрузка...</div>}>
			<CastingResponsesPageInner />
		</Suspense>
	)
}

function CastingResponsesPageInner() {
	const params = useParams()
	const router = useRouter()
	const searchParams = useSearchParams()
	const castingId = Number(params.id)
	const goBack = useSmartBack(`/dashboard/castings/${castingId}`)
	const dialog = useDialog()
	const teamOwnerId = searchParams.get('team_owner_id')
	const teamParam = teamOwnerId ? `team_owner_id=${encodeURIComponent(teamOwnerId)}` : ''
	const withTeamQuery = (path: string) => {
		if (!teamParam) return path
		const separator = path.includes('?') ? '&' : '?'
		return `${path}${separator}${teamParam}`
	}

	const [items, setItems] = useState<Respondent[]>([])
	const [title, setTitle] = useState('Кастинг')
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')
	const [metroFilter, setMetroFilter] = useState('')
	const [sortField, setSortField] = useState<SortField>('response_at')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
	const [availableReports, setAvailableReports] = useState<ReportItem[]>([])
	const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
	const [selectedReportTitle, setSelectedReportTitle] = useState('')
	const [addedToReport, setAddedToReport] = useState<Set<string>>(new Set())
	const [addingToReport, setAddingToReport] = useState<string | null>(null)
	const [showReportPicker, setShowReportPicker] = useState(false)
	const [pendingProfileId, setPendingProfileId] = useState<number | null>(null)
	const [pendingActorProfileId, setPendingActorProfileId] = useState<number | null>(null)
	// Недогрузившееся фото показываем инициалами, а не иконкой битой картинки.
	const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({})

	const markPhotoBroken = useCallback((url: string) => {
		setBrokenPhotos(prev => (prev[url] ? prev : { ...prev, [url]: true }))
	}, [])

	const loadReportActorIds = useCallback(async (reportId: number) => {
		const detail = await apiCall('GET', `employer/reports/${reportId}/`)
		const ids = new Set<string>()
		if (detail?.actors) {
			detail.actors.forEach((actor: any) => {
				if (actor.profile_id) ids.add(reportActorKey(actor.profile_id, actor.actor_profile_id))
			})
		}
		setAddedToReport(ids)
		return ids
	}, [])

	const load = useCallback(async () => {
		if (!castingId) return
		setLoading(true)
		const [data, reportsData] = await Promise.all([
			apiCall('GET', `employer/projects/${castingId}/respondents/?page=1&page_size=${RESPONDENTS_PAGE_SIZE}`),
			apiCall('GET', `employer/reports/?page=1&page_size=100${teamParam ? `&${teamParam}` : ''}`),
		])
		if (data && !data.detail) {
			const collected: Respondent[] = data.respondents || data.items || []
			const totalCount = data.total || collected.length || 0
			// Поиск и сортировка считаются по загруженному списку, поэтому у крупных
			// кастингов догружаем остальные страницы: иначе «по росту» отсортирует
			// только первые отклики, а остальные просто не появятся.
			if (totalCount > RESPONDENTS_PAGE_SIZE) {
				for (let page = 2; page <= RESPONDENTS_MAX_PAGES; page += 1) {
					const next = await apiCall(
						'GET',
						`employer/projects/${castingId}/respondents/?page=${page}&page_size=${RESPONDENTS_PAGE_SIZE}`,
					)
					const chunk: Respondent[] = next?.respondents || next?.items || []
					if (chunk.length === 0) break
					collected.push(...chunk)
				}
			}
			setItems(collected)
			setTotal(totalCount)
			if (data.project_title) setTitle(data.project_title)
		} else {
			setItems([])
			setTotal(0)
		}
		const reports = reportsData?.reports || []
		setAvailableReports(reports)
		const sameCastingReport = reports.find((report: ReportItem) => Number(report.casting_id) === castingId)
		if (sameCastingReport) {
			setSelectedReportId(sameCastingReport.id)
			setSelectedReportTitle(sameCastingReport.title || 'Каст лист')
			await loadReportActorIds(sameCastingReport.id)
		} else {
			setSelectedReportId(null)
			setSelectedReportTitle('')
			setAddedToReport(new Set())
		}
		setLoading(false)
	}, [castingId, loadReportActorIds, teamParam])

	useEffect(() => { load() }, [load])

	const addActorToReport = useCallback(async (reportId: number, profileId: number, actorProfileId?: number | null) => {
		const key = reportActorKey(profileId, actorProfileId)
		setAddingToReport(key)
		const actorParam = actorProfileId ? `&actor_profile_ids=${actorProfileId}` : ''
		const res = await apiCall('POST', `employer/reports/${reportId}/add-actors/?profile_ids=${profileId}${actorParam}`)
		if (Number(res?.added) > 0 || Number(res?.already_exists) > 0) {
			setAddedToReport(prev => new Set(prev).add(key))
		} else if (res?.detail) {
			dialog.error({
				title: 'Не получилось добавить в каст лист',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		} else {
			await loadReportActorIds(reportId)
			dialog.info({
				title: 'Актёр не добавлен',
				message: 'Возможно, он уже есть в этом каст листе. Проверьте выбранный каст лист сверху.',
			})
		}
		setAddingToReport(null)
	}, [dialog, loadReportActorIds])

	const removeActorFromReport = useCallback(async (reportId: number, profileId: number, actorProfileId?: number | null) => {
		const key = reportActorKey(profileId, actorProfileId)
		setAddingToReport(key)
		const actorParam = actorProfileId ? `&actor_profile_ids=${actorProfileId}` : ''
		const res = await apiCall('DELETE', `employer/reports/${reportId}/remove-actors/?profile_ids=${profileId}${actorParam}`)
		if (res?.removed !== undefined) {
			setAddedToReport(prev => {
				const next = new Set(prev)
				next.delete(key)
				return next
			})
		} else if (res?.detail) {
			dialog.error({
				title: 'Не получилось убрать из каст листа',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		} else {
			dialog.error({
				title: 'Не получилось убрать из каст листа',
				message: 'Попробуйте ещё раз через минуту.',
			})
		}
		setAddingToReport(null)
	}, [dialog])

	const addToReport = useCallback((profileId: number, actorProfileId?: number | null, e?: MouseEvent) => {
		e?.stopPropagation()
		e?.preventDefault()
		const key = reportActorKey(profileId, actorProfileId)
		if (!profileId || addingToReport === key) return
		if (selectedReportId && addedToReport.has(key)) {
			removeActorFromReport(selectedReportId, profileId, actorProfileId)
			return
		}
		if (addedToReport.has(key)) return
		if (!selectedReportId) {
			if (availableReports.length === 0) {
				dialog.warn({
					title: 'Сначала создайте каст лист',
					message: 'Откройте раздел «Каст листы», создайте каст лист по кастингу, потом добавьте актёров.',
				})
				return
			}
			setPendingProfileId(profileId)
			setPendingActorProfileId(actorProfileId || null)
			setShowReportPicker(true)
			return
		}
		addActorToReport(selectedReportId, profileId, actorProfileId)
	}, [addedToReport, addingToReport, selectedReportId, availableReports.length, dialog, addActorToReport, removeActorFromReport])

	const selectReportAndAdd = useCallback(async (reportId: number) => {
		const chosen = availableReports.find(report => report.id === reportId)
		setSelectedReportId(reportId)
		setSelectedReportTitle(chosen?.title || 'Каст лист')
		setShowReportPicker(false)
		const reportActorIds = await loadReportActorIds(reportId)
		const pendingKey = reportActorKey(pendingProfileId, pendingActorProfileId)
		if (pendingProfileId && !reportActorIds.has(pendingKey)) {
			await addActorToReport(reportId, pendingProfileId, pendingActorProfileId)
		}
		setPendingProfileId(null)
		setPendingActorProfileId(null)
	}, [availableReports, pendingProfileId, pendingActorProfileId, loadReportActorIds, addActorToReport])

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		return items.filter(actor => {
			if (metroFilter && actor.metro_station !== metroFilter) return false
			if (!q) return true
			const name = [
				actor.display_name,
				actor.last_name,
				actor.first_name,
				actor.city,
				actor.metro_station,
			].filter(Boolean).join(' ').toLowerCase()
			return name.includes(q)
		})
	}, [items, query, metroFilter])

	const visible = useMemo(() => {
		const sorted = [...filtered]
		sorted.sort((a, b) => {
			const left = sortValue(a, sortField)
			const right = sortValue(b, sortField)
			// Анкеты без значения всегда внизу: иначе при сортировке по росту
			// первыми идут те, у кого рост не указан.
			if (left === null && right === null) return 0
			if (left === null) return 1
			if (right === null) return -1
			return sortOrder === 'asc' ? left - right : right - left
		})
		return sorted
	}, [filtered, sortField, sortOrder])

	const metroOptions = useMemo(() => {
		const options = new Set<string>()
		for (const actor of items) {
			if (actor.metro_station) options.add(actor.metro_station)
		}
		return Array.from(options).sort((a, b) => a.localeCompare(b, 'ru-RU'))
	}, [items])

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<div className={styles.headerTitle}>
					<IconUsers size={18} />
					<div className={styles.headerTitleText}>
						<h1 title={title}>Отклики</h1>
					</div>
				</div>
				<span className={styles.headerCount}>{total}</span>
			</header>

			<main className={styles.content}>
				<div className={styles.reportBanner}>
					<IconReport size={16} />
					<div className={styles.reportBannerText}>
						<b>{selectedReportId ? `Добавляем в каст лист: ${selectedReportTitle || 'Каст лист'}` : 'Выберите каст лист для добавления актёров'}</b>
						<span>
							{selectedReportId
								? 'Кнопка «В каст лист» добавит актёра именно сюда.'
								: availableReports.length > 0
									? 'Нажмите «Выбрать каст лист», потом добавляйте актёров.'
									: 'Сначала создайте каст лист в разделе «Каст листы».'}
						</span>
					</div>
					<div className={styles.reportBannerActions}>
						{availableReports.length > 0 ? (
							<>
								{selectedReportId && (
									<button
										type="button"
										onClick={() => router.push(withTeamQuery(`/dashboard/reports/${selectedReportId}`))}
									>
										Открыть каст лист
									</button>
								)}
								<button type="button" onClick={() => setShowReportPicker(true)}>
									{selectedReportId ? 'Сменить' : 'Выбрать'}
								</button>
							</>
						) : (
							<button type="button" onClick={() => router.push(withTeamQuery('/dashboard/reports'))}>
								К каст листам
							</button>
						)}
					</div>
				</div>

				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="Поиск по имени, городу или метро..."
					/>
				</div>
				<div className={styles.sortRow}>
					<div className={styles.sortBox}>
						<IconSortDesc size={15} />
						<select
							value={sortOrder}
							aria-label="Направление сортировки"
							onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
						>
							<option value="desc">По убыванию</option>
							<option value="asc">По возрастанию</option>
						</select>
					</div>
					<div className={styles.sortBox}>
						<IconFilter size={15} />
						<select
							value={sortField}
							aria-label="Сортировать"
							onChange={e => setSortField(e.target.value as SortField)}
						>
							{SORT_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>{option.label}</option>
							))}
						</select>
					</div>
				</div>
				{metroOptions.length > 0 && (
					<div className={styles.searchBox}>
						<select value={metroFilter} onChange={e => setMetroFilter(e.target.value)}>
							<option value="">Все станции метро</option>
							{metroOptions.map(station => (
								<option key={station} value={station}>м. {station}</option>
							))}
						</select>
					</div>
				)}

				{loading ? (
					<div className={styles.state}>
						<IconLoader size={22} />
						<span>Загружаем отклики…</span>
					</div>
				) : visible.length === 0 ? (
					<div className={styles.empty}>
						<IconUsers size={36} />
						<h2>{items.length === 0 ? 'Пока никто не откликнулся' : 'Ничего не найдено'}</h2>
						<p>
							{items.length === 0
								? 'Когда актёры откликнутся на этот кастинг, они появятся здесь.'
								: 'Попробуйте изменить поисковый запрос.'}
						</p>
					</div>
				) : (
					<div className={styles.grid}>
						{visible.map(actor => {
							const name = actor.display_name ||
								[actor.first_name, actor.last_name].filter(Boolean).join(' ') ||
								'Актёр'
							const photo = getActorPhoto(actor)
							const age = actor.age ?? getAgeFromBirthDate(actor.date_of_birth)
							const addedKey = reportActorKey(actor.profile_id, actor.actor_profile_id)
							const isAdded = addedToReport.has(addedKey)
							const isAdding = addingToReport === addedKey
							return (
								<article
									key={`${actor.profile_id}-${actor.actor_profile_id || 'profile'}`}
									className={styles.card}
									onClick={() => router.push(withTeamQuery(`/dashboard/actors/${actor.profile_id}`))}
								>
									<div className={styles.photo}>
										{photo && !brokenPhotos[photo] ? (
											<img
												src={photo}
												alt={name}
												onError={() => markPhotoBroken(photo)}
											/>
										) : (
											<span>{initials(name)}</span>
										)}
										<div className={styles.cardGradient}>
											<h2 className={styles.cardName}>{name}</h2>
											<ActorMetaLine as="p" className={styles.cardSub} age={age} city={actor.city} fallback="Профиль актёра" />
										</div>
									</div>
									<div className={styles.body}>
										<div className={styles.params}>
											{actor.height && <span title="Рост">📏 {actor.height} см</span>}
											{actor.clothing_size && <span title="Размер одежды">👕 {actor.clothing_size}</span>}
											{actor.shoe_size && <span title="Размер обуви">👟 {actor.shoe_size}</span>}
										</div>
										<div className={styles.footer}>
											<span>{formatDate(actor.responded_at) || 'Дата отклика не указана'}</span>
											<div className={styles.actions}>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation()
														router.push(withTeamQuery(`/dashboard/actors/${actor.profile_id}`))
													}}
												>
													<IconEye size={14} /> <span className={styles.btnLabel}>Профиль</span>
												</button>
												<button
													type="button"
													className={`${styles.reportAddBtn} ${isAdded ? styles.reportAddBtnDone : ''}`}
													disabled={isAdding}
													onClick={(e) => addToReport(actor.profile_id, actor.actor_profile_id, e)}
												>
													{isAdding
														? <IconLoader size={14} />
														: isAdded
															? <IconCheck size={14} />
															: <IconSend size={14} />}
													<span className={styles.btnLabel}>{isAdded ? 'Добавлен' : 'В каст лист'}</span>
												</button>
											</div>
										</div>
									</div>
								</article>
							)
						})}
					</div>
				)}
			</main>

			{showReportPicker && (
				<div className={styles.modalOverlay} onClick={() => { setShowReportPicker(false); setPendingProfileId(null); setPendingActorProfileId(null) }}>
					<div className={styles.reportPickerModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.reportPickerHeader}>
							<span>Выберите каст лист</span>
							<button type="button" onClick={() => { setShowReportPicker(false); setPendingProfileId(null); setPendingActorProfileId(null) }}>
								<IconX size={16} />
							</button>
						</div>
						<div className={styles.reportPickerList}>
							{availableReports.map(report => {
								const title = (report.title || 'Каст лист').toString().trim()
								const castingTitle = (report.casting_title || '').toString().trim()
								const titleNorm = title.toLocaleLowerCase('ru-RU')
								const castingNorm = castingTitle.toLocaleLowerCase('ru-RU')
								const showCastingTitle =
									castingTitle &&
									castingNorm !== titleNorm &&
									!titleNorm.startsWith(castingNorm) &&
									!castingNorm.startsWith(titleNorm)
								return (
									<button
										type="button"
										key={report.id}
										className={styles.reportPickerItem}
										onClick={() => selectReportAndAdd(report.id)}
									>
										<span className={styles.reportPickerIcon}><IconSend size={15} /></span>
										<span className={styles.reportPickerInfo}>
											<b>{title}</b>
											{showCastingTitle && <small>{castingTitle}</small>}
										</span>
										{selectedReportId === report.id && <IconCheck size={16} />}
									</button>
								)
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
