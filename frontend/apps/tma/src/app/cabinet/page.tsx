'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import styles from './page.module.scss'

export default function CabinetPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [isAgent, setIsAgent] = useState(false)
	const [profiles, setProfiles] = useState<any[]>([])
	const [agentProfile, setAgentProfile] = useState({
		first_name: '',
		last_name: '',
		email: '',
		phone_number: '',
		photo_url: '',
	})
	const [loading, setLoading] = useState(true)
	const [creating, setCreating] = useState(false)
	const [savingAgent, setSavingAgent] = useState(false)
	const [uploadingPhoto, setUploadingPhoto] = useState(false)
	const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)
	const [form, setForm] = useState({
		first_name: '', last_name: '', gender: 'male', city: '',
		phone_number: '', about_me: '',
	})

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) { router.replace('/login'); return }
		setToken(session.access_token)
		try {
			const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
			setIsAgent(payload?.role === 'agent')
		} catch {}
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		return apiCall(method, path, body)
	}, [])

	useEffect(() => {
		if (!token) return
		Promise.all([
			api('GET', 'tma/actor-profiles/my/').catch(() => ({ profiles: [] })),
			api('GET', 'auth/v2/me/').catch(() => null),
		]).then(([profilesData, me]) => {
			setProfiles(profilesData?.profiles || [])
			if (me) {
				setAgentProfile({
					first_name: me.first_name || '',
					last_name: me.last_name || '',
					email: me.email || '',
					phone_number: me.phone_number || '',
					photo_url: me.photo_url || '',
				})
			}
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

	const saveAgentProfile = async () => {
		setSavingAgent(true)
		const res = await api('PATCH', 'auth/v2/me/', {
			first_name: agentProfile.first_name || null,
			last_name: agentProfile.last_name || null,
			phone_number: agentProfile.phone_number || null,
		})
		if (res?.id) {
			setAgentProfile(prev => ({
				...prev,
				first_name: res.first_name || '',
				last_name: res.last_name || '',
				phone_number: res.phone_number || '',
				email: res.email || prev.email,
				photo_url: res.photo_url || prev.photo_url,
			}))
			alert('Профиль агента сохранен')
		} else {
			alert(res?.detail || 'Не удалось сохранить профиль агента')
		}
		setSavingAgent(false)
	}

	const uploadAgentPhoto = async (file?: File | null) => {
		if (!file || !token) return
		setUploadingPhoto(true)
		try {
			const formData = new FormData()
			formData.append('file', file)
			const res = await fetch(`${API_URL}auth/v2/me/photo/`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			})
			const data = await res.json()
			if (data?.id) {
				setAgentProfile(prev => ({
					...prev,
					photo_url: data.photo_url || prev.photo_url,
				}))
				alert('Фото агента загружено')
			} else {
				alert(data?.detail || 'Не удалось загрузить фото')
			}
		} catch {
			alert('Ошибка загрузки фото')
		}
		setUploadingPhoto(false)
	}

	if (loading) return (
		<div className={styles.root}><p className={styles.center}>Загрузка...</p></div>
	)

	const hasProfiles = profiles.length > 0

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<h1>{isAgent ? '🧑‍💼 Кабинет агента' : '🎭 Кабинет актёра'}</h1>
				<button onClick={() => { const { logout } = require('@prostoprobuy/models'); logout(); router.replace('/login') }} className={styles.logoutBtn}>Выход</button>
			</header>

			<div className={styles.content}>
				{isAgent && (
					<section className={styles.section}>
						<h2>Профиль агента</h2>
						<p className={styles.subtitle}>Ваши данные как представителя актеров</p>
						<div className={styles.form}>
							<div className={styles.agentPhotoRow}>
								<div className={styles.agentAvatar}>
									{agentProfile.photo_url ? (
										<img
											src={agentProfile.photo_url}
											alt="agent avatar"
											onClick={() => setPreviewPhotoUrl(agentProfile.photo_url)}
											style={{ cursor: 'zoom-in' }}
										/>
									) : (
										<span>{(agentProfile.first_name?.[0] || 'A').toUpperCase()}</span>
									)}
								</div>
								<label className={styles.uploadBtn}>
									{uploadingPhoto ? 'Загрузка...' : 'Загрузить фото'}
									<input
										type="file"
										accept="image/*"
										style={{ display: 'none' }}
										onChange={(e) => uploadAgentPhoto(e.target.files?.[0] || null)}
									/>
								</label>
							</div>
							<div className={styles.row}>
								<div className={styles.field}>
									<label>Имя</label>
									<input
										value={agentProfile.first_name}
										onChange={e => setAgentProfile(prev => ({ ...prev, first_name: e.target.value }))}
										placeholder="Имя агента"
										className={styles.input}
									/>
								</div>
								<div className={styles.field}>
									<label>Фамилия</label>
									<input
										value={agentProfile.last_name}
										onChange={e => setAgentProfile(prev => ({ ...prev, last_name: e.target.value }))}
										placeholder="Фамилия агента"
										className={styles.input}
									/>
								</div>
							</div>
							<div className={styles.field}>
								<label>Email (логин)</label>
								<input value={agentProfile.email} readOnly className={styles.inputReadonly} />
							</div>
							<div className={styles.field}>
								<label>Телефон</label>
								<input
									value={agentProfile.phone_number}
									onChange={e => setAgentProfile(prev => ({ ...prev, phone_number: e.target.value }))}
									placeholder="+7 999 123 45 67"
									className={styles.input}
								/>
							</div>
							<button onClick={saveAgentProfile} disabled={savingAgent} className={styles.btnSecondary}>
								{savingAgent ? 'Сохранение...' : 'Сохранить профиль агента'}
							</button>
						</div>
					</section>
				)}

				{/* Если нет профилей — форма создания первой анкеты */}
				{!hasProfiles && (
					<section className={styles.section}>
						<h2>{isAgent ? 'Добавьте первого актёра' : 'Создайте вашу анкету'}</h2>
						<p className={styles.subtitle}>
							{isAgent ? 'Заполните данные актёра, которого ведёте как агент' : 'Заполните данные, чтобы откликаться на кастинги'}
						</p>
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
							<h2>{isAgent ? `Мои актёры (${profiles.length})` : `Мои анкеты (${profiles.length})`}</h2>
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
							<h2>{isAgent ? 'Добавить ещё актёра' : 'Добавить ещё анкету'}</h2>
							<p className={styles.subtitle}>
								{isAgent ? 'Вы можете вести несколько актёров в одном кабинете агента' : 'Вы можете создать несколько профилей (например, для разных амплуа)'}
							</p>
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

			{previewPhotoUrl && (
				<div className={styles.previewOverlay} onClick={() => setPreviewPhotoUrl(null)}>
					<div className={styles.previewContent} onClick={(e) => e.stopPropagation()}>
						<button className={styles.previewClose} onClick={() => setPreviewPhotoUrl(null)}>✕</button>
						<img src={previewPhotoUrl} alt="agent preview" className={styles.previewImage} />
					</div>
				</div>
			)}
		</div>
	)
}
