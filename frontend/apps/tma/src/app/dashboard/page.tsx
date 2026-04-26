'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef, type MouseEvent } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { http } from '~packages/lib'
import { API_URL } from '~/shared/api-url'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconFilm,
	IconLogOut,
	IconPlus,
	IconFolder,
	IconLoader,
	IconSend,
	IconShield,
	IconZap,
	IconCheck,
	IconX,
	IconMessageSquare,
	IconBuilding,
	IconBriefcase,
	IconAward,
	IconClipboard,
	IconUsers,
	IconHeart,
	IconCalendar,
	IconEye,
	IconUser,
	IconCamera,
	IconBell,
} from '~packages/ui/icons'
import ProjectChatsFab from '~/widgets/project-chats-fab/project-chats-fab'
import styles from './dashboard.module.scss'

const EMOJI_ICON_MAP: Record<string, React.ReactNode> = {
	'📋': <IconClipboard size={13} />,
	'🏢': <IconBuilding size={13} />,
	'💼': <IconBriefcase size={13} />,
	'🎬': <IconFilm size={13} />,
	'⭐': <IconAward size={13} />,
	'✅': <IconCheck size={13} />,
	'❌': <IconX size={13} />,
}

function renderTicketMessage(text: string, lineClass: string, iconClass: string, titleClass: string) {
	const lines = text.split('\n')
	return lines.map((line, i) => {
		const chars = [...line]
		const first = chars[0] || ''
		const icon = EMOJI_ICON_MAP[first]
		if (icon) {
			const rest = chars.slice(1).join('').trimStart()
			const isTitle = i === 0
			return (
				<span key={i} className={`${lineClass} ${isTitle ? titleClass : ''}`}>
					<span className={iconClass}>{icon}</span>
					<span>{rest}</span>
				</span>
			)
		}
		return line ? <span key={i} className={lineClass}>{line}</span> : null
	}).filter(Boolean)
}

