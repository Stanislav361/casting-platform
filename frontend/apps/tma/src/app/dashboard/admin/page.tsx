'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session, logout } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import LiveChat from '../components/live-chat'
import styles from './admin.module.scss'

export default function SuperAdminPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [stats, setStats] = useState<any>(null)
	const [users, setUsers] = useState<any[]>([])
	const [projects, setProjects] = useState<any[]>([])
	const [blacklist, setBlacklist] = useState<any[]>([])
	const [tab, setTab] = useState<'stats' | 'users' | 'projects' | 'blacklist' | 'myprojects'>('stats')
	const [loading, setLoading] = useState(true)

	const [newTitle, setNewTitle] = useState('')
	const [newDesc, setNewDesc] = useState('')
	const [banUserId, setBanUserId] = useState('')
	const [banReason, setBanReason] = useState('')
	const [banType, setBanType] = useState('temporary')

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) { router.replace('/login'); return }
		setToken(session.access_token)
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		if (!token) return null
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: body ? JSON.stringify(body) : undefined,
		})
		return res.json().catch(() => null)
	}, [token])

	useEffect(() => {
		if (!token) return
		const load = async () => {
			const [s, u, p, b] = await Promise.all([
				api('GET', 'superadmin/stats/').catch(() => null),
				api('GET', 'superadmin/users/').catch(() => ({ users: [] })),
				api('GET', 'employer/projects/').catch(() => ({ projects: [] })),
				api('GET', 'blacklist/').catch(() => ({ entries: [] })),
			])
			setStats(s)
			setUsers(u?.users || [])
			setProjects(p?.projects || [])
			setBlacklist(b?.entries || [])
			setLoading(false)
		}
		load()
	}, [token, api])

	const createProject = async () => {
		if (!newTitle.trim()) return
		const res = await api('POST', 'employer/projects/', { title: newTitle, description: newDesc || '' })
		if (res?.id) { setProjects(prev => [res, ...prev]); setNewTitle(''); setNewDesc('') }
	}

	const deleteUser = async (profileId: number) => {
		if (!confirm('Удалить профиль?')) return
		await api('DELETE', `superadmin/profiles/${profileId}/`)
		setUsers(prev => prev.filter(u => u.id !== profileId))
	}

	const deleteCasting = async (castingId: number) => {
		if (!confirm('Удалить кастинг?')) return
		await api('DELETE', `superadmin/castings/${castingId}/`)
		setProjects(prev => prev.filter(p => p.id !== castingId))
	}

	const banUser = async () => {
		if (!banUserId || !banReason) return
		await api('POST', `blacklist/ban/?user_id=${banUserId}&ban_type=${banType}&reason=${encodeURIComponent(banReason)}&days=30`)
		setBanUserId(''); setBanReason('')
		const b = await api('GET', 'blacklist/')
		setBlacklist(b?.entries || [])
	}

	const unbanUser = async (userId: number) => {
		await api('POST', `blacklist/unban/?user_id=${userId}`)
		const b = await api('GET', 'blacklist/')
		setBlacklist(b?.entries || [])
	}

	if (loading) return <div className={styles.root}><p className={styles.center}>Загрузка...</p></div>

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<h1>👑 Super<span>Admin</span></h1>
				<div className={styles.headerRight}>
					<button onClick={() => router.push('/dashboard')} className={styles.navBtn}>← Дашборд</button>
					<button onClick={() => { logout(); router.replace('/login') }} className={styles.logoutBtn}>Выход</button>
				</div>
			</header>

			<nav className={styles.tabs}>
				{(['stats', 'users', 'projects', 'blacklist', 'myprojects'] as const).map(t => (
					<button key={t} className={`${styles.tab} ${tab === t ? styles.active : ''}`} onClick={() => setTab(t)}>
						{t === 'stats' ? '📊 Статистика' : t === 'users' ? '👥 Пользователи' : t === 'projects' ? '🎬 Все кастинги' : t === 'blacklist' ? '🚫 Blacklist' : '📋 Мои проекты'}
					</button>
				))}
			</nav>

			<div className={styles.content}>
				{tab === 'stats' && stats && (
					<div className={styles.statsGrid}>
						<div className={styles.statCard}><span className={styles.statNum}>{stats.users_total}</span><span>Пользователей</span></div>
						<div className={styles.statCard}><span className={styles.statNum}>{stats.profiles_total}</span><span>Профилей</span></div>
						<div className={styles.statCard}><span className={styles.statNum}>{stats.castings_total}</span><span>Кастингов</span></div>
						<div className={styles.statCard}>
							<span className={styles.statNum}>{Object.values(stats.roles || {}).reduce((a: number, b: any) => a + b, 0)}</span>
							<span>По ролям</span>
						</div>
						{stats.roles && Object.entries(stats.roles).map(([role, count]: any) => (
							<div key={role} className={styles.roleCard}>
								<span className={styles.roleName}>{role}</span>
								<span className={styles.roleCount}>{count}</span>
							</div>
						))}
					</div>
				)}

				{tab === 'users' && (
					<div className={styles.list}>
						{users.map((u: any) => (
							<div key={u.id} className={styles.listItem}>
								<div>
									<strong>{u.first_name} {u.last_name}</strong>
									<span className={styles.tag}>{u.role}</span>
									<p className={styles.sub}>{u.email || u.telegram_username || `ID: ${u.id}`}</p>
								</div>
								<button onClick={() => deleteUser(u.id)} className={styles.btnDanger}>Удалить</button>
							</div>
						))}
					</div>
				)}

				{tab === 'projects' && (
					<div className={styles.list}>
						{projects.map((p: any) => (
							<div key={p.id} className={styles.listItem}>
								<div>
									<strong>{p.title}</strong>
									<span className={styles.tag}>{p.status}</span>
									<p className={styles.sub}>{p.description}</p>
								</div>
								<button onClick={() => deleteCasting(p.id)} className={styles.btnDanger}>Удалить</button>
							</div>
						))}
					</div>
				)}

				{tab === 'blacklist' && (
					<>
						<div className={styles.banForm}>
							<input placeholder="User ID" value={banUserId} onChange={e => setBanUserId(e.target.value)} className={styles.input} />
							<input placeholder="Причина" value={banReason} onChange={e => setBanReason(e.target.value)} className={styles.input} />
							<select value={banType} onChange={e => setBanType(e.target.value)} className={styles.input}>
								<option value="temporary">Временный</option>
								<option value="permanent">Перманентный</option>
							</select>
							<button onClick={banUser} className={styles.btnDanger}>Заблокировать</button>
						</div>
						<div className={styles.list}>
							{blacklist.map((b: any) => (
								<div key={b.id} className={styles.listItem}>
									<div>
										<strong>User #{b.user_id}</strong>
										<span className={styles.tag}>{b.ban_type}</span>
										<p className={styles.sub}>{b.reason}</p>
									</div>
									<button onClick={() => unbanUser(b.user_id)} className={styles.btnGreen}>Разблокировать</button>
								</div>
							))}
							{blacklist.length === 0 && <p className={styles.empty}>Нет заблокированных</p>}
						</div>
					</>
				)}

				{tab === 'myprojects' && (
					<>
						<div className={styles.createForm}>
							<input placeholder="Название кастинга" value={newTitle} onChange={e => setNewTitle(e.target.value)} className={styles.input} />
							<input placeholder="Описание" value={newDesc} onChange={e => setNewDesc(e.target.value)} className={styles.input} />
							<button onClick={createProject} disabled={!newTitle.trim()} className={styles.btnPrimary}>+ Создать</button>
						</div>
						<div className={styles.list}>
							{projects.filter(p => p.owner_id === parseInt($session.getState()?.access_token?.split('.')[1] ? JSON.parse(atob($session.getState()?.access_token?.split('.')[1] || '')).id : '0')).map((p: any) => (
								<div key={p.id} className={styles.listItem}>
									<div><strong>{p.title}</strong><p className={styles.sub}>{p.description}</p></div>
									<span className={styles.tag}>{p.status}</span>
								</div>
							))}
						</div>
					</>
				)}
			</div>

			<LiveChat />
		</div>
	)
}
