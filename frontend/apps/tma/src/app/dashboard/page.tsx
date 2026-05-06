'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { $session, logout as doLogout } from '@prostoprobuy/models'
import { http } from '~packages/lib'
import { apiCall } from '~/shared/api-client'
import { useRole } from '~/shared/use-role'
import { API_URL } from '~/shared/api-url'
import {
	IconFilm,
	IconUsers,
	IconReport,
	IconUser,
	IconBell,
	IconChat,
	IconSettings,
	IconLogOut,
	IconChevronRight,
	IconLoader,
	IconCamera,
	IconShield,
	IconHeart,
} from '~packages/ui/icons'
import ProjectChatsFab from '~/widgets/project-chats-fab/project-chats-fab'
import styles from './admin-home.module.scss'

const ROLE_LABEL: Record<string, string> = {
	owner: 'Супер Админ',
	employer_pro: 'Админ PRO',
	employer: 'Работодатель',
	administrator: 'Администратор',
	manager: 'Менеджер',
	agent: 'Агент',
	user: 'Актёр',
}

function normalizeUrl(url?: string | null): string {
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

function fullName(me: any): string {
	const n = `${me?.first_name || ''} ${me?.last_name || ''}`.trim()
	return n || me?.email || 'Пользователь'
}

function initials(me: any): string {
	const n = fullName(me)
	if (!n || n === 'Пользователь') return '?'
	return n.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()
}

interface MenuItem {
	id: string
	label: string
	icon: React.ReactNode
	href: string
	color: string
	badge?: number
}

interface MenuSection {
	title: string
	items: MenuItem[]
}

export default function AdminHomePage() {
	const router = useRouter()
	const role = useRole()
	const avatarInputRef = useRef<HTMLInputElement>(null)

	const [me, setMe] = useState<any>(null)
	const [unread, setUnread] = useState(0)
	const [loading, setLoading] = useState(true)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)

	// Redirect non-admin users
	useEffect(() => {
		if (role && ['user', 'agent'].includes(role)) {
			router.replace('/actor-home')
		}
	}, [role, router])

	// Guard: no session → login
	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
		}
	}, [router])

	const load = useCallback(async () => {
		try {
			const [meData, notifData] = await Promise.all([
				apiCall('GET', 'auth/v2/me/').catch(() => null),
				apiCall('GET', 'notifications/?unread_only=true&page=1').catch(() => null),
			])
			if (meData && !meData.detail) setMe(meData)
			setUnread(notifData?.unread_count ?? 0)
		} catch {}
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	// Safety: never stay on loader for more than 5 seconds.
	useEffect(() => {
		const t = setTimeout(() => setLoading(false), 5000)
		return () => clearTimeout(t)
	}, [])

	const uploadAvatar = async (file: File) => {
		setUploadingAvatar(true)
		try {
			const formData = new FormData()
			formData.append('file', file)
			const res = await http.post('auth/v2/me/photo/', formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			})
			if (res?.data) setMe(res.data)
		} catch {}
		setUploadingAvatar(false)
	}

	const handleLogout = () => {
		doLogout()
		router.replace('/login')
	}

	const isProRole = role && ['owner', 'employer_pro', 'administrator'].includes(role)
	const isOwner = role === 'owner'

	const menuSections: MenuSection[] = [
		{
			title: 'Основная работа',
			items: [
				{ id: 'castings', label: 'Кастинги', icon: <IconFilm size={20} />, href: '/dashboard/castings', color: '#f5c518' },
				...(isProRole ? [{ id: 'actors', label: 'Актёры', icon: <IconUsers size={20} />, href: '/dashboard/actors', color: '#a855f7' }] : []),
				{ id: 'reports', label: 'Отчёты', icon: <IconReport size={20} />, href: '/dashboard/reports', color: '#22c55e' },
				{ id: 'team', label: 'Команда', icon: <IconUsers size={20} />, href: '/dashboard/team', color: '#3b82f6' },
			],
		},
		{
			title: 'Коммуникации',
			items: [
				{ id: 'notifications', label: 'Уведомления', icon: <IconBell size={20} />, href: '/notifications', color: '#ef4444', badge: unread > 0 ? unread : undefined },
				{ id: 'chats', label: 'Чаты', icon: <IconChat size={20} />, href: '/chats', color: '#06b6d4' },
				...(isProRole ? [{ id: 'favorites', label: 'Избранные', icon: <IconHeart size={20} />, href: '/dashboard/actors?favorites=true', color: '#ec4899' }] : []),
			],
		},
		{
			title: 'Аккаунт',
			items: [
				...(isOwner ? [{ id: 'admin-panel', label: 'Панель SuperAdmin', icon: <IconShield size={20} />, href: '/dashboard/admin', color: '#ef4444' }] : []),
				{ id: 'settings', label: 'Настройки', icon: <IconSettings size={20} />, href: '/settings', color: '#6b7280' },
			],
		},
	].filter(s => s.items.length > 0)

	const roleLabel = role ? (ROLE_LABEL[role] || role) : '—'

	if (loading) {
		return (
			<div className={styles.root}>
				<div className={styles.loadingState}>
					<IconLoader size={28} />
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			{/* Profile card */}
			<section className={styles.profileCard}>
				<div className={styles.avatarWrap}>
					<div className={styles.avatar}>
						{me?.photo_url ? (
							<img src={normalizeUrl(me.photo_url)} alt="" />
						) : (
							<span>{initials(me)}</span>
						)}
					</div>
					<button
						className={styles.avatarEditBtn}
						onClick={() => avatarInputRef.current?.click()}
						disabled={uploadingAvatar}
						aria-label="Сменить фото"
					>
						{uploadingAvatar ? <IconLoader size={11} /> : <IconCamera size={11} />}
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

				<button
					className={styles.profileInfo}
					onClick={() => router.push('/me')}
					aria-label="Открыть профиль"
				>
					<h1 className={styles.profileName}>{fullName(me)}</h1>
					<span className={styles.roleBadge}>{roleLabel}</span>
					{me?.email && <p className={styles.profileEmail}>{me.email}</p>}
					{me?.phone_number && <p className={styles.profileEmail}>{me.phone_number}</p>}
				</button>

				<button
					className={styles.profileSettingsBtn}
					onClick={() => router.push('/settings')}
					aria-label="Настройки"
				>
					<IconSettings size={18} />
				</button>
			</section>

			{/* Menu sections */}
			<div className={styles.content}>
				{menuSections.map(section => (
					<div key={section.title} className={styles.sectionGroup}>
						<p className={styles.sectionTitle}>{section.title}</p>
						<div className={styles.sectionCard}>
							{section.items.map((item, idx) => (
								<button
									key={item.id}
									className={styles.menuRow}
									onClick={() => router.push(item.href)}
									style={{ borderBottom: idx < section.items.length - 1 ? undefined : 'none' }}
								>
									<span
										className={styles.menuRowIcon}
										style={{ background: `${item.color}1a`, color: item.color }}
									>
										{item.icon}
									</span>
									<span className={styles.menuRowLabel}>{item.label}</span>
									{(item.badge ?? 0) > 0 && (
										<span className={styles.menuRowBadge}>
											{item.badge! > 99 ? '99+' : item.badge}
										</span>
									)}
									<span className={styles.menuRowChevron}>
										<IconChevronRight size={16} />
									</span>
								</button>
							))}
						</div>
					</div>
				))}

				<button className={styles.logoutBtn} onClick={handleLogout}>
					<IconLogOut size={18} />
					Выйти из аккаунта
				</button>
			</div>

			<ProjectChatsFab />
		</div>
	)
}
