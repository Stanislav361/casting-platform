'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import { IconX, IconFolder, IconPlus, IconChevronRight, IconFilm } from '~packages/ui/icons'
import styles from './project-picker.module.scss'

interface Project {
	id: number
	title: string
	image_url: string | null
	status: string
}

interface Props {
	open: boolean
	onClose: () => void
}

const STATUS_LABEL: Record<string, string> = {
	published: 'Опубликован',
	closed:    'Завершён',
	draft:     'Черновик',
}

const STATUS_DOT: Record<string, string> = {
	published: 'green',
	closed:    'gray',
	draft:     'yellow',
}

export default function ProjectPicker({ open, onClose }: Props) {
	const router = useRouter()
	const [projects, setProjects] = useState<Project[]>([])
	const [loading, setLoading] = useState(false)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const data = await apiCall('GET', 'employer/projects/')
			setProjects((data?.projects || []).filter((p: Project) => !p.status?.includes('archived')))
		} catch {
			/* ignore */
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		if (open) load()
	}, [open, load])

	const goProject = (id: number) => {
		onClose()
		router.push(`/dashboard/project/${id}`)
	}

	const goAll = () => {
		onClose()
		router.push('/dashboard')
	}

	const goNew = () => {
		onClose()
		router.push('/dashboard?new=1')
	}

	if (!open) return null

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.sheet} onClick={e => e.stopPropagation()}>
				{/* Handle */}
				<div className={styles.handle} />

				{/* Header */}
				<div className={styles.header}>
					<div className={styles.headerLeft}>
						<span className={styles.headerIcon}><IconFolder size={18} /></span>
						<span className={styles.headerTitle}>Проекты</span>
					</div>
					<button className={styles.closeBtn} onClick={onClose}>
						<IconX size={16} />
					</button>
				</div>

				{/* List */}
				<div className={styles.list}>
					{loading ? (
						<div className={styles.skeleton}>
							{[1, 2, 3].map(i => <div key={i} className={styles.skeletonCard} />)}
						</div>
					) : projects.length === 0 ? (
						<div className={styles.empty}>
							<IconFilm size={32} />
							<p>Нет активных проектов</p>
						</div>
					) : (
						projects.map((p, i) => (
							<button
								key={p.id}
								className={styles.card}
								style={{ animationDelay: `${i * 0.04}s` }}
								onClick={() => goProject(p.id)}
							>
								<div className={styles.cardCover}>
									<img src={getCoverImage(p.image_url, p.id)} alt="" />
								</div>
								<div className={styles.cardInfo}>
									<span className={styles.cardTitle}>{p.title}</span>
									<span className={styles.cardStatus} data-status={STATUS_DOT[p.status] ?? 'gray'}>
										<span className={styles.cardStatusDot} />
										{STATUS_LABEL[p.status] ?? p.status}
									</span>
								</div>
								<IconChevronRight size={16} className={styles.cardArrow} />
							</button>
						))
					)}
				</div>

				{/* Footer actions */}
				<div className={styles.footer}>
					<button className={styles.allBtn} onClick={goAll}>
						<IconFolder size={16} />
						Все проекты
					</button>
					<button className={styles.newBtn} onClick={goNew}>
						<IconPlus size={16} />
						Новый
					</button>
				</div>
			</div>
		</div>
	)
}
