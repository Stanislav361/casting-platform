'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import {
	useActorProfile,
	useUpdateProfile,
	IActorProfileUpdate,
} from '~models/actor-profile'
import Page from '~widgets/page'
import { DataLoader } from '~packages/lib'
import { Loader } from '~packages/ui'
import AlertError from '~widgets/alert-error'

import { apiCall } from '~/shared/api-client'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
import { LOOK_TYPE_OPTIONS, TAX_STATUS_OPTIONS } from '~/shared/profile-labels'
import { useSmartBack } from '~/shared/smart-back'
import { useRole } from '~/shared/use-role'
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
const BIRTH_MONTH_OPTIONS = [
	{ value: '01', label: 'Январь' },
	{ value: '02', label: 'Февраль' },
	{ value: '03', label: 'Март' },
	{ value: '04', label: 'Апрель' },
	{ value: '05', label: 'Май' },
	{ value: '06', label: 'Июнь' },
	{ value: '07', label: 'Июль' },
	{ value: '08', label: 'Август' },
	{ value: '09', label: 'Сентябрь' },
	{ value: '10', label: 'Октябрь' },
	{ value: '11', label: 'Ноябрь' },
	{ value: '12', label: 'Декабрь' },
]
const CURRENT_YEAR = new Date().getFullYear()
const BIRTH_YEAR_OPTIONS = Array.from({ length: 121 }, (_, index) =>
	String(CURRENT_YEAR - index),
)

const parseBirthDate = (value?: string) => {
	const [year = '', month = '', day = ''] = (value || '').split('T')[0].split('-')
	return { day, month, year }
}

const getDaysInBirthMonth = (year: string, month: string) => {
	if (!year || !month) return 31
	return new Date(Number(year), Number(month), 0).getDate()
}

