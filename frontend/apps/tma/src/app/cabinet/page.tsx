'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from './page.module.scss'

export default function CabinetPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [profiles, setProfiles] = useState<any[]>([])
	const [loading, setLoading] = useState(true)
	const [creating, setCreating] = useState(false)
	const [form, setForm] = useState({
		first_name: '', last_name: '', gender: 'male', city: '',
		phone_number: '', about_me: '',
	})

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) { router.replace('/login'); return }
		setToken(session.access_token)
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		if (!token) return null
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: body ? JSON.stringify(body) : undefined,
		})
		return res.json().catch(() => null)
	}, [token])

	useEffect(() => {
		if (!token) return
		api('GET', 'tma/actor-profiles/my/').then(data => {
			setProfiles(data?.profiles || [])
			setLoading(false)
		})
	}, [token, api])

	const createProfile = async () => {
		if (!form.first_name.trim()) return
		setCreating(true)
		const res = await api('POST', 'tma/actor-profiles/', form)
		if (res?.id) {
			setProfiles(prev => [...prev, res])
			setForm({ first_name: '', last_name: '', gender: 'male', city: '', phone_number: '', about_me: '' })
		}
		setCreating(false)
	}

	if (loading) return (
		<div className={styles.root}><p className={styles.center}>Загрузка...</p></div>
	)

	const hasProfiles = profiles.length > 0

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<h1>🎭 Кабинет актёра</h1>
				<button onClick={() => { const { logout } = require('@prostoprobuy/models'); logout(); router.replace('/login') }} className={styles.logoutBtn}>Выход</button>
			</header>

			<div className={styles.content}>
				{/* Если нет профилей — форма создания первой анкеты */}
				{!hasProfiles && (
					<section className={styles.section}>
						<h2>Создайте вашу анкету</h2>
						<p className={styles.subtitle}>Заполните данные, чтобы откликаться на кастинги</p>
						<div className={styles.form}>
							<div className={styles.row}>
								<div className={styles.field}>
									<label>Имя *</label>
									<input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} placeholder="Иван" className={styles.input} />
								</div>
								<div className={styles.field}>
									<label>Фамилия</label>
									<input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} placeholder="Иванов" className={styles.input} />
								</div>
							</div>
							<div className={styles.row}>
								<div className={styles.field}>
									<label>Пол</label>
									<select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className={styles.input}>
										<option value="male">Мужской</option>
										<option value="female">Женский</option>
									</select>
								</div>
								<div className={styles.field}>
									<label>Город</label>
									<input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Москва" className={styles.input} />
								</div>
							</div>
							<div className={styles.field}>
								<label>Телефон</label>
								<input value={form.phone_number} onChange={e => setForm({...form, phone_number: e.target.value})} placeholder="+7 999 123 45 67" className={styles.input} />
							</div>
							<div className={styles.field}>
								<label>О себе</label>
								<textarea value={form.about_me} onChange={e => setForm({...form, about_me: e.target.value})} placeholder="Расскажите о своём опыте, навыках..." className={styles.textarea} rows={3} />
							</div>
							<button onClick={createProfile} disabled={creating || !form.first_name.trim()} className={styles.btnPrimary}>
								{creating ? 'Создание...' : '✨ Создать анкету'}
							</button>
						</div>
					</section>
				)}

				{/* Список профилей */}
				{hasProfiles && (
					<>
						<section className={styles.section}>
							<h2>Мои анкеты ({profiles.length})</h2>
							<div className={styles.profileList}>
								{profiles.map((p: any) => (
									<div key={p.id} className={styles.profileCard} onClick={() => router.push(`/cabinet/profile/${p.id}`)}>
										<div className={styles.avatar}>
											{(p.first_name?.[0] || '?').toUpperCase()}
										</div>
										<div className={styles.profileInfo}>
											<h3>{p.first_name} {p.last_name}</h3>
											<p>{p.city || 'Город не указан'} · {p.gender === 'male' ? 'М' : 'Ж'}</p>
										</div>
										<span className={styles.arrow}>→</span>
									</div>
								))}
							</div>
						</section>

						{/* Кнопка добавить ещё профиль */}
						<section className={styles.section}>
							<h2>Добавить ещё анкету</h2>
							<p className={styles.subtitle}>Вы можете создать несколько профилей (например, для разных амплуа)</p>
							<div className={styles.form}>
								<div className={styles.row}>
									<div className={styles.field}>
										<label>Имя *</label>
										<input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} placeholder="Мария" className={styles.input} />
									</div>
									<div className={styles.field}>
										<label>Фамилия</label>
										<input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} placeholder="Петрова" className={styles.input} />
									</div>
								</div>
								<div className={styles.row}>
									<div className={styles.field}>
										<label>Пол</label>
										<select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className={styles.input}>
											<option value="male">Мужской</option>
											<option value="female">Женский</option>
										</select>
									</div>
									<div className={styles.field}>
										<label>Город</label>
										<input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="СПб" className={styles.input} />
									</div>
								</div>
								<button onClick={createProfile} disabled={creating || !form.first_name.trim()} className={styles.btnSecondary}>
									{creating ? '...' : '+ Добавить профиль'}
								</button>
							</div>
						</section>
					</>
				)}
			</div>
		</div>
	)
}
