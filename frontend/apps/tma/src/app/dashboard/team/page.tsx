'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconArrowLeft,
	IconUsers,
	IconLoader,
	IconUser,
	IconMail,
	IconChevronDown,
	IconChevronRight,
	IconFolder,
	IconCrown,
	IconSearch,
	IconPlus,
	IconX,
} from '~packages/ui/icons'
import styles from './team.module.scss'

interface Project {
	id: number
	title: string
	image_url?: string | null
	owner_id?: number
	team_size?: number
}

interface Collaborator {
	id: number
	user_id: number
	email?: string
	first_name?: string | null
	last_name?: string | null
	photo_url?: string | null
	role?: string
}

const ROLE_LABEL: Record<string, string> = {
	editor: 'Редактор',
	viewer: 'Наблюдатель',
	owner: 'Владелец',
}

export default function TeamPage() {
	const router = useRouter()
	const [projects, setProjects] = useState<Project[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const [expandedId, setExpandedId] = useState<number | null>(null)
	const [collabsByProject, setCollabsByProject] = useState<Record<number, Collaborator[]>>({})
	const [loadingCollab, setLoadingCollab] = useState<Set<number>>(new Set())
	const [addModal, setAddModal] = useState<Project | null>(null)
	const [addEmail, setAddEmail] = useState('')
	const [addLoading, setAddLoading] = useState(false)
	const [addError, setAddError] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'employer/projects/?page=1&page_size=100')
		setProjects(data?.projects || [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const refreshProjectTeam = useCallback(async (projectId: number) => {
		setLoadingCollab((prev) => { const next = new Set(prev); next.add(projectId); return next })
		const data = await apiCall('GET', `employer/projects/${projectId}/collaborators/`)
		setCollabsByProject((prev) => ({
			...prev,
			[projectId]: data?.collaborators || data?.items || [],
		}))
		setLoadingCollab((prev) => { const next = new Set(prev); next.delete(projectId); return next })
	}, [])

	const toggleProject = useCallback(async (project: Project) => {
		if (expandedId === project.id) {
			setExpandedId(null)
			return
		}
		setExpandedId(project.id)
		if (!collabsByProject[project.id]) {
			await refreshProjectTeam(project.id)
		}
	}, [expandedId, collabsByProject, refreshProjectTeam])

	const openAddModal = useCallback((project: Project) => {
		setAddModal(project)
		setAddEmail('')
		setAddError(null)
	}, [])

	const closeAddModal = useCallback(() => {
		if (addLoading) return
		setAddModal(null)
		setAddEmail('')
		setAddError(null)
	}, [addLoading])

	const addTeamMember = useCallback(async () => {
		if (!addModal || !addEmail.trim() || addLoading) return
		setAddLoading(true)
		setAddError(null)
		const email = addEmail.trim()
		const res = await apiCall(
			'POST',
			`employer/projects/${addModal.id}/collaborators/?user_email=${encodeURIComponent(email)}&role=editor`
		)
		setAddLoading(false)
		if (res?.ok) {
			setExpandedId(addModal.id)
			await refreshProjectTeam(addModal.id)
			closeAddModal()
			return
		}
		setAddError(
			typeof res?.detail === 'string'
				? res.detail
				: 'Не удалось добавить участника. Проверьте email и права доступа.'
		)
	}, [addEmail, addLoading, addModal, closeAddModal, refreshProjectTeam])

	const filtered = projects.filter((p) => {
		if (!query.trim()) return true
		return (p.title || '').toLowerCase().includes(query.toLowerCase())
	})

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.replace('/dashboard')}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Команда</h1>
				<span className={styles.headerBadge}>{projects.length}</span>
			</div>

			<div className={styles.toolbar}>
				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						className={styles.searchInput}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Поиск по проекту…"
					/>
				</div>
			</div>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка проектов…
				</div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconUsers size={28} /></div>
					<h3>Нет проектов</h3>
					<p>Команды появятся, как только будут созданы проекты.</p>
					<button className={styles.emptyBtn} onClick={() => router.replace('/dashboard')}>
						К проектам
					</button>
				</div>
			) : (
				<div className={styles.list}>
					{filtered.map((p) => {
						const isOpen = expandedId === p.id
						const collabs = collabsByProject[p.id] || []
						const isLoading = loadingCollab.has(p.id)
						return (
							<div key={p.id} className={styles.card}>
								<div
									className={styles.cardHeader}
									onClick={() => toggleProject(p)}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault()
											toggleProject(p)
										}
									}}
								>
									<div className={styles.cardCover}>
										<img src={getCoverImage(p.image_url, p.id || p.title)} alt="" />
									</div>
									<div className={styles.cardMain}>
										<p className={styles.cardTitle}>{p.title}</p>
										<div className={styles.cardMeta}>
											<span className={styles.metaItem}>
												<IconUsers size={12} />
												{collabs.length || p.team_size || 0} в команде
											</span>
											<button
												className={styles.openProjectBtn}
												onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/project/${p.id}`) }}
												title="Открыть проект"
											>
												<IconFolder size={12} /> Проект
											</button>
											<button
												className={styles.addMemberBtn}
												onClick={(e) => { e.stopPropagation(); openAddModal(p) }}
												title="Добавить участника"
											>
												<IconPlus size={12} /> Добавить в команду
											</button>
										</div>
									</div>
									<span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
										{isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
									</span>
								</div>

								{isOpen && (
									<div className={styles.teamList}>
										{isLoading ? (
											<div className={styles.state}>
												<IconLoader size={16} /> Загрузка команды…
											</div>
										) : collabs.length === 0 ? (
											<div className={styles.emptyTeam}>
												<p>В команде пока никого нет</p>
												<button
													className={styles.inviteBtn}
													onClick={() => openAddModal(p)}
												>
													<IconPlus size={13} /> Добавить в команду
												</button>
											</div>
										) : (
											<ul className={styles.members}>
												{collabs.map((c) => {
													const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || `User #${c.user_id}`
													const isOwner = c.role === 'owner' || c.user_id === p.owner_id
													return (
														<li key={c.id} className={styles.member}>
															<div className={styles.memberAvatar}>
																{c.photo_url ? (
																	<img src={c.photo_url} alt="" />
																) : (
																	<IconUser size={18} />
																)}
															</div>
															<div className={styles.memberInfo}>
																<p className={styles.memberName}>
																	{name}
																	{isOwner && <span className={styles.ownerTag}><IconCrown size={11} /> Владелец</span>}
																</p>
																{c.email && (
																	<p className={styles.memberEmail}>
																		<IconMail size={11} /> {c.email}
																	</p>
																)}
															</div>
															{!isOwner && c.role && (
																<span className={styles.roleTag}>
																	{ROLE_LABEL[c.role] || c.role}
																</span>
															)}
														</li>
													)
												})}
											</ul>
										)}
									</div>
								)}
							</div>
						)
					})}
				</div>
			)}

			{addModal && (
				<div className={styles.modalOverlay} onClick={closeAddModal}>
					<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<div>
								<h3 className={styles.modalTitle}>
									<IconUsers size={18} /> Добавить в команду
								</h3>
								<p className={styles.modalSubtitle}>{addModal.title}</p>
							</div>
							<button className={styles.modalClose} onClick={closeAddModal} disabled={addLoading}>
								<IconX size={16} />
							</button>
						</div>

						<div className={styles.modalBody}>
							<label className={styles.modalLabel} htmlFor="team-member-email">
								Email администратора
							</label>
							<input
								id="team-member-email"
								className={styles.modalInput}
								value={addEmail}
								onChange={(e) => setAddEmail(e.target.value)}
								placeholder="admin@example.com"
								inputMode="email"
								autoComplete="email"
								disabled={addLoading}
								onKeyDown={(e) => {
									if (e.key === 'Enter') addTeamMember()
								}}
							/>
							<p className={styles.modalHint}>
								Пользователь должен быть зарегистрирован как Админ или Админ PRO.
							</p>
							{addError && <p className={styles.modalError}>{addError}</p>}
						</div>

						<div className={styles.modalActions}>
							<button className={styles.modalCancel} onClick={closeAddModal} disabled={addLoading}>
								Отмена
							</button>
							<button
								className={styles.modalSubmit}
								onClick={addTeamMember}
								disabled={addLoading || !addEmail.trim()}
							>
								{addLoading ? <IconLoader size={14} /> : <IconPlus size={14} />}
								Добавить
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
