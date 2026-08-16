'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { apiCall, apiUpload } from '~/shared/api-client'
import { saveAccountContacts } from '~/shared/account-contacts'
import {
	canonicalMax,
	canonicalTelegram,
	canonicalVk,
	hasAnyMessenger,
	normalizeMessengers,
} from '~/shared/contacts'
import { useRole } from '~/shared/use-role'
import { LOOK_TYPE_OPTIONS, TAX_STATUS_OPTIONS } from '~/shared/profile-labels'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
import { consumePendingReturnUrl } from '~/shared/pending-return-url'
import { ACCEPTED_PHOTO_TYPES, MAX_PHOTO_SIZE, optimizePhotoForUpload } from '~/shared/photo-upload'
import { DISTRIBUTION_CATEGORIES, ALL_DISTRIBUTION_CATEGORY_KEYS } from '~/shared/distribution-categories'
import {
	IconArrowLeft,
	IconPlus,
	IconLoader,
	IconMask,
	IconCheck,
	IconAlertCircle,
	IconClipboard,
	IconShield,
} from '~packages/ui/icons'

import styles from './page.module.scss'

const GENDER_OPTIONS = [
	{ value: 'male', label: 'Мужской' },
	{ value: 'female', label: 'Женский' },
]

const QUALIFICATION_OPTIONS = [
	{ value: 'professional', label: 'Профессионал' },
	{ value: 'skilled', label: 'Опытный' },
	{ value: 'enthusiast', label: 'Энтузиаст' },
	{ value: 'beginner', label: 'Начинающий' },
	{ value: 'other', label: 'Другое' },
]

const HAIR_COLOR_OPTIONS = [
	{ value: 'blonde', label: 'Блонд' },
	{ value: 'brunette', label: 'Брюнет' },
	{ value: 'brown', label: 'Шатен' },
	{ value: 'light_brown', label: 'Русый' },
	{ value: 'red', label: 'Рыжий' },
	{ value: 'gray', label: 'Седой' },
	{ value: 'other', label: 'Другой' },
]

const HAIR_LENGTH_OPTIONS = [
	{ value: 'short', label: 'Короткие' },
	{ value: 'medium', label: 'Средние' },
	{ value: 'long', label: 'Длинные' },
	{ value: 'bald', label: 'Лысый' },
]

const isMinor = (dateOfBirth: string): boolean => {
	if (!dateOfBirth) return false
	const dob = new Date(dateOfBirth)
	if (Number.isNaN(dob.getTime())) return false
	const today = new Date()
	let age = today.getFullYear() - dob.getFullYear()
	const monthDiff = today.getMonth() - dob.getMonth()
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1
	return age < 18
}

type PhotoCategory = 'portrait' | 'profile' | 'full_height'

const PHOTO_SLOTS: { value: PhotoCategory; label: string; hint: string }[] = [
	{ value: 'portrait', label: 'Портрет', hint: 'Лицо и верх корпуса, вертикальный кадр' },
	{ value: 'profile', label: 'Профиль', hint: 'Боковой ракурс, вертикальный кадр' },
	{ value: 'full_height', label: 'Полный рост', hint: 'Актёр целиком с головы до ног' },
]

interface FormState {
	first_name: string
	last_name: string
	gender: string
	date_of_birth: string
	phone_number: string
	email: string
	city: string
	metro_station: string
	tax_status: string
	qualification: string
	experience: string
	about_me: string
	look_type: string
	hair_color: string
	hair_length: string
	height: string
	clothing_size: string
	shoe_size: string
	bust_volume: string
	waist_volume: string
	hip_volume: string
	telegram_nick: string
	vk_nick: string
	max_nick: string
	video_intro: string
	extra_portfolio_url: string
}

const EMPTY_FORM: FormState = {
	first_name: '', last_name: '', gender: '', date_of_birth: '',
	phone_number: '', email: '', city: '', metro_station: '', tax_status: '', qualification: '',
	experience: '', about_me: '', look_type: '', hair_color: '', hair_length: '',
	height: '', clothing_size: '', shoe_size: '', bust_volume: '', waist_volume: '',
	hip_volume: '', telegram_nick: '', vk_nick: '', max_nick: '',
	video_intro: '', extra_portfolio_url: '',
}

// Черновик анкеты храним локально: если токен истёк за время долгого заполнения
// и пользователя увело на вход, введённый текст (в т.ч. «о себе»/резюме) не должен
// пропадать — при возврате на страницу он восстановится. Фото в localStorage не
// помещаются (File), но текстовые поля — главное, что теряли люди.
const PROFILE_DRAFT_KEY = 'pp_profile_create_draft_v1'

