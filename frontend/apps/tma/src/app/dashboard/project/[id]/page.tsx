'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { $session } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { formatPhone } from '~/shared/phone-mask'
import {
	IconArrowLeft,
	IconZap,
	IconEdit,
	IconTrash,
	IconSend,
	IconLoader,
	IconUser,
	IconX,
	IconMask,
	IconCamera,
	IconStar,
	IconCheck,
	IconEye,
	IconBan,
	IconClock,
	IconUsers,
	IconPlus,
	IconFilm,
	IconClipboard,
	IconMessageSquare,
	IconHeart,
	IconChevronDown,
	IconChevronUp,
	IconFilter,

	IconSearch,
	IconSortDesc,
	IconFileText,
	IconPhone,
	IconMail,
} from '~packages/ui/icons'
import styles from './project.module.scss'
import LiveChat from '../../components/live-chat'

export default function ProjectPage() {
	const router = useRouter()
	const params = useParams()
	const projectId = params.id

	const [token, setToken] = useState<string | null>(null)
	const [project, setProject] = useState<any>(null)
	const [respondents, setRespondents] = useState<any[]>([])
	const [chatLogs, setChatLogs] = useState<any[]>([])
	const [editing, setEditing] = useState(false)
	const [title, setTitle] = useState('')
	const [desc, setDesc] = useState('')
	const [comment, setComment] = useState('')
	const [loading, setLoading] = useState(true)
	const [selectedActor, setSelectedActor] = useState<any>(null)
	const [favorites, setFavorites] = useState<Set<number>>(new Set())
	const [showFavorites, setShowFavorites] = useState(false)
	const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

	const [collaborators, setCollaborators] = useState<any[]>([])
	const [collabEmail, setCollabEmail] = useState('')
	const [addingCollab, setAddingCollab] = useState(false)

	const [subCastings, setSubCastings] = useState<any[]>([])
	const [newCastTitle, setNewCastTitle] = useState('')
	const [newCastDesc, setNewCastDesc] = useState('')
	const [creatingCast, setCreatingCast] = useState(false)

	const [reports, setReports] = useState<any[]>([])
	const [newReportTitle, setNewReportTitle] = useState('')
	const [creatingReport, setCreatingReport] = useState(false)
	const [selectedReport, setSelectedReport] = useState<any>(null)

	const [chatMessages, setChatMessages] = useState<any[]>([])
	const [chatInput, setChatInput] = useState('')
	const [chatSending, setChatSending] = useState(false)
	const chatEndRef = useRef<HTMLDivElement>(null)

	const [searchTerm, setSearchTerm] = useState('')
	const [showSearch, setShowSearch] = useState(false)
	const [sortBy, setSortBy] = useState<'date' | 'name'>('date')
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ main: true, contacts: false, skills: false, notes: false })
	const [carouselIdx, setCarouselIdx] = useState(0)
	const [actorNotes, setActorNotes] = useState<Record<number, string>>({})
	const [showContacts, setShowContacts] = useState(false)

	const toggleFavorite = async (profileId: number, e?: React.MouseEvent) => {
		if (e) e.stopPropagation()
		if (!profileId) return
		const wasFav = favorites.has(profileId)
		setFavorites(prev => {
			const next = new Set(prev)
			if (wasFav) next.delete(profileId)
			else next.add(profileId)
			return next
		})
		setRespondents(prev =>
			prev.map(r => {
				if (r.profile_id !== profileId) return r
				if (wasFav && r.response_status === 'shortlisted') return { ...r, response_status: 'pending' }
				if (!wasFav && (r.response_status === 'pending' || r.response_status === 'viewed')) return { ...r, response_status: 'shortlisted' }
				return r
			})
		)
		if (selectedActor?.profile_id === profileId) {
			setSelectedActor((prev: any) => {
				if (!prev) return prev
				if (wasFav && prev.response_status === 'shortlisted') return { ...prev, response_status: 'pending' }
				if (!wasFav && (prev.response_status === 'pending' || prev.response_status === 'viewed')) return { ...prev, response_status: 'shortlisted' }
				return prev
			})
		}
		const res = await api('POST', `employer/favorites/toggle/?profile_id=${profileId}`)
		if (res?.ok) return
		setFavorites(prev => {
			const next = new Set(prev)
			if (wasFav) next.add(profileId)
			else next.delete(profileId)
			return next
		})
		setRespondents(prev =>
			prev.map(r => r.profile_id === profileId ? { ...r, response_status: wasFav ? 'shortlisted' : 'pending' } : r)
		)
		if (res?.detail) {
			alert(`Ошибка: ${typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail)}`)
		}
	}

	const toggleSection = (key: string) => {
		setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
	}

	const openActorModal = (actor: any) => {
		setSelectedActor(actor)
		setCarouselIdx(0)
		setShowContacts(false)
		setExpandedSections({ main: true, contacts: false, skills: false, notes: false })
	}

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
	}, [router])

	const api = useCallback(
		async (method: string, path: string, body?: any) => {
			if (!token) return null
			try {
				const res = await fetch(`${API_URL}${path}`, {
					method,
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: body ? JSON.stringify(body) : undefined,
				})
				const data = await res.json().catch(() => null)
				if (!res.ok && !data) return { detail: `Server error ${res.status}` }
				return data
			} catch {
				return null
			}
		},
		[token],
	)

	useEffect(() => {
		if (!token || !projectId) return
		const load = async () => {
			try {
			const [projList, resp, logs, collabData, castingsData, reportsData, chatData, favData] = await Promise.all([
				api('GET', 'employer/projects/'),
				api('GET', `employer/projects/${projectId}/respondents/?page_size=200`).catch(
					() => ({ respondents: [] }),
				),
				api('GET', `collaboration/casting/${projectId}/log/`).catch(
					() => ({ logs: [] }),
				),
				api('GET', `employer/projects/${projectId}/collaborators/`).catch(() => ({ collaborators: [] })),
				api('GET', `employer/projects/${projectId}/castings/`).catch(() => ({ castings: [] })),
				api('GET', 'employer/reports/').catch(() => ({ reports: [] })),
				api('GET', `employer/projects/${projectId}/chat/`).catch(() => ({ messages: [] })),
				api('GET', 'employer/favorites/ids/').catch(() => ({ profile_ids: [] })),
			])
			const proj = projList?.projects?.find(
				(p: any) => p.id === Number(projectId),
			)
			if (proj) {
				setProject(proj)
				setTitle(proj.title)
				setDesc(proj.description)
			}
			setRespondents(resp?.respondents || [])
			if (favData?.profile_ids) setFavorites(new Set(favData.profile_ids))
			setChatLogs(logs?.logs || [])
			setCollaborators(collabData?.collaborators || [])
			setSubCastings(castingsData?.castings || [])
			setReports((reportsData?.reports || []).filter((r: any) => r.casting_id === Number(projectId)))
			setChatMessages(chatData?.messages || [])
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, projectId, api])

	const saveProject = async () => {
		const res = await api('PATCH', `employer/projects/${projectId}/`, {
			title,
			description: desc,
		})
		if (res?.id) {
			setProject(res)
			setEditing(false)
		}
	}

	const deleteProject = async () => {
		if (!confirm('Удалить проект?')) return
		await api('DELETE', `employer/projects/${projectId}/`)
		router.replace('/dashboard')
	}

	const publishProject = async () => {
		const res = await api(
			'POST',
			`employer/projects/${projectId}/publish/`,
		)
		if (res?.id) {
			setProject(res)
			return
		}
		alert(res?.detail || 'Не удалось опубликовать проект')
	}

	const sendComment = async () => {
		if (!comment.trim()) return
		await api(
			'POST',
			`collaboration/casting/${projectId}/comment/?message=${encodeURIComponent(comment)}`,
		)
		setComment('')
		const logs = await api(
			'GET',
			`collaboration/casting/${projectId}/log/`,
		)
		setChatLogs(logs?.logs || [])
	}

	const loadChat = useCallback(async () => {
		const data = await api('GET', `employer/projects/${projectId}/chat/`)
		if (data?.messages) setChatMessages(data.messages)
	}, [api, projectId])

	const sendChatMessage = async () => {
		if (!chatInput.trim() || chatSending) return
		setChatSending(true)
		await api('POST', `employer/projects/${projectId}/chat/?message=${encodeURIComponent(chatInput)}`)
		setChatInput('')
		await loadChat()
		setChatSending(false)
	}

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [chatMessages])

	const RESPONSE_STATUSES = [
		{ value: 'pending', label: 'На рассмотрении', cls: styles.rsPending, icon: <IconClock size={11} /> },
		{ value: 'viewed', label: 'Просмотрено', cls: styles.rsViewed, icon: <IconEye size={11} /> },
		{ value: 'shortlisted', label: 'В избранном', cls: styles.rsShortlisted, icon: <IconStar size={11} /> },
		{ value: 'approved', label: 'Одобрено', cls: styles.rsApproved, icon: <IconCheck size={11} /> },
		{ value: 'rejected', label: 'Отклонено', cls: styles.rsRejected, icon: <IconBan size={11} /> },
	]

	const updateResponseStatus = async (responseId: number, newStatus: string) => {
		const res = await api(
			'PATCH',
			`employer/projects/${projectId}/responses/${responseId}/status/`,
			{ status: newStatus },
		)
		if (res?.ok) {
			setRespondents(prev =>
				prev.map(r =>
					r.response_id === responseId ? { ...r, response_status: newStatus } : r
				)
			)
		}
	}

	const genderLabel = (g: string | null) => {
		if (!g) return '—'
		if (g === 'male') return 'Мужской'
		if (g === 'female') return 'Женский'
		return g
	}

	const qualLabel = (q: string | null) => {
		if (!q) return '—'
		const m: Record<string, string> = {
			professional: 'Профессионал',
			skilled: 'Опытный',
			enthusiast: 'Энтузиаст',
			beginner: 'Начинающий',
			other: 'Другое',
		}
		return m[q] || q
	}

	const lookLabel = (l: string | null) => {
		if (!l) return '—'
		const m: Record<string, string> = {
			european: 'Европейский',
			asian: 'Азиатский',
			slavic: 'Славянский',
			african: 'Африканский',
			latino: 'Латиноамериканский',
			middle_eastern: 'Ближневосточный',
			caucasian: 'Кавказский',
			south_asian: 'Южноазиатский',
			mixed: 'Смешанный',
			other: 'Другой',
		}
		return m[l] || l
	}

	const hairColorLabel = (c: string | null) => {
		if (!c) return '—'
		const m: Record<string, string> = {
			blonde: 'Блонд',
			brunette: 'Брюнет',
			brown: 'Шатен',
			light_brown: 'Русый',
			red: 'Рыжий',
			gray: 'Седой',
			other: 'Другой',
		}
		return m[c] || c
	}

	const hairLenLabel = (l: string | null) => {
		if (!l) return '—'
		const m: Record<string, string> = {
			short: 'Короткие',
			medium: 'Средние',
			long: 'Длинные',
			bald: 'Лысый',
		}
		return m[l] || l
	}

	if (loading)
		return (
			<div className={styles.root}>
				<p className={styles.center}>
					<IconLoader size={18} /> Загрузка...
				</p>
			</div>
		)

	const renderActorModal = () => {
		if (!selectedActor) return null
		const a = selectedActor
		const photos = (a.media_assets || []).filter((m: any) => m.file_type === 'photo')
		const videos = (a.media_assets || []).filter((m: any) => m.file_type === 'video')
		const curSt = RESPONSE_STATUSES.find(s => s.value === (a.response_status || 'pending')) || RESPONSE_STATUSES[0]
		const fullName = a.display_name || `${a.last_name || ''} ${a.first_name || ''}`.trim() || 'Актёр'
		const isFav = favorites.has(a.profile_id)

		const maskPhone = (p: string) => {
			if (showContacts) return formatPhone(p)
			const d = p.replace(/\D/g, '')
			return `+7 *** *** ** ${d.slice(-2) || '**'}`
		}
		const maskEmail = (e: string) => {
			if (showContacts) return e
			const [u, d] = e.split('@')
			return `${u?.[0] || '*'}${'*'.repeat(Math.max(u.length - 1, 3))}@${'*'.repeat(d?.split('.')[0]?.length || 3)}.${d?.split('.')[1] || '***'}`
		}

		const SectionHead = ({ id, title }: { id: string; title: string }) => (
			<button className={styles.sectionToggle} onClick={() => toggleSection(id)}>
				<span className={styles.sectionToggleTitle}>{title}</span>
				{expandedSections[id] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
			</button>
		)

		return (
			<div className={styles.modalOverlay} onClick={() => setSelectedActor(null)}>
				<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
					<div className={styles.modalHeader}>
						<button className={styles.modalBackBtn} onClick={() => setSelectedActor(null)}>
							<IconArrowLeft size={16} />
						</button>
						<h3>{fullName}</h3>
						<button className={styles.modalClose} onClick={() => setSelectedActor(null)}>
							<IconX size={14} />
						</button>
					</div>

					{a.response_id && (
						<div className={styles.modalStatusBar}>
							<span className={styles.modalStatusLabel}>Статус отклика:</span>
							<div className={styles.rsRow}>
								{RESPONSE_STATUSES.map(s => {
									const active = curSt.value === s.value
									return (
										<button
											key={s.value}
											className={`${styles.rsChip} ${active ? s.cls : ''}`}
											onClick={() => {
												if (!active) {
													updateResponseStatus(a.response_id, s.value)
													setSelectedActor({ ...a, response_status: s.value })
												}
											}}
										>
											{s.icon}
											<span>{s.label}</span>
										</button>
									)
								})}
							</div>
						</div>
					)}

					<div className={styles.modalBody}>
						{photos.length > 0 ? (
							<div className={styles.carousel}>
								<div className={styles.carouselMain}>
									<img
										src={photos[carouselIdx]?.processed_url || photos[carouselIdx]?.original_url}
										alt=""
										className={styles.carouselImg}
										onClick={() => setLightboxIdx(carouselIdx)}
									/>
								<button
									className={`${styles.carouselFav} ${isFav ? styles.carouselFavActive : ''}`}
									onClick={(e) => toggleFavorite(a.profile_id, e)}
								>
										<IconStar size={18} />
									</button>
									{carouselIdx > 0 && (
										<button className={`${styles.carouselNav} ${styles.carouselPrev}`} onClick={() => setCarouselIdx(carouselIdx - 1)}>‹</button>
									)}
									{carouselIdx < photos.length - 1 && (
										<button className={`${styles.carouselNav} ${styles.carouselNext}`} onClick={() => setCarouselIdx(carouselIdx + 1)}>›</button>
									)}
								</div>
								{photos.length > 1 && (
									<div className={styles.carouselDots}>
										{photos.map((_: any, idx: number) => (
											<button
												key={idx}
												className={`${styles.carouselDot} ${idx === carouselIdx ? styles.carouselDotActive : ''}`}
												onClick={() => setCarouselIdx(idx)}
											/>
										))}
									</div>
								)}
								{photos.length > 1 && (
									<div className={styles.carouselThumbs}>
										{photos.map((m: any, idx: number) => (
											<img
												key={m.id}
												src={m.processed_url || m.original_url}
												alt=""
												className={`${styles.carouselThumb} ${idx === carouselIdx ? styles.carouselThumbActive : ''}`}
												onClick={() => setCarouselIdx(idx)}
											/>
										))}
									</div>
								)}
							</div>
						) : (
							<div className={styles.noPhoto}><IconUser size={48} /></div>
						)}

						{videos.length > 0 && (
							<div className={styles.videoSection}>
								<h4 className={styles.videoSectionTitle}>ВИДЕО</h4>
								{videos.map((m: any) => (
									<div key={m.id} className={styles.videoItem}>
										<span className={styles.videoLabel}>Видеовизитка</span>
										<video src={m.processed_url || m.original_url} controls className={styles.videoPlayer} />
									</div>
								))}
							</div>
						)}

					<button
						className={`${styles.favBtnLarge} ${isFav ? styles.favBtnLargeActive : ''}`}
						onClick={(e) => toggleFavorite(a.profile_id, e)}
					>
							<IconHeart size={14} style={isFav ? { fill: 'currentColor' } : {}} />
							{isFav ? 'В избранном' : '+ Избранное'}
						</button>

						<SectionHead id="main" title="ОСНОВНОЕ" />
						{expandedSections.main && (
							<div className={styles.sectionContent}>
								<div className={styles.detailRow}><span>Возраст</span><b>{a.age ? `${a.age} лет` : (a.date_of_birth ? `${new Date().getFullYear() - new Date(a.date_of_birth).getFullYear()} лет` : '—')}</b></div>
								<div className={styles.detailRow}><span>Пол</span><b>{genderLabel(a.gender)}</b></div>
								<div className={styles.detailRow}><span>Город проживания</span><b>{a.city || '—'}</b></div>
								<div className={styles.detailRow}><span>Квалификация</span><b>{qualLabel(a.qualification)}</b></div>
								{a.experience != null && <div className={styles.detailRow}><span>Опыт</span><b>{a.experience} лет</b></div>}
								<div className={styles.detailRow}><span>Тип внешности</span><b>{lookLabel(a.look_type)}</b></div>
								<div className={styles.detailRow}><span>Телосложение</span><b>{a.body_type || '—'}</b></div>
								<div className={styles.detailRow}><span>Рост</span><b>{a.height || '—'}</b></div>
								<div className={styles.detailRow}><span>Вес</span><b>{a.weight || '—'}</b></div>
								<div className={styles.detailRow}><span>Размер одежды</span><b>{a.clothing_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Размер обуви</span><b>{a.shoe_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Длина волос</span><b>{hairLenLabel(a.hair_length)}</b></div>
								<div className={styles.detailRow}><span>Цвет волос</span><b>{hairColorLabel(a.hair_color)}</b></div>
								<div className={styles.detailRow}><span>Цвет глаз</span><b>{a.eye_color || '—'}</b></div>
								{a.bust_volume && <div className={styles.detailRow}><span>Обхват груди</span><b>{a.bust_volume} см</b></div>}
								{a.waist_volume && <div className={styles.detailRow}><span>Обхват талии</span><b>{a.waist_volume} см</b></div>}
								{a.hip_volume && <div className={styles.detailRow}><span>Обхват бёдер</span><b>{a.hip_volume} см</b></div>}
							</div>
						)}

						<SectionHead id="contacts" title="КОНТАКТЫ" />
						{expandedSections.contacts && (
							<div className={styles.sectionContent}>
								<div className={styles.detailRow}>
									<span><IconPhone size={13} /> Телефон</span>
									<b>{a.phone_number ? maskPhone(a.phone_number) : '—'}</b>
								</div>
								<div className={styles.detailRow}>
									<span><IconMail size={13} /> Email</span>
									<b>{a.email ? maskEmail(a.email) : '—'}</b>
								</div>
								{!showContacts && (a.phone_number || a.email) && (
									<button className={styles.showContactsBtn} onClick={() => setShowContacts(true)}>Показать</button>
								)}
								{a.video_intro && (
									<div className={styles.detailRow}>
										<span>Видео-визитка</span>
										<b><a href={a.video_intro} target="_blank" rel="noreferrer" className={styles.link}>{a.video_intro}</a></b>
									</div>
								)}
								{a.self_test_url && (
									<div className={styles.detailRow}>
										<span>Самопроба</span>
										<b><a href={a.self_test_url} target="_blank" rel="noreferrer" className={styles.link}>{a.self_test_url}</a></b>
									</div>
								)}
							</div>
						)}

						<SectionHead id="about" title="О СЕБЕ" />
						{expandedSections.about && (
							<div className={styles.sectionContent}>
								<p className={styles.aboutText}>{a.about_me || 'Информация временно отсутствует'}</p>
							</div>
						)}

						<SectionHead id="skills" title="НАВЫКИ" />
						{expandedSections.skills && (
							<div className={styles.sectionContent}>
								{a.skills && a.skills.length > 0 ? (
									<div className={styles.skillTags}>
										{(typeof a.skills === 'string' ? a.skills.split(',') : a.skills).map((s: string, i: number) => (
											<span key={i} className={styles.skillTag}>{s.trim()}</span>
										))}
									</div>
								) : (
									<p className={styles.emptyInfo}>Информация временно отсутствует</p>
								)}
							</div>
						)}

						<SectionHead id="notes" title="МОИ ЗАМЕТКИ" />
						{expandedSections.notes && (
							<div className={styles.sectionContent}>
								<p className={styles.notesHint}>Здесь вы можете оставлять комментарии, личные заметки, информацию об актере, которые будут видны только вам</p>
								<textarea
									className={styles.notesArea}
									placeholder="Введите заметку..."
									value={actorNotes[a.profile_id] || ''}
									onChange={(e) => setActorNotes(prev => ({ ...prev, [a.profile_id]: e.target.value }))}
									rows={3}
								/>
							</div>
						)}

						<div className={styles.detailRow}>
							<span>Дата отклика</span>
							<b>{a.responded_at ? new Date(a.responded_at).toLocaleDateString('ru-RU') : '—'}</b>
						</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<>
			<div className={styles.root}>
				<header className={styles.header}>
					<button
						onClick={() => router.back()}
						className={styles.backBtn}
					>
						<IconArrowLeft size={14} /> Назад
					</button>
					<h1>Проект #{projectId}</h1>
				</header>

				<div className={styles.content}>
					<section className={styles.section}>
						<div className={styles.sectionHeader}>
							<h2>Информация</h2>
							<div className={styles.actions}>
								{project?.status !== 'published' && (
									<button
										onClick={publishProject}
										className={styles.btnPublish}
									>
										<IconZap size={13} /> Опубликовать
									</button>
								)}
								{!editing && (
									<button
										onClick={() => setEditing(true)}
										className={styles.btnEdit}
									>
										<IconEdit size={13} /> Редактировать
									</button>
								)}
								<button
									onClick={deleteProject}
									className={styles.btnDelete}
								>
									<IconTrash size={13} /> Удалить
								</button>
							</div>
						</div>

						{editing ? (
							<div className={styles.editForm}>
								<input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className={styles.input}
									placeholder="Название"
								/>
								<textarea
									value={desc}
									onChange={(e) => setDesc(e.target.value)}
									className={styles.textarea}
									placeholder="Описание"
									rows={3}
								/>
								<div className={styles.editActions}>
									<button
										onClick={saveProject}
										className={styles.btnSave}
									>
										Сохранить
									</button>
									<button
										onClick={() => setEditing(false)}
										className={styles.btnCancel}
									>
										Отмена
									</button>
								</div>
							</div>
						) : (
							<div className={styles.infoCard}>
								<h3>{project?.title}</h3>
								<p>{project?.description}</p>
								<div className={styles.meta}>
									<span>
										Статус: <b>{project?.status}</b>
									</span>
									<span>
										Откликов: <b>{respondents.length}</b>
									</span>
									<span>
										Создан:{' '}
										{project?.created_at?.split('T')[0]}
									</span>
								</div>
							</div>
						)}
					</section>

					<section className={styles.section}>
						<h2><IconMessageSquare size={16} /> Чат проекта</h2>
						<div className={styles.projectChat}>
							<div className={styles.projectChatMessages}>
								{chatMessages.length === 0 ? (
									<div className={styles.projectChatEmpty}>Нет сообщений. Начните обсуждение проекта!</div>
								) : chatMessages.map((m: any) => {
									const roleBadge = m.sender_role === 'owner' ? '👑 SuperAdmin'
										: m.sender_role === 'employer_pro' ? '⭐ Админ PRO'
										: m.sender_role === 'employer' || m.sender_role === 'administrator' || m.sender_role === 'manager' ? '📋 Админ'
										: ''
									return (
									<div key={m.id} className={`${styles.pcMsg} ${m.sender_role === 'owner' ? styles.pcMsgOwner : ''}`}>
										<div className={styles.pcMsgHead}>
											<span className={styles.pcMsgName}>{m.sender_name}</span>
											{roleBadge && <span className={styles.pcMsgRole}>{roleBadge}</span>}
											<span className={styles.pcMsgTime}>{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}</span>
										</div>
										<p className={styles.pcMsgText}>{m.message}</p>
									</div>
									)
								})}
								<div ref={chatEndRef} />
							</div>
							<div className={styles.pcInputArea}>
								<input
									value={chatInput}
									onChange={(e) => setChatInput(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
									placeholder="Напишите сообщение..."
									className={styles.pcInput}
								/>
								<button
									onClick={sendChatMessage}
									disabled={chatSending || !chatInput.trim()}
									className={styles.pcSendBtn}
								>
									{chatSending ? <IconLoader size={14} /> : <IconSend size={14} />}
								</button>
							</div>
						</div>
					</section>

					<section className={styles.section}>
						<h2><IconUsers size={16} /> Команда проекта</h2>
						<div className={styles.collabList}>
							{collaborators.map((c: any) => (
								<div key={c.id} className={styles.collabItem}>
									<div className={styles.collabInfo}>
										<strong>{c.first_name || ''} {c.last_name || ''}</strong>
										<span>{c.email}</span>
									</div>
									<span className={styles.collabRole}>{c.role === 'editor' ? 'Редактор' : 'Наблюдатель'}</span>
									<button className={styles.collabRemove} onClick={async () => {
										await api('DELETE', `employer/projects/${projectId}/collaborators/${c.id}/`)
										setCollaborators(prev => prev.filter(x => x.id !== c.id))
									}}>
										<IconX size={12} />
									</button>
								</div>
							))}
						</div>
						<div className={styles.collabForm}>
							<input
								value={collabEmail}
								onChange={(e) => setCollabEmail(e.target.value)}
								placeholder="Email коллеги..."
								className={styles.input}
							/>
							<button
								className={styles.btnCollabAdd}
								disabled={addingCollab || !collabEmail.trim()}
								onClick={async () => {
									setAddingCollab(true)
									const res = await api('POST', `employer/projects/${projectId}/collaborators/?user_email=${encodeURIComponent(collabEmail)}&role=editor`)
									if (res?.ok) {
										const fresh = await api('GET', `employer/projects/${projectId}/collaborators/`)
										setCollaborators(fresh?.collaborators || [])
										setCollabEmail('')
									} else {
										alert(res?.detail || 'Не удалось добавить')
									}
									setAddingCollab(false)
								}}
							>
								{addingCollab ? <IconLoader size={13} /> : <IconPlus size={13} />}
								Добавить
							</button>
						</div>
					</section>

					<section className={styles.section}>
						<h2><IconFilm size={16} /> Кастинги проекта ({subCastings.length})</h2>
						{subCastings.length > 0 && (
							<div className={styles.castingList}>
								{subCastings.map((c: any) => (
									<div key={c.id} className={styles.castingItem} onClick={() => router.push(`/dashboard/project/${c.id}`)}>
										<div className={styles.castingInfo}>
											<h4>{c.title}</h4>
											<p>{c.description?.slice(0, 80)}{c.description?.length > 80 ? '…' : ''}</p>
										</div>
										<div className={styles.castingMeta}>
											<span className={`${styles.castingStatus} ${c.status === 'published' ? styles.published : ''}`}>
												{c.status === 'published' ? 'Активный' : c.status === 'closed' ? 'Закрыт' : 'Черновик'}
											</span>
											<span className={styles.castingResponses}>{c.response_count} откликов</span>
										</div>
									</div>
								))}
							</div>
						)}
						<div className={styles.castingForm}>
							<input value={newCastTitle} onChange={(e) => setNewCastTitle(e.target.value)} placeholder="Название кастинга" className={styles.input} />
							<input value={newCastDesc} onChange={(e) => setNewCastDesc(e.target.value)} placeholder="Описание (необязательно)" className={styles.input} />
							<button
								className={styles.btnCastCreate}
								disabled={creatingCast || !newCastTitle.trim()}
								onClick={async () => {
									setCreatingCast(true)
									try {
										const res = await api('POST', `employer/projects/${projectId}/castings/?title=${encodeURIComponent(newCastTitle)}&description=${encodeURIComponent(newCastDesc || '-')}`)
										if (res?.id) {
											setSubCastings(prev => [res, ...prev])
											setNewCastTitle('')
											setNewCastDesc('')
										} else {
											const msg = typeof res?.detail === 'string' ? res.detail : JSON.stringify(res?.detail || res)
											alert(msg || 'Ошибка создания кастинга')
										}
									} catch {
										alert('Ошибка сети')
									}
									setCreatingCast(false)
								}}
							>
								{creatingCast ? <IconLoader size={13} /> : <IconPlus size={13} />}
								Создать кастинг
							</button>
						</div>
					</section>

		{(() => {
			const favRespondents = respondents.filter((r: any) => favorites.has(r.profile_id))
			if (favRespondents.length === 0 && favorites.size === 0) return null
			return (
				<section className={styles.section}>
					<h2><IconHeart size={16} /> Избранные актёры ({favRespondents.length})</h2>
					{favRespondents.length === 0 ? (
						<p className={styles.empty}>Нажмите на сердечко у актёра, чтобы добавить в избранное</p>
					) : (
						<div className={styles.actorList}>
							{favRespondents.map((r: any, i: number) => {
								const firstPhoto = (r.media_assets || []).find((m: any) => m.file_type === 'photo')
								const favSt = RESPONSE_STATUSES.find(s => s.value === 'shortlisted') || RESPONSE_STATUSES[0]
								return (
									<div key={i} className={styles.actorCard} onClick={() => openActorModal(r)}>
										<div className={styles.actorPhoto}>
											{firstPhoto ? (
												<img src={firstPhoto.processed_url || firstPhoto.original_url || r.photo_url} alt="" />
											) : r.photo_url ? (
												<img src={r.photo_url} alt="" />
											) : (
												<div className={styles.actorPhotoPlaceholder}><IconUser size={28} /></div>
											)}
										</div>
										<div className={styles.actorInfo}>
											<h4>{r.display_name || `${r.last_name || ''} ${r.first_name || ''}`.trim() || 'Актёр'}</h4>
											<span className={`${styles.actorStatusBadge} ${favSt.cls}`}>
												{favSt.icon} {favSt.label}
											</span>
										</div>
										<div className={styles.actorActions}>
											<button
												className={`${styles.actorActionBtn} ${styles.actorActionActive}`}
												onClick={(e) => toggleFavorite(r.profile_id, e)}
												title="Убрать из избранного"
											>
												<IconHeart size={16} style={{ fill: 'currentColor' }} />
											</button>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</section>
			)
		})()}

		<section className={styles.section}>
			<h2>
				<IconMask size={16} /> Откликнувшиеся актёры ({respondents.length})
				{favorites.size > 0 && (
					<button onClick={() => setShowFavorites(!showFavorites)} className={`${styles.btnFav} ${showFavorites ? styles.btnFavActive : ''}`}>
						<IconHeart size={13} style={showFavorites ? { fill: 'currentColor' } : {}} /> Только избранные ({favorites.size})
					</button>
				)}
			</h2>

				{respondents.length > 0 && (
					<div className={styles.sortBar}>
						<div className={styles.sortInfo}>
							<IconSortDesc size={14} />
							<span>сортировка:</span>
							<button className={styles.sortToggle} onClick={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}>
								{sortBy === 'date' ? 'дата отклика' : 'по имени'} <IconChevronDown size={12} />
							</button>
						</div>
						<div className={styles.sortActions}>
							<button className={styles.sortIconBtn} onClick={() => setShowSearch(!showSearch)} title="Поиск"><IconSearch size={16} /></button>
							<button className={styles.sortIconBtn} title="Фильтры"><IconFilter size={16} /></button>
						</div>
					</div>
				)}

				{showSearch && (
					<div className={styles.searchBar}>
						<IconSearch size={14} />
						<input
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Поиск по имени..."
							className={styles.searchInput}
							autoFocus
						/>
						{searchTerm && (
							<button className={styles.searchClear} onClick={() => setSearchTerm('')}><IconX size={12} /></button>
						)}
					</div>
				)}

				{respondents.length === 0 ? (
					<p className={styles.empty}>Пока нет откликов</p>
				) : (
					<div className={styles.actorList}>
						{(() => {
							let list = showFavorites ? respondents.filter((r: any) => favorites.has(r.profile_id)) : respondents
							if (searchTerm.trim()) {
								const q = searchTerm.toLowerCase()
								list = list.filter((r: any) =>
									(r.first_name || '').toLowerCase().includes(q) ||
									(r.last_name || '').toLowerCase().includes(q) ||
									(r.display_name || '').toLowerCase().includes(q)
								)
							}
							if (sortBy === 'name') {
								list = [...list].sort((a, b) => ((a.last_name || a.first_name || '') > (b.last_name || b.first_name || '') ? 1 : -1))
							} else {
								list = [...list].sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())
							}
							return list
						})().map((r: any, i: number) => {
							const firstPhoto = (r.media_assets || []).find((m: any) => m.file_type === 'photo')
							const isFav = favorites.has(r.profile_id)
							const respondedDate = r.responded_at
								? new Date(r.responded_at).toLocaleDateString('ru-RU') + ', ' + new Date(r.responded_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
								: ''

							return (
								<div key={i} className={styles.actorCard} onClick={() => openActorModal(r)}>
									<div className={styles.actorPhoto}>
										{firstPhoto ? (
											<img src={firstPhoto.processed_url || firstPhoto.original_url || r.photo_url} alt="" />
										) : r.photo_url ? (
											<img src={r.photo_url} alt="" />
										) : (
											<div className={styles.actorPhotoPlaceholder}><IconUser size={28} /></div>
										)}
									</div>
									<div className={styles.actorInfo}>
										<h4>{r.display_name || `${r.last_name || ''} ${r.first_name || ''}`.trim() || 'Актёр'}</h4>
										<span className={styles.actorDateLabel}>{respondedDate}</span>
									<button
										className={`${styles.actorFavDrop} ${isFav ? styles.actorFavDropActive : ''}`}
										onClick={(e) => toggleFavorite(r.profile_id, e)}
									>
										<IconHeart size={11} style={isFav ? { fill: 'currentColor' } : {}} />
										{isFav ? 'В избранном' : '+ Избранное'}
									</button>
									</div>
								<div className={styles.actorActions}>
									<button
										className={styles.actorActionBtn}
										onClick={(e) => { e.stopPropagation(); openActorModal(r) }}
										title="Просмотр"
									>
										<IconEye size={16} />
									</button>
									<button
										className={`${styles.actorActionBtn} ${isFav ? styles.actorActionActive : ''}`}
										onClick={(e) => toggleFavorite(r.profile_id, e)}
										title="Избранное"
									>
										<IconHeart size={16} style={isFav ? { fill: 'currentColor' } : {}} />
									</button>
								</div>
								</div>
							)
						})}
					</div>
				)}
			</section>

					<section className={styles.section}>
						<h2><IconClipboard size={16} /> Отчёты ({reports.length})</h2>
						{reports.length > 0 && (
							<div className={styles.reportList}>
								{reports.map((r: any) => (
									<div key={r.id} className={styles.reportItem} onClick={async () => {
										const detail = await api('GET', `employer/reports/${r.id}/`)
										setSelectedReport(detail)
									}}>
										<strong>{r.title}</strong>
										<span>{new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
									</div>
								))}
							</div>
						)}
						<div className={styles.reportForm}>
							<input value={newReportTitle} onChange={(e) => setNewReportTitle(e.target.value)} placeholder="Название отчёта" className={styles.input} />
							<button
								className={styles.btnReportCreate}
								disabled={creatingReport || !newReportTitle.trim()}
								onClick={async () => {
									setCreatingReport(true)
									const res = await api('POST', `employer/reports/create/?casting_id=${projectId}&title=${encodeURIComponent(newReportTitle)}`)
									if (res?.id) {
										setReports(prev => [{ ...res, created_at: new Date().toISOString() }, ...prev])
										setNewReportTitle('')
										if (respondents.length > 0) {
											const pids = respondents.map((r: any) => r.profile_id)
											const query = pids.map((p: number) => `profile_ids=${p}`).join('&')
											await api('POST', `employer/reports/${res.id}/add-actors/?${query}`)
										}
									}
									setCreatingReport(false)
								}}
							>
								{creatingReport ? <IconLoader size={13} /> : <IconClipboard size={13} />}
								Создать отчёт
							</button>
						</div>

						{selectedReport && (
							<div className={styles.reportDetail}>
								<div className={styles.reportDetailHeader}>
									<h3>{selectedReport.title}</h3>
									<button onClick={() => setSelectedReport(null)}><IconX size={14} /></button>
								</div>
								<p className={styles.reportDetailMeta}>
									Актёров в отчёте: {selectedReport.total || selectedReport.actors?.length || 0}
								</p>
								<div className={styles.reportActorList}>
									{(selectedReport.actors || []).map((a: any) => (
										<div key={a.profile_id} className={styles.reportActorItem}>
											<span>{a.first_name} {a.last_name}</span>
											<span className={styles.reportActorGender}>
												{a.gender === 'male' ? 'М' : a.gender === 'female' ? 'Ж' : '—'}
											</span>
											{a.favorite && <IconStar size={12} style={{ color: '#ffc107' }} />}
										</div>
									))}
								</div>
							</div>
						)}
					</section>

					<section className={styles.section}>
						<h2>Обсуждение</h2>
						<div className={styles.chatBox}>
							{chatLogs.length === 0 ? (
								<p className={styles.empty}>Нет сообщений</p>
							) : (
								chatLogs.map((log: any, i: number) => (
									<div key={i} className={styles.chatMsg}>
										<span className={styles.chatUser}>
											{log.user_name ||
												`User #${log.user_id}`}
										</span>
										<span className={styles.chatText}>
											{log.message}
										</span>
										<span className={styles.chatTime}>
											{log.created_at?.split('.')[0]}
										</span>
									</div>
								))
							)}
						</div>
						<div className={styles.chatInput}>
							<input
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								placeholder="Написать комментарий..."
								className={styles.input}
								onKeyDown={(e) =>
									e.key === 'Enter' && sendComment()
								}
							/>
							<button
								onClick={sendComment}
								className={styles.btnSend}
							>
								<IconSend size={14} />
							</button>
						</div>
					</section>
				</div>
				<LiveChat castingId={Number(projectId) || 0} />
			</div>

			{renderActorModal()}

			{lightboxIdx !== null && selectedActor && (() => {
				const photos = (selectedActor.media_assets || []).filter((m: any) => m.file_type === 'photo')
				if (!photos[lightboxIdx]) return null
				return (
					<div className={styles.lightbox} onClick={() => setLightboxIdx(null)}>
						<button className={styles.lightboxClose} onClick={() => setLightboxIdx(null)}><IconX size={20} /></button>
						{lightboxIdx > 0 && (
							<button className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}>‹</button>
						)}
						<img src={photos[lightboxIdx].processed_url || photos[lightboxIdx].original_url} alt="" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
						{lightboxIdx < photos.length - 1 && (
							<button className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}>›</button>
						)}
						<div className={styles.lightboxCounter}>{lightboxIdx + 1} / {photos.length}</div>
					</div>
				)
			})()}
		</>
	)
}
