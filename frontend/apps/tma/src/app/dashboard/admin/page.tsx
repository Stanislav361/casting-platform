'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import LiveChat from '../components/live-chat'
import {
	IconCrown,
	IconActivity,
	IconTicket,
	IconMessageSquare,
	IconUsers,
	IconMask,
	IconFilm,
	IconBan,
	IconBell,
	IconFolder,
	IconLogOut,
	IconHome,
	IconX,
	IconCheck,
	IconLoader,
	IconSearch,
	IconSend,
	IconShield,
	IconUser,
	IconBuilding,
	IconBriefcase,
	IconStar,
	IconAward,
	IconClock,
	IconClipboard,
	IconEdit,
} from '~packages/ui/icons'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
import styles from './admin.module.scss'

const EMOJI_ICON_MAP: Record<string, React.ReactNode> = {
	'📋': <IconClipboard size={13} />,
	'🏢': <IconBuilding size={13} />,
	'💼': <IconBriefcase size={13} />,
	'🎬': <IconFilm size={13} />,
	'⭐': <IconAward size={13} />,
	'✅': <IconCheck size={13} />,
	'❌': <IconX size={13} />,
}

function renderTicketMessage(text: string, lineClass: string, iconClass: string) {
	const lines = text.split('\n')
	return lines.map((line, i) => {
		const chars = [...line]
		const first = chars[0] || ''
		const icon = EMOJI_ICON_MAP[first]
		if (icon) {
			const rest = chars.slice(1).join('').trimStart()
			const isTitle = i === 0
			return (
				<span key={i} className={`${lineClass} ${isTitle ? styles.msgLineTitle : ''}`}>
					<span className={iconClass}>{icon}</span>
					<span>{rest}</span>
				</span>
			)
		}
		return line ? <span key={i} className={lineClass}>{line}</span> : null
	}).filter(Boolean)
}

type Tab = 'stats' | 'users' | 'actors' | 'projects' | 'blacklist' | 'notifications' | 'myprojects' | 'tickets' | 'generalchat'
type ModalType = 'user' | 'actor' | 'project' | null

