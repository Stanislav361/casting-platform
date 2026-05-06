'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useRole } from '~/shared/use-role'
import { useSmartBack } from '~/shared/smart-back'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconArrowLeft,
	IconUsers,
	IconLoader,
	IconUser,
	IconMail,
	IconChevronDown,
	IconChevronRight,
	IconCrown,
	IconSearch,
	IconPlus,
	IconX,
} from '~packages/ui/icons'
import styles from './team.module.scss'

interface Casting {
	id: number
	title: string
	image_url?: string | null
	owner_id?: number
	team_size?: number
	parent_project_id?: number
	status?: string
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
	const goBack = useSmartBack('/dashboard')
	const role = useRole()
	const [castings, setCastings] = useState<Casting[]>([])
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const [expandedId, setExpandedId] = useState<number | null>(null)
	const [collabsByCasting, setCollabsByCasting] = useState<Record<number, Collaborator[]>>({})
	const [loadingCollab, setLoadingCollab] = useState<Set<number>>(new Set())
	const [addModal, setAddModal] = useState<Casting | null>(null)
	const [addEmail, setAddEmail] = useState('')
	const [addLoading, setAddLoading] = useState(false)
	const [addError, setAddError] = useState<string | null>(null)

	const isOwner = role === 'owner'

	const load = useCallback(async () => {
		setLoading(true)
		// Загружаем все кастинги пользователя плоско (через корневые проекты).
		const projectsData = await apiCall('GET', 'employer/projects/?page=1&page_size=200')
		if (projectsData && !projectsData.detail) {
			const projects = projectsData.projects || projectsData.items || []
			const castingsByProject = await Promise.all(
				projects.map(async (project: Casting) => {
					const data = await apiCall('GET', `employer/projects/${project.id}/castings/`)
					const list = data?.castings || data?.items || []
					return list.map((c: Casting) => ({ ...c, parent_project_id: project.id }))
				}),
			)
			setCastings(castingsByProject.flat())
		} else {
			setCastings([])
		}
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const refreshCastingTeam = useCallback(async (castingId: number) => {
		setLoadingCollab((prev) => { const next = new Set(prev); next.add(castingId); return next })
		const data = await apiCall('GET', `employer/projects/${castingId}/collaborators/`)
		setCollabsByCasting((prev) => ({
			...prev,
			[castingId]: data?.collaborators || data?.items || [],
		}))
		setLoadingCollab((prev) => { const next = new Set(prev); next.delete(castingId); return next })
	}, [])

	const toggleCasting = useCallback(async (casting: Casting) => {
		if (expandedId === casting.id) {
			setExpandedId(null)
			return
		}
		setExpandedId(casting.id)
		if (!collabsByCasting[casting.id]) {
			await refreshCastingTeam(casting.id)
		}
	}, [expandedId, collabsByCasting, refreshCastingTeam])

	const openAddModal = useCallback((casting: Casting) => {
		setAddModal(casting)
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
			`employer/projects/${addModal.id}/collaborators/?user_email=${encodeURIComponent(email)}&role=editor`,
		)
		setAddLoading(false)
		if (res?.ok) {
			setExpandedId(addModal.id)
			await refreshCastingTeam(addModal.id)
			closeAddModal()
			return
		}
		setAddError(
			typeof res?.detail === 'string'
				? res.detail
				: 'Не удалось добавить участника. Проверьте email и права доступа.',
		)
	}, [addEmail, addLoading, addModal, closeAddModal, refreshCastingTeam])

	const filtered = castings.filter((c) => {
		if (!query.trim()) return true
		return (c.title || '').toLowerCase().includes(query.toLowerCase())
	})

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Команда</h1>
				<span className={styles.headerBadge}>{castings.length}</span>
			</div>

			<div className={styles.toolbar}>
				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						className={styles.searchInput}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Поиск по кастингу…"
					/>
				</div>
			</div>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка кастингов…
				</div>
			) : filtered.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconUsers size={28} /></div>
					<h3>Нет кастингов</h3>
					<p>Команды появятся, как только будут созданы кастинги.</p>
					<button className={styles.emptyBtn} onClick={() => router.replace('/dashboard/castings/new')}>
						Создать кастинг
					</button>
				</div>
			) : (
				<div className={styles.list}>
					{filtered.map((c) => {
						const isOpen = expandedId === c.id
						const collabs = collabsByCasting[c.id] || []
						const isLoading = loadingCollab.has(c.id)
						return (
							<div key={c.id} className={styles.card}>
								<div
									className={styles.cardHeader}
									onClick={() => toggleCasting(c)}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault()
											toggleCasting(c)
										}
									}}
								>
									<div className={styles.cardCover}>
										<img src={getCoverImage(c.image_url, c.id || c.title)} alt="" />
									</div>
									<div className={styles.cardMain}>
										<p className={styles.cardTitle}>{c.title}</p>
										<div className={styles.cardMeta}>
											<span className={styles.metaItem}>
												<IconUsers size={12} />
												{collabs.length || c.team_size || 0} в команде
											</span>
											<button
												className={styles.addMemberBtn}
												onClick={(e) => { e.stopPropagation(); openAddModal(c) }}
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
													onClick={() => openAddModal(c)}
												>
													<IconPlus size={13} /> Добавить в команду
												</button>
											</div>
										) : (
											<ul className={styles.members}>
												{collabs.map((m) => {
													const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email || `User #${m.user_id}`
													const isOwnerOfCasting = m.role === 'owner' || m.user_id === c.owner_id
													return (
														<li key={m.id} className={styles.member}>
															<div className={styles.memberAvatar}>
																{m.photo_url ? (
																	<img src={m.photo_url} alt="" />
																) : (
																	<IconUser size={18} />
																)}
															</div>
															<div className={styles.memberInfo}>
																<p className={styles.memberName}>
																	{name}
																	{isOwnerOfCasting && <span className={styles.ownerTag}><IconCrown size={11} /> Владелец</span>}
																</p>
																{m.email && (
																	<p className={styles.memberEmail}>
																		<IconMail size={11} /> {m.email}
																	</p>
																)}
															</div>
															{!isOwnerOfCasting && m.role && (
																<span className={styles.roleTag}>
																	{ROLE_LABEL[m.role] || m.role}
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
								Email пользователя
							</label>
							<input
								id="team-member-email"
								className={styles.modalInput}
								value={addEmail}
								onChange={(e) => setAddEmail(e.target.value)}
								placeholder="user@example.com"
								inputMode="email"
								autoComplete="email"
								disabled={addLoading}
								onKeyDown={(e) => {
									if (e.key === 'Enter') addTeamMember()
								}}
							/>
							<p className={styles.modalHint}>
								{isOwner
									? 'SuperAdmin может добавить пользователя с любой ролью.'
									: 'Можно добавить только Админа или Админа PRO. Пользователь должен быть зарегистрирован.'}
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
