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

async function getImageMeta(file: File): Promise<{ width: number; height: number }> {
	const objectUrl = URL.createObjectURL(file)
	try {
		return await new Promise<{ width: number; height: number }>((resolve, reject) => {
			const image = new window.Image()
			image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
			image.onerror = () => reject(new Error('Image load failed'))
			image.src = objectUrl
		})
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

async function validatePhoto(file: File, category: PhotoCategory): Promise<string | null> {
	const { width, height } = await getImageMeta(file)
	if (width < 600 || height < 800) {
		return 'Фото слишком маленькое. Нужен чёткий вертикальный кадр не меньше 600x800.'
	}
	if (height <= width) {
		return 'Для обязательных фото нужен вертикальный кадр.'
	}
	const aspectRatio = height / width
	if (category === 'full_height' && aspectRatio < 1.45) {
		return 'Для фото «Полный рост» нужен более высокий вертикальный кадр, где актёр виден целиком.'
	}
	if ((category === 'portrait' || category === 'profile') && aspectRatio > 2.4) {
		return 'Кадр слишком узкий и вытянутый. Выберите более естественное вертикальное фото.'
	}
	return null
}

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
		// Автоподстановка данных из аккаунта: если человек регистрировался по email,
		// его email (а также имя/фамилия/телефон) подставляются автоматически.
		// Для агента эти поля относятся к актёру, поэтому не подставляем.
		if (isAgent) return
		let cancelled = false
		;(async () => {
			const me = await apiCall('GET', 'auth/v2/me/').catch(() => null)
			if (cancelled || !me) return
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
		try {
			const validationError = await validatePhoto(file, category)
			if (validationError) {
				toast.error(validationError)
				return
			}
		} catch {
			toast.error('Не удалось прочитать изображение. Попробуйте другой файл.')
			return
		}

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

			const missingPhotos = PHOTO_SLOTS.filter((s) => !photoFiles[s.value])
			if (missingPhotos.length > 0) {
				setError(
					`Добавьте обязательные фото: ${missingPhotos.map((s) => s.label).join(', ')}`,
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
		[form, photoFiles, isAgent, router],
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
					Новый профиль
				</h1>
			</header>

			<form className={styles.createForm} onSubmit={handleSubmit}>
				<p className={styles.description}>
					Заполните анкету полностью: данные и обязательные фото. После создания
					профиля вы сразу сможете откликаться на кастинги.
				</p>

				{error && <div className={styles.error}>{error}</div>}

				{/* Фото */}
				<div className={styles.fields}>
					<div className={styles.sectionLabel}>
						Обязательные фото <span className={styles.required}>*</span>
					</div>
					<p className={styles.sectionHint}>
						Нужны 3 вертикальных фото: портрет, профиль и полный рост. До 20МБ каждое.
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
					<div className={styles.sectionLabel}>Личные данные</div>

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
