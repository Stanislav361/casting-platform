'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
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
	IconCalendar,
	IconEdit,
	IconMail,
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
	const [editingAgent, setEditingAgent] = useState(false)
	const [addProfileOpen, setAddProfileOpen] = useState(false)
	const [responsesExpanded, setResponsesExpanded] = useState(false)
	const [selectedResponseCasting, setSelectedResponseCasting] = useState<any | null>(null)
	const addProfileSectionRef = useRef<HTMLElement | null>(null)
	const responsesSectionRef = useRef<HTMLElement | null>(null)
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

	const normalizeMediaUrl = (url?: string | null) => {
		if (!url) return null
		try {
			const apiBase = new URL(API_URL, window.location.origin)
			const parsed = new URL(url, apiBase)
			if (
				(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.pathname.startsWith('/uploads/')) &&
				parsed.pathname.startsWith('/uploads/')
			) {
				return `${apiBase.origin}${parsed.pathname}${parsed.search}`
			}
			return parsed.toString()
		} catch {
			return url
		}
	}

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

	useEffect(() => {
		if (!profiles.length) {
			setAddProfileOpen(true)
		}
	}, [profiles.length])

	useEffect(() => {
		if (!loading && !isAgent && profiles.length === 1) {
			router.replace(`/cabinet/profile/${profiles[0].id}`)
		}
	}, [loading, isAgent, profiles, router])

	const createProfile = async () => {
		if (!form.first_name.trim()) return
		setCreating(true)
		const res = await api('POST', 'tma/actor-profiles/', form)
		if (res?.id) {
			setProfiles((prev) => [...prev, res])
			setAddProfileOpen(false)
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

	if (!isAgent && profiles.length === 1) return null

	const hasProfiles = profiles.length > 0

	const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
		pending: { label: 'На рассмотрении', cls: styles.statusPending, icon: <IconClock size={13} /> },
		viewed: { label: 'Просмотрено', cls: styles.statusViewed, icon: <IconEye size={13} /> },
		shortlisted: { label: 'В избранном', cls: styles.statusShortlisted, icon: <IconStar size={13} /> },
		approved: { label: 'Одобрено', cls: styles.statusApproved, icon: <IconCheck size={13} /> },
		rejected: { label: 'Отклонено', cls: styles.statusRejected, icon: <IconBan size={13} /> },
	}

	const CASTING_STATUS_RU: Record<string, string> = {
		published: 'Активный',
		closed: 'Закрыт',
		unpublished: 'Не опубликован',
	}

	const toggleAddProfile = () => {
		setAddProfileOpen((prev) => {
			const next = !prev
			if (!prev) {
				setTimeout(() => addProfileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
			}
			return next
		})
	}

	const openResponsesSection = () => {
		setResponsesExpanded(true)
		setTimeout(() => responsesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
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
			{isAgent && (
				<div className={styles.agentHero}>
					<div className={styles.agentHeroTop}>
						<div className={styles.agentAvatarWrap}>
							<div
								className={styles.agentAvatar}
								onClick={() => agentProfile.photo_url && setPreviewPhotoUrl(agentProfile.photo_url)}
							>
								{agentProfile.photo_url ? (
									<img src={agentProfile.photo_url} alt="agent" />
								) : (
									(agentProfile.first_name?.[0] || agentProfile.email?.[0] || '?').toUpperCase()
								)}
							</div>
							<label className={styles.agentAvatarUpload} title="Сменить фото">
								{uploadingPhoto ? <IconLoader size={13} /> : <IconCamera size={13} />}
								<input type="file" accept="image/*" onChange={(e) => uploadAgentPhoto(e.target.files?.[0] || null)} />
							</label>
						</div>

						<div className={styles.agentInfo}>
							<div className={styles.agentRoleBadge}>
								<IconBriefcase size={10} /> Агент
							</div>
							<div className={styles.agentName}>
								{agentProfile.first_name || agentProfile.last_name
									? `${agentProfile.first_name} ${agentProfile.last_name}`.trim()
									: 'Ваш профиль'}
							</div>
							<div className={styles.agentMeta}>
								{agentProfile.email && (
									<span className={styles.agentMetaItem}>
										<IconMail size={11} />
										<b>{agentProfile.email}</b>
									</span>
								)}
								{agentProfile.phone_number && (
									<span className={styles.agentMetaItem}>
										<IconPhone size={11} />
										<b>{formatPhone(agentProfile.phone_number)}</b>
									</span>
								)}
								<span className={styles.agentMetaItem}>
									<IconUser size={11} />
									<b>{profiles.length} {profiles.length === 1 ? 'актёр' : profiles.length < 5 ? 'актёра' : 'актёров'}</b>
								</span>
							</div>
						</div>

						{!editingAgent && (
							<button className={styles.agentEditBtn} onClick={() => setEditingAgent(true)}>
								<IconEdit size={12} /> Изменить
							</button>
						)}
					</div>

					{editingAgent && (
						<div className={styles.agentEditForm}>
							<div className={styles.agentEditField}>
								<label>Имя</label>
								<input
									value={agentProfile.first_name}
									onChange={(e) => setAgentProfile(prev => ({ ...prev, first_name: e.target.value }))}
									placeholder="Виктория"
									className={styles.agentEditInput}
								/>
							</div>
							<div className={styles.agentEditField}>
								<label>Фамилия</label>
								<input
									value={agentProfile.last_name}
									onChange={(e) => setAgentProfile(prev => ({ ...prev, last_name: e.target.value }))}
									placeholder="Лебедева"
									className={styles.agentEditInput}
								/>
							</div>
							<div className={styles.agentEditField}>
								<label>Email</label>
								<input value={agentProfile.email} readOnly className={styles.agentEditInput} />
							</div>
							<div className={styles.agentEditField}>
								<label>Телефон</label>
								<input
									type="tel"
									value={agentProfile.phone_number ? formatPhone(agentProfile.phone_number) : ''}
									onChange={(e) => setAgentProfile(prev => ({ ...prev, phone_number: rawPhone(e.target.value) }))}
									placeholder="+7 (900) 123-45-67"
									className={styles.agentEditInput}
								/>
							</div>
							<div className={styles.agentEditActions}>
								<button onClick={async () => { await saveAgentProfile(); setEditingAgent(false) }} disabled={savingAgent} className={styles.agentSaveBtn}>
									{savingAgent ? <><IconLoader size={14} /> Сохранение...</> : <><IconCheck size={14} /> Сохранить</>}
								</button>
								<button onClick={() => setEditingAgent(false)} className={styles.agentEditBtn}>
									Отмена
								</button>
							</div>
						</div>
					)}
				</div>
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
									type="tel"
									value={form.phone_number ? formatPhone(form.phone_number) : ''}
									onChange={(e) =>
										setForm({ ...form, phone_number: rawPhone(e.target.value) })
									}
									placeholder="+7 (900) 123-45-67"
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
											{(p.primary_photo || p.photo_url) ? (
												<img src={normalizeMediaUrl(p.primary_photo || p.photo_url) || ''} alt="" />
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

						{!isAgent && (
							<section className={styles.section}>
								<h2>
									<span className={styles.sectionIcon}>
										<IconSearch size={17} />
									</span>
									Быстрые действия
								</h2>
								<p className={styles.subtitle}>
									Переходите в ленту, открывайте отклики и добавляйте новые анкеты в одном месте
								</p>
								<div className={styles.actionGrid}>
									<button
										type="button"
										className={styles.actionCard}
										onClick={() => router.push('/cabinet/feed')}
									>
										<span className={styles.actionIcon}>
											<IconSearch size={18} />
										</span>
										<span className={styles.actionBody}>
											<strong>Лента кастингов</strong>
											<small>Смотрите проекты и откликайтесь</small>
										</span>
										<span className={styles.actionArrow}>
											<IconChevronRight size={18} />
										</span>
									</button>

									<button
										type="button"
										className={styles.actionCard}
										onClick={openResponsesSection}
									>
										<span className={styles.actionIcon}>
											<IconZap size={18} />
										</span>
										<span className={styles.actionBody}>
											<strong>Мои отклики</strong>
											<small>{myResponses.length > 0 ? `У вас ${myResponses.length} откликов` : 'Проверяйте статус своих заявок'}</small>
										</span>
										<span className={styles.actionBadge}>{myResponses.length}</span>
									</button>

									<button
										type="button"
										className={`${styles.actionCard} ${styles.actionCardAccent}`}
										onClick={toggleAddProfile}
									>
										<span className={styles.actionIcon}>
											<IconPlus size={18} />
										</span>
										<span className={styles.actionBody}>
											<strong>{addProfileOpen ? 'Скрыть форму' : 'Добавить анкету'}</strong>
											<small>Создайте еще один профиль для другого амплуа</small>
										</span>
										<span className={styles.actionArrow}>
											<IconChevronRight size={18} />
										</span>
									</button>
								</div>
							</section>
						)}

						{addProfileOpen && (
							<section className={styles.section} ref={addProfileSectionRef}>
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
						)}
					</>
				)}

				{!isAgent && hasProfiles && (
					<section className={styles.section} ref={responsesSectionRef}>
						<button
							type="button"
							className={styles.sectionToggle}
							onClick={() => setResponsesExpanded((prev) => !prev)}
						>
							<span className={styles.sectionToggleLeft}>
								<span className={styles.sectionIcon}>
									<IconZap size={17} />
								</span>
								<span>
									<b>Мои отклики ({myResponses.length})</b>
									<small>Показывать список откликов по нажатию</small>
								</span>
							</span>
							<span className={`${styles.sectionToggleChevron} ${responsesExpanded ? styles.sectionToggleChevronOpen : ''}`}>
								<IconChevronRight size={16} />
							</span>
						</button>

						{responsesExpanded && (
							myResponses.length > 0 ? (
								<div className={styles.responseList}>
									{myResponses.map((r: any) => {
										const st = STATUS_MAP[r.response_status] || STATUS_MAP.pending
										return (
											<button
												key={r.id}
												type="button"
												className={styles.responseCard}
												onClick={() => setSelectedResponseCasting(r)}
											>
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
											</button>
										)
									})}
								</div>
							) : (
								<p className={styles.emptyResponses}>
									Вы ещё не откликались на кастинги. Откликнитесь в ленте проектов, и здесь появится статус ваших заявок.
								</p>
							)
						)}
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
			{selectedResponseCasting && (
				<div className={styles.castingModalOverlay} onClick={() => setSelectedResponseCasting(null)}>
					<div className={styles.castingModalCard} onClick={(e) => e.stopPropagation()}>
						<button className={styles.castingModalClose} onClick={() => setSelectedResponseCasting(null)}>
							<IconX size={16} />
						</button>
						<div className={styles.castingModalMedia}>
							{selectedResponseCasting.image_url ? (
								<img
									src={normalizeMediaUrl(selectedResponseCasting.image_url) || ''}
									alt={selectedResponseCasting.casting_title}
									className={styles.castingModalImg}
								/>
							) : (
								<div className={styles.castingModalPlaceholder}>
									<IconFilm size={32} />
								</div>
							)}
						</div>
						<div className={styles.castingModalBody}>
							<div className={styles.castingModalHead}>
								<h3 className={styles.castingModalTitle}>{selectedResponseCasting.casting_title}</h3>
								<span className={styles.castingModalStatus}>
									{CASTING_STATUS_RU[selectedResponseCasting.casting_status] || selectedResponseCasting.casting_status}
								</span>
							</div>
							<div className={styles.castingModalMeta}>
								<span className={styles.castingModalMetaItem}>
									<IconCalendar size={12} />
									Создан
									<b>
										{selectedResponseCasting.casting_created_at
											? new Date(selectedResponseCasting.casting_created_at).toLocaleDateString('ru-RU', {
												day: 'numeric',
												month: 'short',
												year: 'numeric',
											})
											: '—'}
									</b>
								</span>
								<span className={styles.castingModalMetaItem}>
									<IconClock size={12} />
									Отклик
									<b>
										{selectedResponseCasting.responded_at
											? new Date(selectedResponseCasting.responded_at).toLocaleDateString('ru-RU', {
												day: 'numeric',
												month: 'short',
												year: 'numeric',
											})
											: '—'}
									</b>
								</span>
							</div>
							{selectedResponseCasting.casting_description ? (
								<p className={styles.castingModalDesc}>{selectedResponseCasting.casting_description}</p>
							) : (
								<p className={styles.castingModalDescEmpty}>Описание кастинга пока не добавлено.</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
