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

const LOOK_TYPE_OPTIONS = [
	{ value: 'european', label: 'Европейский' },
	{ value: 'asian', label: 'Азиатский' },
	{ value: 'slavic', label: 'Славянский' },
	{ value: 'african', label: 'Африканский' },
	{ value: 'latino', label: 'Латиноамериканский' },
	{ value: 'middle_eastern', label: 'Ближневосточный' },
	{ value: 'caucasian', label: 'Кавказский' },
	{ value: 'south_asian', label: 'Южноазиатский' },
	{ value: 'mixed', label: 'Смешанный' },
	{ value: 'other', label: 'Другой' },
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

export default function ProfileEditPage() {
	const params = useParams()
	const router = useRouter()
	const profileId = Number(params.id)

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const updateProfile = useUpdateProfile(profileId)

	const [formData, setFormData] = useState<IActorProfileUpdate>({})

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
		try {
			await updateProfile.mutateAsync(formData)
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
							onClick={() => router.back()}
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
								<input
									type="date"
									value={formData.date_of_birth || ''}
									onChange={(e) =>
										handleChange('date_of_birth', e.target.value)
									}
								/>
							</div>
						</div>

						<div className={styles.field}>
							<label>Телефон</label>
							<input
								type="tel"
								value={formData.phone_number || ''}
								onChange={(e) =>
									handleChange('phone_number', e.target.value)
								}
								placeholder="+79001234567"
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
							<label>Ссылка на видео-визитку</label>
							<input
								type="url"
								value={formData.video_intro || ''}
								onChange={(e) =>
									handleChange('video_intro', e.target.value)
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


