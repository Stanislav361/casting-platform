'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { apiCall, apiUpload } from '~/shared/api-client'
import { useRole } from '~/shared/use-role'
import { LOOK_TYPE_OPTIONS, TAX_STATUS_OPTIONS } from '~/shared/profile-labels'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
import { consumePendingReturnUrl } from '~/shared/pending-return-url'
import {
	IconArrowLeft,
	IconPlus,
	IconLoader,
	IconMask,
	IconCheck,
	IconAlertCircle,
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

type PhotoCategory = 'portrait' | 'profile' | 'full_height'

const PHOTO_SLOTS: { value: PhotoCategory; label: string; hint: string }[] = [
	{ value: 'portrait', label: 'Портрет', hint: 'Лицо и верх корпуса, вертикальный кадр' },
	{ value: 'profile', label: 'Профиль', hint: 'Боковой ракурс, вертикальный кадр' },
	{ value: 'full_height', label: 'Полный рост', hint: 'Актёр целиком с головы до ног' },
]

const ACCEPTED_PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/heif,image/heic'
const MAX_PHOTO_SIZE = 20 * 1024 * 1024 // 20MB

interface FormState {
	first_name: string
	last_name: string
	gender: string
	date_of_birth: string
	phone_number: string
	email: string
	city: string
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
	video_intro: string
	extra_portfolio_url: string
}

const EMPTY_FORM: FormState = {
	first_name: '', last_name: '', gender: '', date_of_birth: '',
	phone_number: '', email: '', city: '', tax_status: '', qualification: '',
	experience: '', about_me: '', look_type: '', hair_color: '', hair_length: '',
	height: '', clothing_size: '', shoe_size: '', bust_volume: '', waist_volume: '',
	hip_volume: '', video_intro: '', extra_portfolio_url: '',
}

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
	})
	const setAgent = (field: keyof typeof agentForm, value: string) =>
		setAgentForm((prev) => ({ ...prev, [field]: value }))

	const [photoFiles, setPhotoFiles] = useState<Record<PhotoCategory, File | null>>({
		portrait: null, profile: null, full_height: null,
	})
	const [photoPreviews, setPhotoPreviews] = useState<Record<PhotoCategory, string | null>>({
		portrait: null, profile: null, full_height: null,
	})
	const activeCategoryRef = useRef<PhotoCategory>('portrait')
	const fileInputRef = useRef<HTMLInputElement>(null)

	const [creating, setCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		// Чистим object URL превью при размонтировании.
		return () => {
			Object.values(photoPreviews).forEach((url) => url && URL.revokeObjectURL(url))
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		// Автоподстановка данных из аккаунта.
		// Актёр: email/имя/фамилия/телефон относятся к самому актёру.
		// Агент: те же поля относятся к агенту (его контакты), поэтому
		// подставляем их в отдельную секцию «Ваши данные как агента».
		let cancelled = false
		;(async () => {
			const me = await apiCall('GET', 'auth/v2/me/').catch(() => null)
			if (cancelled || !me) return
			if (isAgent) {
				setAgentForm((prev) => ({
					first_name: prev.first_name || me.first_name || '',
					last_name: prev.last_name || me.last_name || '',
					phone_number: prev.phone_number || me.phone_number || '',
					email: prev.email || me.email || '',
				}))
				return
			}
			setForm((prev) => ({
				...prev,
				email: prev.email || me.email || '',
				first_name: prev.first_name || me.first_name || '',
				last_name: prev.last_name || me.last_name || '',
				phone_number: prev.phone_number || me.phone_number || '',
			}))
		})()
		return () => {
			cancelled = true
		}
	}, [isAgent])

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
					setError(`Заполните ваши данные как агента: ${missingAgent.join(', ')}`)
					return
				}
			}

			const missingPhotos = PHOTO_SLOTS.filter((s) => !photoFiles[s.value])
			if (missingPhotos.length > 0) {
				setError(
					`Добавьте обязательные фото актёра: ${missingPhotos.map((s) => s.label).join(', ')}`,
				)
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
				['bust_volume', 'Обхват груди'],
				['waist_volume', 'Обхват талии'],
				['hip_volume', 'Обхват бёдер'],
			]
			if (!isAgent) requiredFields.push(['phone_number', 'Телефон'])

			const missingFields = requiredFields
				.filter(([key]) => !String(form[key] ?? '').trim())
				.map(([, label]) => label)
			if (missingFields.length > 0) {
				setError(`Заполните обязательные поля: ${missingFields.join(', ')}`)
				return
			}

			setCreating(true)
			try {
				// Сохраняем данные агента в его аккаунт — они станут контактами,
				// которые кастинг-директор видит у всех актёров этого агента.
				if (isAgent) {
					await apiCall('PATCH', 'auth/v2/me/', {
						first_name: agentForm.first_name.trim(),
						last_name: agentForm.last_name.trim(),
						phone_number: agentForm.phone_number.trim() || null,
					})
				}

				const payload: Record<string, unknown> = {
					first_name: form.first_name.trim(),
					last_name: form.last_name || undefined,
					gender: form.gender || undefined,
					date_of_birth: form.date_of_birth || undefined,
					city: form.city || undefined,
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
				}
				if (!isAgent) {
					payload.phone_number = form.phone_number || undefined
					payload.email = form.email || undefined
				}

				const res = await apiCall('POST', 'tma/actor-profiles/', payload)
				const newId = res?.id
				if (!newId) {
					setError(
						(res && typeof res.detail === 'string' && res.detail) ||
							'Ошибка при создании профиля',
					)
					setCreating(false)
					return
				}

				// Грузим обязательные фото по порядку (бэк требует портрет/профиль/рост).
				// Используем fetch-загрузку (apiUpload), которая НЕ разлогинивает при
				// проблемах с сессией, чтобы не терять кастинг, на который откликнулись.
				let uploadFailed = false
				for (const slot of PHOTO_SLOTS) {
					const file = photoFiles[slot.value]
					if (!file) continue
					const fd = new FormData()
					fd.append('file', file)
					fd.append('photo_category', slot.value)
					const up = await apiUpload(
						'POST',
						`tma/actor-profiles/${newId}/media/photo/`,
						fd,
					)
					if (!up?.id) {
						uploadFailed = true
						toast.error(`Не удалось загрузить фото «${slot.label}». Добавьте его в анкете.`)
					}
				}

				// Возвращаемся на кастинг, с которого пришли (Telegram deep link),
				// чтобы человек сразу мог откликнуться. Если фото не догрузились —
				// ведём в медиа-раздел анкеты дозагрузить.
				const target = consumePendingReturnUrl()
				if (uploadFailed) {
					router.push(`/cabinet/profile/${newId}/media`)
					return
				}
				router.push(target || `/cabinet/profile/${newId}`)
			} catch {
				setError('Ошибка подключения к серверу')
				setCreating(false)
			}
		},
		[form, agentForm, photoFiles, isAgent, router],
	)

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
						? 'Сначала заполните свои данные как агента, затем — анкету хотя бы одного из ваших актёров. Без полностью заполненной анкеты актёра (данные и фото) откликаться нельзя.'
						: 'Заполните анкету полностью: данные и обязательные фото. После создания профиля вы сразу сможете откликаться на кастинги.'}
				</p>

				{error && <div className={styles.error}>{error}</div>}

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
									readOnly
									placeholder="email@example.com"
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
							<strong>Анкета актёра</strong>
							<p>
								Теперь заполните анкету хотя бы одного вашего актёра полностью —
								данные и обязательные фото. Только после этого вы сможете
								откликаться на кастинги. Контакты в анкете актёра показываются
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
											<img src={preview} alt={slot.label} className={styles.photoPreview} />
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
						<label>Ссылка на видео-визитку</label>
						<input
							type="url"
							value={form.video_intro}
							onChange={(e) => set('video_intro', e.target.value)}
							placeholder="https://..."
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
							<label>
								Обхват груди <span className={styles.required}>*</span>
							</label>
							<input
								type="number"
								min={0}
								max={200}
								value={form.bust_volume}
								onChange={(e) => set('bust_volume', e.target.value)}
								placeholder="см"
								className={styles.input}
								required
							/>
						</div>
						<div className={styles.field}>
							<label>
								Обхват талии <span className={styles.required}>*</span>
							</label>
							<input
								type="number"
								min={0}
								max={200}
								value={form.waist_volume}
								onChange={(e) => set('waist_volume', e.target.value)}
								placeholder="см"
								className={styles.input}
								required
							/>
						</div>
						<div className={styles.field}>
							<label>
								Обхват бёдер <span className={styles.required}>*</span>
							</label>
							<input
								type="number"
								min={0}
								max={200}
								value={form.hip_volume}
								onChange={(e) => set('hip_volume', e.target.value)}
								placeholder="см"
								className={styles.input}
								required
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
