'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import {
	IconFilm,
	IconBriefcase,
	IconMask,
	IconLogOut,
	IconPlus,
	IconCamera,
	IconChevronRight,
	IconUser,
	IconPhone,
	IconLoader,
	IconX,
	IconZap,
	IconClock,
	IconCheck,
	IconEye,
	IconStar,
	IconBan,
	IconSearch,
} from '~packages/ui/icons'
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
	const [myResponses, setMyResponses] = useState<any[]>([])
	const [loadingResponses, setLoadingResponses] = useState(false)
	const [loading, setLoading] = useState(true)
	const [creating, setCreating] = useState(false)
	const [savingAgent, setSavingAgent] = useState(false)
	const [uploadingPhoto, setUploadingPhoto] = useState(false)
	const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)
	const [form, setForm] = useState({
		first_name: '',
		last_name: '',
		gender: 'male',
		city: '',
		phone_number: '',
		about_me: '',
	})

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
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
			api('GET', 'feed/my-responses/').catch(() => ({ responses: [] })),
		]).then(([profilesData, me, responsesData]) => {
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
			setMyResponses(responsesData?.responses || [])
			setLoading(false)
		})
	}, [token, api])

	const createProfile = async () => {
		if (!form.first_name.trim()) return
		setCreating(true)
		const res = await api('POST', 'tma/actor-profiles/', form)
		if (res?.id) {
			setProfiles((prev) => [...prev, res])
			setForm({
				first_name: '',
				last_name: '',
				gender: 'male',
				city: '',
				phone_number: '',
				about_me: '',
			})
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
			setAgentProfile((prev) => ({
				...prev,
				first_name: res.first_name || '',
				last_name: res.last_name || '',
				phone_number: res.phone_number || '',
				email: res.email || prev.email,
				photo_url: res.photo_url || prev.photo_url,
			}))
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
				setAgentProfile((prev) => ({
					...prev,
					photo_url: data.photo_url || prev.photo_url,
				}))
			}
		} catch {}
		setUploadingPhoto(false)
	}

	const handleLogout = () => {
		const { logout } = require('@prostoprobuy/models')
		logout()
		router.replace('/login')
	}

	if (loading)
		return (
			<div className={styles.root}>
				<p className={styles.center}>
					<IconLoader size={20} style={{ marginRight: 8 }} />
					Загрузка...
				</p>
			</div>
		)

	const hasProfiles = profiles.length > 0

	const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
		pending: { label: 'На рассмотрении', cls: styles.statusPending, icon: <IconClock size={13} /> },
		viewed: { label: 'Просмотрено', cls: styles.statusViewed, icon: <IconEye size={13} /> },
		shortlisted: { label: 'В шорт-листе', cls: styles.statusShortlisted, icon: <IconStar size={13} /> },
		approved: { label: 'Одобрено', cls: styles.statusApproved, icon: <IconCheck size={13} /> },
		rejected: { label: 'Отклонено', cls: styles.statusRejected, icon: <IconBan size={13} /> },
	}

	const CASTING_STATUS_RU: Record<string, string> = {
		published: 'Активный',
		closed: 'Закрыт',
		unpublished: 'Не опубликован',
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<div className={styles.brand}>
					<div className={styles.brandIcon}>
						<IconFilm size={18} />
					</div>
					<h1>
						{isAgent ? (
							<>
								Агент<span>ский кабинет</span>
							</>
						) : (
							<>
								Кабинет<span> актёра</span>
							</>
						)}
					</h1>
				</div>
				<div className={styles.headerRight}>
					<button onClick={handleLogout} className={styles.logoutBtn}>
						<IconLogOut size={15} />
						Выход
					</button>
				</div>
			</header>

			<div className={styles.content}>
				{!isAgent && hasProfiles && (
					<button
						className={styles.feedBanner}
						onClick={() => router.push('/cabinet/feed')}
					>
						<div className={styles.feedBannerIcon}>
							<IconSearch size={18} />
						</div>
						<div className={styles.feedBannerText}>
							<strong>Лента кастингов</strong>
							<span>Смотрите доступные проекты и откликайтесь</span>
						</div>
						<IconChevronRight size={18} />
					</button>
				)}

				{isAgent && (
					<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}>
								<IconBriefcase size={17} />
							</span>
							Профиль агента
						</h2>
						<p className={styles.subtitle}>Ваши данные как представителя актёров</p>
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
										<IconUser size={24} />
									)}
								</div>
								<label className={styles.uploadBtn}>
									{uploadingPhoto ? (
										<>
											<IconLoader size={14} /> Загрузка...
										</>
									) : (
										<>
											<IconCamera size={14} /> Загрузить фото
										</>
									)}
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
										onChange={(e) =>
											setAgentProfile((prev) => ({
												...prev,
												first_name: e.target.value,
											}))
										}
										placeholder="Иван"
										className={styles.input}
									/>
								</div>
								<div className={styles.field}>
									<label>Фамилия</label>
									<input
										value={agentProfile.last_name}
										onChange={(e) =>
											setAgentProfile((prev) => ({
												...prev,
												last_name: e.target.value,
											}))
										}
										placeholder="Иванов"
										className={styles.input}
									/>
								</div>
							</div>
							<div className={styles.field}>
								<label>Email (логин)</label>
								<input
									value={agentProfile.email}
									readOnly
									className={styles.inputReadonly}
								/>
							</div>
							<div className={styles.field}>
								<label>Телефон</label>
								<input
									value={agentProfile.phone_number}
									onChange={(e) =>
										setAgentProfile((prev) => ({
											...prev,
											phone_number: e.target.value,
										}))
									}
									placeholder="+7 999 123 45 67"
									className={styles.input}
								/>
							</div>
							<button
								onClick={saveAgentProfile}
								disabled={savingAgent}
								className={styles.btnSecondary}
							>
								{savingAgent ? (
									<>
										<IconLoader size={16} /> Сохранение...
									</>
								) : (
									'Сохранить профиль агента'
								)}
							</button>
						</div>
					</section>
				)}

				{!hasProfiles && (
					<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}>
								<IconMask size={17} />
							</span>
							{isAgent ? 'Добавьте первого актёра' : 'Создайте вашу анкету'}
						</h2>
						<p className={styles.subtitle}>
							{isAgent
								? 'Заполните данные актёра, которого ведёте как агент'
								: 'Заполните данные, чтобы откликаться на кастинги'}
						</p>
						<div className={styles.form}>
							<div className={styles.row}>
								<div className={styles.field}>
									<label>Имя *</label>
									<input
										value={form.first_name}
										onChange={(e) =>
											setForm({ ...form, first_name: e.target.value })
										}
										placeholder="Иван"
										className={styles.input}
									/>
								</div>
								<div className={styles.field}>
									<label>Фамилия</label>
									<input
										value={form.last_name}
										onChange={(e) =>
											setForm({ ...form, last_name: e.target.value })
										}
										placeholder="Иванов"
										className={styles.input}
									/>
								</div>
							</div>
							<div className={styles.row}>
								<div className={styles.field}>
									<label>Пол</label>
									<select
										value={form.gender}
										onChange={(e) => setForm({ ...form, gender: e.target.value })}
										className={styles.input}
									>
										<option value="male">Мужской</option>
										<option value="female">Женский</option>
									</select>
								</div>
								<div className={styles.field}>
									<label>Город</label>
									<input
										value={form.city}
										onChange={(e) => setForm({ ...form, city: e.target.value })}
										placeholder="Москва"
										className={styles.input}
									/>
								</div>
							</div>
							<div className={styles.field}>
								<label>Телефон</label>
								<input
									value={form.phone_number}
									onChange={(e) =>
										setForm({ ...form, phone_number: e.target.value })
									}
									placeholder="+7 999 123 45 67"
									className={styles.input}
								/>
							</div>
							<div className={styles.field}>
								<label>О себе</label>
								<textarea
									value={form.about_me}
									onChange={(e) => setForm({ ...form, about_me: e.target.value })}
									placeholder="Расскажите о своём опыте, навыках..."
									className={styles.textarea}
									rows={3}
								/>
							</div>
							<button
								onClick={createProfile}
								disabled={creating || !form.first_name.trim()}
								className={styles.btnPrimary}
							>
								{creating ? (
									<>
										<IconLoader size={16} /> Создание...
									</>
								) : (
									<>
										<IconPlus size={16} /> Создать анкету
									</>
								)}
							</button>
						</div>
					</section>
				)}

				{hasProfiles && (
					<>
						<section className={styles.section}>
							<h2>
								<span className={styles.sectionIcon}>
									<IconMask size={17} />
								</span>
								{isAgent
									? `Мои актёры (${profiles.length})`
									: `Мои анкеты (${profiles.length})`}
							</h2>
							<div className={styles.profileList}>
								{profiles.map((p: any) => (
									<div
										key={p.id}
										className={styles.profileCard}
										onClick={() => router.push(`/cabinet/profile/${p.id}`)}
									>
										<div className={styles.avatar}>
											{p.photo_url ? (
												<img src={p.photo_url} alt="" />
											) : (
												(p.first_name?.[0] || '?').toUpperCase()
											)}
										</div>
										<div className={styles.profileInfo}>
											<h3>
												{p.first_name} {p.last_name}
											</h3>
											<p>
												{p.city || 'Город не указан'} ·{' '}
												{p.gender === 'male' ? 'Муж' : 'Жен'}
											</p>
										</div>
										<span className={styles.arrow}>
											<IconChevronRight size={18} />
										</span>
									</div>
								))}
							</div>
						</section>

						<section className={styles.section}>
							<h2>
								<span className={styles.sectionIcon}>
									<IconPlus size={17} />
								</span>
								{isAgent ? 'Добавить ещё актёра' : 'Добавить ещё анкету'}
							</h2>
							<p className={styles.subtitle}>
								{isAgent
									? 'Вы можете вести несколько актёров в одном кабинете'
									: 'Создайте несколько профилей для разных амплуа'}
							</p>
							<div className={styles.form}>
								<div className={styles.row}>
									<div className={styles.field}>
										<label>Имя *</label>
										<input
											value={form.first_name}
											onChange={(e) =>
												setForm({ ...form, first_name: e.target.value })
											}
											placeholder="Мария"
											className={styles.input}
										/>
									</div>
									<div className={styles.field}>
										<label>Фамилия</label>
										<input
											value={form.last_name}
											onChange={(e) =>
												setForm({ ...form, last_name: e.target.value })
											}
											placeholder="Петрова"
											className={styles.input}
										/>
									</div>
								</div>
								<div className={styles.row}>
									<div className={styles.field}>
										<label>Пол</label>
										<select
											value={form.gender}
											onChange={(e) =>
												setForm({ ...form, gender: e.target.value })
											}
											className={styles.input}
										>
											<option value="male">Мужской</option>
											<option value="female">Женский</option>
										</select>
									</div>
									<div className={styles.field}>
										<label>Город</label>
										<input
											value={form.city}
											onChange={(e) => setForm({ ...form, city: e.target.value })}
											placeholder="СПб"
											className={styles.input}
										/>
									</div>
								</div>
								<button
									onClick={createProfile}
									disabled={creating || !form.first_name.trim()}
									className={styles.addProfileBtn}
								>
									{creating ? (
										<IconLoader size={15} />
									) : (
										<IconPlus size={15} />
									)}
									{creating ? 'Добавление...' : 'Добавить профиль'}
								</button>
							</div>
						</section>
					</>
				)}

				{!isAgent && myResponses.length > 0 && (
					<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}>
								<IconZap size={17} />
							</span>
							Мои отклики ({myResponses.length})
						</h2>
						<p className={styles.subtitle}>
							Статус ваших заявок на кастинги
						</p>
						<div className={styles.responseList}>
							{myResponses.map((r: any) => {
								const st = STATUS_MAP[r.response_status] || STATUS_MAP.pending
								return (
									<div key={r.id} className={styles.responseCard}>
										<div className={styles.responseHeader}>
											<h4 className={styles.responseTitle}>{r.casting_title}</h4>
											<span className={`${styles.statusBadge} ${st.cls}`}>
												{st.icon}
												{st.label}
											</span>
										</div>
										{r.casting_description && (
											<p className={styles.responseDesc}>
												{r.casting_description.length > 100
													? r.casting_description.slice(0, 100) + '…'
													: r.casting_description}
											</p>
										)}
										<div className={styles.responseMeta}>
											<span className={styles.responseMetaItem}>
												<IconClock size={12} />
												{new Date(r.responded_at).toLocaleDateString('ru-RU', {
													day: 'numeric',
													month: 'short',
													year: 'numeric',
												})}
											</span>
											<span className={styles.responseMetaItem}>
												<IconFilm size={12} />
												{CASTING_STATUS_RU[r.casting_status] || r.casting_status}
											</span>
										</div>
									</div>
								)
							})}
						</div>
					</section>
				)}

				{!isAgent && myResponses.length === 0 && hasProfiles && (
					<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}>
								<IconZap size={17} />
							</span>
							Мои отклики
						</h2>
						<p className={styles.emptyResponses}>
							Вы ещё не откликались на кастинги. Откликнитесь в ленте проектов, и здесь появится статус ваших заявок.
						</p>
					</section>
				)}
			</div>

			{previewPhotoUrl && (
				<div
					className={styles.previewOverlay}
					onClick={() => setPreviewPhotoUrl(null)}
				>
					<div
						className={styles.previewContent}
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className={styles.previewClose}
							onClick={() => setPreviewPhotoUrl(null)}
						>
							<IconX size={14} />
						</button>
						<img
							src={previewPhotoUrl}
							alt="agent preview"
							className={styles.previewImage}
						/>
					</div>
				</div>
			)}
		</div>
	)
}
