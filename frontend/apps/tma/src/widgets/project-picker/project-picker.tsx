'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconX,
	IconFolder,
	IconPlus,
	IconChevronRight,
	IconFilm,
	IconUsers,
	IconReport,
	IconArrowLeft,
} from '~packages/ui/icons'
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
	onSelect?: (projectId: number) => void
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

interface SubItem {
	id: string
	label: string
	desc: string
	icon: React.ReactNode
	href: (projectId: number) => string
}

const SUB_ITEMS: SubItem[] = [
	{ id: 'overview', label: 'Обзор проекта',  desc: 'Общая страница',          icon: <IconFolder size={20} />,  href: id => `/dashboard/project/${id}` },
	{ id: 'castings', label: 'Кастинги',        desc: 'Все кастинги проекта',    icon: <IconFilm size={20} />,    href: id => `/dashboard/castings?project_id=${id}` },
	{ id: 'actors',   label: 'Актёры',          desc: 'Откликнувшиеся актёры',   icon: <IconUsers size={20} />,   href: id => `/dashboard/project/${id}/responses` },
	{ id: 'reports',  label: 'Отчёты',          desc: 'Шортлисты и отчёты',      icon: <IconReport size={20} />,  href: _ => `/dashboard/reports` },
	{ id: 'team',     label: 'Команда',         desc: 'Участники проекта',        icon: <IconUsers size={20} />,   href: _ => `/dashboard/team` },
]

export default function ProjectPicker({ open, onClose, onSelect }: Props) {
	const router = useRouter()
	const [projects, setProjects] = useState<Project[]>([])
	const [loading, setLoading] = useState(false)
	const [selected, setSelected] = useState<Project | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const data = await apiCall('GET', 'employer/projects/')
			setProjects((data?.projects || []).filter((p: Project) => !p.status?.includes('archived')))
		} catch { /* ignore */ }
		finally { setLoading(false) }
	}, [])

	useEffect(() => {
		if (open) {
			setSelected(null)
			load()
		}
	}, [open, load])

	const handleClose = () => {
		setSelected(null)
		onClose()
	}

	const navigate = (href: string) => {
		handleClose()
		router.push(href)
	}

	if (!open) return null

	return (
		<div className={styles.overlay} onClick={handleClose}>
			<div className={styles.sheet} onClick={e => e.stopPropagation()}>
				<div className={styles.handle} />

				{/* ── LEVEL 1: Project list ── */}
				{!selected && (
					<div className={styles.view}>
						<div className={styles.header}>
							<div className={styles.headerLeft}>
								<span className={styles.headerIcon}><IconFolder size={18} /></span>
								<span className={styles.headerTitle}>Мои проекты</span>
							</div>
							<button className={styles.closeBtn} onClick={handleClose}><IconX size={16} /></button>
						</div>

						<div className={styles.list}>
							{loading ? (
								<div className={styles.skeleton}>
									{[1, 2, 3].map(i => <div key={i} className={styles.skeletonCard} />)}
								</div>
							) : projects.length === 0 ? (
								<div className={styles.empty}>
									<IconFilm size={36} />
									<p>Нет активных проектов</p>
									<span>Создайте первый проект</span>
								</div>
							) : (
								projects.map((p, i) => (
									<button
										key={p.id}
										className={styles.card}
										style={{ animationDelay: `${i * 0.04}s` }}
										onClick={() => {
										if (onSelect) {
											handleClose()
											onSelect(p.id)
										} else {
											setSelected(p)
										}
									}}
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

						<div className={styles.footer}>
							<button className={styles.allBtn} onClick={() => navigate('/dashboard')}>
								<IconFolder size={16} />
								Все проекты
							</button>
							<button className={styles.newBtn} onClick={() => navigate('/dashboard?new=1')}>
								<IconPlus size={16} />
								Новый
							</button>
						</div>
					</div>
				)}

				{/* ── LEVEL 2: Project submenu ── */}
				{selected && (
					<div className={styles.view} key={selected.id}>
						<div className={styles.header}>
							<button className={styles.backBtn} onClick={() => setSelected(null)}>
								<IconArrowLeft size={16} />
							</button>
							<div className={styles.headerProject}>
								<div className={styles.headerProjectCover}>
									<img src={getCoverImage(selected.image_url, selected.id)} alt="" />
								</div>
								<span className={styles.headerTitle}>{selected.title}</span>
							</div>
							<button className={styles.closeBtn} onClick={handleClose}><IconX size={16} /></button>
						</div>

						<div className={styles.list}>
							{SUB_ITEMS.map((item, i) => (
								<button
									key={item.id}
									className={styles.subCard}
									style={{ animationDelay: `${i * 0.045}s` }}
									onClick={() => navigate(item.href(selected.id))}
								>
									<span className={styles.subCardIcon}>{item.icon}</span>
									<div className={styles.subCardInfo}>
										<span className={styles.subCardLabel}>{item.label}</span>
										<span className={styles.subCardDesc}>{item.desc}</span>
									</div>
									<IconChevronRight size={15} className={styles.cardArrow} />
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
