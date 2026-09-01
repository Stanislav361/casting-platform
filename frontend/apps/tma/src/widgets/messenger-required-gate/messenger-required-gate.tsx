'use client'

/**
 * Обязательный способ связи для актёров и агентов.
 *
 * По Telegram, ВКонтакте или MAX кастинг-директор связывается с актёром — без
 * них анкета и отклик бесполезны. Формы создания и редактирования анкеты этот
 * контакт требуют, но аккаунты из перенесённой базы (и те, кто зарегистрировался
 * до появления требования) остались без него: они никогда не проходили через
 * форму заново. Поэтому требование закрываем здесь — при входе в приложение, а
 * не только в момент заполнения анкеты.
 *
 * Кому показываем, решает сервер (`messenger_required` в `auth/v2/me/`): список
 * ролей живёт в одном месте — services/core/users/routes/auth_v2.py. Экраны
 * входа, публичные документы, каст-листы по ссылке и подтверждение полномочий
 * исключены: там человек либо ещё не авторизован, либо пришёл по ссылке за одним
 * конкретным действием, и запирать его нельзя.
 */
import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { logout as doLogout, $session } from '@prostoprobuy/models'
import { apiCall, getToken } from '~/shared/api-client'
import { saveAccountContacts } from '~/shared/account-contacts'
import {
	canonicalMax,
	canonicalTelegram,
	canonicalVk,
	hasAnyMessenger,
} from '~/shared/contacts'
import {
	IconLoader,
	IconMessageSquare,
	IconSend,
	IconTelegram,
	IconVK,
} from '~packages/ui/icons'
import styles from './messenger-required-gate.module.scss'

const EXCLUDED_PREFIXES = [
	'/legal',
	'/login',
	'/admin-login',
	'/admin-register',
	'/report',
	'/confirm-authority',
	'/invite',
	'/error',
	// Анкета: создание и редактирование сами требуют способ связи и
	// подставляют его из аккаунта. Второе окно поверх формы только мешало бы —
	// человек уже вводит контакт в нужном поле.
	'/cabinet/profile',
]

type Contacts = {
	telegram_nick: string
	vk_nick: string
	max_nick: string
}

const EMPTY_CONTACTS: Contacts = { telegram_nick: '', vk_nick: '', max_nick: '' }

const FIELDS: Array<{
	key: keyof Contacts
	label: string
	placeholder: string
	canonical: (value: string) => string
	icon: typeof IconTelegram
}> = [
	{
		key: 'telegram_nick',
		label: 'Telegram',
		placeholder: '@username или t.me/username',
		canonical: canonicalTelegram,
		icon: IconTelegram,
	},
	{
		key: 'vk_nick',
		label: 'ВКонтакте',
		placeholder: 'vk.com/username',
		canonical: canonicalVk,
		icon: IconVK,
	},
	{
		key: 'max_nick',
		label: 'MAX',
		placeholder: 'Ник в MAX или телефон',
		canonical: canonicalMax,
		icon: IconMessageSquare,
	},
]

export default function MessengerRequiredGate() {
	const pathname = usePathname()
	const router = useRouter()
	const [needsMessenger, setNeedsMessenger] = useState(false)
	const [contacts, setContacts] = useState<Contacts>(EMPTY_CONTACTS)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const isExcludedRoute = Boolean(pathname && EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p)))

	const checkStatus = useCallback(async () => {
		if (!getToken()) {
			setNeedsMessenger(false)
			return
		}
		const data = await apiCall('GET', 'auth/v2/me/')
		if (!data || data.detail || typeof data !== 'object') return
		setNeedsMessenger(Boolean(data.messenger_required) && !data.has_messenger)
	}, [])

	useEffect(() => {
		if (isExcludedRoute) return
		checkStatus()
		// Токен появляется после входа, восстановления сессии или refresh —
		// переслушиваем сессию, чтобы требование сработало сразу же.
		const unsubscribe = $session.watch(() => checkStatus())
		return unsubscribe
	}, [isExcludedRoute, checkStatus])

	const setContact = (key: keyof Contacts, value: string) => {
		setContacts((prev) => ({ ...prev, [key]: value }))
		if (error) setError(null)
	}

	const handleSave = useCallback(async () => {
		if (saving) return
		if (!hasAnyMessenger(contacts)) {
			setError('Укажите хотя бы один способ связи: Telegram, ВКонтакте или MAX')
			return
		}

		setSaving(true)
		setError(null)
		const result = await saveAccountContacts(contacts)
		setSaving(false)

		if (!result.ok) {
			setError(result.error || 'Не удалось сохранить способ связи. Попробуйте ещё раз.')
			return
		}

		setNeedsMessenger(false)
		setContacts(EMPTY_CONTACTS)
	}, [saving, contacts])

	const handleLogout = useCallback(() => {
		doLogout()
		router.replace('/login')
	}, [router])

	if (isExcludedRoute || !needsMessenger) return null

	return (
		<div className={styles.overlay} role="dialog" aria-modal="true">
			<div className={styles.card}>
				<div className={styles.iconWrap}>
					<IconSend size={24} />
				</div>
				<h2 className={styles.title}>Укажите способ связи</h2>
				<p className={styles.subtitle}>
					Кастинг-директор связывается с вами через мессенджер. Заполните хотя бы
					одно поле — без этого отклики не доходят до кастинг-директора.
				</p>

				{error && <div className={styles.error}>{error}</div>}

				<div className={styles.fields}>
					{FIELDS.map(({ key, label, placeholder, canonical, icon: Icon }) => (
						<label className={styles.field} key={key}>
							<span className={styles.fieldLabel}>
								<Icon size={15} />
								{label}
							</span>
							<input
								className={styles.input}
								type='text'
								inputMode='text'
								autoComplete='off'
								value={contacts[key]}
								placeholder={placeholder}
								onChange={(e) => setContact(key, e.target.value)}
								onBlur={(e) => setContact(key, canonical(e.target.value))}
								onKeyDown={(e) => e.key === 'Enter' && handleSave()}
							/>
						</label>
					))}
				</div>

				<p className={styles.hint}>
					Достаточно одного мессенджера. Изменить его можно позже — в анкете.
				</p>

				<button
					type='button'
					className={styles.saveBtn}
					onClick={handleSave}
					disabled={saving || !hasAnyMessenger(contacts)}
				>
					{saving ? <IconLoader size={18} /> : 'Сохранить и продолжить'}
				</button>
				<button type='button' className={styles.logoutBtn} onClick={handleLogout}>
					Выйти из аккаунта
				</button>
			</div>
		</div>
	)
}
