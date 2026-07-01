'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { useSmartBack } from '~/shared/smart-back'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { formatAge, getAgeFromBirthDate } from '~/shared/age'
import {
	IconArrowLeft,
	IconCheck,
	IconEye,
	IconLoader,
	IconReport,
	IconSearch,
	IconSend,
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
	height?: number | string | null
	clothing_size?: number | string | null
	shoe_size?: number | string | null
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

function normalizeMediaUrl(url?: string | null): string | null {
	if (!url) return null
	try {
		const apiBase = new URL(API_URL, window.location.origin)
		const parsed = new URL(url, apiBase)
		if (parsed.pathname.startsWith('/uploads/')) {
			return `${apiBase.origin}${parsed.pathname}${parsed.search}`
		}
		return parsed.toString()
	} catch {
		return url
	}
}

function getActorPhoto(actor: Respondent): string | null {
	const photos = (actor.media_assets || []).filter(m => m.file_type === 'photo')
	const primary = photos.find(m => m.is_primary)
	return normalizeMediaUrl(
		primary?.thumbnail_url ||
		primary?.processed_url ||
		primary?.original_url ||
		photos[0]?.thumbnail_url ||
		photos[0]?.processed_url ||
		photos[0]?.original_url ||
		actor.photo_url ||
		null,
	)
}

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
	const [availableReports, setAvailableReports] = useState<ReportItem[]>([])
	const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
	const [selectedReportTitle, setSelectedReportTitle] = useState('')
	const [addedToReport, setAddedToReport] = useState<Set<string>>(new Set())
	const [addingToReport, setAddingToReport] = useState<string | null>(null)
	const [showReportPicker, setShowReportPicker] = useState(false)
	const [pendingProfileId, setPendingProfileId] = useState<number | null>(null)
	const [pendingActorProfileId, setPendingActorProfileId] = useState<number | null>(null)

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
			apiCall('GET', `employer/projects/${castingId}/respondents/?page=1&page_size=200`),
			apiCall('GET', `employer/reports/?page=1&page_size=100${teamParam ? `&${teamParam}` : ''}`),
		])
		if (data && !data.detail) {
			setItems(data.respondents || data.items || [])
			setTotal(data.total || (data.respondents || data.items || []).length || 0)
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
			setSelectedReportTitle(sameCastingReport.title || 'Отчёт')
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
				title: 'Не получилось добавить в отчёт',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		} else {
			await loadReportActorIds(reportId)
			dialog.info({
				title: 'Актёр не добавлен',
				message: 'Возможно, он уже есть в этом отчёте. Проверьте выбранный отчёт сверху.',
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
				title: 'Не получилось убрать из отчёта',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
			})
		} else {
			dialog.error({
				title: 'Не получилось убрать из отчёта',
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
					title: 'Сначала создайте отчёт',
					message: 'Откройте раздел «Отчёты», создайте отчёт по кастингу, потом добавьте актёров.',
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
		setSelectedReportTitle(chosen?.title || 'Отчёт')
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
		if (!q) return items
		return items.filter(actor => {
			const name = [
				actor.display_name,
				actor.last_name,
				actor.first_name,
				actor.city,
			].filter(Boolean).join(' ').toLowerCase()
			return name.includes(q)
		})
	}, [items, query])

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<div className={styles.headerTitle}>
					<IconUsers size={18} />
					<div>
						<h1>Отклики</h1>
						<p>{title}</p>
					</div>
				</div>
				<span className={styles.headerCount}>{total}</span>
			</header>

			<main className={styles.content}>
				<div className={styles.reportBanner}>
					<IconReport size={16} />
					<div className={styles.reportBannerText}>
						<b>{selectedReportId ? `Добавляем в отчёт: ${selectedReportTitle || 'Отчёт'}` : 'Выберите отчёт для добавления актёров'}</b>
						<span>
							{selectedReportId
								? 'Кнопка «В отчёт» добавит актёра именно сюда.'
								: availableReports.length > 0
									? 'Нажмите «Выбрать отчёт», потом добавляйте актёров.'
									: 'Сначала создайте отчёт в разделе «Отчёты».'}
						</span>
					</div>
					{availableReports.length > 0 ? (
						<>
							{selectedReportId && (
								<button
									type="button"
									onClick={() => router.push(withTeamQuery(`/dashboard/reports/${selectedReportId}`))}
								>
									Открыть отчёт
								</button>
							)}
							<button type="button" onClick={() => setShowReportPicker(true)}>
								{selectedReportId ? 'Сменить' : 'Выбрать'}
							</button>
						</>
					) : (
						<button type="button" onClick={() => router.push(withTeamQuery('/dashboard/reports'))}>
							К отчётам
						</button>
					)}
				</div>

				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="Поиск по имени или городу..."
					/>
				</div>

				{loading ? (
					<div className={styles.state}>
						<IconLoader size={22} />
						<span>Загружаем отклики…</span>
					</div>
				) : filtered.length === 0 ? (
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
						{filtered.map(actor => {
							const name = actor.display_name ||
								[actor.first_name, actor.last_name].filter(Boolean).join(' ') ||
								'Актёр'
							const photo = getActorPhoto(actor)
							const meta = [
								formatAge(actor.age ?? getAgeFromBirthDate(actor.date_of_birth)),
								actor.city,
							].filter(Boolean)
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
										{photo ? <img src={photo} alt={name} /> : <span>{initials(name)}</span>}
										<div className={styles.cardGradient}>
											<h2 className={styles.cardName}>{name}</h2>
											<p className={styles.cardSub}>{meta.join(' · ') || 'Профиль актёра'}</p>
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
													<IconEye size={14} /> Профиль
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
													{isAdded ? 'Добавлен' : 'В отчёт'}
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
							<span>Выберите отчёт</span>
							<button type="button" onClick={() => { setShowReportPicker(false); setPendingProfileId(null); setPendingActorProfileId(null) }}>
								<IconX size={16} />
							</button>
						</div>
						<div className={styles.reportPickerList}>
							{availableReports.map(report => {
								const title = (report.title || 'Отчёт').toString().trim()
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
