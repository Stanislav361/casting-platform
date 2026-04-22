'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
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

export default function ReportsPage() {
	const router = useRouter()
	const [reports, setReports] = useState<ReportItem[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'employer/reports/?page=1&page_size=100')
		setReports(data?.reports || [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const filtered = reports.filter(r => {
		if (!query) return true
		const q = query.toLowerCase()
		const pool = [r.title, r.casting_title, r.project_title].filter(Boolean).join(' ').toLowerCase()
		return pool.includes(q)
	})

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
		router.push(`/dashboard/project/${r.casting_id}`)
	}

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Отчёты</h1>
				<span className={styles.headerBadge}>{reports.length}</span>
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
			</div>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка отчётов…
				</div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconReport size={28} /></div>
					<h3>Отчётов пока нет</h3>
					<p>Отчёты создаются из карточки кастинга — там вы собираете шорт-лист актёров и делитесь им с заказчиком.</p>
					<button className={styles.emptyBtn} onClick={() => router.push('/dashboard')}>
						К проектам
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
											title="Перейти к проекту"
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
		</div>
	)
}