function BirthDateField({
	value,
	onChange,
}: {
	value?: string
	onChange: (value: string | undefined) => void
}) {
	const [parts, setParts] = useState(() => parseBirthDate(value))

	useEffect(() => {
		setParts(parseBirthDate(value))
	}, [value])

	const { day, month, year } = parts
	const daysInMonth = getDaysInBirthMonth(year, month)

	const updatePart = (part: 'day' | 'month' | 'year', nextValue: string) => {
		const next = { ...parts, [part]: nextValue }
		const maxDay = getDaysInBirthMonth(next.year, next.month)
		if (next.day && Number(next.day) > maxDay) {
			next.day = ''
		}
		setParts(next)
		onChange(
			next.day && next.month && next.year
				? `${next.year}-${next.month}-${next.day}`
				: undefined,
		)
	}

	return (
		<div className={styles.dateFields}>
			<select value={day} onChange={(e) => updatePart('day', e.target.value)}>
				<option value="">День</option>
				{Array.from({ length: daysInMonth }, (_, index) => {
					const optionValue = String(index + 1).padStart(2, '0')
					return (
						<option key={optionValue} value={optionValue}>
							{index + 1}
						</option>
					)
				})}
			</select>
			<select value={month} onChange={(e) => updatePart('month', e.target.value)}>
				<option value="">Месяц</option>
				{BIRTH_MONTH_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			<select
				value={year}
				onChange={(e) => updatePart('year', e.target.value)}
				className={styles.dateYear}
			>
				<option value="">Год</option>
				{BIRTH_YEAR_OPTIONS.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		</div>
	)
}

export default function ProfileEditPage() {
	const params = useParams()
	const router = useRouter()
	const goBack = useSmartBack()
	const role = useRole()
	const profileId = Number(params.id)
	const isAgent = role === 'agent'

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const updateProfile = useUpdateProfile(profileId)

	const [formData, setFormData] = useState<IActorProfileUpdate>({})
	// Мессенджеры хранятся в аккаунте пользователя (не в анкете).
	const [contacts, setContacts] = useState({ telegram_nick: '', vk_nick: '', max_nick: '' })
	const setContact = (field: keyof typeof contacts, value: string) =>
		setContacts((prev) => ({ ...prev, [field]: value }))

	useEffect(() => {
		let cancelled = false
		;(async () => {
			const me = await apiCall('GET', 'auth/v2/me/').catch(() => null)
			if (cancelled || !me) return
			setContacts({
				telegram_nick: me.telegram_nick || me.telegram_username || '',
				vk_nick: me.vk_nick || '',
				max_nick: me.max_nick || '',
			})
		})()
		return () => { cancelled = true }
	}, [])

	useEffect(() => {
		if (profile) {
			setFormData({
				display_name: profile.display_name || undefined,
				first_name: profile.first_name || undefined,
				last_name: profile.last_name || undefined,
				gender: profile.gender || undefined,
				date_of_birth: profile.date_of_birth || undefined,
				phone_number: profile.phone_number || undefined,
				email: profile.email || undefined,
				city: profile.city || undefined,
				tax_status: profile.tax_status || undefined,
				qualification: profile.qualification || undefined,
				experience: profile.experience || undefined,
				about_me: profile.about_me || undefined,
				look_type: profile.look_type || undefined,
				hair_color: profile.hair_color || undefined,
				hair_length: profile.hair_length || undefined,
				height: profile.height || undefined,
				clothing_size: profile.clothing_size || undefined,
				shoe_size: profile.shoe_size || undefined,
				bust_volume: profile.bust_volume || undefined,
				waist_volume: profile.waist_volume || undefined,
				hip_volume: profile.hip_volume || undefined,
				video_intro: profile.video_intro || undefined,
				extra_portfolio_url: profile.extra_portfolio_url || undefined,
			})
		}
	}, [profile])

	const handleChange = (
		field: keyof IActorProfileUpdate,
		value: string | number | undefined,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		const hasMessenger =
			contacts.telegram_nick.trim() || contacts.vk_nick.trim() || contacts.max_nick.trim()
		if (!hasMessenger) {
			toast.error('Укажите хотя бы один способ связи: Telegram, ВКонтакте или MAX')
			return
		}
		try {
			const payload = isAgent
				? { ...formData, phone_number: undefined, email: undefined }
				: formData
			await updateProfile.mutateAsync(payload)
			await apiCall('PATCH', 'auth/v2/me/', {
				telegram_nick: contacts.telegram_nick.trim() || null,
				vk_nick: contacts.vk_nick.trim() || null,
				max_nick: contacts.max_nick.trim() || null,
			})
			toast.success('Профиль обновлён')
			router.push(`/cabinet/profile/${profileId}`)
		} catch {
			toast.error('Ошибка при сохранении')
		}
	}

	return (
		<DataLoader
			isLoading={isLoading}
			hasError={isError}
			errorFallback={
				<Page>
					<AlertError />
				</Page>
			}
			loadingFallback={<Loader />}
		>
			<Page>
				<form className={styles.editForm} onSubmit={handleSubmit}>
					<div className={styles.header}>
						<button
							type="button"
							className={styles.backButton}
							onClick={goBack}
						>
							← Отмена
						</button>
						<h1 className={styles.title}>Редактирование</h1>
						<button
							type="submit"
							className={styles.saveButton}
							disabled={updateProfile.isPending}
						>
							{updateProfile.isPending ? '...' : 'Сохранить'}
						</button>
					</div>

					{/* Личные данные */}
					<fieldset className={styles.fieldset}>
						<legend>Личные данные</legend>

						<div className={styles.field}>
							<label>Отображаемое имя</label>
							<input
								type="text"
								value={formData.display_name || ''}
								onChange={(e) =>
									handleChange('display_name', e.target.value)
								}
								placeholder="Как вас представлять"
							/>
						</div>

						<div className={styles.row}>
							<div className={styles.field}>
								<label>Имя</label>
								<input
									type="text"
									value={formData.first_name || ''}
									onChange={(e) =>
										handleChange('first_name', e.target.value)
									}
									placeholder="Имя"
								/>
							</div>
							<div className={styles.field}>
								<label>Фамилия</label>
								<input
									type="text"
									value={formData.last_name || ''}
									onChange={(e) =>
										handleChange('last_name', e.target.value)
									}
									placeholder="Фамилия"
								/>
							</div>
						</div>

						<div className={styles.row}>
							<div className={styles.field}>
								<label>Пол</label>
								<select
									value={formData.gender || ''}
									onChange={(e) =>
										handleChange('gender', e.target.value || undefined)
									}
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
								<label>Дата рождения</label>
							<BirthDateField
								value={formData.date_of_birth}
								onChange={(value) => handleChange('date_of_birth', value)}
							/>
							</div>
						</div>

						{isAgent ? (
							<div className={styles.field}>
								<label>Контакты</label>
								<p className={styles.hintText}>
									В карточке актёра будут показаны контакты агента из вашего профиля.
								</p>
							</div>
						) : (
							<>
								<div className={styles.field}>
									<label>Телефон</label>
									<input
										type="tel"
										value={formData.phone_number ? formatPhone(formData.phone_number) : ''}
										onChange={(e) =>
											handleChange('phone_number', rawPhone(e.target.value))
										}
										placeholder="+7 (900) 123-45-67"
									/>
								</div>

								<div className={styles.field}>
									<label>Email</label>
									<input
										type="email"
										value={formData.email || ''}
										onChange={(e) =>
											handleChange('email', e.target.value)
										}
										placeholder="email@example.com"
									/>
								</div>
							</>
						)}

						<div className={styles.field}>
							<label>Приоритетные способы связи *</label>
							<p className={styles.hintText}>Укажите хотя бы один — по нему с вами свяжется кастинг-директор.</p>
						</div>

						<div className={styles.field}>
							<label>Telegram</label>
							<input
								type="text"
								value={contacts.telegram_nick}
								onChange={(e) => setContact('telegram_nick', e.target.value)}
								placeholder="@username"
							/>
						</div>

						<div className={styles.field}>
							<label>ВКонтакте</label>
							<input
								type="text"
								value={contacts.vk_nick}
								onChange={(e) => setContact('vk_nick', e.target.value)}
								placeholder="vk.com/username"
							/>
						</div>

						<div className={styles.field}>
							<label>MAX</label>
							<input
								type="text"
								value={contacts.max_nick}
								onChange={(e) => setContact('max_nick', e.target.value)}
								placeholder="Ник в MAX"
							/>
						</div>

						<div className={styles.field}>
							<label>Город</label>
							<input
								type="text"
								value={formData.city || ''}
								onChange={(e) =>
									handleChange('city', e.target.value)
								}
								placeholder="Москва"
							/>
						</div>

						<div className={styles.field}>
							<label>Статус налогоплательщика</label>
							<select
								value={formData.tax_status || ''}
								onChange={(e) =>
									handleChange('tax_status', e.target.value || undefined)
								}
							>
								<option value="">Выберите статус</option>
								{TAX_STATUS_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</div>
					</fieldset>

					{/* Профессиональные данные */}
					<fieldset className={styles.fieldset}>
						<legend>Профессиональные данные</legend>

						<div className={styles.row}>
							<div className={styles.field}>
								<label>Квалификация</label>
								<select
									value={formData.qualification || ''}
									onChange={(e) =>
										handleChange(
											'qualification',
											e.target.value || undefined,
										)
									}
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
								<label>Опыт (лет)</label>
								<input
									type="number"
									min={0}
									max={99}
									value={formData.experience ?? ''}
									onChange={(e) =>
										handleChange(
											'experience',
											e.target.value
												? Number(e.target.value)
												: undefined,
										)
									}
								/>
							</div>
						</div>

						<div className={styles.field}>
							<label>О себе</label>
							<textarea
								value={formData.about_me || ''}
								onChange={(e) =>
									handleChange('about_me', e.target.value)
								}
								placeholder="Расскажите о себе..."
								rows={4}
								maxLength={3000}
							/>
						</div>

						<div className={styles.field}>
							<label>Видеовизитка</label>
							<input
								type="url"
								value={formData.video_intro || ''}
								onChange={(e) =>
									handleChange('video_intro', e.target.value)
								}
								placeholder="Ссылка на видео: YouTube, Rutube, VK..."
							/>
						</div>

						<div className={styles.field}>
							<label>Ссылка на доп. портфолио</label>
							<input
								type="url"
								value={formData.extra_portfolio_url || ''}
								onChange={(e) =>
									handleChange('extra_portfolio_url', e.target.value)
								}
								placeholder="https://..."
							/>
						</div>
					</fieldset>

					{/* Параметры внешности */}
					<fieldset className={styles.fieldset}>
						<legend>Параметры внешности</legend>

						<div className={styles.field}>
							<label>Тип внешности</label>
							<select
								value={formData.look_type || ''}
								onChange={(e) =>
									handleChange('look_type', e.target.value || undefined)
								}
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
								<label>Цвет волос</label>
								<select
									value={formData.hair_color || ''}
									onChange={(e) =>
										handleChange(
											'hair_color',
											e.target.value || undefined,
										)
									}
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
								<label>Длина волос</label>
								<select
									value={formData.hair_length || ''}
									onChange={(e) =>
										handleChange(
											'hair_length',
											e.target.value || undefined,
										)
									}
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
								<label>Рост (см)</label>
								<input
									type="number"
									min={0}
									max={300}
									value={formData.height ?? ''}
									onChange={(e) =>
										handleChange(
											'height',
											e.target.value
												? Number(e.target.value)
												: undefined,
										)
									}
								/>
							</div>
							<div className={styles.field}>
								<label>Размер одежды</label>
								<input
									type="text"
									value={formData.clothing_size || ''}
									onChange={(e) =>
										handleChange('clothing_size', e.target.value)
									}
									placeholder="42"
								/>
							</div>
							<div className={styles.field}>
								<label>Размер обуви</label>
								<input
									type="text"
									value={formData.shoe_size || ''}
									onChange={(e) =>
										handleChange('shoe_size', e.target.value)
									}
									placeholder="40"
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
									value={formData.bust_volume ?? ''}
									onChange={(e) =>
										handleChange(
											'bust_volume',
											e.target.value
												? Number(e.target.value)
												: undefined,
										)
									}
									placeholder="см"
								/>
							</div>
							<div className={styles.field}>
								<label>Обхват талии</label>
								<input
									type="number"
									min={0}
									max={200}
									value={formData.waist_volume ?? ''}
									onChange={(e) =>
										handleChange(
											'waist_volume',
											e.target.value
												? Number(e.target.value)
												: undefined,
										)
									}
									placeholder="см"
								/>
							</div>
							<div className={styles.field}>
								<label>Обхват бёдер</label>
								<input
									type="number"
									min={0}
									max={200}
									value={formData.hip_volume ?? ''}
									onChange={(e) =>
										handleChange(
											'hip_volume',
											e.target.value
												? Number(e.target.value)
												: undefined,
										)
									}
									placeholder="см"
								/>
							</div>
						</div>
					</fieldset>

					<button
						type="submit"
						className={styles.submitButton}
						disabled={updateProfile.isPending}
					>
						{updateProfile.isPending
							? 'Сохранение...'
							: 'Сохранить изменения'}
					</button>
				</form>
			</Page>
		</DataLoader>
	)
}


