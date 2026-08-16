'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { apiCall, ensureAccessToken } from '~/shared/api-client'
import { useSmartBack } from '~/shared/smart-back'
import { API_URL } from '~/shared/api-url'
import { normalizeMediaUrl } from '~/shared/media-url'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
import { ActorMetaLine } from '~/shared/actor-meta-line'
import { hasAnyMessenger, normalizeMessengers } from '~/shared/contacts'
import { ACCEPTED_PHOTO_TYPES, optimizePhotoForUpload } from '~/shared/photo-upload'
import {
	IconFilm,
	IconBriefcase,
	IconMask,
	IconLogOut,
	IconPlus,
	IconCamera,
	IconUser,
	IconPhone,
	IconArrowLeft,
	IconLoader,
	IconX,
	IconCheck,
	IconEye,
	IconEdit,
	IconMail,
	IconAlertCircle,
} from '~packages/ui/icons'
import styles from './page.module.scss'

export default function CabinetPage() {
	const router = useRouter()
	const goBack = useSmartBack()
	const dialog = useDialog()
	const [token, setToken] = useState<string | null>(null)
	const [isAgent, setIsAgent] = useState(false)
	const [profiles, setProfiles] = useState<any[]>([])
	const [agentProfile, setAgentProfile] = useState({
		first_name: '',
		last_name: '',
		email: '',
		phone_number: '',
		telegram_nick: '',
		vk_nick: '',
		max_nick: '',
		photo_url: '',
	})
	const [loading, setLoading] = useState(true)
	const [savingAgent, setSavingAgent] = useState(false)
	const [uploadingPhoto, setUploadingPhoto] = useState(false)
	const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)
	const [editingAgent, setEditingAgent] = useState(false)

	const handleBack = useCallback(() => {
		if (isAgent) {
			router.push('/actor-home')
			return
		}
		goBack()
	}, [goBack, isAgent, router])

	useEffect(() => {
		let cancelled = false

		const restore = async () => {
			const accessToken = await ensureAccessToken()
			if (cancelled) return
			if (!accessToken) {
				router.replace('/login')
				return
			}
			setToken(accessToken)
			try {
				const rawToken = accessToken.includes(' ') ? accessToken.split(' ').pop() : accessToken
				const payload = JSON.parse(atob(rawToken?.split('.')[1] || ''))
				const role = payload?.role
				// Админы не должны попадать на /cabinet — это страница актёра/агента
				const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager']
				if (ADMIN_ROLES.includes(role)) {
					router.replace('/dashboard')
					return
				}
				setIsAgent(role === 'agent')
			} catch {}
		}

		restore()
		return () => { cancelled = true }
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
					telegram_nick: me.telegram_nick || me.telegram_username || '',
					vk_nick: me.vk_nick || '',
					max_nick: me.max_nick || '',
					photo_url: me.photo_url || '',
				})
			}
			setLoading(false)
		})
	}, [token, api])

	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams(window.location.search)
		if (params.get('add') === '1') {
			// Legacy: ?add=1 теперь ведёт на отдельную страницу создания профиля
			router.replace('/cabinet/profile/create')
		}
	}, [router])

	useEffect(() => {
		// Ранее актёра с анкетами автоматически переводили на /cabinet/feed.
		// Теперь /cabinet — страница управления анкетой, лента доступна через /actor-home.
		// Авто-редирект убран намеренно.
	}, [loading, isAgent, profiles, router])

	const saveAgentProfile = async () => {
		if (!hasAnyMessenger(agentProfile)) {
			dialog.error({
				title: 'Укажите способ связи',
				message: 'Заполните хотя бы один приоритетный способ связи: Telegram, ВКонтакте или MAX.',
			})
			return false
		}
		setSavingAgent(true)
		const res = await api('PATCH', 'auth/v2/me/', {
			first_name: agentProfile.first_name || null,
			last_name: agentProfile.last_name || null,
			phone_number: agentProfile.phone_number || null,
			...normalizeMessengers(agentProfile),
		})
		if (res?.id) {
			setAgentProfile((prev) => ({
				...prev,
				first_name: res.first_name || '',
				last_name: res.last_name || '',
				phone_number: res.phone_number || '',
				email: res.email || prev.email,
				telegram_nick: res.telegram_nick || res.telegram_username || '',
				vk_nick: res.vk_nick || '',
				max_nick: res.max_nick || '',
				photo_url: res.photo_url || prev.photo_url,
			}))
			setSavingAgent(false)
			return true
		}
		setSavingAgent(false)
		// Причина отказа приходит либо строкой, либо объектом `{code, message}` —
		// без разбора объекта человек видел бессмысленное «попробуйте позже».
		const detail = res?.detail
		dialog.error({
			title: 'Не получилось сохранить',
			message:
				(typeof detail === 'string' && detail) ||
				(typeof detail?.message === 'string' && detail.message) ||
				'Попробуйте ещё раз через минуту.',
		})
		return false
	}

	const uploadAgentPhoto = async (file?: File | null) => {
		if (!file || !token) return
		setUploadingPhoto(true)
		try {
			const uploadFile = await optimizePhotoForUpload(file)
			const formData = new FormData()
			formData.append('file', uploadFile)
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

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button
					onClick={handleBack}
					className={styles.backBtn}
					aria-label="Назад"
				>
					<IconArrowLeft size={15} />
				</button>
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
								<input type="file" accept={ACCEPTED_PHOTO_TYPES} onChange={(e) => uploadAgentPhoto(e.target.files?.[0] || null)} />
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
							<div className={styles.agentEditField}>
								<label>Приоритетные способы связи *</label>
								<small style={{ color: 'var(--c-text-2)', fontSize: 12 }}>Укажите хотя бы один из трёх.</small>
							</div>
							<div className={styles.agentEditField}>
								<label>Telegram</label>
								<input
									value={agentProfile.telegram_nick}
									onChange={(e) => setAgentProfile(prev => ({ ...prev, telegram_nick: e.target.value }))}
									placeholder="@username"
									className={styles.agentEditInput}
								/>
							</div>
							<div className={styles.agentEditField}>
								<label>ВКонтакте</label>
								<input
									value={agentProfile.vk_nick}
									onChange={(e) => setAgentProfile(prev => ({ ...prev, vk_nick: e.target.value }))}
									placeholder="vk.com/username"
									className={styles.agentEditInput}
								/>
							</div>
							<div className={styles.agentEditField}>
								<label>MAX</label>
								<input
									value={agentProfile.max_nick}
									onChange={(e) => setAgentProfile(prev => ({ ...prev, max_nick: e.target.value }))}
									placeholder="Ник в MAX"
									className={styles.agentEditInput}
								/>
							</div>
							<div className={styles.agentEditActions}>
								<button onClick={async () => { if (await saveAgentProfile()) setEditingAgent(false) }} disabled={savingAgent} className={styles.agentSaveBtn}>
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

			{/* Анкета заполняется только на /cabinet/profile/create: там собраны
			    обязательные поля (рост, размеры, способ связи), обязательные фото
			    и согласия. Прежняя форма прямо здесь всё это обходила, и в базу
			    попадали анкеты без параметров. */}
			{!hasProfiles && (
				<section className={styles.section}>
					<h2>
						<span className={styles.sectionIcon}><IconMask size={17} /></span>
						{isAgent ? 'Добавьте первого актёра' : 'Создайте ваш профиль'}
					</h2>
					<p className={styles.subtitle}>
						{isAgent
							? 'Заполните данные актёра, загрузите обязательные фото — и он сможет откликаться на кастинги.'
							: 'Заполните данные и загрузите обязательные фото, чтобы откликаться на кастинги'}
					</p>
					<button
						onClick={() => router.push('/cabinet/profile/create')}
						className={styles.btnPrimary}
						style={{ marginTop: 8 }}
					>
						<IconPlus size={16} /> {isAgent ? 'Добавить актёра' : 'Заполнить анкету'}
					</button>
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
									: `Мои профили (${profiles.length})`}
							</h2>
							<div className={styles.actorGrid}>
								{profiles.map((p: any) => {
									const photoUrl = normalizeMediaUrl(p.primary_photo || p.photo_url)
									return (
										<div
											key={p.id}
											className={styles.actorCard}
											onClick={() => router.push(`/cabinet/profile/${p.id}`)}
										>
											<div className={styles.actorCardCover}>
												{photoUrl ? (
													<img src={photoUrl} alt="" className={styles.actorCardImg} />
												) : (
													<div className={styles.actorCardEmpty}>
														<span>{(p.first_name?.[0] || p.last_name?.[0] || '?').toUpperCase()}</span>
													</div>
												)}
												<div className={`${styles.actorCardReadiness} ${styles[`readiness_${p.readiness || 'incomplete'}`]}`} />
											</div>
											<div className={styles.actorCardInfo}>
												<p className={styles.actorCardName}>
													{p.last_name || ''}{p.last_name && p.first_name ? ' ' : ''}{p.first_name || 'Без имени'}
												</p>
												<ActorMetaLine as="p" className={styles.actorCardSub} age={p.age} city={p.city} fallback="Данные не заполнены" />
												{(p.height || p.clothing_size || p.shoe_size) ? (
													<div className={styles.actorCardParams}>
														{p.height && (
															<span><span className={styles.paramIcon}>↕</span>{p.height}{' см'}</span>
														)}
														{p.clothing_size && (
															<span><span className={styles.paramIcon}>◻</span>{p.clothing_size}</span>
														)}
														{p.shoe_size && (
															<span><span className={styles.paramIcon}>◈</span>{p.shoe_size}</span>
														)}
													</div>
												) : null}
											</div>
											<button
												type="button"
												className={styles.actorCardBtn}
												onClick={e => { e.stopPropagation(); router.push(`/cabinet/profile/${p.id}`) }}
											>
												<IconEye size={14} />
												Посмотреть
											</button>
										</div>
									)
								})}
							</div>
							{/* Без этой кнопки со страницы «Профиль» нельзя было завести
							    вторую анкету (например, ребёнку): добавление жило только
							    в боковом меню и переключателе профилей. */}
							<button
								type="button"
								onClick={() => router.push('/cabinet/profile/create')}
								className={styles.addProfileBtn}
							>
								<IconPlus size={16} />
								{isAgent ? 'Добавить актёра' : 'Добавить профиль'}
							</button>
						</section>

					</>
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
