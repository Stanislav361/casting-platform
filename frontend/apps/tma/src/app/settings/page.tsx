'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { logout as doLogout } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import {
	IconArrowLeft,
	IconUser,
	IconMail,
	IconLock,
	IconBell,
	IconLogOut,
	IconCheck,
	IconLoader,
} from '~packages/ui/icons'
import styles from './settings.module.scss'

interface Me {
	id: number
	email?: string
	first_name?: string
	last_name?: string
	middle_name?: string
	phone_number?: string
	photo_url?: string
	telegram_nick?: string
	vk_nick?: string
	max_nick?: string
	telegram_connected?: boolean
	role?: string
	casting_notification_channel?: string
	available_casting_notification_channels?: string[]
}

const ROLE_LABELS: Record<string, string> = {
	owner: 'Супер Админ',
	employer_pro: 'Админ PRO',
	employer: 'Работодатель',
	administrator: 'Администратор',
	manager: 'Менеджер',
	agent: 'Агент',
	user: 'Актёр',
}

const CHANNEL_LABELS: Record<string, string> = {
	in_app: 'В приложении',
	email: 'На email',
	sms: 'SMS',
	telegram: 'Telegram',
}

export default function SettingsPage() {
	const router = useRouter()
	const [me, setMe]             = useState<Me | null>(null)
	const [loading, setLoading]   = useState(true)

	// profile form
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName]   = useState('')
	const [phone, setPhone]         = useState('')
	const [savingProfile, setSavingProfile] = useState(false)
	const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

	// password
	const [currentPwd, setCurrentPwd] = useState('')
	const [newPwd, setNewPwd]         = useState('')
	const [savingPwd, setSavingPwd]   = useState(false)
	const [pwdMsg, setPwdMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

	// email
	const [newEmail, setNewEmail]           = useState('')
	const [emailPassword, setEmailPassword] = useState('')
	const [savingEmail, setSavingEmail]     = useState(false)
	const [emailMsg, setEmailMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

	// notifications
	const [savingChannel, setSavingChannel] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'auth/v2/me/')
		if (data && !data.detail) {
			setMe(data)
			setFirstName(data.first_name || '')
			setLastName(data.last_name  || '')
			setPhone(data.phone_number  || '')
		}
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const saveProfile = async () => {
		setSavingProfile(true)
		setProfileMsg(null)
		const result = await apiCall('PATCH', 'auth/v2/me/', {
			first_name: firstName,
			last_name:  lastName,
			phone_number: phone,
		})
		setSavingProfile(false)
		if (result?.id) {
			setMe(result)
			setProfileMsg({ type: 'ok', text: 'Профиль обновлён' })
			setTimeout(() => setProfileMsg(null), 2500)
		} else {
			setProfileMsg({ type: 'err', text: result?.detail || 'Не удалось сохранить' })
		}
	}

	const selectChannel = async (channel: string) => {
		if (!me) return
		setSavingChannel(channel)
		const result = await apiCall('PATCH', 'auth/v2/me/', {
			casting_notification_channel: channel,
		})
		setSavingChannel(null)
		if (result?.id) setMe(result)
	}

	const changePassword = async () => {
		if (newPwd.length < 8) {
			setPwdMsg({ type: 'err', text: 'Новый пароль должен быть от 8 символов' })
			return
		}
		setSavingPwd(true)
		setPwdMsg(null)
		const result = await apiCall('POST', 'auth/v2/change-password/', {
			current_password: currentPwd,
			new_password:     newPwd,
		})
		setSavingPwd(false)
		if (result?.message) {
			setPwdMsg({ type: 'ok', text: 'Пароль изменён' })
			setCurrentPwd('')
			setNewPwd('')
			setTimeout(() => setPwdMsg(null), 2500)
		} else {
			setPwdMsg({ type: 'err', text: result?.detail || 'Ошибка при смене пароля' })
		}
	}

	const changeEmail = async () => {
		if (!newEmail || !emailPassword) {
			setEmailMsg({ type: 'err', text: 'Укажите новый email и текущий пароль' })
			return
		}
		setSavingEmail(true)
		setEmailMsg(null)
		const result = await apiCall('POST', 'auth/v2/change-email/', {
			new_email: newEmail,
			password:  emailPassword,
		})
		setSavingEmail(false)
		if (result?.message) {
			setEmailMsg({ type: 'ok', text: 'Email изменён' })
			setEmailPassword('')
			setTimeout(() => setEmailMsg(null), 2500)
			load()
		} else {
			setEmailMsg({ type: 'err', text: result?.detail || 'Ошибка при смене email' })
		}
	}

	const handleLogout = () => {
		doLogout()
		router.replace('/login')
	}

	if (loading) {
		return (
			<div className={styles.loading}>
				<IconLoader size={20} /> Загрузка…
			</div>
		)
	}

	if (!me) {
		return (
			<div className={styles.loading}>
				Не удалось загрузить данные пользователя
			</div>
		)
	}

	const channels = me.available_casting_notification_channels || ['in_app']
	const currentChannel = me.casting_notification_channel || 'in_app'
	const roleLabel = ROLE_LABELS[me.role || ''] || me.role || ''

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.back()}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Настройки</h1>
			</div>

			{/* Account summary */}
			<section className={styles.section}>
				<div className={styles.accountCard}>
					<div className={styles.accountAvatar}>
						{me.photo_url
							? <img src={me.photo_url} alt="" />
							: <IconUser size={26} />
						}
					</div>
					<div className={styles.accountInfo}>
						<p className={styles.accountName}>
							{[me.last_name, me.first_name].filter(Boolean).join(' ') || 'Без имени'}
						</p>
						<p className={styles.accountEmail}>{me.email || '—'}</p>
						{roleLabel && <span className={styles.accountRole}>{roleLabel}</span>}
					</div>
				</div>
			</section>

			{/* Profile */}
			<section className={styles.section}>
				<header className={styles.sectionHeader}>
					<IconUser size={16} />
					<h2>Профиль</h2>
				</header>

				<div className={styles.formGrid}>
					<div className={styles.field}>
						<label className={styles.label}>Имя</label>
						<input
							className={styles.input}
							value={firstName}
							onChange={e => setFirstName(e.target.value)}
							placeholder="Введите имя"
						/>
					</div>

					<div className={styles.field}>
						<label className={styles.label}>Фамилия</label>
						<input
							className={styles.input}
							value={lastName}
							onChange={e => setLastName(e.target.value)}
							placeholder="Введите фамилию"
						/>
					</div>

					<div className={styles.field}>
						<label className={styles.label}>Телефон</label>
						<input
							className={styles.input}
							value={phone}
							onChange={e => setPhone(e.target.value)}
							placeholder="+7 ..."
							inputMode="tel"
						/>
					</div>
				</div>

				<div className={styles.actions}>
					<button className={styles.btnPrimary} onClick={saveProfile} disabled={savingProfile}>
						{savingProfile ? <><IconLoader size={14} /> Сохранение…</> : <><IconCheck size={14} /> Сохранить</>}
					</button>
					{profileMsg && (
						<span className={profileMsg.type === 'ok' ? styles.msgOk : styles.msgErr}>
							{profileMsg.text}
						</span>
					)}
				</div>
			</section>

			{/* Notifications */}
			<section className={styles.section}>
				<header className={styles.sectionHeader}>
					<IconBell size={16} />
					<h2>Уведомления о кастингах</h2>
				</header>
				<p className={styles.sectionHint}>
					Как вы хотите получать оповещения о новых кастингах и откликах.
				</p>

				<div className={styles.channelList}>
					{channels.map(ch => (
						<button
							key={ch}
							className={`${styles.channelItem} ${currentChannel === ch ? styles.channelItemActive : ''}`}
							onClick={() => selectChannel(ch)}
							disabled={savingChannel === ch}
						>
							<span className={styles.channelRadio}>
								{currentChannel === ch && <span className={styles.channelRadioInner} />}
							</span>
							<span className={styles.channelLabel}>{CHANNEL_LABELS[ch] || ch}</span>
							{savingChannel === ch && <IconLoader size={12} />}
						</button>
					))}
				</div>
			</section>

			{/* Email */}
			<section className={styles.section}>
				<header className={styles.sectionHeader}>
					<IconMail size={16} />
					<h2>Email</h2>
				</header>
				<p className={styles.sectionHint}>Текущий: <b>{me.email || '—'}</b></p>

				<div className={styles.formGrid}>
					<div className={styles.field}>
						<label className={styles.label}>Новый email</label>
						<input
							className={styles.input}
							type="email"
							value={newEmail}
							onChange={e => setNewEmail(e.target.value)}
							placeholder="name@example.com"
							autoComplete="off"
						/>
					</div>
					<div className={styles.field}>
						<label className={styles.label}>Текущий пароль</label>
						<input
							className={styles.input}
							type="password"
							value={emailPassword}
							onChange={e => setEmailPassword(e.target.value)}
							placeholder="Для подтверждения"
							autoComplete="off"
						/>
					</div>
				</div>

				<div className={styles.actions}>
					<button className={styles.btnSecondary} onClick={changeEmail} disabled={savingEmail}>
						{savingEmail ? <><IconLoader size={14} /> Смена…</> : <>Изменить email</>}
					</button>
					{emailMsg && (
						<span className={emailMsg.type === 'ok' ? styles.msgOk : styles.msgErr}>
							{emailMsg.text}
						</span>
					)}
				</div>
			</section>

			{/* Password */}
			<section className={styles.section}>
				<header className={styles.sectionHeader}>
					<IconLock size={16} />
					<h2>Пароль</h2>
				</header>

				<div className={styles.formGrid}>
					<div className={styles.field}>
						<label className={styles.label}>Текущий пароль</label>
						<input
							className={styles.input}
							type="password"
							value={currentPwd}
							onChange={e => setCurrentPwd(e.target.value)}
							placeholder="Введите текущий пароль"
							autoComplete="off"
						/>
					</div>
					<div className={styles.field}>
						<label className={styles.label}>Новый пароль</label>
						<input
							className={styles.input}
							type="password"
							value={newPwd}
							onChange={e => setNewPwd(e.target.value)}
							placeholder="Минимум 8 символов"
							autoComplete="off"
						/>
					</div>
				</div>

				<div className={styles.actions}>
					<button className={styles.btnSecondary} onClick={changePassword} disabled={savingPwd}>
						{savingPwd ? <><IconLoader size={14} /> Смена…</> : <>Изменить пароль</>}
					</button>
					{pwdMsg && (
						<span className={pwdMsg.type === 'ok' ? styles.msgOk : styles.msgErr}>
							{pwdMsg.text}
						</span>
					)}
				</div>
			</section>

			{/* Logout */}
			<section className={styles.section}>
				<button className={styles.btnDanger} onClick={handleLogout}>
					<IconLogOut size={15} /> Выйти из аккаунта
				</button>
			</section>
		</div>
	)
}
