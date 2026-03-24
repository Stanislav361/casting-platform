'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { $session, login as doLogin } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import {
	IconCrown,
	IconMask,
	IconBriefcase,
	IconClipboard,
	IconDiamond,
	IconAlertCircle,
	IconLoader,
	IconX,
} from '~packages/ui/icons'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
import styles from './role.module.scss'

export default function RoleSelectPage() {
	const router = useRouter()
	const [loading, setLoading] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const [showContactForm, setShowContactForm] = useState(false)
	const [pendingPlan, setPendingPlan] = useState<string | null>(null)
	const [contactForm, setContactForm] = useState({
		first_name: '', last_name: '', middle_name: '',
		phone_number: '', telegram_nick: '', vk_nick: '', max_nick: '',
	})
	const [contactError, setContactError] = useState<string | null>(null)
	const [contactSaving, setContactSaving] = useState(false)

	const session = $session.getState()
	const token = session?.access_token

	let currentRole = 'user'
	try {
		if (token) {
			currentRole = JSON.parse(atob(token.split('.')[1])).role || 'user'
		}
	} catch {}

	const selectRole = async (plan: string | null, redirectTo: string) => {
		setLoading(plan || 'actor')
		setError(null)

		if (!token) {
			router.replace('/login')
			return
		}

		try {
			if (plan) {
				const res = await fetch(
					`${API_URL}subscriptions/activate/?plan=${plan}&days=30`,
					{
						method: 'POST',
						headers: { Authorization: `Bearer ${token}` },
					},
				)
				const data = await res.json()

				if (data.access_token) {
					doLogin({ access_token: data.access_token })
					router.replace(redirectTo)
					return
				} else {
					const msg =
						typeof data.detail === 'string'
							? data.detail
							: data.detail?.message ||
								data.detail?.event ||
								JSON.stringify(data.detail) ||
								'Ошибка активации подписки'
					setError(msg)
					setLoading(null)
					return
				}
			}

			router.replace(redirectTo)
		} catch {
			setError('Ошибка подключения к серверу')
			setLoading(null)
		}
	}

	const selectBaseRole = async (role: 'user' | 'agent', redirectTo: string) => {
		setLoading(role)
		setError(null)

		if (!token) {
			router.replace('/login')
			return
		}

		try {
			const res = await fetch(`${API_URL}subscriptions/switch-role/?role=${role}`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			})
			const data = await res.json()
			if (data.access_token) {
				doLogin({ access_token: data.access_token })
				router.replace(redirectTo)
				return
			}
			const msg =
				typeof data.detail === 'string'
					? data.detail
					: data.detail?.message ||
						data.detail?.event ||
						JSON.stringify(data.detail) ||
						'Ошибка переключения роли'
			setError(msg)
			setLoading(null)
		} catch {
			setError('Ошибка подключения к серверу')
			setLoading(null)
		}
	}

	const openAdminForm = (plan: string) => {
		setPendingPlan(plan)
		setContactError(null)
		setShowContactForm(true)
	}

	const handleContactPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
		setContactForm({ ...contactForm, phone_number: formatPhone(e.target.value) })
	}

	const submitContactForm = async () => {
		const { first_name, last_name, phone_number } = contactForm
		const hasMessenger = contactForm.telegram_nick.trim() || contactForm.vk_nick.trim() || contactForm.max_nick.trim()

		if (!first_name.trim() || !last_name.trim()) {
			setContactError('Заполните Имя и Фамилию'); return
		}
		if (rawPhone(phone_number).length < 12) {
			setContactError('Укажите корректный номер телефона'); return
		}
		if (!hasMessenger) {
			setContactError('Укажите хотя бы один мессенджер (Telegram, VK или MAX)'); return
		}

		setContactSaving(true)
		setContactError(null)

		try {
			const body: Record<string, string> = {}
			for (const [k, v] of Object.entries(contactForm)) {
				if (k === 'phone_number') {
					const r = rawPhone(v)
					if (r.length >= 12) body[k] = r
				} else if (v.trim()) {
					body[k] = v.trim()
				}
			}
			const res = await fetch(`${API_URL}auth/v2/me/`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify(body),
			})
			if (!res.ok) {
				setContactError('Ошибка сохранения данных')
				setContactSaving(false)
				return
			}

			setShowContactForm(false)
			setContactSaving(false)
			await selectRole(pendingPlan, '/dashboard')
		} catch {
			setContactError('Ошибка подключения к серверу')
			setContactSaving(false)
		}
	}

	const cfField = (label: string, field: keyof typeof contactForm, placeholder?: string, required?: boolean) => (
		<div className={styles.cfField} key={field}>
			<label>{label}{required && <span className={styles.cfReq}>*</span>}</label>
			<input
				type={field === 'phone_number' ? 'tel' : 'text'}
				value={contactForm[field]}
				onChange={field === 'phone_number' ? handleContactPhone : (e) => setContactForm(prev => ({ ...prev, [field]: e.target.value }))}
				placeholder={placeholder || label}
				className={styles.cfInput}
			/>
		</div>
	)

	return (
		<div className={styles.root}>
			<div className={styles.container}>
				<div className={styles.logo}>
					<h1>
						prosto<span>probuy</span>
					</h1>
				</div>

				<div className={styles.card}>
					<h2>Выберите роль</h2>
					<p className={styles.subtitle}>Как вы хотите использовать платформу?</p>

					{error && (
						<div className={styles.error}>
							<IconAlertCircle size={16} />
							{typeof error === 'string' ? error : JSON.stringify(error)}
						</div>
					)}

					{currentRole === 'owner' && (
						<button
							className={`${styles.roleCard} ${styles.superadmin}`}
							onClick={() => selectRole(null, '/dashboard/admin')}
							disabled={!!loading}
						>
							<div className={`${styles.roleIconWrap} ${styles.roleIconSA}`}>
								<IconCrown size={22} />
							</div>
							<div className={styles.roleInfo}>
								<h3>SuperAdmin</h3>
								<p>Полный доступ к платформе, управление всеми пользователями</p>
							</div>
							<div className={styles.roleBadgeSA}>Owner</div>
						</button>
					)}

					<button
						className={`${styles.roleCard} ${styles.actor}`}
						onClick={() => selectBaseRole('user', '/cabinet')}
						disabled={!!loading}
					>
						<div className={`${styles.roleIconWrap} ${styles.roleIconActor}`}>
							{loading === 'user' ? <IconLoader size={22} /> : <IconMask size={22} />}
						</div>
						<div className={styles.roleInfo}>
							<h3>Актёр</h3>
							<p>Создайте анкету, откликайтесь на кастинги</p>
						</div>
						<div className={styles.roleBadge}>Бесплатно</div>
					</button>

					<button
						className={`${styles.roleCard} ${styles.agent}`}
						onClick={() => selectBaseRole('agent', '/cabinet')}
						disabled={!!loading}
					>
						<div className={`${styles.roleIconWrap} ${styles.roleIconAgent}`}>
							{loading === 'agent' ? (
								<IconLoader size={22} />
							) : (
								<IconBriefcase size={22} />
							)}
						</div>
						<div className={styles.roleInfo}>
							<h3>Агент</h3>
							<p>Создайте профиль агента и регистрируйте своих актёров</p>
						</div>
						<div className={styles.roleBadge}>Бесплатно</div>
					</button>

					<button
						className={`${styles.roleCard} ${styles.admin}`}
						onClick={() => openAdminForm('admin')}
						disabled={!!loading}
					>
						<div className={`${styles.roleIconWrap} ${styles.roleIconAdmin}`}>
							{loading === 'admin' ? (
								<IconLoader size={22} />
							) : (
								<IconClipboard size={22} />
							)}
						</div>
						<div className={styles.roleInfo}>
							<h3>Администратор кастинга</h3>
							<p>Публикуйте кастинги, работайте с откликнувшимися актёрами</p>
						</div>
						<div className={styles.roleBadge}>Подписка</div>
					</button>

					<button
						className={`${styles.roleCard} ${styles.adminPro}`}
						onClick={() => openAdminForm('admin_pro')}
						disabled={!!loading}
					>
						<div className={`${styles.roleIconWrap} ${styles.roleIconAdminPro}`}>
							{loading === 'admin_pro' ? (
								<IconLoader size={22} />
							) : (
								<IconDiamond size={22} />
							)}
						</div>
						<div className={styles.roleInfo}>
							<h3>Администратор PRO</h3>
							<p>Все актёры в базе, шорт-листы из любых, полный поиск</p>
						</div>
						<div className={styles.roleBadge}>PRO</div>
					</button>
				</div>

				{loading && (
					<p className={styles.loadingText}>
						<IconLoader size={14} />
						{loading === 'admin' || loading === 'admin_pro'
							? 'Активация подписки...'
							: 'Переход в кабинет...'}
					</p>
				)}
			</div>

			{showContactForm && (
				<div className={styles.cfOverlay} onClick={() => setShowContactForm(false)}>
					<div className={styles.cfCard} onClick={(e) => e.stopPropagation()}>
						<div className={styles.cfHeader}>
							<h3>Контактные данные</h3>
							<button className={styles.cfClose} onClick={() => setShowContactForm(false)}><IconX size={14} /></button>
						</div>
						<p className={styles.cfSubtitle}>Для регистрации в качестве администратора необходимо заполнить обязательные поля</p>

						{contactError && <div className={styles.cfError}>{contactError}</div>}

						<div className={styles.cfForm}>
							{cfField("Фамилия", "last_name", undefined, true)}
							{cfField("Имя", "first_name", undefined, true)}
							{cfField("Отчество", "middle_name")}
							{cfField("Номер телефона", "phone_number", "+7 (900) 123-45-67", true)}
							<div className={styles.cfDivider}>Мессенджеры <span className={styles.cfReq}>* хотя бы один</span></div>
							{cfField("Telegram", "telegram_nick", "@username")}
							{cfField("ВКонтакте", "vk_nick", "id или ник")}
							{cfField("MAX (ex-Мой Мир)", "max_nick", "ник или ссылка")}
						</div>

						<button
							className={styles.cfSubmit}
							onClick={submitContactForm}
							disabled={contactSaving}
						>
							{contactSaving ? <><IconLoader size={14} /> Сохранение...</> : 'Продолжить'}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
