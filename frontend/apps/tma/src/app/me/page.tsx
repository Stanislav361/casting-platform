'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { useRole } from '~/shared/use-role'
import { API_URL } from '~/shared/api-url'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconLoader,
	IconUsers,
	IconReport,
	IconHeart,
	IconBell,
	IconSend,
	IconSettings,
	IconFilm,
} from '~packages/ui/icons'
import styles from './me.module.scss'

interface MeData {
	id?: number
	email?: string
	first_name?: string
	last_name?: string
	photo_url?: string | null
	role?: string
	phone_number?: string
}

const ROLE_LABEL: Record<string, string> = {
	owner: 'Супер Админ',
	employer_pro: 'Админ PRO',
	employer: 'Работодатель',
	administrator: 'Администратор',
	manager: 'Менеджер',
	agent: 'Агент',
	user: 'Актёр',
}

function fullName(me?: MeData | null): string {
	if (!me) return '—'
	const n = `${me.first_name || ''} ${me.last_name || ''}`.trim()
	return n || me.email || 'Пользователь'
}

function normalizeMediaUrl(url?: string | null): string {
	if (!url) return ''
	if (/^https?:\/\//.test(url)) return url
	if (url.startsWith('/')) {
		try {
			const base = new URL(API_URL)
			return `${base.protocol}//${base.host}${url}`
		} catch { return url }
	}
	return url
}

function initials(me?: MeData | null): string {
	const n = fullName(me)
	if (!n || n === '—') return '?'
	return n.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

export default function MePage() {
	const router = useRouter()
	const goBack = useSmartBack()
	const role = useRole()

	const [me, setMe] = useState<MeData | null>(null)
	const [stats, setStats] = useState<{
		castings?: number
		responses?: number
		reports?: number
		favorites?: number
		unread?: number
		actors?: number
		completion?: number
	}>({})
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		setLoading(true)

		const meData: MeData | null = await apiCall('GET', 'auth/v2/me/')
		if (meData && !(meData as any).detail) setMe(meData)

		const st: typeof stats = {}
		try {
			const unread = await apiCall('GET', 'notifications/?unread_only=true&page=1')
			if (unread && !unread.detail) st.unread = unread.unread_count ?? 0
		} catch {}

		if (role && ['owner', 'administrator', 'manager', 'employer_pro', 'employer'].includes(role)) {
			try {
				const projectsData = await apiCall('GET', 'employer/projects/?page=1&page_size=200')
				if (projectsData && !projectsData.detail) {
					const projects = projectsData.projects || projectsData.items || []
					const counts = await Promise.all(projects.map(async (p: any) => {
						const data = await apiCall('GET', `employer/projects/${p.id}/castings/`)
						const list = data?.castings || data?.items || []
						return list.length
					}))
					st.castings = counts.reduce((sum, n) => sum + n, 0)
				}
			} catch {}
			try {
				const r = await apiCall('GET', 'employer/reports/')
				if (r && !r.detail) st.reports = r.reports?.length ?? 0
			} catch {}
			try {
				const f = await apiCall('GET', 'employer/favorites/ids/')
				if (f && !f.detail) st.favorites = Array.isArray(f.ids) ? f.ids.length : 0
			} catch {}
		}

		if (role === 'agent') {
			try {
				const resp = await apiCall('GET', 'feed/my-responses/')
				if (resp && !resp.detail) st.responses = resp.responses?.length ?? 0
			} catch {}
			try {
				const f = await apiCall('GET', 'employer/favorites/ids/')
				if (f && !f.detail) st.favorites = Array.isArray(f.ids) ? f.ids.length : 0
			} catch {}
			try {
				const actors = await apiCall('GET', 'actor-profiles/mine/')
				if (actors && !actors.detail) st.actors = Array.isArray(actors.profiles) ? actors.profiles.length : (Array.isArray(actors) ? actors.length : 0)
			} catch {}
		}

		if (role === 'user') {
			try {
				const resp = await apiCall('GET', 'feed/my-responses/')
				if (resp && !resp.detail) st.responses = resp.responses?.length ?? 0
			} catch {}
			try {
				if (meData?.id) {
					const ts = await apiCall('GET', `trust-score/${meData.id}/`)
					if (ts && !ts.detail) st.completion = ts.profile_completeness ?? 0
				}
			} catch {}
		}

		setStats(st)
		setLoading(false)
	}, [role])

	useEffect(() => { load() }, [load])

	const roleLabel = role ? (ROLE_LABEL[role] || role) : '—'

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				<h1 className={styles.title}>Моя страница</h1>
			</header>

			{loading && !me ? (
				<div className={styles.state}><IconLoader size={22} /><span>Загрузка…</span></div>
			) : (
				<>
					{/* Profile card */}
					<section className={styles.profileCard}>
						<div className={styles.avatar}>
							{me?.photo_url ? (
								<img src={normalizeMediaUrl(me.photo_url)} alt="" />
							) : (
								<span>{initials(me)}</span>
							)}
						</div>
						<div className={styles.profileInfo}>
							<p className={styles.nameLabel}>
								<span className={styles.name}>{fullName(me)}</span>
								<span className={styles.roleBadge}>{roleLabel}</span>
							</p>
							{me?.email && <p className={styles.profileMeta}>{me.email}</p>}
							{me?.phone_number && <p className={styles.profileMeta}>{me.phone_number}</p>}
						</div>
						<button className={styles.settingsBtn} onClick={() => router.push('/settings')}>
							<IconSettings size={16} />
							<span>Настройки</span>
						</button>
					</section>

					{/* Completion bar for actor */}
					{role === 'user' && stats.completion !== undefined && (
						<section className={styles.completion}>
							<div className={styles.completionHead}>
								<span>Заполнение профиля</span>
								<b>{stats.completion}%</b>
							</div>
							<div className={styles.progressTrack}>
								<div
									className={styles.progressFill}
									style={{ width: `${Math.min(100, Math.max(0, stats.completion))}%` }}
								/>
							</div>
							{stats.completion < 100 && (
								<button className={styles.linkBtn} onClick={() => router.push('/cabinet')}>
									Дозаполнить анкету →
								</button>
							)}
						</section>
					)}

					{/* Quick stats */}
					<section className={styles.statsGrid}>
						{role && ['owner', 'administrator', 'manager', 'employer_pro', 'employer'].includes(role) && (
							<>
								<StatTile label="Кастинги" value={stats.castings ?? 0} icon={<IconFilm size={18} />} />
								<StatTile label="Отчёты"   value={stats.reports ?? 0}   icon={<IconReport size={18} />} />
								<StatTile label="Избранные" value={stats.favorites ?? 0} icon={<IconHeart size={18} />} />
								<StatTile label="Новых уведомлений" value={stats.unread ?? 0} icon={<IconBell size={18} />} highlight={!!stats.unread} />
							</>
						)}
						{role === 'agent' && (
							<>
								<StatTile label="Мои актёры" value={stats.actors ?? 0} icon={<IconUsers size={18} />} />
								<StatTile label="Отклики"   value={stats.responses ?? 0} icon={<IconSend size={18} />} />
								<StatTile label="Избранные" value={stats.favorites ?? 0} icon={<IconHeart size={18} />} />
								<StatTile label="Новых уведомлений" value={stats.unread ?? 0} icon={<IconBell size={18} />} highlight={!!stats.unread} />
							</>
						)}
						{role === 'user' && (
							<>
								<StatTile label="Мои отклики" value={stats.responses ?? 0} icon={<IconSend size={18} />} />
								<StatTile label="Новых уведомлений" value={stats.unread ?? 0} icon={<IconBell size={18} />} highlight={!!stats.unread} />
							</>
						)}
					</section>

				</>
			)}
		</div>
	)
}

function StatTile({ label, value, icon, highlight }:
	{ label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
	return (
		<div className={`${styles.stat} ${highlight ? styles.statHighlight : ''}`}>
			<div className={styles.statIcon}>{icon}</div>
			<div className={styles.statBody}>
				<p className={styles.statValue}>{value}</p>
				<p className={styles.statLabel}>{label}</p>
			</div>
		</div>
	)
}
