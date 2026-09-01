'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { login as doLogin, logout as doLogout } from '@prostoprobuy/models'
import { http } from '~packages/lib'
import { apiCall, ensureAccessToken } from '~/shared/api-client'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { useRole, canManageTeam } from '~/shared/use-role'
import { API_URL } from '~/shared/api-url'
import { normalizeMediaUrl } from '~/shared/media-url'
import { ACCEPTED_PHOTO_TYPES, optimizePhotoForUpload } from '~/shared/photo-upload'
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
	IconBriefcase,
	IconSend,
	IconCheck,
	IconClock,
	IconAlertCircle,
	IconMask,
} from '~packages/ui/icons'
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
	return normalizeMediaUrl(url) || ''
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
	const dialog = useDialog()
	const avatarInputRef = useRef<HTMLInputElement>(null)

	const [me, setMe] = useState<any>(null)
	const [unread, setUnread] = useState(0)
	const [loading, setLoading] = useState(true)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)
	const [verificationStatus, setVerificationStatus] = useState<any>(null)
	const [verificationLoading, setVerificationLoading] = useState(false)
	const [verificationSubmitting, setVerificationSubmitting] = useState(false)
	const [verificationDeclining, setVerificationDeclining] = useState<string | null>(null)
	const [verificationError, setVerificationError] = useState<string | null>(null)
	const [verificationForm, setVerificationForm] = useState({
		company_name: '',
		phone_number: '',
		telegram_username: '',
		about_text: '',
		projects_text: '',
		experience_text: '',
	})

	// Redirect non-admin users
	useEffect(() => {
		if (role && ['user', 'agent'].includes(role)) {
			router.replace('/actor-home')
		}
	}, [role, router])

	// Guard: no session → login
	useEffect(() => {
		let cancelled = false

		const restore = async () => {
			const token = await ensureAccessToken()
			if (!cancelled && !token) router.replace('/login')
		}

		restore()
		return () => { cancelled = true }
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

	useEffect(() => {
		if (!me) return
		setVerificationForm(prev => ({
			...prev,
			phone_number: prev.phone_number || me.phone_number || '',
			telegram_username: prev.telegram_username || me.telegram_nick || me.telegram_username || '',
		}))
	}, [me])

	const loadVerificationStatus = useCallback(async () => {
		if (!role || !['employer', 'employer_pro'].includes(role)) return
		setVerificationLoading(true)
		try {
			const data = await apiCall('GET', 'employer/projects/verification-status/').catch(() => null)
			if (data && !data.detail) setVerificationStatus(data)
		} finally {
			setVerificationLoading(false)
		}
	}, [role])

	useEffect(() => {
		loadVerificationStatus()
	}, [loadVerificationStatus])

	// Safety: never stay on loader for more than 5 seconds.
	useEffect(() => {
		const t = setTimeout(() => setLoading(false), 5000)
		return () => clearTimeout(t)
	}, [])

	const uploadAvatar = async (file: File) => {
		setUploadingAvatar(true)
		try {
			const uploadFile = await optimizePhotoForUpload(file)
			const formData = new FormData()
			formData.append('file', uploadFile)
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

	const submitVerificationRequest = async () => {
		const companyName = verificationForm.company_name.trim()
		const phoneNumber = verificationForm.phone_number.trim()
		const telegramUsername = verificationForm.telegram_username.trim()
		const aboutText = verificationForm.about_text.trim()
		const projectsText = verificationForm.projects_text.trim()
		const experienceText = verificationForm.experience_text.trim()

		if (!companyName || !phoneNumber || !telegramUsername || !aboutText || !projectsText || !experienceText) {
			setVerificationError('Ответьте на все вопросы, чтобы отправить заявку супер-админу.')
			return
		}

		setVerificationSubmitting(true)
		setVerificationError(null)
		try {
			const data = await apiCall('POST', 'employer/projects/verification-request/', {
				company_name: companyName,
				phone_number: phoneNumber,
				telegram_username: telegramUsername,
				about_text: aboutText,
				projects_text: projectsText,
				experience_text: experienceText,
			})
			if (data?.ticket_id) {
				setVerificationForm({
					company_name: '',
					phone_number: '',
					telegram_username: '',
					about_text: '',
					projects_text: '',
					experience_text: '',
				})
				await loadVerificationStatus()
			} else {
				const detail = data?.detail
				setVerificationError(typeof detail === 'string' ? detail : 'Не удалось отправить заявку.')
			}
		} finally {
			setVerificationSubmitting(false)
		}
	}

	/**
	 * Осознанный отказ от верификации: заявка закрывается, аккаунт продолжает
	 * работу как Актёр или Агент. Без этого выхода человек, передумавший быть
	 * администратором, навсегда оставался у супер-админа в списке «Ожидают».
	 */
	const declineVerification = async (nextRole: 'user' | 'agent') => {
		if (verificationDeclining) return
		const nextRoleLabel = nextRole === 'agent' ? 'Агент' : 'Актёр'
		const confirmed = await dialog.confirm({
			title: 'Отказаться от верификации?',
			message: `Заявка супер-админу будет закрыта, а аккаунт продолжит работу как ${nextRoleLabel}. Пройти верификацию можно будет позже.`,
			confirmLabel: `Продолжить как ${nextRoleLabel}`,
			cancelLabel: 'Остаться в очереди',
			tone: 'warning',
		})
		if (!confirmed) return

		setVerificationDeclining(nextRole)
		setVerificationError(null)
		try {
			const data = await apiCall(
				'POST',
				`employer/projects/verification-decline/?role=${nextRole}`,
			)
			if (data?.access_token) {
				doLogin({ access_token: data.access_token })
				router.replace('/actor-home')
				return
			}
			const detail = data?.detail
			setVerificationError(
				typeof detail === 'string' ? detail : 'Не удалось отменить заявку на верификацию.',
			)
		} finally {
			setVerificationDeclining(null)
		}
	}

	const isAdminRole = role && ['owner', 'employer_pro', 'employer', 'administrator', 'manager'].includes(role)
	const isOwner = role === 'owner'
	const showTeamMenu = canManageTeam(role)
	const canUseActorBase = role && ['owner', 'employer_pro', 'administrator', 'manager'].includes(role)
	const requiresVerification = role && ['employer', 'employer_pro'].includes(role)
	const isVerified = Boolean(me?.is_employer_verified || verificationStatus?.is_verified)
	const ticketStatus = verificationStatus?.ticket_status || null
	const showVerificationGate = Boolean(requiresVerification && !isVerified)

	const menuSections: MenuSection[] = [
		{
			title: 'Основная работа',
			items: [
				{ id: 'castings', label: 'Кастинги', icon: <IconFilm size={20} />, href: '/dashboard/castings', color: '#f5c518' },
				...(canUseActorBase ? [{ id: 'actors', label: 'Актёры', icon: <IconUsers size={20} />, href: '/dashboard/actors', color: '#a855f7' }] : []),
				{ id: 'reports', label: 'Каст листы', icon: <IconReport size={20} />, href: '/dashboard/reports', color: '#22c55e' },
				showTeamMenu
					? { id: 'team-hub', label: 'Работа в команде', icon: <IconBriefcase size={20} />, href: '/dashboard/team-hub', color: '#14b8a6' }
					: { id: 'workspace', label: 'Приглашения в команду', icon: <IconBriefcase size={20} />, href: '/dashboard/workspace', color: '#14b8a6' },
			],
		},
		{
			title: 'Коммуникации',
			items: [
				{ id: 'notifications', label: 'Уведомления', icon: <IconBell size={20} />, href: '/notifications', color: '#ef4444', badge: unread > 0 ? unread : undefined },
				{ id: 'chats', label: 'Чаты', icon: <IconChat size={20} />, href: '/chats', color: '#06b6d4' },
				...(isAdminRole ? [{ id: 'favorites', label: 'Избранные', icon: <IconHeart size={20} />, href: '/dashboard/actors?favorites=true', color: '#ec4899' }] : []),
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
						accept={ACCEPTED_PHOTO_TYPES}
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

			<div className={styles.content}>
				{showVerificationGate ? (
					<div className={styles.verificationCard}>
						<div className={styles.verificationHead}>
							<span className={styles.verificationIcon}>
								{ticketStatus === 'open' ? <IconClock size={22} /> : ticketStatus === 'rejected' ? <IconAlertCircle size={22} /> : <IconShield size={22} />}
							</span>
							<div>
								<h2>Верификация аккаунта</h2>
								<p>Ответьте на вопросы для подтверждения профиля</p>
							</div>
						</div>

						{verificationLoading ? (
							<div className={styles.verificationNotice}>
								<IconLoader size={16} /> Проверяем статус заявки...
							</div>
						) : ticketStatus === 'open' ? (
							<div className={`${styles.verificationNotice} ${styles.verificationNoticeWarn}`}>
								<IconClock size={16} />
								Заявка уже отправлена. Дождитесь, пока супер-админ подтвердит или отклонит верификацию.
							</div>
						) : (
							<>
								{ticketStatus === 'rejected' && (
									<div className={`${styles.verificationNotice} ${styles.verificationNoticeDanger}`}>
										<IconAlertCircle size={16} />
										Прошлая заявка была отклонена. Исправьте ответы и отправьте повторно.
									</div>
								)}
								{verificationError && (
									<div className={`${styles.verificationNotice} ${styles.verificationNoticeDanger}`}>
										<IconAlertCircle size={16} />
										{verificationError}
									</div>
								)}
								<div className={styles.verificationForm}>
									<label>
										<span>Название компании / должность</span>
										<input
											value={verificationForm.company_name}
											onChange={e => setVerificationForm(prev => ({ ...prev, company_name: e.target.value }))}
											placeholder="Например: Prostoprobuy Casting"
											maxLength={200}
										/>
									</label>
									<label>
										<span>Номер телефона</span>
										<input
											value={verificationForm.phone_number}
											onChange={e => setVerificationForm(prev => ({ ...prev, phone_number: e.target.value }))}
											placeholder="+7 999 123-45-67"
											inputMode="tel"
											maxLength={30}
										/>
									</label>
									<label>
										<span>Telegram username</span>
										<input
											value={verificationForm.telegram_username}
											onChange={e => setVerificationForm(prev => ({ ...prev, telegram_username: e.target.value }))}
											placeholder="@username"
											autoCapitalize="none"
											autoCorrect="off"
											maxLength={100}
										/>
									</label>
									<label>
										<span>Чем вы занимаетесь?</span>
										<textarea
											value={verificationForm.about_text}
											onChange={e => setVerificationForm(prev => ({ ...prev, about_text: e.target.value }))}
											placeholder="Коротко расскажите о себе или компании"
											rows={3}
										/>
									</label>
									<label>
										<span>Кастинги для каких съёмок планируете размещать (информация остаётся конфиденциальной)</span>
										<textarea
											value={verificationForm.projects_text}
											onChange={e => setVerificationForm(prev => ({ ...prev, projects_text: e.target.value }))}
											placeholder="Опишите типы съёмок, фильмов или мероприятий"
											rows={3}
										/>
									</label>
									<label>
										<span>Опыт</span>
										<textarea
											value={verificationForm.experience_text}
											onChange={e => setVerificationForm(prev => ({ ...prev, experience_text: e.target.value }))}
											placeholder="Укажите названия фильмов и съёмок, над которыми работали ранее"
											rows={3}
										/>
									</label>
								</div>
								<button
									className={styles.verificationSubmit}
									onClick={submitVerificationRequest}
									disabled={verificationSubmitting}
								>
									{verificationSubmitting ? <IconLoader size={16} /> : <IconSend size={16} />}
									Отправить
								</button>
							</>
						)}

						<div className={styles.verificationDecline}>
							<p>Передумали публиковать кастинги? Откажитесь от верификации — заявка закроется, а аккаунт продолжит работу в обычной роли.</p>
							<div className={styles.verificationDeclineActions}>
								<button
									type="button"
									className={styles.verificationDeclineBtn}
									onClick={() => declineVerification('user')}
									disabled={Boolean(verificationDeclining)}
								>
									{verificationDeclining === 'user' ? <IconLoader size={15} /> : <IconMask size={15} />}
									Продолжить как Актёр
								</button>
								<button
									type="button"
									className={styles.verificationDeclineBtn}
									onClick={() => declineVerification('agent')}
									disabled={Boolean(verificationDeclining)}
								>
									{verificationDeclining === 'agent' ? <IconLoader size={15} /> : <IconBriefcase size={15} />}
									Продолжить как Агент
								</button>
							</div>
						</div>
					</div>
				) : (
					<>
						{requiresVerification && isVerified && (
							<div className={`${styles.verificationNotice} ${styles.verificationNoticeOk}`}>
								<IconCheck size={16} />
								Верификация пройдена. Доступ к рабочим разделам открыт.
							</div>
						)}

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
					</>
				)}

				<button className={styles.logoutBtn} onClick={handleLogout}>
					<IconLogOut size={18} />
					Выйти из аккаунта
				</button>
			</div>

		</div>
	)
}
