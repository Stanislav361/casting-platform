'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import LiveChat from '../components/live-chat'
import styles from './admin.module.scss'

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

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) { router.replace('/login'); return }
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
		} catch { return null }
	}, [token])

	const showMsg = (msg: string) => {
		setActionMsg(msg)
		setTimeout(() => setActionMsg(null), 3000)
	}

	useEffect(() => {
		if (!token) return
		const load = async () => {
			const [s, u, p, b] = await Promise.all([
				api('GET', 'superadmin/stats/'),
				api('GET', 'superadmin/users/?page_size=100'),
				api('GET', 'employer/projects/?page_size=100'),
				api('GET', 'blacklist/'),
			])
			setStats(s)
			setUsers(u?.users || [])
			setProjects(p?.projects || [])
			setBlacklist(b?.entries || [])
			setLoading(false)
		}
		load()
	}, [token, api])

	const loadTickets = useCallback(async () => {
		const data = await api('GET', 'superadmin/tickets/')
		setTickets(data?.tickets || [])
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
			(u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.telegram_username || '').toLowerCase().includes(searchQuery.toLowerCase())
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

	const tabs: { key: Tab; label: string; icon: string }[] = [
		{ key: 'stats', label: 'Статистика', icon: '📊' },
		{ key: 'tickets', label: 'Тикеты', icon: '📩' },
		{ key: 'generalchat', label: 'Общий чат', icon: '💬' },
		{ key: 'users', label: 'Пользователи', icon: '👥' },
		{ key: 'actors', label: 'Актёры', icon: '🎭' },
		{ key: 'projects', label: 'Все проекты', icon: '🎬' },
		{ key: 'blacklist', label: 'Blacklist', icon: '🚫' },
		{ key: 'notifications', label: 'Уведомления', icon: '🔔' },
		{ key: 'myprojects', label: 'Мои проекты', icon: '📋' },
	]

	const roleLabel = (role: string) => {
		const m: Record<string, string> = {
			owner: '👑 SuperAdmin', employer_pro: '⭐ Админ PRO', employer: '📋 Админ',
			user: '🎭 Актёр', agent: '🧑‍💼 Агент', administrator: '🔧 Администратор',
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
				title = `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || 'Пользователь'
				body = (
					<>
						<div className={styles.detailRow}><span>Роль</span><b>{roleLabel(u?.role)}</b></div>
						<div className={styles.detailRow}><span>Email</span><b>{u?.email || '—'}</b></div>
						<div className={styles.detailRow}><span>Телефон</span><b>{u?.phone_number || '—'}</b></div>
						{u?.photo_url && (
							<div className={styles.detailRow}><span>Фото</span><img src={u.photo_url} alt="" className={styles.modalAvatar} /></div>
						)}

						{(u?.role === 'user' || u?.role === 'agent') && (
							<section className={styles.detailSection}>
								<h4>{u?.role === 'agent' ? `Актеры агента (${modalData.actor_profiles?.length || 0})` : `Анкеты актера (${modalData.actor_profiles?.length || 0})`}</h4>
								{(modalData.actor_profiles || []).length === 0 ? (
									<p className={styles.empty}>Нет анкет</p>
								) : (
									<div className={styles.miniList}>
										{modalData.actor_profiles.map((p: any) => (
											<div key={p.id} className={styles.miniCard}>
												<strong>{p.first_name || ''} {p.last_name || ''}</strong>
												<span>{p.city || '—'} · {p.gender || '—'} · {p.phone_number || '—'}</span>
											</div>
										))}
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
				title = `${modalData.first_name || ''} ${modalData.last_name || ''}`.trim() || 'Актёр'
				body = (
					<>
						<div className={styles.detailRow}><span>Имя</span><b>{modalData.first_name || '—'}</b></div>
						<div className={styles.detailRow}><span>Фамилия</span><b>{modalData.last_name || '—'}</b></div>
						<div className={styles.detailRow}><span>Пол</span><b>{modalData.gender || '—'}</b></div>
						<div className={styles.detailRow}><span>Город</span><b>{modalData.city || '—'}</b></div>
						<div className={styles.detailRow}><span>Квалификация</span><b>{modalData.qualification || '—'}</b></div>
						<div className={styles.detailRow}><span>Телефон</span><b>{modalData.phone_number || '—'}</b></div>
						{modalData.owner_name && (
							<div className={styles.detailRow}><span>Владелец</span><b>{modalData.owner_name} ({roleLabel(modalData.owner_role)})</b></div>
						)}
						<div className={styles.detailRow}><span>Источник</span><b>{modalData.source === 'actor_profiles' ? 'Новая система' : 'Legacy'}</b></div>
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
						<button className={styles.modalClose} onClick={closeModal}>✕</button>
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
					<h1>{'👑'} Super<span>Admin</span></h1>
					<div className={styles.headerRight}>
						<button onClick={() => router.push('/dashboard')} className={styles.navBtn}>Dashboard</button>
						<button onClick={() => { logout(); router.replace('/login') }} className={styles.logoutBtn}>Выход</button>
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
							{t.icon} {t.label}
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
											<div className={styles.userName}>{u.first_name || ''} {u.last_name || ''}<span className={styles.userId}>#{u.id}</span></div>
											<div className={styles.userMeta}>
												{u.email && <span>{u.email}</span>}
												{u.telegram_username && <span>@{u.telegram_username}</span>}
											</div>
										</div>
									<div className={styles.userActions}>
										<span className={`${styles.roleBadge} ${styles[`role_${u.role}`]}`}>{u.role}</span>
										{(u.role === 'employer' || u.role === 'employer_pro') && (
											<span className={u.is_employer_verified ? styles.verifiedBadgeSmall : styles.unverifiedBadgeSmall}>
												{u.is_employer_verified ? '✅' : '⏳'}
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
											<strong>{a.first_name} {a.last_name}</strong>
											<span>{a.city || '—'} · {a.gender || '—'} · {a.qualification || '—'}</span>
											{a.owner_name && <span>Владелец: {a.owner_name} ({a.owner_role})</span>}
										</div>
										<button onClick={(e) => { e.stopPropagation(); deleteProfile(a.profile_id); }} className={styles.btnDanger}>Удалить</button>
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
													{t.status === 'approved' ? '✅' : t.status === 'rejected' ? '❌' : '⏳'} {t.status}
												</span>
											</div>
											<div className={styles.ticketItemMeta}>
												<span>{roleLabel(t.user_role || '')}</span>
												{t.message_count > 0 && <span className={styles.ticketMsgCount}>{t.message_count} 💬</span>}
											</div>
											{t.last_message && <p className={styles.ticketItemPreview}>{t.last_message}</p>}
										</div>
									))
								)}
							</div>
							<div className={styles.ticketDetail}>
								{!selectedTicket ? (
									<div className={styles.ticketDetailEmpty}>
										<span>📩</span>
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
														<button className={styles.btnApprove} onClick={() => approveTicket(selectedTicket.id)}>✅ Одобрить</button>
														<button className={styles.btnReject} onClick={() => rejectTicket(selectedTicket.id)}>❌ Отклонить</button>
													</>
												)}
												{selectedTicket.status === 'approved' && <span className={styles.ticketApprovedLabel}>✅ Верифицирован</span>}
												{selectedTicket.status === 'rejected' && <span className={styles.ticketRejectedLabel}>❌ Отклонён</span>}
											</div>
										</div>
										{selectedTicket.company_name && <p className={styles.ticketInfoLine}>🏢 {selectedTicket.company_name}</p>}
										{selectedTicket.about_text && <p className={styles.ticketInfoLine}>💼 {selectedTicket.about_text}</p>}
										{selectedTicket.projects_text && <p className={styles.ticketInfoLine}>🎬 {selectedTicket.projects_text}</p>}
										{selectedTicket.experience_text && <p className={styles.ticketInfoLine}>⭐ {selectedTicket.experience_text}</p>}

										<div className={styles.ticketChatArea}>
											<div className={styles.ticketChatMessages}>
												{ticketMessages.map((m: any) => (
													<div key={m.id} className={`${styles.tChatMsg} ${m.sender_role === 'owner' ? styles.tChatMsgOwner : styles.tChatMsgUser}`}>
														<div className={styles.tChatMsgHead}>
															<span className={styles.tChatMsgName}>{m.sender_name}</span>
															<span className={styles.tChatMsgTime}>{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}</span>
														</div>
														<p className={styles.tChatMsgText}>{m.message}</p>
													</div>
												))}
												<div ref={ticketChatEndRef} />
											</div>
											{selectedTicket.status === 'open' && (
												<div className={styles.tChatInputArea}>
													<input value={ticketChatInput} onChange={e => setTicketChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendTicketMessage()} placeholder="Напишите ответ..." className={styles.tChatInput} />
													<button onClick={sendTicketMessage} disabled={ticketChatSending || !ticketChatInput.trim()} className={styles.tChatSendBtn}>
														{ticketChatSending ? '...' : '➤'}
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
							<h3 className={styles.sectionTitle}>💬 Общий чат (верифицированные админы + SuperAdmin)</h3>
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
									{generalChatSending ? '...' : '➤'}
								</button>
							</div>
						</div>
					)}
				</div>

				<LiveChat />
			</div>

			{renderModal()}
		</>
	)
}
