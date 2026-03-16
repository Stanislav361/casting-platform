'use client'

import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import {
	IconArrowLeft,
	IconPlus,
	IconLoader,
	IconMask,
} from '~packages/ui/icons'

import styles from './page.module.scss'

export default function CreateProfilePage() {
	const router = useRouter()

	const [form, setForm] = useState({
		first_name: '',
		last_name: '',
		display_name: '',
		gender: '',
		city: '',
	})
	const [creating, setCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			if (!form.first_name.trim()) {
				setError('Укажите имя')
				return
			}
			setCreating(true)
			setError(null)
			try {
				const res = await apiCall('POST', 'tma/actor-profiles/', {
					first_name: form.first_name,
					last_name: form.last_name || undefined,
					display_name: form.display_name || undefined,
					gender: form.gender || undefined,
					city: form.city || undefined,
				})
				if (res?.id) {
					router.push(`/cabinet/profile/${res.id}`)
				} else {
					setError('Ошибка при создании профиля')
				}
			} catch {
				setError('Ошибка подключения к серверу')
			}
			setCreating(false)
		},
		[form, router],
	)

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button
					type="button"
					className={styles.backButton}
					onClick={() => router.back()}
				>
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
					Создайте новый профиль актёра. Вы сможете добавить фото, видео и
					заполнить параметры позже.
				</p>

				{error && <div className={styles.error}>{error}</div>}

				<div className={styles.fields}>
					<div className={styles.field}>
						<label>Отображаемое имя</label>
						<input
							type="text"
							value={form.display_name}
							onChange={(e) =>
								setForm({ ...form, display_name: e.target.value })
							}
							placeholder="Как вас будут представлять (необязательно)"
							className={styles.input}
						/>
					</div>

					<div className={styles.row}>
						<div className={styles.field}>
							<label>
								Имя <span className={styles.required}>*</span>
							</label>
							<input
								type="text"
								value={form.first_name}
								onChange={(e) =>
									setForm({ ...form, first_name: e.target.value })
								}
								placeholder="Имя"
								className={styles.input}
								required
							/>
						</div>
						<div className={styles.field}>
							<label>Фамилия</label>
							<input
								type="text"
								value={form.last_name}
								onChange={(e) =>
									setForm({ ...form, last_name: e.target.value })
								}
								placeholder="Фамилия"
								className={styles.input}
							/>
						</div>
					</div>

					<div className={styles.field}>
						<label>Пол</label>
						<select
							value={form.gender}
							onChange={(e) =>
								setForm({ ...form, gender: e.target.value })
							}
							className={styles.input}
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
							value={form.city}
							onChange={(e) => setForm({ ...form, city: e.target.value })}
							placeholder="Москва"
							className={styles.input}
						/>
					</div>
				</div>

				<button
					type="submit"
					className={styles.submitButton}
					disabled={creating}
				>
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
