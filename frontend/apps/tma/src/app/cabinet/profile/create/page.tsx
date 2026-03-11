'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { useCreateProfile, IActorProfileCreate } from '~models/actor-profile'
import Page from '~widgets/page'

import styles from './page.module.scss'

export default function CreateProfilePage() {
	const router = useRouter()
	const createProfile = useCreateProfile()

	const [formData, setFormData] = useState<IActorProfileCreate>({
		display_name: '',
		first_name: '',
		last_name: '',
	})

	const handleChange = (
		field: keyof IActorProfileCreate,
		value: string | number | undefined,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }))
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!formData.first_name?.trim()) {
			toast.error('Укажите имя')
			return
		}

		try {
			const response = await createProfile.mutateAsync(formData)
			toast.success('Профиль создан!')
			router.push(`/cabinet/profile/${response.data.id}`)
		} catch {
			toast.error('Ошибка при создании профиля')
		}
	}

	return (
		<Page>
			<form className={styles.createForm} onSubmit={handleSubmit}>
				<div className={styles.header}>
					<button
						type="button"
						className={styles.backButton}
						onClick={() => router.back()}
					>
						← Отмена
					</button>
					<h1 className={styles.title}>Новый профиль</h1>
				</div>

				<p className={styles.description}>
					Создайте новый профиль актёра. Вы сможете добавить фото, видео и
					заполнить параметры позже.
				</p>

				<div className={styles.fields}>
					<div className={styles.field}>
						<label>Отображаемое имя</label>
						<input
							type="text"
							value={formData.display_name || ''}
							onChange={(e) =>
								handleChange('display_name', e.target.value)
							}
							placeholder="Как вас будут представлять (необязательно)"
						/>
					</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>
								Имя <span className={styles.required}>*</span>
							</label>
							<input
								type="text"
								value={formData.first_name || ''}
								onChange={(e) =>
									handleChange('first_name', e.target.value)
								}
								placeholder="Имя"
								required
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

					<div className={styles.field}>
						<label>Пол</label>
						<select
							value={formData.gender || ''}
							onChange={(e) =>
								handleChange('gender', e.target.value || undefined)
							}
						>
							<option value="">Не указан</option>
							<option value="male">Мужской</option>
							<option value="female">Женский</option>
						</select>
					</div>

					<div className={styles.field}>
						<label>Город</label>
						<input
							type="text"
							value={formData.city || ''}
							onChange={(e) => handleChange('city', e.target.value)}
							placeholder="Москва"
						/>
					</div>
				</div>

				<button
					type="submit"
					className={styles.submitButton}
					disabled={createProfile.isPending}
				>
					{createProfile.isPending
						? 'Создание...'
						: 'Создать профиль'}
				</button>
			</form>
		</Page>
	)
}


