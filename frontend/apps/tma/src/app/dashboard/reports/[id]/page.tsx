'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
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
	IconPlus,
} from '~packages/ui/icons'
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

interface Respondent {
	profile_id: number
	first_name?: string | null
	last_name?: string | null
	age?: number | null
	city?: string | null
	gender?: string | null
	photo_url?: string | null
	responded_at?: string | null
	actor_status?: string | null
	actor_status_label?: string | null
}

interface Actor {
	profile_id?: number
	id?: number
	first_name?: string | null
	last_name?: string | null
	age?: number | null
	city?: string | null
	gender?: string | null
	photo_url?: string | null
}

type FilterMode = 'responded' | 'not_responded' | 'in_report' | 'all'

const FILTER_LABELS: Record<FilterMode, string> = {
	responded: 'Откликнувшиеся',
	not_responded: 'Не откликнувшиеся',
	in_report: 'В отчёте',
	all: 'Все',
}

export default function ReportDetailPage() {
	const router = useRouter()
	const params = useParams()
	const reportId = Number(params?.id)

	const [report, setReport] = useState<ReportDetail | null>(null)
	const [respondents, setRespondents] = useState<Respondent[]>([])
	const [allActors, setAllActors] = useState<Actor[]>([])

	const [loading, setLoading] = useState(true)
	const [loadingAll, setLoadingAll] = useState(false)
	const [query, setQuery] = useState('')
	const [filter, setFilter] = useState<FilterMode>('responded')
	const [adding, setAdding] = useState<number | null>(null)

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
				setAllActors((data?.respondents || data?.actors || data?.items || []) as Actor[])
			}
			setLoadingAll(false)
		})()
		return () => { cancelled = true }
	}, [filter, allActors.length])

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
		const matchQuery = (a: { first_name?: string | null; last_name?: string | null; city?: string | null }) => {
			if (!q) return true
			const full = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase()
			const city = (a.city || '').toLowerCase()
			return full.includes(q) || city.includes(q)
		}

		if (filter === 'in_report' && report) {
			return report.actors.filter(matchQuery).map(a => ({ ...a, _kind: 'in_report' as const }))
		}
		if (filter === 'responded') {
			return respondents.filter(matchQuery).map(r => ({ ...r, _kind: 'responded' as const }))
		}
		if (filter === 'not_responded') {
			return allActors
				.filter(a => !respondedIds.has((a.profile_id ?? a.id) as number))
				.filter(matchQuery)
				.map(a => ({ ...a, _kind: 'not_responded' as const }))
		}
		// all — склеиваем (уникально по profile_id)
		const map = new Map<number, any>()
		respondents.forEach(r => map.set(r.profile_id, { ...r, _kind: 'responded' }))
		allActors.forEach(a => {
			const pid = (a.profile_id ?? a.id) as number
			if (!map.has(pid)) map.set(pid, { ...a, profile_id: pid, _kind: 'not_responded' })
		})
		return Array.from(map.values()).filter(matchQuery)
	}, [filter, respondents, allActors, report, query, respondedIds])

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

			<div className={styles.searchBox}>
				<IconSearch size={16} />
				<input
					className={styles.searchInput}
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Поиск по имени или городу…"
				/>
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
						return (
							<div key={`${a._kind}-${pid}`} className={styles.card}>
								<div className={styles.cardPhoto}>
									{a.photo_url ? (
										<img src={a.photo_url} alt="" loading="lazy" />
									) : (
										<div className={styles.cardPhotoStub}><IconUser size={22} /></div>
									)}
									<div className={styles.cardBadges}>
										{responded && <span className={`${styles.badge} ${styles.badgeOk}`}>Откликнулся</span>}
										{!responded && a._kind === 'not_responded' && (
											<span className={`${styles.badge} ${styles.badgeMuted}`}>Не откликался</span>
										)}
										{inReport && <span className={`${styles.badge} ${styles.badgeGold}`}>В отчёте</span>}
									</div>
								</div>
								<div className={styles.cardBody}>
									<p className={styles.cardName}>{fullName}</p>
									<div className={styles.cardMeta}>
										{a.age != null && <span>{a.age} лет</span>}
										{a.city && <span>· {a.city}</span>}
										{a.gender && <span>· {a.gender === 'female' ? 'Ж' : a.gender === 'male' ? 'М' : ''}</span>}
									</div>
									<div className={styles.cardActions}>
										<button
											className={styles.cardBtnGhost}
											onClick={() => router.push(`/cabinet/profile/${pid}`)}
										>
											Анкета
										</button>
										{!inReport && (
											<button
												className={styles.cardBtnPrimary}
												disabled={adding === pid}
												onClick={() => addToReport(pid)}
											>
												{adding === pid ? <IconLoader size={13} /> : <IconPlus size={13} />}
												В отчёт
											</button>
										)}
										{inReport && (
											<span className={styles.cardInReport}>
												<IconCheck size={13} /> Уже в отчёте
											</span>
										)}
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