export default function SuperAdminPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [stats, setStats] = useState<any>(null)
	const [users, setUsers] = useState<any[]>([])
	const [actors, setActors] = useState<any[]>([])
	const [projects, setProjects] = useState<any[]>([])
	const [blacklist, setBlacklist] = useState<any[]>([])
	const [notifications, setNotifications] = useState<any[]>([])
	const [tab, setTab] = useState<Tab>('stats')
	const [loading, setLoading] = useState(true)
	const [actionMsg, setActionMsg] = useState<string | null>(null)
	const [seeding, setSeeding] = useState(false)
	const [seedResult, setSeedResult] = useState<any>(null)

	const [newTitle, setNewTitle] = useState('')
	const [newDesc, setNewDesc] = useState('')
	const [banUserId, setBanUserId] = useState('')
	const [banReason, setBanReason] = useState('')
	const [banType, setBanType] = useState('temporary')
	const [banDays, setBanDays] = useState('30')
	const [searchQuery, setSearchQuery] = useState('')

	const [modalType, setModalType] = useState<ModalType>(null)
	const [modalData, setModalData] = useState<any>(null)
	const [modalLoading, setModalLoading] = useState(false)

	const [tickets, setTickets] = useState<any[]>([])
	const [selectedTicket, setSelectedTicket] = useState<any>(null)
	const [ticketMessages, setTicketMessages] = useState<any[]>([])
	const [ticketChatInput, setTicketChatInput] = useState('')
	const [ticketChatSending, setTicketChatSending] = useState(false)
	const ticketChatEndRef = useRef<HTMLDivElement>(null)

	const [generalChatMessages, setGeneralChatMessages] = useState<any[]>([])
	const [generalChatInput, setGeneralChatInput] = useState('')
	const [generalChatSending, setGeneralChatSending] = useState(false)
	const generalChatEndRef = useRef<HTMLDivElement>(null)

	const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
	const [editingActor, setEditingActor] = useState(false)
	const [editForm, setEditForm] = useState<Record<string, any>>({})

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) { router.replace('/login'); return }
		try {
			const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
			if (payload.role !== 'owner') {
				router.replace('/dashboard')
				return
			}
		} catch {
			router.replace('/dashboard')
			return
		}
		setToken(session.access_token)
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		if (!token) return null
		try {
			const res = await fetch(`${API_URL}${path}`, {
				method,
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: body ? JSON.stringify(body) : undefined,
			})
			return res.json().catch(() => null)
		} catch {
			return null
		}
	}, [token])

	const showMsg = (msg: string) => {
		setActionMsg(msg)
		setTimeout(() => setActionMsg(null), 3000)
	}

	const startEditActor = () => {
		if (!modalData) return
		setEditForm({
			first_name: modalData.first_name || '',
			last_name: modalData.last_name || '',
			display_name: modalData.display_name || '',
			gender: modalData.gender || '',
			city: modalData.city || '',
			phone_number: modalData.phone_number || '',
			email: modalData.email || '',
			qualification: modalData.qualification || '',
			experience: modalData.experience ?? '',
			about_me: modalData.about_me || '',
			look_type: modalData.look_type || '',
			hair_color: modalData.hair_color || '',
			hair_length: modalData.hair_length || '',
			height: modalData.height ?? '',
			clothing_size: modalData.clothing_size || '',
			shoe_size: modalData.shoe_size || '',
			bust_volume: modalData.bust_volume ?? '',
			waist_volume: modalData.waist_volume ?? '',
			hip_volume: modalData.hip_volume ?? '',
		})
		setEditingActor(true)
	}

	const saveActorEdit = async () => {
		if (!modalData?.id) return
		const body: Record<string, any> = {}
		for (const [k, v] of Object.entries(editForm)) {
			if (v === '') { body[k] = null; continue }
			if (['height', 'bust_volume', 'waist_volume', 'hip_volume', 'experience'].includes(k)) {
				body[k] = Number(v) || null
			} else {
				body[k] = v
			}
		}
		const res = await api('PATCH', `actor-profiles/${modalData.id}/`, body)
		if (res?.id) {
			setModalData({ ...modalData, ...res })
			setEditingActor(false)
			showMsg('Профиль обновлён')
		} else {
			showMsg('Ошибка сохранения')
		}
	}

	useEffect(() => {
		if (!token) return
		const load = async () => {
			const [s, u, p, b, tk] = await Promise.all([
				api('GET', 'superadmin/stats/'),
				api('GET', 'superadmin/users/?page_size=100'),
				api('GET', 'employer/projects/?page_size=100'),
				api('GET', 'blacklist/'),
				api('GET', 'superadmin/tickets/'),
			])
			setStats(s)
			setUsers(u?.users || [])
			setProjects(p?.projects || [])
			setBlacklist(b?.entries || [])
			if (tk?.tickets) setTickets(tk.tickets)
			setLoading(false)
		}
		load()
	}, [token, api])

	const loadTickets = useCallback(async () => {
		const data = await api('GET', 'superadmin/tickets/')
		if (data?.tickets) {
			setTickets(data.tickets)
		} else if (data?.detail) {
			showMsg(`Ошибка загрузки тикетов: ${data.detail}`)
		}
	}, [api])

	const openTicket = useCallback(async (ticketId: number) => {
		const data = await api('GET', `superadmin/tickets/${ticketId}/`)
		if (data?.ticket) {
			setSelectedTicket(data.ticket)
			setTicketMessages(data.messages || [])
		}
	}, [api])

	const loadGeneralChat = useCallback(async () => {
		const data = await api('GET', 'superadmin/general-chat/')
		setGeneralChatMessages(data?.messages || [])
	}, [api])

	useEffect(() => {
		if (tab === 'tickets') loadTickets()
		if (tab === 'generalchat') loadGeneralChat()
	}, [tab, loadTickets, loadGeneralChat])

	useEffect(() => {
		if (tab === 'tickets' && selectedTicket?.status === 'open') {
			const iv = setInterval(() => openTicket(selectedTicket.id), 5000)
			return () => clearInterval(iv)
		}
	}, [tab, selectedTicket, openTicket])

	useEffect(() => {
		if (tab === 'generalchat') {
			const iv = setInterval(loadGeneralChat, 5000)
			return () => clearInterval(iv)
		}
	}, [tab, loadGeneralChat])

	useEffect(() => { ticketChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [ticketMessages])
	useEffect(() => { generalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [generalChatMessages])

	const loadActors = async () => {
		const data = await api('GET', 'superadmin/actors/?page_size=100')
		setActors(data?.actors || [])
	}

	const loadNotifications = async () => {
		const data = await api('GET', 'notifications/')
		setNotifications(data?.notifications || [])
	}

	const deleteProfile = async (profileId: number) => {
		if (!confirm('Удалить профиль актёра #' + profileId + '?')) return
		await api('DELETE', `superadmin/profiles/${profileId}/`)
		showMsg('Профиль удалён')
		loadActors()
	}

	const deleteCasting = async (castingId: number) => {
		if (!confirm('Удалить проект #' + castingId + '?')) return
		await api('DELETE', `superadmin/castings/${castingId}/`)
		setProjects(prev => prev.filter(p => p.id !== castingId))
		showMsg('Проект удалён')
	}

	const createProject = async () => {
		if (!newTitle.trim()) return
		const res = await api('POST', 'employer/projects/', { title: newTitle, description: newDesc || '' })
		if (res?.id) { setProjects(prev => [res, ...prev]); setNewTitle(''); setNewDesc(''); showMsg('Проект создан') }
	}

	const banUser = async () => {
		if (!banUserId || !banReason) return
		await api('POST', `blacklist/ban/?user_id=${banUserId}&ban_type=${banType}&reason=${encodeURIComponent(banReason)}&days=${banDays}`)
		setBanUserId(''); setBanReason('')
		const b = await api('GET', 'blacklist/')
		setBlacklist(b?.entries || [])
		showMsg('Пользователь заблокирован')
	}

	const unbanUser = async (userId: number) => {
		await api('POST', `blacklist/unban/?user_id=${userId}`)
		const b = await api('GET', 'blacklist/')
		setBlacklist(b?.entries || [])
		showMsg('Пользователь разблокирован')
	}

	const filteredUsers = searchQuery
		? users.filter(u =>
			(u.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.last_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.middle_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.phone_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.telegram_username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.telegram_nick || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.vk_nick || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.max_nick || '').toLowerCase().includes(searchQuery.toLowerCase())
		)
		: users

	const openUserDetails = async (userId: number) => {
		setModalLoading(true)
		setModalType('user')
		setModalData(null)
		const data = await api('GET', `superadmin/users/${userId}/details/`)
		setModalData(data || null)
		setModalLoading(false)
	}

	const openActorDetails = (actor: any) => {
		setModalType('actor')
		setModalData(actor)
		setModalLoading(false)
	}

	const openProjectDetails = async (project: any) => {
		setModalType('project')
		setModalLoading(true)
		setModalData(null)
		const ownerData = await api('GET', `superadmin/users/${project.owner_id}/details/`)
		const casting = ownerData?.castings?.find((c: any) => c.id === project.id)
		setModalData({
			...project,
			owner: ownerData?.user || null,
			castingDetail: casting || null,
		})
		setModalLoading(false)
	}

	const closeModal = () => {
		setModalType(null)
		setModalData(null)
		setModalLoading(false)
	}

	const toggleVerification = async (userId: number, currentlyVerified: boolean) => {
		const endpoint = currentlyVerified ? `superadmin/users/${userId}/unverify/` : `superadmin/users/${userId}/verify/`
		await api('POST', endpoint)
		showMsg(currentlyVerified ? 'Верификация отозвана' : 'Пользователь верифицирован')
		setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_employer_verified: !currentlyVerified } : u))
		if (modalData?.user?.id === userId) {
			setModalData((prev: any) => ({
				...prev,
				user: { ...prev.user, is_employer_verified: !currentlyVerified },
			}))
		}
	}

	const sendTicketMessage = async () => {
		if (!ticketChatInput.trim() || ticketChatSending || !selectedTicket) return
		setTicketChatSending(true)
		await api('POST', `superadmin/tickets/${selectedTicket.id}/message/?message=${encodeURIComponent(ticketChatInput)}`)
		setTicketChatInput('')
		await openTicket(selectedTicket.id)
		setTicketChatSending(false)
	}

	const approveTicket = async (ticketId: number) => {
		await api('POST', `superadmin/tickets/${ticketId}/approve/`)
		showMsg('Тикет одобрен, пользователь верифицирован')
		await openTicket(ticketId)
		await loadTickets()
	}

	const rejectTicket = async (ticketId: number) => {
		const reason = prompt('Причина отказа (необязательно):') || ''
		await api('POST', `superadmin/tickets/${ticketId}/reject/?reason=${encodeURIComponent(reason)}`)
		showMsg('Тикет отклонён')
		await openTicket(ticketId)
		await loadTickets()
	}

	const sendGeneralChat = async () => {
		if (!generalChatInput.trim() || generalChatSending) return
		setGeneralChatSending(true)
		await api('POST', `superadmin/general-chat/?message=${encodeURIComponent(generalChatInput)}`)
		setGeneralChatInput('')
		await loadGeneralChat()
		setGeneralChatSending(false)
	}

	if (loading) return <div className={styles.root}><p className={styles.center}>Загрузка...</p></div>

	const tabIcons: Record<Tab, React.ReactNode> = {
		stats: <IconActivity size={14} />,
		tickets: <IconTicket size={14} />,
		generalchat: <IconMessageSquare size={14} />,
		users: <IconUsers size={14} />,
		actors: <IconMask size={14} />,
		projects: <IconFilm size={14} />,
		blacklist: <IconBan size={14} />,
		notifications: <IconBell size={14} />,
		myprojects: <IconFolder size={14} />,
	}

	const tabs: { key: Tab; label: string }[] = [
		{ key: 'stats', label: 'Статистика' },
		{ key: 'tickets', label: 'Тикеты' },
		{ key: 'generalchat', label: 'Общий чат' },
		{ key: 'users', label: 'Пользователи' },
		{ key: 'actors', label: 'Актёры' },
		{ key: 'projects', label: 'Все проекты' },
		{ key: 'blacklist', label: 'Blacklist' },
		{ key: 'notifications', label: 'Уведомления' },
		{ key: 'myprojects', label: 'Мои проекты' },
	]

	const runSeed = async (force: boolean) => {
		setSeeding(true)
		setSeedResult(null)
		try {
			const res = await api('POST', `superadmin/seed-demo-data/?force=${force}`)
			setSeedResult(res || { ok: false, error: 'Нет ответа от сервера (таймаут или ошибка сети)' })
		} catch (e: any) {
			setSeedResult({ ok: false, error: e?.message || 'Network error' })
		}
		setSeeding(false)
		const s = await api('GET', 'superadmin/stats/')
		if (s) setStats(s)
	}

	const roleLabel = (role: string) => {
		const m: Record<string, string> = {
			owner: 'SuperAdmin', employer_pro: 'Админ PRO', employer: 'Админ',
			user: 'Актёр', agent: 'Агент', administrator: 'Администратор',
		}
		return m[role] || role
	}

	const renderModal = () => {
		if (!modalType) return null

		let title = 'Загрузка...'
		let body = null

		if (!modalLoading && modalData) {
			if (modalType === 'user') {
				const u = modalData.user
				title = `${u?.last_name || ''} ${u?.first_name || ''} ${u?.middle_name || ''}`.trim() || 'Пользователь'
				const handleSetRole = async (newRole: string) => {
					if (!confirm(`Назначить роль "${roleLabel(newRole)}" пользователю #${u?.id}?`)) return
					const res = await api('POST', `superadmin/users/${u?.id}/set-role/?role=${newRole}`)
					if (res?.ok) {
						showMsg(`Роль "${roleLabel(newRole)}" назначена`)
						setUsers(prev => prev.map(x => x.id === u?.id ? { ...x, role: newRole } : x))
						setModalData((prev: any) => ({ ...prev, user: { ...prev.user, role: newRole } }))
					} else {
						showMsg(`Ошибка: ${res?.detail || 'Неизвестная ошибка'}`)
					}
				}
				body = (
					<>
						<div className={styles.detailRow}><span>Роль</span><b>{roleLabel(u?.role)}</b></div>
						<div className={styles.detailRow}><span>Фамилия</span><b>{u?.last_name || '—'}</b></div>
						<div className={styles.detailRow}><span>Имя</span><b>{u?.first_name || '—'}</b></div>
						<div className={styles.detailRow}><span>Отчество</span><b>{u?.middle_name || '—'}</b></div>
						<div className={styles.detailRow}><span>Email</span><b>{u?.email || '—'}</b></div>
						<div className={styles.detailRow}><span>Телефон</span><b>{u?.phone_number ? formatPhone(u.phone_number) : '—'}</b></div>
						<div className={styles.detailRow}><span>Telegram (system)</span><b>{u?.telegram_username ? `@${u.telegram_username}` : '—'}</b></div>
						<div className={styles.detailRow}><span>Telegram (ник)</span><b>{u?.telegram_nick || '—'}</b></div>
						<div className={styles.detailRow}><span>ВКонтакте</span><b>{u?.vk_nick || '—'}</b></div>
						<div className={styles.detailRow}><span>MAX</span><b>{u?.max_nick || '—'}</b></div>
						{u?.photo_url && (
							<div className={styles.detailRow}><span>Фото</span><img src={u.photo_url} alt="" className={styles.modalAvatar} /></div>
						)}

						<section className={styles.detailSection}>
							<h4>Назначить роль</h4>
							<div className={styles.roleAssignGrid}>
								{[
									{ value: 'user', label: 'Актёр' },
									{ value: 'agent', label: 'Агент' },
									{ value: 'employer', label: 'Админ' },
									{ value: 'employer_pro', label: 'Админ PRO' },
								].map(r => (
									<button
										key={r.value}
										className={`${styles.roleAssignBtn} ${u?.role === r.value ? styles.roleAssignActive : ''}`}
										onClick={() => handleSetRole(r.value)}
										disabled={u?.role === r.value}
									>
										{r.label}
									</button>
								))}
							</div>
						</section>

						{(u?.role === 'user' || u?.role === 'agent') && (
							<section className={styles.detailSection}>
								<h4>{u?.role === 'agent' ? `Актёры агента (${modalData.actor_profiles?.length || 0})` : `Анкеты актёра (${modalData.actor_profiles?.length || 0})`}</h4>
								{(modalData.actor_profiles || []).length === 0 ? (
									<p className={styles.empty}>Нет анкет</p>
								) : (
									<div className={styles.miniList}>
										{modalData.actor_profiles.map((p: any) => {
											const pPhotos = (p.media_assets || []).filter((m: any) => m.file_type === 'photo')
											return (
												<div key={p.id} className={styles.miniCard} onClick={() => openActorDetails(p)} style={{ cursor: 'pointer' }}>
													{pPhotos.length > 0 && (
														<img src={pPhotos[0].processed_url || pPhotos[0].original_url} alt="" className={styles.miniCardAvatar} />
													)}
													<div>
														<strong>{p.display_name || `${p.first_name || ''} ${p.last_name || ''}`}</strong>
														<span>{p.city || '—'} · {p.gender === 'male' ? 'Муж' : p.gender === 'female' ? 'Жен' : (p.gender || '—')} · {p.qualification || '—'}</span>
														<span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>
															Тел: {p.phone_number ? formatPhone(p.phone_number) : '—'} · Email: {p.email || '—'}
															{p.height ? ` · Рост: ${p.height} см` : ''}
															{p.experience != null ? ` · Опыт: ${p.experience} лет` : ''}
														</span>
													</div>
												</div>
											)
										})}
									</div>
								)}
							</section>
						)}

						{(u?.role === 'employer' || u?.role === 'employer_pro') && (
							<div className={styles.verifyRow}>
								<span>Верификация</span>
								<div className={styles.verifyActions}>
									<span className={u.is_employer_verified ? styles.verifiedBadge : styles.unverifiedBadge}>
										{u.is_employer_verified ? '✅ Верифицирован' : '⏳ Не верифицирован'}
									</span>
									<button
										className={u.is_employer_verified ? styles.btnDanger : styles.btnGreen}
										onClick={() => toggleVerification(u.id, u.is_employer_verified)}
									>
										{u.is_employer_verified ? 'Отозвать' : 'Верифицировать'}
									</button>
								</div>
							</div>
						)}

						{(u?.role === 'employer' || u?.role === 'employer_pro') && (
							<section className={styles.detailSection}>
								<h4>Кастинги ({modalData.castings?.length || 0})</h4>
								{(modalData.castings || []).length === 0 ? (
									<p className={styles.empty}>Нет кастингов</p>
								) : (
									<div className={styles.miniList}>
										{modalData.castings.map((c: any) => (
											<div key={c.id} className={styles.miniCard}>
												<strong>{c.title}</strong>
												<span>Статус: {c.status} · Откликов: {c.response_count} · Shortlist: {c.shortlist_count}</span>
												{(c.respondents || []).length > 0 && (
													<div className={styles.respondentsBlock}>
														{c.respondents.map((r: any) => (
															<div key={`${c.id}_${r.profile_id}`} className={styles.respondentRow}>
																<span>{r.first_name || ''} {r.last_name || ''}</span>
																<b className={r.is_shortlisted ? styles.shortlistBadge : styles.responseBadge}>{r.is_shortlisted ? 'SHORTLIST' : 'ОТКЛИК'}</b>
															</div>
														))}
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</section>
						)}
					</>
				)
			}

			if (modalType === 'actor') {
				const a = modalData
				title = a.display_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Актёр'
				const genderLabel = (g: string | null) => {
					if (!g) return '—'
					if (g === 'male') return 'Мужской'
					if (g === 'female') return 'Женский'
					return g
				}
				const qualLabel = (q: string | null) => {
					if (!q) return '—'
					const m: Record<string, string> = { professional: 'Профессионал', skilled: 'Опытный', enthusiast: 'Энтузиаст', beginner: 'Начинающий', other: 'Другое' }
					return m[q] || q
				}
				const lookLabel = (l: string | null) => {
					if (!l) return '—'
					const m: Record<string, string> = { european: 'Европейский', asian: 'Азиатский', slavic: 'Славянский', african: 'Африканский', latino: 'Латиноамериканский', middle_eastern: 'Ближневосточный', caucasian: 'Кавказский', south_asian: 'Южноазиатский', mixed: 'Смешанный', other: 'Другой' }
					return m[l] || l
				}
				const hairColorLabel = (c: string | null) => {
					if (!c) return '—'
					const m: Record<string, string> = { blonde: 'Блонд', brunette: 'Брюнет', brown: 'Шатен', light_brown: 'Русый', red: 'Рыжий', gray: 'Седой', other: 'Другой' }
					return m[c] || c
				}
				const hairLenLabel = (l: string | null) => {
					if (!l) return '—'
					const m: Record<string, string> = { short: 'Короткие', medium: 'Средние', long: 'Длинные', bald: 'Лысый' }
					return m[l] || l
				}
				const mediaList = a.media_assets || []
				const photos = mediaList.filter((m: any) => m.file_type === 'photo')
				const videos = mediaList.filter((m: any) => m.file_type === 'video')

				const EF = ({ label, field, type = 'text', options }: { label: string; field: string; type?: string; options?: { value: string; label: string }[] }) => {
					const isPhone = type === 'tel'
					return (
						<div className={styles.editField}>
							<label>{label}</label>
							{options ? (
								<select value={editForm[field] || ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} className={styles.editInput}>
									<option value="">—</option>
									{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
								</select>
							) : type === 'textarea' ? (
								<textarea value={editForm[field] || ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} className={styles.editInput} rows={3} />
							) : isPhone ? (
								<input type="tel" value={editForm[field] ? formatPhone(editForm[field]) : ''} onChange={(e) => setEditForm({ ...editForm, [field]: rawPhone(e.target.value) })} placeholder="+7 (900) 123-45-67" className={styles.editInput} />
							) : (
								<input type={type} value={editForm[field] ?? ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} className={styles.editInput} />
							)}
						</div>
					)
				}

				body = editingActor ? (
					<div className={styles.editActorForm}>
						<h4>Личные данные</h4>
						<EF label="Имя" field="first_name" />
						<EF label="Фамилия" field="last_name" />
						<EF label="Отображаемое имя" field="display_name" />
						<EF label="Пол" field="gender" options={[{ value: 'male', label: 'Мужской' }, { value: 'female', label: 'Женский' }]} />
						<EF label="Город" field="city" />
						<EF label="Телефон" field="phone_number" type="tel" />
						<EF label="Email" field="email" type="email" />
						<h4>Профессиональные данные</h4>
						<EF label="Квалификация" field="qualification" options={[{ value: 'professional', label: 'Профессионал' }, { value: 'skilled', label: 'Опытный' }, { value: 'enthusiast', label: 'Энтузиаст' }, { value: 'beginner', label: 'Начинающий' }]} />
						<EF label="Опыт (лет)" field="experience" type="number" />
						<EF label="О себе" field="about_me" type="textarea" />
						<h4>Параметры внешности</h4>
						<EF label="Тип внешности" field="look_type" options={[{ value: 'european', label: 'Европейский' }, { value: 'asian', label: 'Азиатский' }, { value: 'slavic', label: 'Славянский' }, { value: 'african', label: 'Африканский' }, { value: 'latino', label: 'Латиноамериканский' }, { value: 'middle_eastern', label: 'Ближневосточный' }, { value: 'caucasian', label: 'Кавказский' }, { value: 'mixed', label: 'Смешанный' }]} />
						<EF label="Цвет волос" field="hair_color" options={[{ value: 'blonde', label: 'Блонд' }, { value: 'brunette', label: 'Брюнет' }, { value: 'brown', label: 'Шатен' }, { value: 'light_brown', label: 'Русый' }, { value: 'red', label: 'Рыжий' }, { value: 'gray', label: 'Седой' }]} />
						<EF label="Длина волос" field="hair_length" options={[{ value: 'short', label: 'Короткие' }, { value: 'medium', label: 'Средние' }, { value: 'long', label: 'Длинные' }, { value: 'bald', label: 'Лысый' }]} />
						<EF label="Рост (см)" field="height" type="number" />
						<EF label="Размер одежды" field="clothing_size" />
						<EF label="Размер обуви" field="shoe_size" />
						<EF label="Обхват груди (см)" field="bust_volume" type="number" />
						<EF label="Обхват талии (см)" field="waist_volume" type="number" />
						<EF label="Обхват бёдер (см)" field="hip_volume" type="number" />
						<div className={styles.editActions}>
							<button className={styles.btnSave} onClick={saveActorEdit}>Сохранить</button>
							<button className={styles.btnCancel} onClick={() => setEditingActor(false)}>Отмена</button>
						</div>
					</div>
				) : (
					<>
						<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
							<button className={styles.btnEdit} onClick={startEditActor}><IconEdit size={13} /> Редактировать</button>
						</div>

						{photos.length > 0 && (
							<div className={styles.mediaGallery}>
								{photos.map((m: any, idx: number) => (
									<img key={m.id} src={m.processed_url || m.original_url} alt="" className={styles.galleryImg} onClick={() => setLightboxIdx(idx)} style={{ cursor: 'pointer' }} />
								))}
							</div>
						)}

						<section className={styles.detailSection}>
							<h4>Личные данные</h4>
							<div className={styles.detailRow}><span>Имя</span><b>{a.first_name || '—'}</b></div>
							<div className={styles.detailRow}><span>Фамилия</span><b>{a.last_name || '—'}</b></div>
							{a.display_name && <div className={styles.detailRow}><span>Отображаемое имя</span><b>{a.display_name}</b></div>}
							<div className={styles.detailRow}><span>Пол</span><b>{genderLabel(a.gender)}</b></div>
							<div className={styles.detailRow}><span>Дата рождения</span><b>{a.date_of_birth?.split('T')[0] || '—'}</b></div>
							<div className={styles.detailRow}><span>Город</span><b>{a.city || '—'}</b></div>
							<div className={styles.detailRow}><span>Телефон</span><b>{a.phone_number ? formatPhone(a.phone_number) : '—'}</b></div>
							<div className={styles.detailRow}><span>Email</span><b>{a.email || '—'}</b></div>
						</section>

						<section className={styles.detailSection}>
							<h4>Профессиональные данные</h4>
							<div className={styles.detailRow}><span>Квалификация</span><b>{qualLabel(a.qualification)}</b></div>
							<div className={styles.detailRow}><span>Опыт</span><b>{a.experience != null ? `${a.experience} лет` : '—'}</b></div>
							<div className={styles.detailRow}><span>О себе</span><b className={styles.multiLine}>{a.about_me || '—'}</b></div>
							{a.video_intro && <div className={styles.detailRow}><span>Видео-визитка</span><b><a href={a.video_intro} target="_blank" rel="noreferrer" className={styles.link}>{a.video_intro}</a></b></div>}
						</section>

						<section className={styles.detailSection}>
							<h4>Параметры внешности</h4>
							<div className={styles.detailRow}><span>Тип внешности</span><b>{lookLabel(a.look_type)}</b></div>
							<div className={styles.detailRow}><span>Цвет волос</span><b>{hairColorLabel(a.hair_color)}</b></div>
							<div className={styles.detailRow}><span>Длина волос</span><b>{hairLenLabel(a.hair_length)}</b></div>
							<div className={styles.detailRow}><span>Рост</span><b>{a.height ? `${a.height} см` : '—'}</b></div>
							<div className={styles.detailRow}><span>Размер одежды</span><b>{a.clothing_size || '—'}</b></div>
							<div className={styles.detailRow}><span>Размер обуви</span><b>{a.shoe_size || '—'}</b></div>
							<div className={styles.detailRow}><span>Обхват груди</span><b>{a.bust_volume ? `${a.bust_volume} см` : '—'}</b></div>
							<div className={styles.detailRow}><span>Обхват талии</span><b>{a.waist_volume ? `${a.waist_volume} см` : '—'}</b></div>
							<div className={styles.detailRow}><span>Обхват бёдер</span><b>{a.hip_volume ? `${a.hip_volume} см` : '—'}</b></div>
						</section>

						<section className={styles.detailSection}>
							<h4>Системная информация</h4>
							<div className={styles.detailRow}><span>Trust Score</span><b>{a.trust_score ?? 0}</b></div>
							{a.owner_name && <div className={styles.detailRow}><span>Владелец</span><b>{a.owner_name} ({roleLabel(a.owner_role)})</b></div>}
							<div className={styles.detailRow}><span>Источник</span><b>{a.source === 'actor_profiles' ? 'Новая система' : 'Legacy'}</b></div>
							<div className={styles.detailRow}><span>Создан</span><b>{a.created_at?.split('T')[0] || '—'}</b></div>
						</section>

						{videos.length > 0 && (
							<section className={styles.detailSection}>
								<h4>Видео ({videos.length})</h4>
								<div className={styles.mediaGallery}>
									{videos.map((m: any) => (
										<video key={m.id} src={m.processed_url || m.original_url} controls className={styles.galleryVideo} />
									))}
								</div>
							</section>
						)}
					</>
				)
			}

			if (modalType === 'project') {
				title = modalData.title || 'Проект'
				const c = modalData.castingDetail
				body = (
					<>
						<div className={styles.detailRow}><span>Название</span><b>{modalData.title}</b></div>
						<div className={styles.detailRow}><span>Описание</span><b>{modalData.description || '—'}</b></div>
						<div className={styles.detailRow}><span>Статус</span><b>{modalData.status}</b></div>
						<div className={styles.detailRow}><span>Владелец</span><b>{modalData.owner ? `${modalData.owner.first_name || ''} ${modalData.owner.last_name || ''} (${roleLabel(modalData.owner.role)})` : `#${modalData.owner_id}`}</b></div>
						{c && (
							<section className={styles.detailSection}>
								<h4>Откликнувшиеся ({c.response_count || 0})</h4>
								{(c.respondents || []).length === 0 ? (
									<p className={styles.empty}>Нет откликов</p>
								) : (
									<div className={styles.miniList}>
										{c.respondents.map((r: any) => (
											<div key={r.profile_id} className={styles.miniCard}>
												<div className={styles.respondentRow}>
													<span><strong>{r.first_name || ''} {r.last_name || ''}</strong></span>
													<b className={r.is_shortlisted ? styles.shortlistBadge : styles.responseBadge}>{r.is_shortlisted ? 'SHORTLIST' : 'ОТКЛИК'}</b>
												</div>
												<span>Дата: {r.responded_at?.split('T')[0] || '—'}</span>
											</div>
										))}
									</div>
								)}
								<div className={styles.detailRow} style={{ marginTop: 12 }}><span>В Shortlist</span><b>{c.shortlist_count || 0}</b></div>
							</section>
						)}
					</>
				)
			}
		}

		return (
			<div className={styles.modalOverlay} onClick={closeModal}>
				<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
					<div className={styles.modalHeader}>
						<h3>{title}</h3>
						<button className={styles.modalClose} onClick={closeModal}><IconX size={14} /></button>
					</div>
					{modalLoading ? (
						<div className={styles.modalBody}><p className={styles.empty}>Загрузка...</p></div>
					) : body ? (
						<div className={styles.modalBody}>{body}</div>
					) : null}
				</div>
			</div>
		)
	}

	return (
		<>
			<div className={styles.root}>
			<header className={styles.header}>
				<h1>
					<div className={styles.brandIcon}><IconCrown size={16} /></div>
					Super<span>Admin</span>
				</h1>
				<div className={styles.headerRight}>
					<button onClick={() => router.push('/dashboard')} className={styles.navBtn}>
						<IconHome size={14} /> Dashboard
					</button>
					<button onClick={() => { logout(); router.replace('/login') }} className={styles.logoutBtn}>
						<IconLogOut size={14} /> Выход
					</button>
				</div>
			</header>

				{actionMsg && <div className={styles.toast}>{actionMsg}</div>}

			<nav className={styles.tabs}>
				{tabs.map(t => (
					<button
						key={t.key}
						className={`${styles.tab} ${tab === t.key ? styles.active : ''}`}
						onClick={() => {
							setTab(t.key)
							if (t.key === 'actors') loadActors()
							if (t.key === 'notifications') loadNotifications()
						}}
					>
						{tabIcons[t.key]} {t.label}
					</button>
				))}
			</nav>

				<div className={styles.content}>
				{tab === 'stats' && stats && (
					<>
						<div className={styles.statsGrid}>
							<div className={styles.statCard}><span className={styles.statNum}>{stats.users_total}</span><span>Пользователей</span></div>
							<div className={styles.statCard}><span className={styles.statNum}>{stats.profiles_total}</span><span>Профилей</span></div>
							<div className={styles.statCard}><span className={styles.statNum}>{stats.castings_total}</span><span>Кастингов</span></div>
						</div>
						<h3 className={styles.sectionTitle}>Распределение по ролям</h3>
						<div className={styles.roleGrid}>
							{stats.roles && Object.entries(stats.roles).map(([role, count]: any) => (
								<div key={role} className={styles.roleCard}>
									<span className={styles.roleName}>{roleLabel(role)}</span>
									<span className={styles.roleCount}>{count}</span>
								</div>
							))}
						</div>

						<div className={styles.seedBlock}>
							<h3 className={styles.sectionTitle}>🧪 Демо-данные</h3>
							<p className={styles.seedHint}>
								Создаёт 4 админов, 3 актёра с фотографиями и откликами на все кастинги.
							</p>
							<div className={styles.seedBtns}>
								<button
									className={styles.seedBtn}
									disabled={seeding}
									onClick={() => runSeed(false)}
								>
									{seeding ? <IconLoader size={14} /> : <IconStar size={14} />}
									Создать демо-данные
								</button>
								<button
									className={styles.seedBtnForce}
									disabled={seeding}
									onClick={() => runSeed(true)}
								>
									{seeding ? <IconLoader size={14} /> : <IconCheck size={14} />}
									Сбросить пароли демо-аккаунтов
								</button>
							</div>
							{seedResult && (
								<div className={styles.seedResult}>
									{seedResult.ok ? (
										<>
											<div className={styles.seedOk}>✓ {seedResult.message}</div>
											<div className={styles.seedCreds}>
												<b>Логины для входа:</b>
												{seedResult.credentials?.admins?.map((a: any) => (
													<div key={a.email} className={styles.seedCred}>
														<span className={styles.seedRole}>Админ</span>
														<span>{a.email}</span>
														<code>{a.password}</code>
													</div>
												))}
												{seedResult.credentials?.actors?.map((a: any) => (
													<div key={a.email} className={styles.seedCred}>
														<span className={styles.seedRole}>Актёр</span>
														<span>{a.email}</span>
														<code>{a.password}</code>
													</div>
												))}
											</div>
										</>
									) : (
										<div className={styles.seedErr}>
										Ошибка: {seedResult.error || seedResult.detail || JSON.stringify(seedResult)}
										{seedResult.traceback && (
											<pre style={{ fontSize: 10, marginTop: 8, whiteSpace: 'pre-wrap', opacity: 0.7 }}>{seedResult.traceback}</pre>
										)}
									</div>
									)}
								</div>
							)}
						</div>
					</>
				)}

					{tab === 'users' && (
						<>
							<div className={styles.searchBar}>
								<input placeholder="Поиск по имени, email, telegram..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={styles.input} />
								<span className={styles.count}>{filteredUsers.length} пользователей</span>
							</div>
							<div className={styles.list}>
								{filteredUsers.map((u: any) => (
									<div key={u.id} className={`${styles.userCard} ${styles.clickableCard}`} onClick={() => openUserDetails(u.id)}>
										<div className={styles.userInfo}>
											<div className={styles.userName}>{u.last_name || ''} {u.first_name || ''} {u.middle_name || ''}<span className={styles.userId}>#{u.id}</span></div>
											<div className={styles.userMeta}>
												{u.email && <span>{u.email}</span>}
												{u.phone_number && <span>{formatPhone(u.phone_number)}</span>}
												{u.telegram_username && <span>TG: @{u.telegram_username}</span>}
												{u.telegram_nick && <span>TG: {u.telegram_nick}</span>}
												{u.vk_nick && <span>VK: {u.vk_nick}</span>}
												{u.max_nick && <span>MAX: {u.max_nick}</span>}
											</div>
										</div>
									<div className={styles.userActions}>
										<span className={`${styles.roleBadge} ${styles[`role_${u.role}`]}`}>{roleLabel(u.role)}</span>
										{(u.role === 'employer' || u.role === 'employer_pro') && (
											<span className={u.is_employer_verified ? styles.verifiedBadgeSmall : styles.unverifiedBadgeSmall}>
												{u.is_employer_verified ? <IconCheck size={10} /> : <IconClock size={10} />}
											</span>
										)}
										<span className={u.is_active ? styles.activeStatus : styles.inactiveStatus}>{u.is_active ? 'Active' : 'Blocked'}</span>
									</div>
									</div>
								))}
							</div>
						</>
					)}

					{tab === 'actors' && (
						<>
							<h3 className={styles.sectionTitle}>Все актёры в базе ({actors.length})</h3>
							<div className={styles.list}>
								{actors.length === 0 ? (
									<p className={styles.empty}>Нет профилей актёров</p>
								) : actors.map((a: any, i: number) => (
									<div key={i} className={`${styles.actorCard} ${styles.clickableCard}`} onClick={() => openActorDetails(a)}>
										<div className={styles.actorAvatar}>
											{a.photo_url ? <img src={a.photo_url} alt="" /> : (a.first_name?.[0] || '?').toUpperCase()}
										</div>
										<div className={styles.actorInfo}>
											<strong>{a.first_name || 'Без имени'} {a.last_name || ''}</strong>
											{a.has_profile ? (
												<span>{a.city || '—'} · {a.gender || '—'} · {a.qualification || '—'}</span>
											) : (
												<span style={{color: '#f59e0b'}}>Профиль не создан</span>
											)}
											{a.email && <span style={{color: '#888', fontSize: 12}}>{a.email}</span>}
											<span style={{color: '#666', fontSize: 11}}>
												{a.owner_role === 'agent' ? '🧑‍💼 Агент' : '🎭 Актёр'}
												{a.user_id ? ` · ID ${a.user_id}` : ''}
											</span>
										</div>
										{a.profile_id && (
											<button onClick={(e) => { e.stopPropagation(); deleteProfile(a.profile_id); }} className={styles.btnDanger}>Удалить</button>
										)}
									</div>
								))}
							</div>
						</>
					)}

					{tab === 'projects' && (
						<>
							<h3 className={styles.sectionTitle}>Все проекты ({projects.length})</h3>
							<div className={styles.list}>
								{projects.map((p: any) => (
									<div key={p.id} className={`${styles.projectCard} ${styles.clickableCard}`} onClick={() => openProjectDetails(p)}>
										<div className={styles.projectInfo}>
											<strong>{p.title}</strong>
											<span>{p.description}</span>
											<span className={styles.projectMeta}>Owner #{p.owner_id} | {p.status} | {p.response_count || 0} откликов</span>
										</div>
										<button onClick={(e) => { e.stopPropagation(); deleteCasting(p.id); }} className={styles.btnDanger}>Удалить</button>
									</div>
								))}
							</div>
						</>
					)}

					{tab === 'blacklist' && (
						<>
							<h3 className={styles.sectionTitle}>Заблокировать пользователя</h3>
							<div className={styles.banForm}>
								<input placeholder="User ID" value={banUserId} onChange={e => setBanUserId(e.target.value)} className={styles.input} type="number" />
								<input placeholder="Причина блокировки" value={banReason} onChange={e => setBanReason(e.target.value)} className={styles.input} />
								<select value={banType} onChange={e => setBanType(e.target.value)} className={styles.input}>
									<option value="temporary">Временный</option>
									<option value="permanent">Перманентный</option>
								</select>
								{banType === 'temporary' && (
									<input placeholder="Дней" value={banDays} onChange={e => setBanDays(e.target.value)} className={styles.input} type="number" />
								)}
								<button onClick={banUser} disabled={!banUserId || !banReason} className={styles.btnDanger}>Заблокировать</button>
							</div>
							<h3 className={styles.sectionTitle}>Заблокированные ({blacklist.length})</h3>
							<div className={styles.list}>
								{blacklist.length === 0 ? (
									<p className={styles.empty}>Нет заблокированных пользователей</p>
								) : blacklist.map((b: any) => (
									<div key={b.id} className={styles.banCard}>
										<div>
											<strong>User #{b.user_id}</strong>
											<span className={styles.banType}>{b.ban_type}</span>
											<p className={styles.banReason}>{b.reason}</p>
											<span className={styles.banDate}>{b.expires_at === 'permanent' ? 'Навсегда' : `До ${b.expires_at?.split('.')[0]}`}</span>
										</div>
										<button onClick={() => unbanUser(b.user_id)} className={styles.btnGreen}>Разблокировать</button>
									</div>
								))}
							</div>
						</>
					)}

					{tab === 'notifications' && (
						<>
							<h3 className={styles.sectionTitle}>Уведомления</h3>
							<div className={styles.list}>
								{notifications.length === 0 ? (
									<p className={styles.empty}>Нет уведомлений</p>
								) : notifications.map((n: any) => (
									<div key={n.id} className={`${styles.notifCard} ${n.is_read ? '' : styles.unread}`}>
										<div>
											<strong>{n.title}</strong>
											{n.message && <p>{n.message}</p>}
										</div>
										<span className={styles.notifDate}>{n.created_at?.split('.')[0]}</span>
									</div>
								))}
							</div>
						</>
					)}

					{tab === 'myprojects' && (
						<>
							<h3 className={styles.sectionTitle}>Создать проект</h3>
							<div className={styles.createForm}>
								<input placeholder="Название кастинга" value={newTitle} onChange={e => setNewTitle(e.target.value)} className={styles.input} />
								<input placeholder="Описание" value={newDesc} onChange={e => setNewDesc(e.target.value)} className={styles.input} />
								<button onClick={createProject} disabled={!newTitle.trim()} className={styles.btnPrimary}>+ Создать</button>
							</div>
						</>
					)}

					{tab === 'tickets' && (
						<div className={styles.ticketsLayout}>
							<div className={styles.ticketsList}>
								<h3 className={styles.sectionTitle}>Заявки на верификацию</h3>
								<div className={styles.ticketFilters}>
									<button className={styles.ticketFilterBtn} onClick={() => loadTickets()}>Все</button>
									<button className={styles.ticketFilterBtn} onClick={async () => { const d = await api('GET', 'superadmin/tickets/?status=open'); setTickets(d?.tickets || []) }}>Открытые</button>
									<button className={styles.ticketFilterBtn} onClick={async () => { const d = await api('GET', 'superadmin/tickets/?status=approved'); setTickets(d?.tickets || []) }}>Одобренные</button>
								</div>
								{tickets.length === 0 ? (
									<p className={styles.empty}>Нет заявок</p>
								) : (
									tickets.map((t: any) => (
										<div key={t.id} className={`${styles.ticketItem} ${selectedTicket?.id === t.id ? styles.ticketItemActive : ''}`} onClick={() => openTicket(t.id)}>
											<div className={styles.ticketItemHeader}>
												<span className={styles.ticketItemName}>{t.user_name || t.user_email}</span>
												<span className={`${styles.ticketStatusBadge} ${t.status === 'approved' ? styles.ticketApproved : t.status === 'rejected' ? styles.ticketRejected : styles.ticketOpen}`}>
													{t.status === 'approved'
														? <><IconCheck size={10} /> Одобрен</>
														: t.status === 'rejected'
														? <><IconX size={10} /> Отклонён</>
														: <><IconClock size={10} /> Open</>}
												</span>
											</div>
											<div className={styles.ticketItemMeta}>
												<span className={styles.ticketMetaRole}><IconUser size={11} /> {roleLabel(t.user_role || '')}</span>
												{t.message_count > 0 && (
													<span className={styles.ticketMsgCount}>
														<IconMessageSquare size={11} /> {t.message_count}
													</span>
												)}
											</div>
											{t.last_message && <p className={styles.ticketItemPreview}>{t.last_message}</p>}
										</div>
									))
								)}
							</div>
							<div className={styles.ticketDetail}>
							{!selectedTicket ? (
								<div className={styles.ticketDetailEmpty}>
									<span className={styles.emptyIcon}><IconTicket size={32} /></span>
									<p>Выберите тикет</p>
								</div>
								) : (
									<>
										<div className={styles.ticketDetailHeader}>
											<div>
												<h3>{selectedTicket.user_name || selectedTicket.user_email}</h3>
												<span className={styles.ticketDetailRole}>{roleLabel(selectedTicket.user_role || '')}</span>
											</div>
											<div className={styles.ticketDetailActions}>
												{selectedTicket.status === 'open' && (
													<>
														<button className={styles.btnApprove} onClick={() => approveTicket(selectedTicket.id)}><IconCheck size={14} /> Одобрить</button>
														<button className={styles.btnReject} onClick={() => rejectTicket(selectedTicket.id)}><IconX size={14} /> Отклонить</button>
													</>
												)}
												{selectedTicket.status === 'approved' && <span className={styles.ticketApprovedLabel}><IconCheck size={14} /> Верифицирован</span>}
												{selectedTicket.status === 'rejected' && <span className={styles.ticketRejectedLabel}><IconX size={14} /> Отклонён</span>}
											</div>
										</div>
									<div className={styles.ticketInfoGrid}>
										{selectedTicket.company_name && (
											<div className={styles.ticketInfoCard}>
												<span className={styles.ticketInfoIcon}><IconBuilding size={14} /></span>
												<div>
													<span className={styles.ticketInfoLabel}>Компания</span>
													<span className={styles.ticketInfoValue}>{selectedTicket.company_name}</span>
												</div>
											</div>
										)}
										{selectedTicket.about_text && (
											<div className={styles.ticketInfoCard}>
												<span className={styles.ticketInfoIcon}><IconBriefcase size={14} /></span>
												<div>
													<span className={styles.ticketInfoLabel}>О себе</span>
													<span className={styles.ticketInfoValue}>{selectedTicket.about_text}</span>
												</div>
											</div>
										)}
										{selectedTicket.projects_text && (
											<div className={styles.ticketInfoCard}>
												<span className={styles.ticketInfoIcon}><IconFilm size={14} /></span>
												<div>
													<span className={styles.ticketInfoLabel}>Проекты</span>
													<span className={styles.ticketInfoValue}>{selectedTicket.projects_text}</span>
												</div>
											</div>
										)}
										{selectedTicket.experience_text && (
											<div className={styles.ticketInfoCard}>
												<span className={styles.ticketInfoIcon}><IconAward size={14} /></span>
												<div>
													<span className={styles.ticketInfoLabel}>Опыт</span>
													<span className={styles.ticketInfoValue}>{selectedTicket.experience_text}</span>
												</div>
											</div>
										)}
									</div>

										<div className={styles.ticketChatArea}>
											<div className={styles.ticketChatMessages}>
												{ticketMessages.map((m: any) => (
													<div key={m.id} className={`${styles.tChatMsg} ${m.sender_role === 'owner' ? styles.tChatMsgOwner : styles.tChatMsgUser}`}>
														<div className={styles.tChatMsgHead}>
															<span className={styles.tChatMsgName}>{m.sender_name}</span>
															<span className={styles.tChatMsgTime}>{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}</span>
														</div>
														<div className={styles.tChatMsgText}>
															{renderTicketMessage(m.message, styles.msgLine, styles.msgLineIcon)}
														</div>
													</div>
												))}
												<div ref={ticketChatEndRef} />
											</div>
											{selectedTicket.status === 'open' && (
												<div className={styles.tChatInputArea}>
													<input value={ticketChatInput} onChange={e => setTicketChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendTicketMessage()} placeholder="Напишите ответ..." className={styles.tChatInput} />
													<button onClick={sendTicketMessage} disabled={ticketChatSending || !ticketChatInput.trim()} className={styles.tChatSendBtn}>
														{ticketChatSending ? <IconLoader size={14} /> : <IconSend size={14} />}
													</button>
												</div>
											)}
										</div>
									</>
								)}
							</div>
						</div>
					)}

					{tab === 'generalchat' && (
						<div className={styles.generalChatContainer}>
							<h3 className={styles.sectionTitle}><IconMessageSquare size={13} /> Общий чат — верифицированные админы + SuperAdmin</h3>
							<div className={styles.generalChatMessages}>
								{generalChatMessages.length === 0 ? (
									<div className={styles.empty}>Нет сообщений. Начните первым!</div>
								) : (
									generalChatMessages.map((m: any) => (
										<div key={m.id} className={`${styles.gcMsg} ${m.sender_role === 'owner' ? styles.gcMsgOwner : ''}`}>
											<div className={styles.gcMsgHead}>
												<span className={styles.gcMsgName}>{m.sender_name}</span>
												<span className={styles.gcMsgTime}>{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}</span>
											</div>
											<p className={styles.gcMsgText}>{m.message}</p>
										</div>
									))
								)}
								<div ref={generalChatEndRef} />
							</div>
							<div className={styles.gcInputArea}>
								<input value={generalChatInput} onChange={e => setGeneralChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendGeneralChat()} placeholder="Напишите сообщение..." className={styles.gcInput} />
							<button onClick={sendGeneralChat} disabled={generalChatSending || !generalChatInput.trim()} className={styles.gcSendBtn}>
								{generalChatSending ? <IconLoader size={16} /> : <IconSend size={16} />}
							</button>
							</div>
						</div>
					)}
				</div>

				<LiveChat />
			</div>

			{renderModal()}

			{lightboxIdx !== null && modalType === 'actor' && modalData && (() => {
				const photos = (modalData.media_assets || []).filter((m: any) => m.file_type === 'photo')
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