export default function CreateProfilePage() {
	const router = useRouter()
	const role = useRole()
	const isAgent = role === 'agent'

	const goBack = () => {
		if (role === 'agent') router.push('/cabinet')
		else router.push('/actor-home')
	}

	const [form, setForm] = useState<FormState>(EMPTY_FORM)
	const set = (field: keyof FormState, value: string) =>
		setForm((prev) => ({ ...prev, [field]: value }))

	// Данные самого агента (его аккаунт). Эти контакты кастинг-директор видит
	// у всех актёров агента, поэтому агент сначала заполняет их.
	const [agentForm, setAgentForm] = useState({
		first_name: '',
		last_name: '',
		phone_number: '',
		email: '',
		telegram_nick: '',
		vk_nick: '',
		max_nick: '',
	})
	const setAgent = (field: keyof typeof agentForm, value: string) =>
		setAgentForm((prev) => ({ ...prev, [field]: value }))

	const [photoFiles, setPhotoFiles] = useState<Record<PhotoCategory, File | null>>({
		portrait: null, profile: null, full_height: null,
	})
	// Согласие на использование изображения — обязательно ДО загрузки фото
	// (см. «Комплект по ролям» в инструкции по внедрению документов).
	// Если пользователь уже дал его раньше (например, обновляет анкету),
	// повторно спрашивать не нужно.
	const [imageConsentAccepted, setImageConsentAccepted] = useState<boolean | null>(null)
	const [imageConsentChecked, setImageConsentChecked] = useState(false)
	// Согласие на распространение персональных данных (Каст-листы) — только
	// для самостоятельно регистрирующегося Актёра: Агент не может дать это
	// согласие за него (см. 05_Согласие_на_распространение_персональных_данных,
	// для профилей, созданных Агентом, собирается позже на экране
	// /confirm-authority/{token}). Детальный выбор по категориям — по
	// умолчанию разрешены все, актёр может отключить любую.
	const [distributionConsentAccepted, setDistributionConsentAccepted] = useState<boolean | null>(null)
	const [distributionConsentChecked, setDistributionConsentChecked] = useState(false)
	const [distributionCategories, setDistributionCategories] = useState<Record<string, boolean>>(
		() => Object.fromEntries(ALL_DISTRIBUTION_CATEGORY_KEYS.map((key) => [key, true])),
	)
	// Согласие представителя несовершеннолетнего, когда Анкету создаёт Агент.
	// Временная мера: подтверждение полномочий чек-боксом до внедрения полного
	// механизма (загрузка документа/подтверждение самим представителем).
	const [minorAuthorityChecked, setMinorAuthorityChecked] = useState(false)
	// Анкета несовершеннолетнего: её заполняет либо сам законный представитель
	// (родитель/опекун) из своего аккаунта, либо несовершеннолетний сам —
	// подтверждая, что изучил документы вместе с представителем. Согласие
	// даётся здесь же, поэтому ссылка подтверждения не нужна
	// (см. 07_Согласие_представителя_на_данные_несовершеннолетнего).
	const [minorFilledBy, setMinorFilledBy] = useState<'' | 'self' | 'representative'>('')
	const [minorConsentChecked, setMinorConsentChecked] = useState(false)
	const [photoPreviews, setPhotoPreviews] = useState<Record<PhotoCategory, string | null>>({
		portrait: null, profile: null, full_height: null,
	})
	const photoPreviewsRef = useRef(photoPreviews)
	const activeCategoryRef = useRef<PhotoCategory>('portrait')
	const fileInputRef = useRef<HTMLInputElement>(null)

	const [creating, setCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	/* Сообщение об ошибке стоит в начале формы, а кнопка сохранения — в самом
	   конце. Без прокрутки к нему казалось, что кнопка просто не работает.
	   Счётчик нужен, чтобы прокрутка срабатывала и когда ошибка повторилась
	   с тем же текстом. */
	const errorRef = useRef<HTMLDivElement | null>(null)
	const [errorSeq, setErrorSeq] = useState(0)
	const reportError = useCallback((message: string) => {
		setError(message)
		setErrorSeq((seq) => seq + 1)
	}, [])
	// Ссылка подтверждения полномочий после создания анкеты Агентом — показываем
	// сразу после сохранения, чтобы агент мог отправить её актёру/представителю.
	const [authorityLink, setAuthorityLink] = useState<{ url: string; isMinor: boolean } | null>(null)
	const [linkCopied, setLinkCopied] = useState(false)

	useEffect(() => {
		photoPreviewsRef.current = photoPreviews
	}, [photoPreviews])

	useEffect(() => {
		if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [error, errorSeq])

	useEffect(() => {
		return () => {
			Object.values(photoPreviewsRef.current).forEach((url) => url && URL.revokeObjectURL(url))
		}
	}, [])

	// Восстанавливаем сохранённый черновик ДО автоподстановки из аккаунта, чтобы
	// уже введённые значения не были затёрты данными из /me (там используется
	// `prev.X || me.X`, поэтому непустые поля черновика сохранятся).
	const draftHydratedRef = useRef(false)
	useEffect(() => {
		if (draftHydratedRef.current) return
		draftHydratedRef.current = true
		try {
			const raw = localStorage.getItem(PROFILE_DRAFT_KEY)
			if (!raw) return
			const saved = JSON.parse(raw)
			if (saved?.form && typeof saved.form === 'object') {
				setForm((prev) => ({ ...prev, ...saved.form }))
			}
			if (saved?.agentForm && typeof saved.agentForm === 'object') {
				setAgentForm((prev) => ({ ...prev, ...saved.agentForm }))
			}
		} catch {}
	}, [])

	// Автосохранение черновика при каждом изменении полей. Первый прогон (на
	// монтировании, с пустой формой) пропускаем, чтобы не затереть уже сохранённый
	// черновик ДО того, как сработает его восстановление.
	const skipFirstSaveRef = useRef(true)
	useEffect(() => {
		if (skipFirstSaveRef.current) {
			skipFirstSaveRef.current = false
			return
		}
		try {
			localStorage.setItem(
				PROFILE_DRAFT_KEY,
				JSON.stringify({ form, agentForm }),
			)
		} catch {}
	}, [form, agentForm])

	useEffect(() => {
		// Автоподстановка данных из аккаунта.
		// Актёр: email/имя/фамилия/телефон относятся к самому актёру.
		// Агент: те же поля относятся к агенту (его контакты), поэтому
		// подставляем их в отдельную секцию «Ваши данные как агента».
		let cancelled = false
		;(async () => {
			const me = await apiCall('GET', 'auth/v2/me/').catch(() => null)
			if (cancelled || !me) return
			// Telegram автоматически подставляем из аккаунта: сначала вручную
			// заданный ник, иначе username из Telegram-регистрации.
			const tgValue = me.telegram_nick || me.telegram_username || ''
			if (isAgent) {
				setAgentForm((prev) => ({
					first_name: prev.first_name || me.first_name || '',
					last_name: prev.last_name || me.last_name || '',
					phone_number: prev.phone_number || me.phone_number || '',
					email: prev.email || me.email || '',
					telegram_nick: prev.telegram_nick || tgValue,
					vk_nick: prev.vk_nick || me.vk_nick || '',
					max_nick: prev.max_nick || me.max_nick || '',
				}))
				return
			}
			setForm((prev) => ({
				...prev,
				email: prev.email || me.email || '',
				first_name: prev.first_name || me.first_name || '',
				last_name: prev.last_name || me.last_name || '',
				phone_number: prev.phone_number || me.phone_number || '',
				telegram_nick: prev.telegram_nick || tgValue,
				vk_nick: prev.vk_nick || me.vk_nick || '',
				max_nick: prev.max_nick || me.max_nick || '',
			}))
		})()
		return () => {
			cancelled = true
		}
	}, [isAgent])

	useEffect(() => {
		let cancelled = false
		;(async () => {
			const status = await apiCall('GET', 'legal/consent/status/').catch(() => null)
			if (!cancelled) {
				setImageConsentAccepted(!!status?.image_consent?.accepted)
				setDistributionConsentAccepted(!!status?.distribution_consent?.accepted)
			}
		})()
		return () => { cancelled = true }
	}, [])

	const pickPhoto = (category: PhotoCategory) => {
		activeCategoryRef.current = category
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
			fileInputRef.current.click()
		}
	}

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		const category = activeCategoryRef.current

		if (file.size > MAX_PHOTO_SIZE) {
			toast.error('Фото слишком большое. Максимум 20МБ')
			return
		}
		// Кадр не отклоняем по формату: сервер сам приведёт обязательное фото
		// к вертикальному виду, чтобы клиенту не нужно было подбирать формат.

		setPhotoFiles((prev) => ({ ...prev, [category]: file }))
		setPhotoPreviews((prev) => {
			if (prev[category]) URL.revokeObjectURL(prev[category] as string)
			return { ...prev, [category]: URL.createObjectURL(file) }
		})
	}

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			setError(null)

			// Для агента сначала проверяем его собственные данные (имя и телефон) —
			// они показываются кастинг-директору у всех его актёров.
			if (isAgent) {
				const missingAgent: string[] = []
				if (!agentForm.first_name.trim()) missingAgent.push('Имя агента')
				if (!agentForm.last_name.trim()) missingAgent.push('Фамилия агента')
				if (!agentForm.phone_number.trim()) missingAgent.push('Телефон агента')
				if (missingAgent.length > 0) {
					reportError(`Заполните ваши данные как агента: ${missingAgent.join(', ')}`)
					return
				}
				if (!hasAnyMessenger(agentForm)) {
					reportError('Укажите хотя бы один приоритетный способ связи: Telegram, ВКонтакте или MAX')
					return
				}
			}

			const missingPhotos = PHOTO_SLOTS.filter((s) => !photoFiles[s.value])
			if (missingPhotos.length > 0) {
				reportError(
					`Добавьте обязательные фото актёра: ${missingPhotos.map((s) => s.label).join(', ')}`,
				)
				return
			}

			if (!imageConsentAccepted && !imageConsentChecked) {
				reportError('Отметьте согласие на использование изображения, фотографий и видео')
				return
			}

			if (!isAgent && !distributionConsentAccepted && !distributionConsentChecked) {
				reportError('Отметьте согласие на распространение персональных данных для Каст-листов')
				return
			}

			const requiredFields: [keyof FormState, string][] = [
				['first_name', 'Имя'],
				['last_name', 'Фамилия'],
				['gender', 'Пол'],
				['date_of_birth', 'Дата рождения'],
				['city', 'Город'],
				['experience', 'Опыт'],
				['look_type', 'Тип внешности'],
				['hair_color', 'Цвет волос'],
				['hair_length', 'Длина волос'],
				['height', 'Рост'],
				['clothing_size', 'Размер одежды'],
				['shoe_size', 'Размер обуви'],
			]
			if (!isAgent) {
				requiredFields.push(['phone_number', 'Телефон'])
			}

			const missingFields = requiredFields
				.filter(([key]) => !String(form[key] ?? '').trim())
				.map(([, label]) => label)
			if (missingFields.length > 0) {
				reportError(`Заполните обязательные поля: ${missingFields.join(', ')}`)
				return
			}

			if (!isAgent) {
				if (!hasAnyMessenger(form)) {
					reportError('Укажите хотя бы один приоритетный способ связи: Telegram, ВКонтакте или MAX')
					return
				}

				// Анкета несовершеннолетнего требует согласия законного
				// представителя — либо он заполняет её сам, либо актёр
				// подтверждает, что изучил документы вместе с ним.
				if (isMinor(form.date_of_birth)) {
					if (!minorFilledBy) {
						reportError('Актёру меньше 18 лет: укажите, кто заполняет анкету.')
						return
					}
					if (!minorConsentChecked) {
						reportError('Подтвердите согласие законного представителя актёра.')
						return
					}
				}
			}

			if (isAgent && isMinor(form.date_of_birth) && !minorAuthorityChecked) {
				reportError('Подтвердите наличие полномочий представлять несовершеннолетнего актёра и его законного представителя')
				return
			}

			setCreating(true)
			try {
				if (!imageConsentAccepted) {
					await apiCall('POST', 'legal/consent/accept/', { documents: ['image_consent'] })
				}
				if (!isAgent && !distributionConsentAccepted) {
					const allowedCategories = ALL_DISTRIBUTION_CATEGORY_KEYS.filter((key) => distributionCategories[key])
					await apiCall('POST', 'legal/consent/accept/', {
						documents: ['distribution_consent'],
						categories: { distribution_consent: allowedCategories },
					})
				}

				// Контакты сохраняем в аккаунт: у агента это его собственные
				// контакты, которые кастинг-директор видит у всех его актёров.
				// Те же контакты уходят и вместе с самой анкетой (ниже) — их
				// сохранит бэкенд тем же запросом, который их проверяет, поэтому
				// заполненные поля больше не могут обернуться требованием
				// «укажите способ связи».
				const messengers = normalizeMessengers(isAgent ? agentForm : form)
				const contactsResult = await saveAccountContacts(
					isAgent
						? {
								first_name: agentForm.first_name.trim(),
								last_name: agentForm.last_name.trim(),
								phone_number: agentForm.phone_number.trim() || null,
								email: agentForm.email.trim() || undefined,
								...messengers,
							}
						: messengers,
				)
				if (!contactsResult.ok) {
					reportError(contactsResult.error)
					setCreating(false)
					return
				}
				if (contactsResult.warning) {
					toast.error(contactsResult.warning, { duration: 9000 })
				}

				const payload: Record<string, unknown> = {
					first_name: form.first_name.trim(),
					last_name: form.last_name || undefined,
					gender: form.gender || undefined,
					date_of_birth: form.date_of_birth || undefined,
					city: form.city || undefined,
					metro_station: form.metro_station.trim() || undefined,
					tax_status: form.tax_status || undefined,
					qualification: form.qualification || undefined,
					experience: form.experience ? Number(form.experience) : undefined,
					about_me: form.about_me || undefined,
					look_type: form.look_type || undefined,
					hair_color: form.hair_color || undefined,
					hair_length: form.hair_length || undefined,
					height: form.height ? Number(form.height) : undefined,
					clothing_size: form.clothing_size || undefined,
					shoe_size: form.shoe_size || undefined,
					bust_volume: form.bust_volume ? Number(form.bust_volume) : undefined,
					waist_volume: form.waist_volume ? Number(form.waist_volume) : undefined,
					hip_volume: form.hip_volume ? Number(form.hip_volume) : undefined,
					video_intro: form.video_intro || undefined,
					extra_portfolio_url: form.extra_portfolio_url || undefined,
					// Способы связи бэкенд запишет в аккаунт сам — тем же запросом,
					// в котором их и требует.
					telegram_nick: messengers.telegram_nick || undefined,
					vk_nick: messengers.vk_nick || undefined,
					max_nick: messengers.max_nick || undefined,
				}
				if (!isAgent) {
					payload.phone_number = form.phone_number || undefined
					payload.email = form.email || undefined
					// Бэкенд зафиксирует Согласие законного представителя в журнале
					// согласий с привязкой к анкете и пометкой, кем оно дано.
					if (isMinor(form.date_of_birth)) {
						payload.minor_consent = minorFilledBy
					}
				}

				const res = await apiCall('POST', 'tma/actor-profiles/', payload)
				const newId = res?.id
				if (!newId) {
					// Бэкенд отдаёт detail либо строкой, либо объектом {message}.
					const detail = res?.detail
					reportError(
						(typeof detail === 'string' && detail) ||
							(typeof detail?.message === 'string' && detail.message) ||
							'Ошибка при создании профиля',
					)
					setCreating(false)
					return
				}

				// Профиль создан — черновик больше не нужен.
				try {
					localStorage.removeItem(PROFILE_DRAFT_KEY)
				} catch {}

				// Грузим обязательные фото по порядку (бэк требует портрет/профиль/рост).
				// Используем fetch-загрузку (apiUpload), которая НЕ разлогинивает при
				// проблемах с сессией, чтобы не терять кастинг, на который откликнулись.
				let uploadFailed = false
				for (const slot of PHOTO_SLOTS) {
					const file = photoFiles[slot.value]
					if (!file) continue
					const uploadFile = await optimizePhotoForUpload(file)
					const fd = new FormData()
					fd.append('file', uploadFile)
					fd.append('photo_category', slot.value)
					const up = await apiUpload(
						'POST',
						`tma/actor-profiles/${newId}/media/photo/`,
						fd,
					)
					if (!up?.id) {
						uploadFailed = true
						toast.error(`Не удалось загрузить фото «${slot.label}». Добавьте его в профиле.`)
					}
				}

				if (uploadFailed) {
					toast.error('Профиль создан. Фото, которые не загрузились, можно добавить позже.')
				}

				// Анкету создал Агент — она ждёт подтверждения полномочий самим
				// актёром (или его законным представителем, если несовершеннолетний)
				// и пока не публикуется. Показываем ссылку вместо немедленного выхода.
				if (isAgent && res?.authority_status === 'pending_confirmation' && res?.authority_confirmation_token) {
					setAuthorityLink({
						url: `${window.location.origin}/confirm-authority/${res.authority_confirmation_token}`,
						isMinor: isMinor(form.date_of_birth),
					})
					setCreating(false)
					return
				}

				// После создания всегда возвращаем пользователя на основной экран.
				// Ошибка отдельного фото не должна принудительно открывать загрузку
				// медиа: профиль уже создан, а фото можно заменить позже.
				consumePendingReturnUrl()
				router.replace(isAgent ? '/cabinet' : '/actor-home')
			} catch {
				reportError('Ошибка подключения к серверу')
				setCreating(false)
			}
		},
		[
			form, agentForm, photoFiles, isAgent, router, reportError,
			imageConsentAccepted, imageConsentChecked, minorAuthorityChecked,
			minorFilledBy, minorConsentChecked,
			distributionConsentAccepted, distributionConsentChecked, distributionCategories,
		],
	)

	const copyAuthorityLink = async () => {
		if (!authorityLink) return
		try {
			await navigator.clipboard.writeText(authorityLink.url)
			setLinkCopied(true)
			setTimeout(() => setLinkCopied(false), 2000)
		} catch {
			toast.error('Не удалось скопировать ссылку')
		}
	}

	if (authorityLink) {
		return (
			<div className={styles.root}>
				<header className={styles.header}>
					<h1 className={styles.title}>
						<IconShield size={20} />
						Подтверждение полномочий
					</h1>
				</header>
				<div className={styles.createForm}>
					<div className={styles.agentNotice}>
						<IconAlertCircle size={18} />
						<div>
							<strong>Анкета создана, но пока не опубликована</strong>
							<p>
								Отправьте эту ссылку {authorityLink.isMinor ? 'законному представителю актёра' : 'актёру'} —
								после подтверждения по ссылке анкета станет видна в кастингах и по ней можно будет
								откликаться. Без подтверждения анкета останется скрытой.
							</p>
						</div>
					</div>

					<div className={styles.field}>
						<label>Ссылка для подтверждения</label>
						<div className={styles.linkRow}>
							<input
								type="text"
								readOnly
								value={authorityLink.url}
								className={styles.input}
								onFocus={(e) => e.currentTarget.select()}
							/>
							<button
								type="button"
								className={`${styles.submitButton} ${styles.copyButton}`}
								onClick={copyAuthorityLink}
							>
								{linkCopied ? <IconCheck size={16} /> : <IconClipboard size={16} />}
								{linkCopied ? 'Готово' : 'Копировать'}
							</button>
						</div>
					</div>

					<button
						type="button"
						className={styles.submitButton}
						onClick={() => {
							consumePendingReturnUrl()
							router.replace('/cabinet')
						}}
					>
						Готово
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button type="button" className={styles.backButton} onClick={goBack}>
					<IconArrowLeft size={16} />
					Отмена
				</button>
				<h1 className={styles.title}>
					<IconMask size={20} />
					{isAgent ? 'Профиль агента и актёра' : 'Новый профиль'}
				</h1>
			</header>

			<form className={styles.createForm} onSubmit={handleSubmit}>
				<p className={styles.description}>
					{isAgent
						? 'Сначала заполните свои данные как агента, затем — профиль хотя бы одного из ваших актёров. После создания вы получите ссылку подтверждения полномочий — без неё анкета не публикуется и не участвует в откликах.'
						: 'Заполните профиль полностью: данные и обязательные фото. После создания профиля вы сразу сможете откликаться на кастинги.'}
				</p>

				{error && <div ref={errorRef} className={styles.error}>{error}</div>}

				{/* Данные агента */}
				{isAgent && (
					<div className={styles.fields}>
						<div className={styles.sectionLabel}>Ваши данные как агента</div>
						<p className={styles.sectionHint}>
							Эти контакты кастинг-директор увидит у всех ваших актёров.
						</p>

						<div className={styles.row}>
							<div className={styles.field}>
								<label>
									Имя <span className={styles.required}>*</span>
								</label>
								<input
									type="text"
									value={agentForm.first_name}
									onChange={(e) => setAgent('first_name', e.target.value)}
									placeholder="Имя"
									className={styles.input}
									required
								/>
							</div>
							<div className={styles.field}>
								<label>
									Фамилия <span className={styles.required}>*</span>
								</label>
								<input
									type="text"
									value={agentForm.last_name}
									onChange={(e) => setAgent('last_name', e.target.value)}
									placeholder="Фамилия"
									className={styles.input}
									required
								/>
							</div>
						</div>

						<div className={styles.row}>
							<div className={styles.field}>
								<label>
									Телефон <span className={styles.required}>*</span>
								</label>
								<input
									type="tel"
									value={agentForm.phone_number ? formatPhone(agentForm.phone_number) : ''}
									onChange={(e) => setAgent('phone_number', rawPhone(e.target.value))}
									placeholder="+7 (900) 123-45-67"
									className={styles.input}
									required
								/>
							</div>
							<div className={styles.field}>
								<label>Email</label>
								<input
									type="email"
									value={agentForm.email}
									onChange={(e) => setAgent('email', e.target.value)}
									placeholder="email@example.com"
									className={styles.input}
									autoComplete="email"
									inputMode="email"
								/>
							</div>
						</div>

						<div className={styles.sectionLabel}>
							Приоритетные способы связи <span className={styles.required}>*</span>
						</div>

						<div className={styles.row}>
							<div className={styles.field}>
								<label>Telegram</label>
								<input
									type="text"
									value={agentForm.telegram_nick}
									onChange={(e) => setAgent('telegram_nick', e.target.value)}
									onBlur={(e) => setAgent('telegram_nick', canonicalTelegram(e.target.value))}
									placeholder="@username или t.me/username"
									className={styles.input}
								/>
							</div>
							<div className={styles.field}>
								<label>ВКонтакте</label>
								<input
									type="text"
									value={agentForm.vk_nick}
									onChange={(e) => setAgent('vk_nick', e.target.value)}
									onBlur={(e) => setAgent('vk_nick', canonicalVk(e.target.value))}
									placeholder="vk.com/username"
									className={styles.input}
								/>
							</div>
						</div>

						<div className={styles.row}>
							<div className={styles.field}>
								<label>MAX</label>
								<input
									type="text"
									value={agentForm.max_nick}
									onChange={(e) => setAgent('max_nick', e.target.value)}
									onBlur={(e) => setAgent('max_nick', canonicalMax(e.target.value))}
									placeholder="Ник в MAX"
									className={styles.input}
								/>
							</div>
						</div>
					</div>
				)}

				{/* Пояснение для агента про анкету актёра */}
				{isAgent && (
					<div className={styles.agentNotice}>
						<IconAlertCircle size={18} />
						<div>
							<strong>Профиль актёра</strong>
							<p>
								Теперь заполните профиль хотя бы одного вашего актёра полностью —
								данные и обязательные фото. Только после этого вы сможете
								откликаться на кастинги. Контакты в профиле актёра показываются
								ваши (как агента).
							</p>
						</div>
					</div>
				)}

				{/* Фото */}
				<div className={styles.fields}>
					<div className={styles.sectionLabel}>
						{isAgent ? 'Обязательные фото актёра' : 'Обязательные фото'}{' '}
						<span className={styles.required}>*</span>
					</div>
					<p className={styles.sectionHint}>
						Нужны 3 фото: портрет, профиль и полный рост. Можно загружать любые
						фото — мы сами приведём их к нужному вертикальному формату. До 20МБ каждое.
					</p>
					<div className={styles.photoGrid}>
						{PHOTO_SLOTS.map((slot) => {
							const preview = photoPreviews[slot.value]
							return (
								<button
									type="button"
									key={slot.value}
									className={`${styles.photoSlot} ${preview ? styles.photoSlotDone : ''}`}
									onClick={() => pickPhoto(slot.value)}
								>
									{preview ? (
										<>
											<img src={preview} alt={slot.label} className={styles.photoPreview} decoding="async" />
											<span className={styles.photoBadge}>
												<IconCheck size={12} /> {slot.label}
											</span>
										</>
									) : (
										<span className={styles.photoPlaceholder}>
											<IconPlus size={18} />
											<strong>{slot.label}</strong>
											<small>{slot.hint}</small>
										</span>
									)}
								</button>
							)
						})}
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept={ACCEPTED_PHOTO_TYPES}
						onChange={handleFileChange}
						style={{ display: 'none' }}
					/>

					{!imageConsentAccepted && (
						<label className={styles.consentRow}>
							<input
								type="checkbox"
								checked={imageConsentChecked}
								onChange={(e) => setImageConsentChecked(e.target.checked)}
							/>
							<span>
								Я даю{' '}
								<a href="/legal/image-consent" target="_blank" rel="noopener noreferrer">
									согласие на использование изображения, фотографий и видео
								</a>{' '}
								{isAgent ? 'представляемого актёра' : ''} для создания и показа Анкеты.
							</span>
						</label>
					)}

					{!isAgent && !distributionConsentAccepted && (
						<div className={styles.distributionConsent}>
							<label className={styles.consentRow}>
								<input
									type="checkbox"
									checked={distributionConsentChecked}
									onChange={(e) => setDistributionConsentChecked(e.target.checked)}
								/>
								<span>
									Я даю{' '}
									<a href="/legal/distribution-consent" target="_blank" rel="noopener noreferrer">
										согласие на распространение персональных данных
									</a>{' '}
									для показа Анкеты в Каст-листах кастинг-директорам. Можно отключить
									отдельные категории данных ниже.
								</span>
							</label>
							<div className={styles.distributionCategories}>
								{DISTRIBUTION_CATEGORIES.map((cat) => (
									<label key={cat.key} className={styles.distributionCategoryRow}>
										<input
											type="checkbox"
											checked={!!distributionCategories[cat.key]}
											onChange={(e) =>
												setDistributionCategories((prev) => ({ ...prev, [cat.key]: e.target.checked }))
											}
										/>
										<span>{cat.label}</span>
									</label>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Личные данные */}
				<div className={styles.fields}>
					<div className={styles.sectionLabel}>
						{isAgent ? 'Данные актёра' : 'Личные данные'}
					</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>
								Имя <span className={styles.required}>*</span>
							</label>
							<input
								type="text"
								value={form.first_name}
								onChange={(e) => set('first_name', e.target.value)}
								placeholder="Имя"
								className={styles.input}
								required
							/>
						</div>
						<div className={styles.field}>
							<label>
								Фамилия <span className={styles.required}>*</span>
							</label>
							<input
								type="text"
								value={form.last_name}
								onChange={(e) => set('last_name', e.target.value)}
								placeholder="Фамилия"
								className={styles.input}
								required
							/>
						</div>
					</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>
								Пол <span className={styles.required}>*</span>
							</label>
							<select
								value={form.gender}
								onChange={(e) => set('gender', e.target.value)}
								className={styles.input}
								required
							>
								<option value="">Не указан</option>
								{GENDER_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>
						<div className={styles.field}>
							<label>
								Дата рождения <span className={styles.required}>*</span>
							</label>
							<input
								type="date"
								value={form.date_of_birth}
								onChange={(e) => set('date_of_birth', e.target.value)}
								className={styles.input}
								required
							/>
						</div>
					</div>

					{isAgent && isMinor(form.date_of_birth) && (
						<label className={styles.consentRow}>
							<input
								type="checkbox"
								checked={minorAuthorityChecked}
								onChange={(e) => setMinorAuthorityChecked(e.target.checked)}
							/>
							<span>
								Актёру меньше 18 лет. Подтверждаю, что имею полномочия представлять его
								интересы. После создания анкеты я получу ссылку — её нужно отправить
								законному представителю актёра: пока он не подтвердит полномочия по
								ссылке, анкета не будет опубликована.
							</span>
						</label>
					)}

					{!isAgent && isMinor(form.date_of_birth) && (
						<div className={styles.minorConsent}>
							<div className={styles.minorConsentHead}>
								<strong>Актёру меньше 18 лет</strong>
								<span>
									Для анкеты несовершеннолетнего нужно согласие законного
									представителя. Укажите, кто заполняет анкету:
								</span>
							</div>
							<div className={styles.minorOptions}>
								<label className={styles.minorOptionRow}>
									<input
										type="radio"
										name="minor-filled-by"
										checked={minorFilledBy === 'self'}
										onChange={() => {
											setMinorFilledBy('self')
											setMinorConsentChecked(false)
										}}
									/>
									<span>Заполняю сам(а) — вместе с законным представителем</span>
								</label>
								<label className={styles.minorOptionRow}>
									<input
										type="radio"
										name="minor-filled-by"
										checked={minorFilledBy === 'representative'}
										onChange={() => {
											setMinorFilledBy('representative')
											setMinorConsentChecked(false)
										}}
									/>
									<span>Я законный представитель актёра (родитель или опекун)</span>
								</label>
							</div>
							{minorFilledBy && (
								<label className={styles.consentRow}>
									<input
										type="checkbox"
										checked={minorConsentChecked}
										onChange={(e) => setMinorConsentChecked(e.target.checked)}
									/>
									<span>
										{minorFilledBy === 'self' ? (
											<>
												Я изучил(а){' '}
												<a href="/legal/minor-consent" target="_blank" rel="noopener noreferrer">
													согласие законного представителя на обработку данных
													несовершеннолетнего
												</a>{' '}
												вместе со своим законным представителем, и он не возражает
												против моей регистрации и создания анкеты.
											</>
										) : (
											<>
												Подтверждаю, что я законный представитель актёра, заполняю
												анкету за него и даю{' '}
												<a href="/legal/minor-consent" target="_blank" rel="noopener noreferrer">
													согласие законного представителя на обработку данных
													несовершеннолетнего
												</a>
												.
											</>
										)}
									</span>
								</label>
							)}
						</div>
					)}

					{!isAgent && (
						<div className={styles.row}>
							<div className={styles.field}>
								<label>
									Телефон <span className={styles.required}>*</span>
								</label>
								<input
									type="tel"
									value={form.phone_number ? formatPhone(form.phone_number) : ''}
									onChange={(e) => set('phone_number', rawPhone(e.target.value))}
									placeholder="+7 (900) 123-45-67"
									className={styles.input}
									required
								/>
							</div>
							<div className={styles.field}>
								<label>Email</label>
								<input
									type="email"
									value={form.email}
									onChange={(e) => set('email', e.target.value)}
									placeholder="email@example.com"
									className={styles.input}
								/>
							</div>
						</div>
					)}

					{!isAgent && (
						<>
							<div className={styles.sectionLabel}>
								Приоритетные способы связи <span className={styles.required}>*</span>
							</div>
							<div className={styles.row}>
								<div className={styles.field}>
									<label>Telegram</label>
									<input
										type="text"
										value={form.telegram_nick}
										onChange={(e) => set('telegram_nick', e.target.value)}
										onBlur={(e) => set('telegram_nick', canonicalTelegram(e.target.value))}
										placeholder="@username или t.me/username"
										className={styles.input}
									/>
								</div>
								<div className={styles.field}>
									<label>ВКонтакте</label>
									<input
										type="text"
										value={form.vk_nick}
										onChange={(e) => set('vk_nick', e.target.value)}
										onBlur={(e) => set('vk_nick', canonicalVk(e.target.value))}
										placeholder="vk.com/username"
										className={styles.input}
									/>
								</div>
							</div>
							<div className={styles.field}>
								<label>MAX</label>
								<input
									type="text"
									value={form.max_nick}
									onChange={(e) => set('max_nick', e.target.value)}
									onBlur={(e) => set('max_nick', canonicalMax(e.target.value))}
									placeholder="Ник в MAX"
									className={styles.input}
								/>
							</div>
						</>
					)}

					<div className={styles.field}>
						<label>
							Город <span className={styles.required}>*</span>
						</label>
						<input
							type="text"
							value={form.city}
							onChange={(e) => set('city', e.target.value)}
							placeholder="Москва"
							className={styles.input}
							required
						/>
					</div>

					<div className={styles.field}>
						<label>Станция метро</label>
						<input
							type="text"
							value={form.metro_station}
							onChange={(e) => set('metro_station', e.target.value)}
							placeholder="Например: Тверская"
							className={styles.input}
						/>
					</div>

					<div className={styles.field}>
						<label>Статус налогоплательщика</label>
						<select
							value={form.tax_status}
							onChange={(e) => set('tax_status', e.target.value)}
							className={styles.input}
						>
							<option value="">Выберите статус</option>
							{TAX_STATUS_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Профессиональные данные */}
				<div className={styles.fields}>
					<div className={styles.sectionLabel}>Профессиональные данные</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>Квалификация</label>
							<select
								value={form.qualification}
								onChange={(e) => set('qualification', e.target.value)}
								className={styles.input}
							>
								<option value="">Не указана</option>
								{QUALIFICATION_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>
						<div className={styles.field}>
							<label>
								Опыт (лет) <span className={styles.required}>*</span>
							</label>
							<input
								type="number"
								min={0}
								max={99}
								value={form.experience}
								onChange={(e) => set('experience', e.target.value)}
								className={styles.input}
								required
							/>
						</div>
					</div>

					<div className={styles.field}>
						<label>О себе</label>
						<textarea
							value={form.about_me}
							onChange={(e) => set('about_me', e.target.value)}
							placeholder="Расскажите о себе..."
							rows={4}
							maxLength={3000}
							className={styles.input}
						/>
					</div>

					<div className={styles.field}>
						<label>Видеовизитка</label>
						<input
							type="url"
							value={form.video_intro}
							onChange={(e) => set('video_intro', e.target.value)}
							placeholder="Ссылка на видео: YouTube, Rutube, VK..."
							className={styles.input}
						/>
					</div>

					<div className={styles.field}>
						<label>Ссылка на доп. портфолио</label>
						<input
							type="url"
							value={form.extra_portfolio_url}
							onChange={(e) => set('extra_portfolio_url', e.target.value)}
							placeholder="https://..."
							className={styles.input}
						/>
					</div>
				</div>

				{/* Параметры внешности */}
				<div className={styles.fields}>
					<div className={styles.sectionLabel}>Параметры внешности</div>

					<div className={styles.field}>
						<label>
							Тип внешности <span className={styles.required}>*</span>
						</label>
						<select
							value={form.look_type}
							onChange={(e) => set('look_type', e.target.value)}
							className={styles.input}
							required
						>
							<option value="">Не указан</option>
							{LOOK_TYPE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>
								Цвет волос <span className={styles.required}>*</span>
							</label>
							<select
								value={form.hair_color}
								onChange={(e) => set('hair_color', e.target.value)}
								className={styles.input}
								required
							>
								<option value="">Не указан</option>
								{HAIR_COLOR_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>
						<div className={styles.field}>
							<label>
								Длина волос <span className={styles.required}>*</span>
							</label>
							<select
								value={form.hair_length}
								onChange={(e) => set('hair_length', e.target.value)}
								className={styles.input}
								required
							>
								<option value="">Не указана</option>
								{HAIR_LENGTH_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>
					</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>
								Рост (см) <span className={styles.required}>*</span>
							</label>
							<input
								type="number"
								min={0}
								max={300}
								value={form.height}
								onChange={(e) => set('height', e.target.value)}
								className={styles.input}
								required
							/>
						</div>
						<div className={styles.field}>
							<label>
								Размер одежды <span className={styles.required}>*</span>
							</label>
							<input
								type="text"
								value={form.clothing_size}
								onChange={(e) => set('clothing_size', e.target.value)}
								placeholder="42"
								className={styles.input}
								required
							/>
						</div>
						<div className={styles.field}>
							<label>
								Размер обуви <span className={styles.required}>*</span>
							</label>
							<input
								type="text"
								value={form.shoe_size}
								onChange={(e) => set('shoe_size', e.target.value)}
								placeholder="40"
								className={styles.input}
								required
							/>
						</div>
					</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>Обхват груди</label>
							<input
								type="number"
								min={0}
								max={200}
								value={form.bust_volume}
								onChange={(e) => set('bust_volume', e.target.value)}
								placeholder="см"
								className={styles.input}
							/>
						</div>
						<div className={styles.field}>
							<label>Обхват талии</label>
							<input
								type="number"
								min={0}
								max={200}
								value={form.waist_volume}
								onChange={(e) => set('waist_volume', e.target.value)}
								placeholder="см"
								className={styles.input}
							/>
						</div>
						<div className={styles.field}>
							<label>Обхват бёдер</label>
							<input
								type="number"
								min={0}
								max={200}
								value={form.hip_volume}
								onChange={(e) => set('hip_volume', e.target.value)}
								placeholder="см"
								className={styles.input}
							/>
						</div>
					</div>
				</div>

				<button type="submit" className={styles.submitButton} disabled={creating}>
					{creating ? (
						<>
							<IconLoader size={16} /> Создание...
						</>
					) : (
						<>
							<IconPlus size={16} /> Создать профиль
						</>
					)}
				</button>
			</form>
		</div>
	)
}
