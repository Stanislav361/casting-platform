'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconCalendar,
	IconFilm,
	IconFolder,
	IconLoader,
	IconReport,
	IconUsers,
} from '~packages/ui/icons'
import styles from './casting-detail.module.scss'

interface Casting {
	id: number
	title: string
	description?: string | null
	status?: string | null
	image_url?: string | null
	response_count?: number | null
	report_count?: number | null
	city?: string | null
	project_category?: string | null
	role_types?: string[] | null
	gender?: string | null
	age_from?: number | null
	age_to?: number | null
	financial_conditions?: string | null
	shooting_dates?: string | null
	published_at?: string | null
	created_at?: string | null
	parent_project_id?: number | null
	project_title?: string | null
}

interface Project {
	id: number
	title: string
}

const STATUS_LABELS: Record<string, { label: string; tone: 'ok' | 'warn' | 'muted' }> = {
	published:   { label: 'Опубликован', tone: 'ok' },
	draft:       { label: 'Черновик', tone: 'muted' },
	unpublished: { label: 'Не опубликован', tone: 'warn' },
	finished:    { label: 'Завершён', tone: 'muted' },
	closed:      { label: 'Закрыт', tone: 'muted' },
}

function formatDate(raw?: string | null): string | null {
	if (!raw) return null
	const date = new Date(raw)
	if (Number.isNaN(date.getTime())) return null
	return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

function normalizeList(data: any): Casting[] {
	return data?.castings || data?.items || []
}

export default function CastingDetailPageWrapper() {
	return (
		<Suspense fallback={<div className={styles.loadingState}><IconLoader size={24} /> Загрузка...</div>}>
			<CastingDetailPage />
		</Suspense>
	)
}

function CastingDetailPage() {
	const params = useParams()
	const searchParams = useSearchParams()
	const castingId = Number(params.id)
	const projectIdParam = searchParams.get('project_id')
	const goBack = useSmartBack()

	const [casting, setCasting] = useState<Casting | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadCasting = useCallback(async () => {
		if (!castingId) {
			setError('Некорректный кастинг')
			setLoading(false)
			return
		}

		setLoading(true)
		setError(null)

		try {
			if (projectIdParam) {
				const [castingsData, projectData] = await Promise.all([
					apiCall('GET', `employer/projects/${projectIdParam}/castings/`),
					apiCall('GET', `employer/projects/${projectIdParam}/detail/`).catch(() => null),
				])
				const found = normalizeList(castingsData).find(c => Number(c.id) === castingId)
				if (found) {
					setCasting({
						...found,
						parent_project_id: Number(projectIdParam),
						project_title: found.project_title || projectData?.title || null,
					})
					setLoading(false)
					return
				}
			}

			const projectsData = await apiCall('GET', 'employer/projects/?page=1&page_size=200')
			const projects: Project[] = projectsData?.projects || projectsData?.items || []
			for (const project of projects) {
				const data = await apiCall('GET', `employer/projects/${project.id}/castings/`)
				const found = normalizeList(data).find(c => Number(c.id) === castingId)
				if (found) {
					setCasting({
						...found,
						parent_project_id: project.id,
						project_title: project.title,
					})
					setLoading(false)
					return
				}
			}

			setError('Кастинг не найден')
		} catch {
			setError('Не удалось загрузить кастинг')
		} finally {
			setLoading(false)
		}
	}, [castingId, projectIdParam])

	useEffect(() => { loadCasting() }, [loadCasting])

	const status = useMemo(() => {
		const key = (casting?.status || '').toLowerCase()
		return STATUS_LABELS[key] || { label: casting?.status || '—', tone: 'muted' as const }
	}, [casting?.status])

	const metaRows = useMemo(() => {
		if (!casting) return []
		return [
			{ label: 'Проект', value: casting.project_title, icon: <IconFolder size={15} /> },
			{ label: 'Город', value: casting.city, icon: <IconFilm size={15} /> },
			{ label: 'Категория', value: casting.project_category, icon: <IconReport size={15} /> },
			{ label: 'Тип роли', value: casting.role_types?.join(', '), icon: <IconUsers size={15} /> },
			{ label: 'Пол', value: casting.gender, icon: <IconUsers size={15} /> },
			{
				label: 'Возраст',
				value: casting.age_from || casting.age_to ? `${casting.age_from || '?'}–${casting.age_to || '?'} лет` : null,
				icon: <IconUsers size={15} />,
			},
			{ label: 'Финансы', value: casting.financial_conditions, icon: <IconReport size={15} /> },
			{ label: 'Даты съёмки', value: casting.shooting_dates, icon: <IconCalendar size={15} /> },
			{ label: 'Опубликован', value: formatDate(casting.published_at), icon: <IconCalendar size={15} /> },
			{ label: 'Создан', value: formatDate(casting.created_at), icon: <IconCalendar size={15} /> },
		].filter(row => row.value)
	}, [casting])

	if (loading) {
		return <div className={styles.loadingState}><IconLoader size={24} /> Загрузка кастинга...</div>
	}

	if (error || !casting) {
		return (
			<div className={styles.root}>
				<header className={styles.header}>
					<button className={styles.backBtn} onClick={goBack}>
						<IconArrowLeft size={16} /> Назад
					</button>
				</header>
				<div className={styles.emptyState}>
					<IconFilm size={34} />
					<h1>{error || 'Кастинг не найден'}</h1>
					<button onClick={goBack}>Вернуться назад</button>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.headerTitle}>Кастинг</h1>
			</header>

			<main className={styles.content}>
				<section className={styles.hero}>
					<div className={styles.cover}>
						<img src={getCoverImage(casting.image_url, casting.id)} alt={casting.title} />
						<span className={`${styles.status} ${styles[status.tone]}`}>{status.label}</span>
					</div>

					<div className={styles.body}>
						<h2 className={styles.title}>{casting.title}</h2>

						{casting.description && casting.description !== '-' && (
							<p className={styles.description}>{casting.description}</p>
						)}

						<div className={styles.stats}>
							<span><IconUsers size={14} /> {casting.response_count ?? 0} откликов</span>
							<span><IconReport size={14} /> {casting.report_count ?? 0} отчётов</span>
						</div>
					</div>
				</section>

				{metaRows.length > 0 && (
					<section className={styles.details}>
						<h3>Данные кастинга</h3>
						<div className={styles.detailGrid}>
							{metaRows.map(row => (
								<div key={row.label} className={styles.detailRow}>
									<span className={styles.detailIcon}>{row.icon}</span>
									<span className={styles.detailLabel}>{row.label}</span>
									<b className={styles.detailValue}>{row.value}</b>
								</div>
							))}
						</div>
					</section>
				)}
			</main>
		</div>
	)
}