export default function DashboardPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [projects, setProjects] = useState<any[]>([])
	const [archivedProjects, setArchivedProjects] = useState<any[]>([])
	const [subscription, setSubscription] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [newTitle, setNewTitle] = useState('')
	const [newDesc, setNewDesc] = useState('')
	const [newProjectPhoto, setNewProjectPhoto] = useState<File | null>(null)
	const [creating, setCreating] = useState(false)
	const [uploadingProjectId, setUploadingProjectId] = useState<number | null>(null)
	const [photoTargetProjectId, setPhotoTargetProjectId] = useState<number | null>(null)
	const [publishingProjectId, setPublishingProjectId] = useState<number | null>(null)
	const [archiveLoadingProjectId, setArchiveLoadingProjectId] = useState<number | null>(null)
	const [isVerified, setIsVerified] = useState<boolean | null>(null)
	const [isOwner, setIsOwner] = useState(false)
	const [isPro, setIsPro] = useState(false)
	const [ticketStatus, setTicketStatus] = useState<string | null>(null)
	const [favCount, setFavCount] = useState(0)

	const [notifications, setNotifications] = useState<any[]>([])
	const [showNotifs, setShowNotifs] = useState(false)
	const [meData, setMeData] = useState<any>(null)
	const [editingProfile, setEditingProfile] = useState(false)
	const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '' })
	const [savingProfile, setSavingProfile] = useState(false)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)
	const [showCreateProject, setShowCreateProject] = useState(false)
	const [showAvatarLightbox, setShowAvatarLightbox] = useState(false)
	const [teamModal, setTeamModal] = useState<{ projectId: number; projectTitle: string } | null>(null)
	const [teamCollaborators, setTeamCollaborators] = useState<any[]>([])
	const [teamLoading, setTeamLoading] = useState(false)
	const [teamEmail, setTeamEmail] = useState('')
	const [teamAdding, setTeamAdding] = useState(false)
	const [teamInviteUrl, setTeamInviteUrl] = useState<string | null>(null)
	const [teamCreatingInvite, setTeamCreatingInvite] = useState(false)
	const avatarInputRef = useRef<HTMLInputElement>(null)

	const [formStep, setFormStep] = useState<'form' | 'chat'>('form')
	const [companyName, setCompanyName] = useState('')
	const [aboutText, setAboutText] = useState('')
	const [projectsText, setProjectsText] = useState('')
	const [experienceText, setExperienceText] = useState('')
	const [submitting, setSubmitting] = useState(false)

	const [ticketMessages, setTicketMessages] = useState<any[]>([])
	const [chatInput, setChatInput] = useState('')
	const [chatSending, setChatSending] = useState(false)
	const chatEndRef = useRef<HTMLDivElement>(null)
	const newProjectPhotoInputRef = useRef<HTMLInputElement>(null)
	const projectPhotoInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
		try {
			const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
			if (payload.role === 'owner') setIsOwner(true)
			if (['owner', 'employer_pro', 'administrator', 'manager'].includes(payload.role)) setIsPro(true)
		} catch {}
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		try {
			const res = await http.request({
				method: method as any,
				url: path,
				data: body,
			})
			return res.data
		} catch (error: any) {
			return error?.response?.data || null
		}
	}, [])

	const getRequestErrorMessage = (error: any, fallback: string) => {
		const detail = error?.response?.data?.detail
		return typeof detail === 'string' ? detail : fallback
	}

	const normalizeProjectImageUrl = (url?: string | null) => {
		if (!url) return null
		try {
			const apiBase = new URL(API_URL, window.location.origin)
			const parsed = new URL(url, apiBase)
			if (
				(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.pathname.startsWith('/uploads/')) &&
				parsed.pathname.startsWith('/uploads/')
			) {
				return `${apiBase.origin}${parsed.pathname}${parsed.search}`
			}
			return parsed.toString()
		} catch {
			return url
		}
	}

	const normalizeProject = useCallback((project: any) => ({
		...project,
		image_url: normalizeProjectImageUrl(project?.image_url),
	}), [])

	const compressForUpload = (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => {
				const img = new window.Image()
				img.onload = () => {
					const maxSide = 1280
					let w = img.width
					let h = img.height
					if (w > maxSide || h > maxSide) {
						const ratio = Math.min(maxSide / w, maxSide / h)
						w = Math.round(w * ratio)
						h = Math.round(h * ratio)
					}
					const canvas = document.createElement('canvas')
					canvas.width = w
					canvas.height = h
					const ctx = canvas.getContext('2d')
					if (!ctx) {
						reject(new Error('Canvas not supported'))
						return
					}
					ctx.drawImage(img, 0, 0, w, h)
					resolve(canvas.toDataURL('image/jpeg', 0.75))
				}
				img.onerror = () => {
					if (typeof reader.result === 'string') resolve(reader.result)
					else reject(new Error('Не удалось прочитать изображение'))
				}
				img.src = reader.result as string
			}
			reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
			reader.readAsDataURL(file)
		})
	}

	const refreshProjects = useCallback(async () => {
		const [activeData, archivedData] = await Promise.all([
			api('GET', 'employer/projects/'),
			api('GET', 'employer/projects/?archived=true'),
		])
		setProjects((activeData?.projects || []).map(normalizeProject))
		setArchivedProjects((archivedData?.projects || []).map(normalizeProject))
	}, [api, normalizeProject])

	const uploadProjectImage = useCallback(async (projectId: number, file: File) => {
		setUploadingProjectId(projectId)
		try {
			const image_base64 = await compressForUpload(file)
			const res = await http.post(`employer/projects/${projectId}/upload-image-json/`, { image_base64 })
			const imageUrl = normalizeProjectImageUrl(res?.data?.image_url)
			if (imageUrl) {
				setProjects(prev => prev.map(project => (
					project.id === projectId ? { ...project, image_url: imageUrl } : project
				)))
			} else {
				await refreshProjects()
			}
		} catch (error: any) {
			alert(getRequestErrorMessage(error, 'Не удалось загрузить фото проекта'))
		} finally {
			setUploadingProjectId(null)
		}
	}, [getRequestErrorMessage, refreshProjects])

	useEffect(() => {
		if (!token) return
		const load = async () => {
			try {
			const [sub, proj, archivedProj, verif, favData, notifData, me] = await Promise.all([
				api('GET', 'subscriptions/my/'),
				api('GET', 'employer/projects/').catch(() => ({ projects: [] })),
				api('GET', 'employer/projects/?archived=true').catch(() => ({ projects: [] })),
				api('GET', 'employer/projects/verification-status/').catch(() => ({ is_verified: false })),
				api('GET', 'employer/favorites/ids/').catch(() => ({ profile_ids: [] })),
				api('GET', 'notifications/?unread_only=false').catch(() => ({ notifications: [] })),
				api('GET', 'auth/v2/me/').catch(() => null),
			])
			setSubscription(sub)
			setProjects((proj?.projects || []).map(normalizeProject))
			setArchivedProjects((archivedProj?.projects || []).map(normalizeProject))
			setFavCount(favData?.profile_ids?.length || 0)
			setNotifications(notifData?.notifications || [])
			if (me) {
				setMeData(me)
				setProfileForm({ first_name: me.first_name || '', last_name: me.last_name || '' })
			}
				setIsVerified(verif?.is_verified ?? false)
				setTicketStatus(verif?.ticket_status || null)
				if (verif?.ticket_status === 'open' || verif?.ticket_status === 'approved') {
					setFormStep('chat')
					loadTicketMessages()
				} else if (verif?.ticket_status === 'rejected') {
					loadTicketMessages()
				}
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, api, normalizeProject])

	const saveProfile = async () => {
		setSavingProfile(true)
		try {
			const res = await api('PATCH', 'auth/v2/me/', profileForm)
			if (res?.id) {
				setMeData(res)
				setEditingProfile(false)
			}
		} catch {}
		setSavingProfile(false)
	}

	const uploadAvatar = async (file: File) => {
		setUploadingAvatar(true)
		try {
			const formData = new FormData()
			formData.append('file', file)
			const res = await http.post('auth/v2/me/photo/', formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			})
			if (res?.data) {
				setMeData(res.data)
			}
		} catch (error: any) {
			alert(getRequestErrorMessage(error, 'Не удалось загрузить фото'))
		}
		setUploadingAvatar(false)
	}

	const openTeamModal = async (projectId: number, projectTitle: string) => {
		setTeamModal({ projectId, projectTitle })
		setTeamEmail('')
		setTeamInviteUrl(null)
		setTeamLoading(true)
		const data = await api('GET', `employer/projects/${projectId}/collaborators/`).catch(() => ({ collaborators: [] }))
		setTeamCollaborators(data?.collaborators || [])
		setTeamLoading(false)
	}

	const addTeamMember = async () => {
		if (!teamModal || !teamEmail.trim()) return
		setTeamAdding(true)
		const res = await api('POST', `employer/projects/${teamModal.projectId}/collaborators/?user_email=${encodeURIComponent(teamEmail)}&role=editor`)
		if (res?.ok) {
			const fresh = await api('GET', `employer/projects/${teamModal.projectId}/collaborators/`)
			setTeamCollaborators(fresh?.collaborators || [])
			setTeamEmail('')
		} else {
			alert(res?.detail || 'Не удалось добавить участника')
		}
		setTeamAdding(false)
	}

	const removeTeamMember = async (collabId: number) => {
		if (!teamModal) return
		await api('DELETE', `employer/projects/${teamModal.projectId}/collaborators/${collabId}/`)
		setTeamCollaborators(prev => prev.filter(x => x.id !== collabId))
	}

	const generateTeamInvite = async () => {
		if (!teamModal) return
		setTeamCreatingInvite(true)
		const res = await api('POST', `employer/projects/${teamModal.projectId}/collaborators/invite-link/?role=editor&expires_in_hours=168`)
		if (res?.invite_url) setTeamInviteUrl(res.invite_url)
		setTeamCreatingInvite(false)
	}

	const loadTicketMessages = async () => {
		const data = await api('GET', 'employer/projects/my-ticket/')
		if (data?.messages) {
			setTicketMessages(data.messages)
			if (data.ticket?.status === 'approved') {
				setIsVerified(true)
				setTicketStatus('approved')
			}
		}
	}

	useEffect(() => {
		if (formStep === 'chat' && ticketStatus === 'open') {
			const interval = setInterval(loadTicketMessages, 5000)
			return () => clearInterval(interval)
		}
	}, [formStep, ticketStatus])

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [ticketMessages])

	const submitVerificationRequest = async () => {
		setSubmitting(true)
		try {
			const params = new URLSearchParams({
				company_name: companyName,
				about_text: aboutText,
				projects_text: projectsText,
				experience_text: experienceText,
			})
			const res = await api('POST', `employer/projects/verification-request/?${params}`)
			if (res?.ticket_id) {
				setTicketStatus('open')
				setFormStep('chat')
				await loadTicketMessages()
			} else {
				const msg = typeof res?.detail === 'string' ? res.detail : (res?.detail?.message || 'Ошибка отправки заявки')
				alert(msg)
			}
		} catch {
			alert('Ошибка подключения к серверу')
		}
		setSubmitting(false)
	}

	const sendTicketMessage = async () => {
		if (!chatInput.trim() || chatSending) return
		setChatSending(true)
		try {
			const message = chatInput.trim()
			const res = await http.post(`employer/projects/my-ticket/message/?message=${encodeURIComponent(message)}`)
			if (res.data?.sent) {
				setChatInput('')
				await loadTicketMessages()
			}
		} catch (error: any) {
			alert(getRequestErrorMessage(error, 'Не удалось отправить сообщение'))
		} finally {
			setChatSending(false)
		}
	}

	const createProject = async () => {
		if (!newTitle.trim()) return
		setCreating(true)
		const res = await api('POST', 'employer/projects/', {
			title: newTitle, description: newDesc || '',
		})
		if (res?.id) {
			const createdProject = normalizeProject(res)
			setProjects(prev => [createdProject, ...prev])
			if (newProjectPhoto) {
				await uploadProjectImage(res.id, newProjectPhoto)
			}
			setNewTitle('')
			setNewDesc('')
			setNewProjectPhoto(null)
			if (newProjectPhotoInputRef.current) newProjectPhotoInputRef.current.value = ''
		} else if (res?.detail === 'employer_not_verified') {
			setIsVerified(false)
		} else if (res?.detail) {
			alert(typeof res.detail === 'string' ? res.detail : res.detail.event || res.detail.message || 'Ошибка')
		}
		setCreating(false)
	}

	const handleLogout = () => {
		logout()
		router.replace('/login')
	}

	const publishProjectFromList = async (event: MouseEvent, projectId: number) => {
		event.stopPropagation()
		setPublishingProjectId(projectId)
		const res = await api('POST', `employer/projects/${projectId}/publish/`)
		if (res?.id) {
			setProjects(prev => prev.map(project => (
				project.id === projectId ? { ...project, status: res.status } : project
			)))
		} else if (res?.detail === 'employer_not_verified') {
			setIsVerified(false)
		} else {
			alert(res?.detail || 'Не удалось опубликовать проект')
		}
		setPublishingProjectId(null)
	}

	const setProjectArchived = async (event: MouseEvent, project: any, archived: boolean) => {
		event.stopPropagation()
		const message = archived
			? `Переместить проект «${project.title}» в архив?`
			: `Вернуть проект «${project.title}» из архива?`
		if (!window.confirm(message)) return
		setArchiveLoadingProjectId(project.id)
		const res = await api('POST', `employer/projects/${project.id}/${archived ? 'archive' : 'restore'}/`)
		if (res?.id) {
			const normalized = normalizeProject({ ...project, ...res, is_archived: archived })
			if (archived) {
				setProjects(prev => prev.filter(item => item.id !== project.id))
				setArchivedProjects(prev => [normalized, ...prev.filter(item => item.id !== project.id)])
			} else {
				setArchivedProjects(prev => prev.filter(item => item.id !== project.id))
				setProjects(prev => [normalized, ...prev.filter(item => item.id !== project.id)])
			}
		} else {
			alert(res?.detail || (archived ? 'Не удалось архивировать проект' : 'Не удалось вернуть проект'))
		}
		setArchiveLoadingProjectId(null)
	}

	if (loading) {
		return (
			<div className={styles.root}>
				<p className={styles.loading}>
					<IconLoader size={18} /> Загрузка...
				</p>
			</div>
		)
	}

	const showVerificationBlock = isVerified === false && !isOwner
	const projectCount = projects.length
	const totalCastings = projects.reduce((sum, project) => sum + Number(project?.sub_castings_count || 0), 0)
	const totalReports = projects.reduce((sum, project) => sum + Number(project?.report_count || 0), 0)

	return (
		<>
			<div className={styles.root}>
				<header className={styles.header}>
					<div className={styles.brand}>
						<div className={styles.brandIcon}><IconFilm size={18} /></div>
						<h1>prosto<span>probuy</span></h1>
					</div>
					<div className={styles.headerRight}>
						<span className={styles.badge}>
							{isOwner ? 'SuperAdmin' : subscription?.plan_code === 'pro' ? 'PRO' : 'Админ'}
						</span>
						{isOwner && (
							<button onClick={() => router.push('/dashboard/admin')} className={styles.logoutBtn} style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
								SuperAdmin
							</button>
						)}
						<button onClick={handleLogout} className={styles.logoutBtn}>
							<IconLogOut size={14} /> Выход
						</button>
					</div>
				</header>

			{meData && (
				<section className={styles.myProfileCard}>
				<div className={styles.myProfileAvatar}>
					{meData.photo_url ? (
						<img
							src={meData.photo_url}
							alt="Аватар"
							className={styles.myProfileAvatarImg}
							onClick={() => setShowAvatarLightbox(true)}
							style={{ cursor: 'pointer' }}
						/>
					) : (
						<div className={styles.myProfileAvatarFallback}>
							<IconUser size={30} />
						</div>
					)}
						<button
							className={styles.myProfileAvatarBtn}
							onClick={() => avatarInputRef.current?.click()}
							disabled={uploadingAvatar}
						>
							{uploadingAvatar ? <IconLoader size={12} /> : <IconCamera size={12} />}
						</button>
						<input
							ref={avatarInputRef}
							type="file"
							accept="image/*"
							hidden
							onChange={(e) => {
								const f = e.target.files?.[0]
								if (f) uploadAvatar(f)
								e.target.value = ''
							}}
						/>
					</div>
					<div className={styles.myProfileInfo}>
						{editingProfile ? (
							<div className={styles.myProfileEditForm}>
								<input
									className={styles.myProfileInput}
									value={profileForm.first_name}
									onChange={(e) => setProfileForm(prev => ({ ...prev, first_name: e.target.value }))}
									placeholder="Имя"
								/>
								<input
									className={styles.myProfileInput}
									value={profileForm.last_name}
									onChange={(e) => setProfileForm(prev => ({ ...prev, last_name: e.target.value }))}
									placeholder="Фамилия"
								/>
								<div className={styles.myProfileEditActions}>
									<button className={styles.myProfileSaveBtn} onClick={saveProfile} disabled={savingProfile}>
										{savingProfile ? <IconLoader size={12} /> : <IconCheck size={12} />} Сохранить
									</button>
									<button className={styles.myProfileCancelBtn} onClick={() => setEditingProfile(false)}>
										<IconX size={12} /> Отмена
									</button>
								</div>
							</div>
						) : (
							<>
								<h2 className={styles.myProfileName}>
									{[meData.first_name, meData.last_name].filter(Boolean).join(' ') || 'Не указано'}
								</h2>
								<span className={styles.myProfileRole}>
									{isOwner ? 'SuperAdmin' : subscription?.plan_code === 'pro' ? 'Админ PRO' : 'Админ'}
								</span>
								{meData.email && <span className={styles.myProfileEmail}>{meData.email}</span>}
								<button className={styles.myProfileEditBtn} onClick={() => setEditingProfile(true)}>
									Редактировать профиль
								</button>
							</>
						)}
					</div>
				</section>
			)}

			{showAvatarLightbox && meData?.photo_url && (
				<div className={styles.avatarLightbox} onClick={() => setShowAvatarLightbox(false)}>
					<button className={styles.avatarLightboxClose} onClick={() => setShowAvatarLightbox(false)}>✕</button>
					<img src={meData.photo_url} alt="Фото профиля" className={styles.avatarLightboxImg} onClick={(e) => e.stopPropagation()} />
				</div>
			)}

			<input
				ref={newProjectPhotoInputRef}
				type="file"
				accept="image/*"
				style={{ display: 'none' }}
				onChange={(e) => setNewProjectPhoto(e.target.files?.[0] || null)}
			/>
			<input
				ref={projectPhotoInputRef}
				type="file"
				accept="image/*"
				style={{ display: 'none' }}
				onChange={async (e) => {
					const file = e.target.files?.[0]
					if (file && photoTargetProjectId) await uploadProjectImage(photoTargetProjectId, file)
					setPhotoTargetProjectId(null)
					e.target.value = ''
				}}
			/>

			<div className={styles.content}>

				<section className={styles.section}>
					<div className={styles.projectSectionHead}>
						<div>
							<h2>
								<span className={styles.sectionIcon}><IconFolder size={17} /></span>
								Проекты
							</h2>
							<p className={styles.sectionLead}>
								Открывайте проект, чтобы управлять кастингами, составом команды и своими отчётами в одном месте.
							</p>
						</div>
					</div>

						{projects.length === 0 ? (
							<p className={styles.empty}>
								<span className={styles.emptyIcon}><IconFolder size={28} /></span>
								Нет проектов. Создайте первый!
							</p>
						) : (
							<div className={styles.projectList}>
								{projects.map((p: any) => {
									const statusLabel = p.status === 'published' ? 'Опубликован' : p.status === 'closed' ? 'Завершён' : 'Черновик'
									const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
									const publishedDate = p.published_at ? new Date(p.published_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
									return (
										<div key={p.id} className={styles.castingCard}>
											<div className={styles.castingCardInner}>
												<div className={styles.castingPhoto}>
													<img src={getCoverImage(p.image_url, p.id || p.title)} alt={p.title} />
													<button
														className={styles.projectPhotoAction}
														onClick={(event) => {
															event.stopPropagation()
															setPhotoTargetProjectId(p.id)
															projectPhotoInputRef.current?.click()
														}}
														disabled={uploadingProjectId === p.id}
													>
														<IconCamera size={14} /> {uploadingProjectId === p.id ? 'Загрузка...' : p.image_url ? 'Сменить фото' : 'Добавить фото'}
													</button>
												</div>
												<div className={styles.castingBody}>
													<div className={styles.castingTitleRow}>
														<h3 className={styles.castingTitle}>{p.title}</h3>
														<span className={`${styles.castingStatus} ${p.status === 'published' ? styles.castingStatusPublished : p.status === 'closed' ? styles.castingStatusFinished : ''}`}>
															{statusLabel}
														</span>
													</div>
													<div className={styles.castingDates}>
														<span><IconCalendar size={13} /> Дата создания<br /><b>{createdDate}</b></span>
														{publishedDate && <span><IconCalendar size={13} /> Дата публикации<br /><b>{publishedDate}</b></span>}
														<span><IconUser size={13} /> Откликнулось<br /><b>{p.response_count || 0} актёров</b></span>
													</div>
												<div className={styles.projectMetaRow}>
													<button className={styles.projectMetaPill} onClick={() => router.push(`/dashboard/project/${p.id}#castings-section`)}>
														<IconFilm size={13} /> {p.sub_castings_count || 0} кастингов
													</button>
												<button className={styles.projectMetaPill} onClick={(e) => { e.stopPropagation(); openTeamModal(p.id, p.title) }}>
													<IconUsers size={13} /> {p.team_size || 1} в команде
												</button>
													<button className={styles.projectMetaPill} onClick={() => router.push(`/dashboard/project/${p.id}#reports-section`)}>
														<IconClipboard size={13} /> {p.report_count || 0} отчётов
													</button>
												</div>
												<div className={styles.castingActions}>
													<button className={styles.castingBtnDetails} onClick={() => router.push(`/dashboard/project/${p.id}`)}>
														<IconEye size={13} /> Открыть проект
													</button>
												{p.status !== 'published' && p.status !== 'closed' && (
													<button onClick={(event) => publishProjectFromList(event, p.id)} className={styles.castingBtnPublish} disabled={publishingProjectId === p.id}>
															{publishingProjectId === p.id ? <IconLoader size={11} /> : <IconZap size={11} />}
															{publishingProjectId === p.id ? 'Публикация...' : 'Опубликовать'}
														</button>
													)}
													<button
														onClick={(event) => setProjectArchived(event, p, true)}
														className={styles.castingBtnArchive}
														disabled={archiveLoadingProjectId === p.id}
													>
														{archiveLoadingProjectId === p.id ? <IconLoader size={11} /> : <IconFolder size={11} />}
														{archiveLoadingProjectId === p.id ? 'Архив...' : 'Архивировать'}
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

					<section className={`${styles.section} ${styles.archiveSection}`}>
						<div className={styles.projectSectionHead}>
							<div>
								<h2>
									<span className={styles.sectionIcon}><IconFolder size={17} /></span>
									Архив
								</h2>
								<p className={styles.sectionLead}>
									Сюда попадают проекты, которые больше не нужны в активной работе. Их можно вернуть обратно в список проектов.
								</p>
							</div>
							<span className={styles.archiveCount}>{archivedProjects.length}</span>
						</div>

						{archivedProjects.length === 0 ? (
							<p className={styles.empty}>
								<span className={styles.emptyIcon}><IconFolder size={28} /></span>
								В архиве пока пусто.
							</p>
						) : (
							<div className={styles.projectList}>
								{archivedProjects.map((p: any) => {
									const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
									const publishedDate = p.published_at ? new Date(p.published_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
									return (
										<div key={p.id} className={`${styles.castingCard} ${styles.castingCardArchived}`}>
											<div className={styles.castingCardInner}>
												<div className={styles.castingPhoto}>
													<img src={getCoverImage(p.image_url, p.id || p.title)} alt={p.title} />
												</div>
												<div className={styles.castingBody}>
													<div className={styles.castingTitleRow}>
														<h3 className={styles.castingTitle}>{p.title}</h3>
														<span className={`${styles.castingStatus} ${styles.castingStatusArchived}`}>
															В архиве
														</span>
													</div>
													<div className={styles.castingDates}>
														<span><IconCalendar size={13} /> Дата создания<br /><b>{createdDate}</b></span>
														{publishedDate && <span><IconCalendar size={13} /> Дата публикации<br /><b>{publishedDate}</b></span>}
														<span><IconUser size={13} /> Откликнулось<br /><b>{p.response_count || 0} актёров</b></span>
													</div>
													<div className={styles.projectMetaRow}>
														<span className={styles.projectMetaPillStatic}><IconFilm size={13} /> {p.sub_castings_count || 0} кастингов</span>
														<span className={styles.projectMetaPillStatic}><IconUsers size={13} /> {p.team_size || 1} в команде</span>
														<span className={styles.projectMetaPillStatic}><IconClipboard size={13} /> {p.report_count || 0} отчётов</span>
													</div>
													<div className={styles.castingActions}>
														<button className={styles.castingBtnDetails} onClick={() => router.push(`/dashboard/project/${p.id}`)}>
															<IconEye size={13} /> Открыть
														</button>
														<button
															onClick={(event) => setProjectArchived(event, p, false)}
															className={styles.castingBtnRestore}
															disabled={archiveLoadingProjectId === p.id}
														>
															{archiveLoadingProjectId === p.id ? <IconLoader size={11} /> : <IconCheck size={11} />}
															{archiveLoadingProjectId === p.id ? 'Возврат...' : 'Вернуть'}
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

					{/* Quick actions — between projects and subscription */}
				<div className={styles.quickGrid}>
					<button className={`${styles.quickCard} ${styles.quickCardGold}`} onClick={() => setShowCreateProject(prev => !prev)}>
						<div className={styles.quickCardIcon}><IconPlus size={24} /></div>
						<div className={styles.quickCardBody}>
							<strong>Создать проект</strong>
							<span>{projectCount} пр. · {totalCastings} каст. · {totalReports} отч.</span>
						</div>
						<span className={styles.quickCardChevron}>{showCreateProject ? '▲' : '▼'}</span>
					</button>

					{(isPro || subscription?.plan_code === 'pro') && (
						<button className={`${styles.quickCard} ${styles.quickCardPurple}`} onClick={() => router.push('/dashboard/actors')}>
							<div className={styles.quickCardIcon}><IconUsers size={24} /></div>
							<div className={styles.quickCardBody}>
								<strong>База актёров</strong>
								<span>Все анкеты</span>
							</div>
							<span className={styles.quickCardChevron}>→</span>
						</button>
					)}

					{favCount > 0 && (
						<button className={`${styles.quickCard} ${styles.quickCardRed}`} onClick={() => router.push('/dashboard/actors?favorites=true')}>
							<div className={styles.quickCardIcon}><IconHeart size={24} /></div>
							<div className={styles.quickCardBody}>
								<strong>Избранные</strong>
								<span>{favCount} актёров</span>
							</div>
							<span className={styles.quickCardChevron}>→</span>
						</button>
					)}

					{notifications.length > 0 && (
						<button className={`${styles.quickCard} ${styles.quickCardBlue}`} onClick={() => setShowNotifs(prev => !prev)}>
							<div className={styles.quickCardIcon}><IconBell size={24} /></div>
							<div className={styles.quickCardBody}>
								<strong>Уведомления</strong>
								<span>{notifications.filter((n: any) => !n.is_read).length} новых</span>
							</div>
							{notifications.filter((n: any) => !n.is_read).length > 0 && (
								<span className={styles.quickCardBadge}>{notifications.filter((n: any) => !n.is_read).length}</span>
							)}
						</button>
					)}
				</div>

				{showCreateProject && (
					<section className={styles.createProjectHero}>
						<div className={styles.createForm}>
							<input type="text" placeholder="Название проекта" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={styles.input} />
							<input type="text" placeholder="Краткое описание проекта" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className={styles.input} />
							<div className={styles.projectPhotoPicker}>
								<button type="button" className={styles.projectPhotoPickerBtn} onClick={() => newProjectPhotoInputRef.current?.click()}>
									<IconCamera size={15} /> {newProjectPhoto ? 'Заменить фото проекта' : 'Добавить фото проекта'}
								</button>
								{newProjectPhoto && (
									<div className={styles.projectPhotoPickerNote}>
										<span>{newProjectPhoto.name}</span>
										<button type="button" className={styles.projectPhotoClearBtn}
											onClick={() => { setNewProjectPhoto(null); if (newProjectPhotoInputRef.current) newProjectPhotoInputRef.current.value = '' }}>
											<IconX size={12} />
										</button>
									</div>
								)}
							</div>
							<button onClick={createProject} disabled={creating || !newTitle.trim()} className={styles.btnPrimary}>
								{creating ? <><IconLoader size={15} /> Создание...</> : <><IconPlus size={15} /> Создать проект</>}
							</button>
						</div>
					</section>
				)}

				{showNotifs && notifications.length > 0 && (
					<div className={styles.notifList}>
						{notifications.slice(0, 20).map((n: any) => (
							<div key={n.id} className={`${styles.notifItem} ${!n.is_read ? styles.notifItemUnread : ''}`}>
								<div className={styles.notifTitle}>{n.title}</div>
								{n.message && <div className={styles.notifMessage}>{n.message}</div>}
								<div className={styles.notifDate}>{n.created_at?.split('.')[0]?.replace('T', ' ')}</div>
							</div>
						))}
						<button className={styles.notifReadAll} onClick={async () => {
							await api('POST', 'notifications/read/')
							setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
						}}>Отметить всё прочитанным</button>
					</div>
				)}

				<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}><IconShield size={17} /></span>
							Подписка
						</h2>
						{subscription?.plan_code ? (
							<div className={styles.subCard}>
								<p><strong>План:</strong> {subscription.plan_name || subscription.plan_code}</p>
								<p><strong>Статус:</strong> {subscription.status}</p>
								<p><strong>Действует до:</strong> {subscription.expires_at?.split('.')[0]}</p>
							</div>
						) : (
							<p className={styles.empty}>Нет активной подписки</p>
						)}
					</section>
				</div>

				<ProjectChatsFab />
			</div>

			{teamModal && (
				<div className={styles.teamModalOverlay} onClick={() => setTeamModal(null)}>
					<div className={styles.teamModalCard} onClick={(e) => e.stopPropagation()}>
						<div className={styles.teamModalHeader}>
							<div>
								<h3 className={styles.teamModalTitle}><IconUsers size={18} /> Команда проекта</h3>
								<p className={styles.teamModalSubtitle}>{teamModal.projectTitle}</p>
							</div>
							<button className={styles.teamModalClose} onClick={() => setTeamModal(null)}><IconX size={16} /></button>
						</div>

						{teamLoading ? (
							<div className={styles.teamModalLoading}><IconLoader size={18} /> Загрузка...</div>
						) : (
							<>
								{teamCollaborators.length === 0 ? (
									<p className={styles.teamModalEmpty}>Пока нет участников. Добавьте первого!</p>
								) : (
									<div className={styles.teamMemberList}>
										{teamCollaborators.map((c: any) => (
											<div key={c.id} className={styles.teamMemberItem}>
												<div className={styles.teamMemberAvatar}>
													{c.photo_url ? <img src={c.photo_url} alt="" /> : <IconUser size={18} />}
												</div>
												<div className={styles.teamMemberInfo}>
													<strong>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</strong>
													<span>{c.email}</span>
												</div>
												<span className={styles.teamMemberRole}>
													{c.role === 'editor' ? 'Редактор' : 'Наблюдатель'}
												</span>
												<button className={styles.teamMemberRemove} onClick={() => removeTeamMember(c.id)}>
													<IconX size={12} />
												</button>
											</div>
										))}
									</div>
								)}

								<div className={styles.teamAddForm}>
									<input
										className={styles.teamAddInput}
										value={teamEmail}
										onChange={(e) => setTeamEmail(e.target.value)}
										placeholder="Email Админа / Админа ПРО..."
										onKeyDown={(e) => e.key === 'Enter' && addTeamMember()}
									/>
									<button
										className={styles.teamAddBtn}
										disabled={teamAdding || !teamEmail.trim()}
										onClick={addTeamMember}
									>
										{teamAdding ? <IconLoader size={14} /> : <IconPlus size={14} />}
										Добавить
									</button>
								</div>

								{isOwner && (
									<div className={styles.teamInviteSection}>
										<button className={styles.teamInviteBtn} onClick={generateTeamInvite} disabled={teamCreatingInvite}>
											{teamCreatingInvite ? <IconLoader size={13} /> : <IconSend size={13} />}
											Создать пригласительную ссылку
										</button>
										{teamInviteUrl && (
											<div className={styles.teamInviteUrl}>
												<span>{teamInviteUrl}</span>
												<button onClick={() => {
													try { navigator.clipboard.writeText(teamInviteUrl) } catch {}
													alert('Ссылка скопирована!')
												}}>Копировать</button>
											</div>
										)}
									</div>
								)}
							</>
						)}
					</div>
				</div>
			)}

			{showVerificationBlock && (
				<div className={styles.verifyOverlay}>
					<div className={styles.verifyCard}>
						{(formStep === 'form' && !ticketStatus) || ticketStatus === 'rejected' ? (
							<>
								<div className={styles.verifyIconWrap}>
									{ticketStatus === 'rejected' ? <IconX size={32} /> : <IconShield size={32} />}
								</div>
								<h2 className={styles.verifyTitle}>
									{ticketStatus === 'rejected' ? 'Заявка отклонена' : 'Заявка на верификацию'}
								</h2>
								{ticketStatus === 'rejected' && ticketMessages.length > 0 && (
									<div className={styles.ticketChat} style={{ maxHeight: 140, marginBottom: 12 }}>
										<div className={styles.ticketMessages}>
											{ticketMessages.filter((m: any) => !m.is_mine).slice(-2).map((m: any) => (
												<div key={m.id} className={`${styles.ticketMsg} ${styles.ticketMsgOther}`}>
													<div className={styles.ticketMsgHeader}>
														<span className={styles.ticketMsgName}>{m.sender_name}</span>
													</div>
													<div className={styles.ticketMsgText}>
														{renderTicketMessage(m.message, styles.msgLine, styles.msgLineIcon, styles.msgLineTitle)}
													</div>
												</div>
											))}
										</div>
									</div>
								)}
								<p className={styles.verifyText}>
									{ticketStatus === 'rejected'
										? 'Вы можете отправить заявку повторно с обновлёнными данными'
										: 'Заполните анкету, чтобы получить доступ к публикации кастингов'}
								</p>
								<div className={styles.verifyFormFields}>
									<input type="text" placeholder="Название компании / студии" value={companyName} onChange={e => setCompanyName(e.target.value)} className={styles.verifyInput} />
									<textarea placeholder="Расскажите о себе и чем занимаетесь" value={aboutText} onChange={e => setAboutText(e.target.value)} className={styles.verifyTextarea} rows={3} />
									<textarea placeholder="Какие проекты планируете размещать?" value={projectsText} onChange={e => setProjectsText(e.target.value)} className={styles.verifyTextarea} rows={3} />
									<textarea placeholder="Ваш опыт работы в индустрии" value={experienceText} onChange={e => setExperienceText(e.target.value)} className={styles.verifyTextarea} rows={3} />
								</div>
								<button className={styles.verifySubmitBtn} onClick={submitVerificationRequest} disabled={submitting || (!aboutText.trim() && !companyName.trim())}>
									{submitting ? <><IconLoader size={16} /> Отправка...</> : <><IconSend size={16} /> {ticketStatus === 'rejected' ? 'Отправить повторно' : 'Отправить заявку'}</>}
								</button>
							</>
						) : (
							<>
								<div className={styles.verifyIconWrap}>
									{ticketStatus === 'approved' ? <IconCheck size={32} /> : <IconMessageSquare size={32} />}
								</div>
								<h2 className={styles.verifyTitle}>
									{ticketStatus === 'approved' ? 'Верификация пройдена!' : 'Чат с SuperAdmin'}
								</h2>
								{ticketStatus === 'approved' && (
									<p className={styles.verifyText}>Вы можете публиковать кастинги. Страница обновится автоматически.</p>
								)}

								<div className={styles.ticketChat}>
									<div className={styles.ticketMessages}>
										{ticketMessages.map((m: any) => (
										<div key={m.id} className={`${styles.ticketMsg} ${m.is_mine ? styles.ticketMsgMine : styles.ticketMsgOther}`}>
											<div className={styles.ticketMsgHeader}>
												<span className={styles.ticketMsgName}>{m.sender_name}</span>
												<span className={styles.ticketMsgTime}>{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}</span>
											</div>
											<div className={styles.ticketMsgText}>
												{renderTicketMessage(m.message, styles.msgLine, styles.msgLineIcon, styles.msgLineTitle)}
											</div>
										</div>
										))}
										<div ref={chatEndRef} />
									</div>
									{ticketStatus === 'open' && (
										<div className={styles.ticketInputArea}>
											<input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendTicketMessage()} placeholder="Напишите сообщение..." className={styles.ticketInput} disabled={chatSending} />
											<button onClick={sendTicketMessage} disabled={chatSending || !chatInput.trim()} className={styles.ticketSendBtn}>
												{chatSending ? <IconLoader size={14} /> : <IconSend size={14} />}
											</button>
										</div>
									)}
								</div>
								{ticketStatus === 'approved' && (
									<button className={styles.verifySubmitBtn} onClick={() => { setIsVerified(true); window.location.reload() }}>
										Продолжить →
									</button>
								)}
								</>
						)}
					</div>
				</div>
			)}
		</>
	)
}
