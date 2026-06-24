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
	IconUser,
	IconBell,
	IconSettings,
	IconLogOut,
	IconChevronRight,
	IconLoader,
	IconCamera,
	IconSend,
	IconPlus,
	IconMessageSquare,
} from '~packages/ui/icons'
import SupportChat from '~/widgets/support-chat/support-chat'
import ProfileSwitcher from '~/widgets/profile-switcher/profile-switcher'
import styles from './actor-home.module.scss'

function getGreeting(): string {
	const hour = new Date().getHours()
	if (hour >= 5 && hour < 12) return 'Доброе утро'
	if (hour >= 12 && hour < 18) return 'Добрый день'
	if (hour >= 18 && hour < 23) return 'Добрый вечер'
	return 'Доброй ночи'
}

function firstName(me: any): string {
	const n = (me?.first_name || '').trim()
	if (n) return n
	const full = (me?.email || '').split('@')[0]
	return full ? full.charAt(0).toUpperCase() + full.slice(1) : ''
}

const ROLE_LABEL: Record<string, string> = {
	user:  'Актёр',
	agent: 'Агент',
}

function normalizeUrl(url?: string | null): string {
	if (!url) return ''
	if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://')
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

// Активный профиль определяем по токену — это самый надёжный источник
// (не зависит от кэша ответа API), синхронен со switch-profile.
function activeProfileIdFromToken(): number | null {
	try {
		const token = $session.getState()?.access_token
		if (!token) return null
		const payload = JSON.parse(atob(token.split('.')[1] || ''))
		const raw = payload?.profile_id
		return raw != null ? Number(raw) : null
	} catch {
		return null
	}
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
	href?: string
	color: string
	badge?: number
	action?: () => void
}

interface MenuSection {
	title: string
	items: MenuItem[]
}

export default function ActorHomePage() {
	const router = useRouter()
	const role = useRole()
	const avatarInputRef = useRef<HTMLInputElement>(null)

	const [me, setMe] = useState<any>(null)
	const [unread, setUnread] = useState(0)
	const [loading, setLoading] = useState(true)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)
	const [supportOpen, setSupportOpen] = useState(false)
	// Для актёра аватар на главной — это его портрет из профиля (одно фото
	// и в анкете, и в шапке), а не отдельная аккаунтная картинка.
	const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
	const [firstProfileId, setFirstProfileId] = useState<number | null>(null)
	// Активная анкета целиком — чтобы шапка (имя/фамилия/аватар) полностью
	// переключалась вместе с выбранной анкетой.
	const [activeProfile, setActiveProfile] = useState<any>(null)

	// Redirect non-actor/agent users to the correct hub
	useEffect(() => {
		if (!role) return
		const adminRoles = ['owner', 'employer_pro', 'employer', 'administrator', 'manager']
		if (adminRoles.includes(role)) {
			router.replace('/dashboard')
		}
	}, [role, router])

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
		}
	}, [router])

	const load = useCallback(async () => {
		try {
			const [meData, notifData, profData] = await Promise.all([
				apiCall('GET', 'auth/v2/me/').catch(() => null),
				apiCall('GET', 'notifications/?unread_only=true&page=1').catch(() => null),
				apiCall('GET', 'tma/actor-profiles/my/').catch(() => null),
			])
			if (meData && !meData.detail) setMe(meData)
			setUnread(notifData?.unread_count ?? 0)
			const profiles = profData?.profiles || profData?.items || []
			// Аватар в шапке — это портрет АКТИВНОЙ анкеты (а не всегда первой),
			// чтобы после переключения профиля менялось и фото. Активную анкету
			// берём из токена (надёжно), затем из ответа API, иначе первую.
			const activeId = activeProfileIdFromToken() ?? profData?.current_profile_id ?? null
			const active = profiles.find((p: any) => Number(p.id) === Number(activeId)) || profiles[0]
			if (active) {
				setProfilePhoto(active.primary_photo || null)
				setFirstProfileId(active.id ?? null)
				setActiveProfile(active)
			} else {
				setActiveProfile(null)
			}
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

	const navigate = (href: string) => router.push(href)

	const isAgent = role === 'agent'

	const menuSections: MenuSection[] = isAgent
		? [
			{
				title: 'Работа',
				items: [
					{ id: 'cabinet',  label: 'Мои актёры',       icon: <IconUsers size={20} />,        href: '/cabinet',         color: '#a855f7' },
					{ id: 'feed',     label: 'Лента кастингов',  icon: <IconFilm size={20} />,         href: '/cabinet/feed',    color: '#f5c518' },
					{ id: 'responses', label: 'Мои отклики',     icon: <IconSend size={20} />,         href: '/cabinet/responses', color: '#3b82f6' },
					{ id: 'add',      label: 'Добавить актёра',  icon: <IconPlus size={20} />,         href: '/cabinet/profile/create',   color: '#22c55e' },
				],
			},
			{
				title: 'Коммуникации',
				items: [
					{ id: 'notifications', label: 'Уведомления', icon: <IconBell size={20} />,        href: '/notifications',   color: '#ef4444', badge: unread > 0 ? unread : undefined },
				],
			},
			{
				title: 'Аккаунт',
				items: [
					{ id: 'settings', label: 'Настройки',        icon: <IconSettings size={20} />,    href: '/settings',        color: '#6b7280' },
					{ id: 'support',  label: 'Написать в поддержку', icon: <IconMessageSquare size={20} />, color: '#3b82f6', action: () => setSupportOpen(true) },
				],
			},
		]
		: [
			{
				title: 'Основная работа',
				items: [
					{ id: 'feed',        label: 'Лента кастингов', icon: <IconFilm size={20} />,        href: '/cabinet/feed',    color: '#f5c518' },
					{ id: 'my-card',     label: 'Мой профиль',      icon: <IconUser size={20} />,        href: '/cabinet/profile', color: '#a855f7' },
					{ id: 'add-profile', label: 'Добавить профиль', icon: <IconPlus size={20} />,        href: '/cabinet/profile/create',   color: '#22c55e' },
					{ id: 'responses',   label: 'Мои отклики',     icon: <IconSend size={20} />,        href: '/cabinet/responses', color: '#3b82f6' },
				],
			},
			{
				title: 'Коммуникации',
				items: [
					{ id: 'notifications', label: 'Уведомления', icon: <IconBell size={20} />,        href: '/notifications',   color: '#ef4444', badge: unread > 0 ? unread : undefined },
				],
			},
			{
				title: 'Аккаунт',
				items: [
					{ id: 'settings', label: 'Настройки',        icon: <IconSettings size={20} />,    href: '/settings',        color: '#6b7280' },
					{ id: 'support',  label: 'Написать в поддержку', icon: <IconMessageSquare size={20} />, color: '#3b82f6', action: () => setSupportOpen(true) },
				],
			},
		]

	const roleLabel = role ? (ROLE_LABEL[role] || role) : '—'
	// Актёр: показываем портрет из профиля; агент: аккаунтное фото.
	const avatarUrl = isAgent ? me?.photo_url : (profilePhoto || me?.photo_url)
	// Для актёра шапка следует за АКТИВНОЙ анкетой: имя/фамилия/приветствие
	// берём из неё, а не из аккаунта. Для агента — данные аккаунта.
	const activeProfileFullName = activeProfile
		? `${activeProfile.first_name || ''} ${activeProfile.last_name || ''}`.trim()
		: ''
	const headerName = (!isAgent && activeProfileFullName) ? activeProfileFullName : fullName(me)
	const headerFirstName = (!isAgent && (activeProfile?.first_name || '').trim())
		? activeProfile.first_name.trim()
		: firstName(me)
	const headerInitials = (headerName && headerName !== 'Пользователь')
		? headerName.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()
		: initials(me)

	if (loading || role === null) {
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
						{avatarUrl ? (
							<img src={normalizeUrl(avatarUrl)} alt="" />
						) : (
							<span>{headerInitials}</span>
						)}
					</div>
					<button
						className={styles.avatarEditBtn}
						onClick={() => {
							// Актёр меняет фото в своём профиле (одно фото везде),
							// агент — отдельную аккаунтную картинку.
							if (isAgent) {
								avatarInputRef.current?.click()
							} else if (firstProfileId) {
								router.push(`/cabinet/profile/${firstProfileId}/media`)
							} else {
								router.push('/cabinet/profile/create')
							}
						}}
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
					<h1 className={styles.profileName}>{headerName}</h1>
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

			{/* Переключатель активной анкеты (только для актёра) */}
			{!isAgent && (
				<div style={{ marginTop: 14 }}>
					<ProfileSwitcher onSwitched={() => load()} />
				</div>
			)}

			{/* Welcome / quick action */}
			<section className={styles.welcomeBlock}>
				<div className={styles.welcomeText}>
					<p className={styles.welcomeGreeting}>
						{getGreeting()}{headerFirstName ? `, ${headerFirstName}` : ''}!
					</p>
				</div>
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
									onClick={() => item.action ? item.action() : item.href && navigate(item.href)}
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

			{supportOpen && (
				<SupportChat open={supportOpen} onClose={() => setSupportOpen(false)} />
			)}
		</div>
	)
}
