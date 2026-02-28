'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import LiveChat from '../components/live-chat'
import styles from './admin.module.scss'

type Tab = 'stats' | 'users' | 'actors' | 'projects' | 'subscriptions' | 'blacklist' | 'notifications' | 'myprojects'

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
	const [editingUser, setEditingUser] = useState<any>(null)
	const [newRole, setNewRole] = useState('')

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

	const loadActors = async () => {
		const data = await api('GET', 'employer/actors/all/?page_size=100')
		setActors(data?.respondents || [])
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

	const changeRole = async (userId: number, role: string) => {
		// Используем прямой SQL через подписку для смены роли
		if (role === 'employer') {
			await api('POST', `subscriptions/activate/?plan=admin&days=365`)
		} else if (role === 'employer_pro') {
			await api('POST', `subscriptions/activate/?plan=admin_pro&days=365`)
		}
		showMsg(`Роль пользователя #${userId} обновлена`)
		setEditingUser(null)
		const u = await api('GET', 'superadmin/users/?page_size=100')
		setUsers(u?.users || [])
	}

	const filteredUsers = searchQuery
		? users.filter(u =>
			(u.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.last_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.telegram_username || '').toLowerCase().includes(searchQuery.toLowerCase())
		)
		: users

	if (loading) return <div className={styles.root}><p className={styles.center}>Загрузка...</p></div>

	const tabs: { key: Tab; label: string; icon: string }[] = [
		{ key: 'stats', label: 'Статистика', icon: '📊' },
		{ key: 'users', label: 'Пользователи', icon: '👥' },
		{ key: 'actors', label: 'Актёры', icon: '🎭' },
		{ key: 'projects', label: 'Все проекты', icon: '🎬' },
		{ key: 'blacklist', label: 'Blacklist', icon: '🚫' },
		{ key: 'notifications', label: 'Уведомления', icon: '🔔' },
		{ key: 'myprojects', label: 'Мои проекты', icon: '📋' },
	]

	return (
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

				{/* STATS */}
				{tab === 'stats' && stats && (
					<>
						<div className={styles.statsGrid}>
							<div className={styles.statCard}>
								<span className={styles.statNum}>{stats.users_total}</span>
								<span>Пользователей</span>
							</div>
							<div className={styles.statCard}>
								<span className={styles.statNum}>{stats.profiles_total}</span>
								<span>Профилей</span>
							</div>
							<div className={styles.statCard}>
								<span className={styles.statNum}>{stats.castings_total}</span>
								<span>Кастингов</span>
							</div>
						</div>
						<h3 className={styles.sectionTitle}>Распределение по ролям</h3>
						<div className={styles.roleGrid}>
							{stats.roles && Object.entries(stats.roles).map(([role, count]: any) => (
								<div key={role} className={styles.roleCard}>
									<span className={styles.roleName}>
										{role === 'owner' ? '👑 SuperAdmin' :
										 role === 'employer_pro' ? '⭐ АдминПро' :
										 role === 'employer' ? '📋 Админ' :
										 role === 'user' ? '🎭 Актёр' :
										 role === 'administrator' ? '🔧 Администратор' : role}
									</span>
									<span className={styles.roleCount}>{count}</span>
								</div>
							))}
						</div>
					</>
				)}

				{/* USERS */}
				{tab === 'users' && (
					<>
						<div className={styles.searchBar}>
							<input
								placeholder="Поиск по имени, email, telegram..."
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								className={styles.input}
							/>
							<span className={styles.count}>{filteredUsers.length} пользователей</span>
						</div>
						<div className={styles.list}>
							{filteredUsers.map((u: any) => (
								<div key={u.id} className={styles.userCard}>
									<div className={styles.userInfo}>
										<div className={styles.userName}>
											{u.first_name || ''} {u.last_name || ''}
											<span className={styles.userId}>#{u.id}</span>
										</div>
										<div className={styles.userMeta}>
											{u.email && <span>{u.email}</span>}
											{u.telegram_username && <span>@{u.telegram_username}</span>}
										</div>
									</div>
									<div className={styles.userActions}>
										<span className={`${styles.roleBadge} ${styles[`role_${u.role}`]}`}>{u.role}</span>
										<span className={u.is_active ? styles.activeStatus : styles.inactiveStatus}>
											{u.is_active ? 'Active' : 'Blocked'}
										</span>
									</div>
								</div>
							))}
						</div>
					</>
				)}

				{/* ACTORS */}
				{tab === 'actors' && (
					<>
						<h3 className={styles.sectionTitle}>Все актёры в базе ({actors.length})</h3>
						<div className={styles.list}>
							{actors.length === 0 ? (
								<p className={styles.empty}>Нет профилей актёров</p>
							) : actors.map((a: any, i: number) => (
								<div key={i} className={styles.actorCard}>
									<div className={styles.actorAvatar}>
										{a.photo_url ? <img src={a.photo_url} alt="" /> : (a.first_name?.[0] || '?').toUpperCase()}
									</div>
									<div className={styles.actorInfo}>
										<strong>{a.first_name} {a.last_name}</strong>
										<span>{a.city || '—'} | {a.gender || '—'} | {a.qualification || '—'}</span>
									</div>
									<button onClick={() => deleteProfile(a.profile_id)} className={styles.btnDanger}>Удалить</button>
								</div>
							))}
						</div>
					</>
				)}

				{/* PROJECTS */}
				{tab === 'projects' && (
					<>
						<h3 className={styles.sectionTitle}>Все проекты ({projects.length})</h3>
						<div className={styles.list}>
							{projects.map((p: any) => (
								<div key={p.id} className={styles.projectCard}>
									<div className={styles.projectInfo}>
										<strong>{p.title}</strong>
										<span>{p.description}</span>
										<span className={styles.projectMeta}>
											Owner #{p.owner_id} | {p.status} | {p.response_count || 0} откликов
										</span>
									</div>
									<button onClick={() => deleteCasting(p.id)} className={styles.btnDanger}>Удалить</button>
								</div>
							))}
						</div>
					</>
				)}

				{/* BLACKLIST */}
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
										<span className={styles.banDate}>
											{b.expires_at === 'permanent' ? 'Навсегда' : `До ${b.expires_at?.split('.')[0]}`}
										</span>
									</div>
									<button onClick={() => unbanUser(b.user_id)} className={styles.btnGreen}>Разблокировать</button>
								</div>
							))}
						</div>
					</>
				)}

				{/* NOTIFICATIONS */}
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

				{/* MY PROJECTS */}
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
			</div>

			<LiveChat />
		</div>
	)
}
