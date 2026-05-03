'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconArrowLeft,
	IconCalendar,
	IconCheck,
	IconClipboard,
	IconEye,
	IconFilm,
	IconFolder,
	IconLoader,
	IconSearch,
	IconUser,
	IconUsers,
} from '~packages/ui/icons'
import styles from '../dashboard.module.scss'

type Project = {
	id: number
	title: string
	image_url?: string | null
	status?: string
	created_at?: string
	published_at?: string | null
	response_count?: number
	sub_castings_count?: number
	team_size?: number
	report_count?: number
}

export default function DashboardArchivePage() {
	const router = useRouter()
	const [projects, setProjects] = useState<Project[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')
	const [restoringId, setRestoringId] = useState<number | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'employer/projects/?page=1&page_size=100&archived=true').catch(() => ({ projects: [] }))
		setProjects(data?.projects || [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const restoreProject = async (event: MouseEvent, project: Project) => {
		event.stopPropagation()
		if (!window.confirm(`Вернуть проект «${project.title}» из архива?`)) return
		setRestoringId(project.id)
		const res = await apiCall('POST', `employer/projects/${project.id}/restore/`)
		if (res?.id) {
			setProjects(prev => prev.filter(item => item.id !== project.id))
		} else {
			alert(res?.detail || 'Не удалось вернуть проект')
		}
		setRestoringId(null)
	}

	const filtered = projects.filter(project => {
		if (!query.trim()) return true
		return (project.title || '').toLowerCase().includes(query.toLowerCase())
	})

	return (
		<div className={styles.content}>
			<section className={`${styles.section} ${styles.archiveSection}`}>
				<div className={styles.projectSectionHead}>
					<div>
						<button className={styles.backBtn} onClick={() => router.replace('/dashboard')}>
							<IconArrowLeft size={16} /> Назад
						</button>
						<h2>
							<span className={styles.sectionIcon}><IconFolder size={17} /></span>
							Архив
						</h2>
						<p className={styles.sectionLead}>
							Архивные проекты не мешают активной работе. При необходимости их можно вернуть обратно.
						</p>
					</div>
					<span className={styles.archiveCount}>{projects.length}</span>
				</div>

				<div className={styles.archiveToolbar}>
					<div className={styles.archiveSearchBox}>
						<IconSearch size={16} />
						<input
							className={styles.archiveSearchInput}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Поиск по архиву…"
						/>
					</div>
				</div>

				{loading ? (
					<p className={styles.empty}>
						<IconLoader size={18} /> Загружаем архив…
					</p>
				) : filtered.length === 0 ? (
					<p className={styles.empty}>
						<span className={styles.emptyIcon}><IconFolder size={28} /></span>
						{projects.length === 0 ? 'В архиве пока пусто.' : 'Ничего не найдено.'}
					</p>
				) : (
					<div className={styles.projectList}>
						{filtered.map((project) => {
							const createdDate = project.created_at ? new Date(project.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'
							const publishedDate = project.published_at ? new Date(project.published_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
							return (
								<div key={project.id} className={`${styles.castingCard} ${styles.castingCardArchived}`}>
									<div className={styles.castingCardInner}>
										<div className={styles.castingPhoto}>
											<img src={getCoverImage(project.image_url, project.id || project.title)} alt={project.title} />
										</div>
										<div className={styles.castingBody}>
											<div className={styles.castingTitleRow}>
												<h3 className={styles.castingTitle}>{project.title}</h3>
												<span className={`${styles.castingStatus} ${styles.castingStatusArchived}`}>
													В архиве
												</span>
											</div>
											<div className={styles.castingDates}>
												<span><IconCalendar size={13} /> Дата создания<br /><b>{createdDate}</b></span>
												{publishedDate && <span><IconCalendar size={13} /> Дата публикации<br /><b>{publishedDate}</b></span>}
												<span><IconUser size={13} /> Откликнулось<br /><b>{project.response_count || 0} актёров</b></span>
											</div>
											<div className={styles.projectMetaRow}>
												<span className={styles.projectMetaPillStatic}><IconFilm size={13} /> {project.sub_castings_count || 0} кастингов</span>
												<span className={styles.projectMetaPillStatic}><IconUsers size={13} /> {project.team_size || 1} в команде</span>
												<span className={styles.projectMetaPillStatic}><IconClipboard size={13} /> {project.report_count || 0} отчётов</span>
											</div>
											<div className={styles.castingActions}>
												<button className={styles.castingBtnDetails} onClick={() => router.push(`/dashboard/project/${project.id}`)}>
													<IconEye size={13} /> Открыть
												</button>
												<button
													onClick={(event) => restoreProject(event, project)}
													className={styles.castingBtnRestore}
													disabled={restoringId === project.id}
												>
													{restoringId === project.id ? <IconLoader size={11} /> : <IconCheck size={11} />}
													{restoringId === project.id ? 'Возврат...' : 'Вернуть'}
												</button>
											</div>
										</div>
									</div>
								</div>
							)
						})}
					</div>
				)}
			</section>
		</div>
	)
}
