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

// ─── Options ─────────────────────────────────────────────────────────────
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

type FormState = {
	display_name: string; first_name: string; last_name: string; gender: string
	date_of_birth: string; city: string; phone_number: string; email: string
	qualification: string; experience: string; about_me: string
	video_intro: string; extra_portfolio_url: string; look_type: string
	hair_color: string; hair_length: string; height: string
	clothing_size: string; shoe_size: string
	bust_volume: string; waist_volume: string; hip_volume: string
}

function FullProfileForm({ form, setForm, isAgent }: { form: FormState; setForm: (f: FormState) => void; isAgent: boolean }) {
	const f = (field: keyof FormState, value: string) => setForm({ ...form, [field]: value })
	return (
		<div className={styles.form}>
			{/* ── Группа: Личные данные ── */}
			<div className={styles.formGroup}>
				<div className={styles.formGroupTitle}>👤 Личные данные</div>
				<div className={styles.field}>
					<label>Отображаемое имя</label>
					<input value={form.display_name} onChange={e => f('display_name', e.target.value)} placeholder="Как представлять актёра" className={styles.input} />
				</div>
				<div className={styles.row}>
					<div className={styles.field}>
						<label>Имя *</label>
						<input value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="Иван" className={styles.input} />
					</div>
					<div className={styles.field}>
						<label>Фамилия</label>
						<input value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="Иванов" className={styles.input} />
					</div>
				</div>
				<div className={styles.row}>
					<div className={styles.field}>
						<label>Пол</label>
						<select value={form.gender} onChange={e => f('gender', e.target.value)} className={styles.input}>
							<option value="male">Мужской</option>
							<option value="female">Женский</option>
						</select>
					</div>
					<div className={styles.field}>
						<label>Дата рождения</label>
						<input type="date" value={form.date_of_birth} onChange={e => f('date_of_birth', e.target.value)} className={styles.input} />
					</div>
				</div>
				<div className={styles.field}>
					<label>Город</label>
					<input value={form.city} onChange={e => f('city', e.target.value)} placeholder="Москва" className={styles.input} />
				</div>
			</div>

			{/* ── Группа: Контакты (скрыто для агента — используются контакты агента) ── */}
			{!isAgent && (
				<div className={styles.formGroup}>
					<div className={styles.formGroupTitle}>📱 Контакты</div>
					<div className={styles.row}>
						<div className={styles.field}>
							<label>Телефон</label>
							<input type="tel" value={form.phone_number ? formatPhone(form.phone_number) : ''} onChange={e => f('phone_number', rawPhone(e.target.value))} placeholder="+7 (900) 123-45-67" className={styles.input} />
						</div>
						<div className={styles.field}>
							<label>Email</label>
							<input type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@example.com" className={styles.input} />
						</div>
					</div>
				</div>
			)}
			{isAgent && (
				<div className={styles.agentContactHint}>
					🤝 Контакты актёра — ваши данные как агента. Кастинг-директоры видят ваш телефон и email.
				</div>
			)}

			{/* ── Группа: Профессиональное ── */}
			<div className={styles.formGroup}>
				<div className={styles.formGroupTitle}>💼 Профессиональное</div>
				<div className={styles.row}>
					<div className={styles.field}>
						<label>Квалификация</label>
						<select value={form.qualification} onChange={e => f('qualification', e.target.value)} className={styles.input}>
							<option value="">Не указана</option>
							{QUALIFICATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</div>
					<div className={styles.field}>
						<label>Опыт (лет)</label>
						<input type="number" min={0} max={99} value={form.experience} onChange={e => f('experience', e.target.value)} placeholder="0" className={styles.input} />
					</div>
				</div>
				<div className={styles.field}>
					<label>О себе</label>
					<textarea value={form.about_me} onChange={e => f('about_me', e.target.value)} placeholder="Расскажите об опыте, навыках, амплуа..." className={styles.textarea} rows={4} />
				</div>
				<div className={styles.field}>
					<label>🎬 Ссылка на видеовизитку</label>
					<input type="url" value={form.video_intro} onChange={e => f('video_intro', e.target.value)} placeholder="https://youtube.com/..." className={styles.input} />
				</div>
				<div className={styles.field}>
					<label>🔗 Доп. портфолио</label>
					<input type="url" value={form.extra_portfolio_url} onChange={e => f('extra_portfolio_url', e.target.value)} placeholder="https://..." className={styles.input} />
				</div>
			</div>

			{/* ── Группа: Параметры внешности ── */}
			<div className={styles.formGroup}>
				<div className={styles.formGroupTitle}>📐 Параметры внешности</div>
				<div className={styles.row}>
					<div className={styles.field}>
						<label>Тип внешности</label>
						<select value={form.look_type} onChange={e => f('look_type', e.target.value)} className={styles.input}>
							<option value="">Не указан</option>
							{LOOK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</div>
					<div className={styles.field}>
						<label>Рост (см)</label>
						<input type="number" min={0} max={300} value={form.height} onChange={e => f('height', e.target.value)} placeholder="170" className={styles.input} />
					</div>
				</div>
				<div className={styles.row}>
					<div className={styles.field}>
						<label>Цвет волос</label>
						<select value={form.hair_color} onChange={e => f('hair_color', e.target.value)} className={styles.input}>
							<option value="">Не указан</option>
							{HAIR_COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</div>
					<div className={styles.field}>
						<label>Длина волос</label>
						<select value={form.hair_length} onChange={e => f('hair_length', e.target.value)} className={styles.input}>
							<option value="">Не указана</option>
							{HAIR_LENGTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</div>
				</div>
				<div className={styles.row}>
					<div className={styles.field}>
						<label>Размер одежды</label>
						<input type="text" value={form.clothing_size} onChange={e => f('clothing_size', e.target.value)} placeholder="42" className={styles.input} />
					</div>
					<div className={styles.field}>
						<label>Размер обуви</label>
						<input type="text" value={form.shoe_size} onChange={e => f('shoe_size', e.target.value)} placeholder="40" className={styles.input} />
					</div>
				</div>
				<div className={styles.row}>
					<div className={styles.field}>
						<label>Обхват груди (см)</label>
						<input type="number" min={0} max={200} value={form.bust_volume} onChange={e => f('bust_volume', e.target.value)} className={styles.input} />
					</div>
					<div className={styles.field}>
						<label>Обхват талии (см)</label>
						<input type="number" min={0} max={200} value={form.waist_volume} onChange={e => f('waist_volume', e.target.value)} className={styles.input} />
					</div>
					<div className={styles.field}>
						<label>Обхват бёдер (см)</label>
						<input type="number" min={0} max={200} value={form.hip_volume} onChange={e => f('hip_volume', e.target.value)} className={styles.input} />
					</div>
				</div>
			</div>
		</div>
	)
}

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
	const [feedCastings, setFeedCastings] = useState<any[]>([])
	const [feedLoading, setFeedLoading] = useState(false)
	const [myResponseIds, setMyResponseIds] = useState<Set<number>>(new Set())
	const [respondingTo, setRespondingTo] = useState<number | null>(null)
	const [agentRespondCastingId, setAgentRespondCastingId] = useState<number | null>(null)
	const [selectedProfileIds, setSelectedProfileIds] = useState<Set<number>>(new Set())
	const [agentSubmitting, setAgentSubmitting] = useState(false)
	const addProfileSectionRef = useRef<HTMLElement | null>(null)
	const responsesSectionRef = useRef<HTMLElement | null>(null)
	const [form, setForm] = useState({
		display_name: '',
		first_name: '',
		last_name: '',
		gender: 'male',
		date_of_birth: '',
		city: '',
		phone_number: '',
		email: '',
		qualification: '',
		experience: '',
		about_me: '',
		video_intro: '',
		extra_portfolio_url: '',
		look_type: '',
		hair_color: '',
		hair_length: '',
		height: '',
		clothing_size: '',
		shoe_size: '',
		bust_volume: '',
		waist_volume: '',
		hip_volume: '',
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
		if (!token || !isAgent) return
		setFeedLoading(true)
		Promise.all([
			api('GET', 'feed/projects/?page_size=100').catch(() => ({ projects: [] })),
			api('GET', 'feed/my-responses/').catch(() => ({ responses: [] })),
		]).then(([feedData, responsesData]) => {
			const allCastings: any[] = []
			for (const proj of (feedData?.projects || [])) {
				for (const c of (proj.castings || [])) {
					allCastings.push({ ...c, project_title: proj.title, publisher_name: c.publisher_name || proj.owner_name })
				}
			}
			setFeedCastings(allCastings)
			const ids = new Set<number>((responsesData?.responses || []).map((r: any) => r.casting_id))
			setMyResponseIds(ids)
			setFeedLoading(false)
		})
	}, [token, isAgent, api])

	const handleAgentRespond = (castingId: number) => {
		setAgentRespondCastingId(castingId)
		setSelectedProfileIds(new Set())
	}

	const toggleProfileSelection = (id: number) => {
		setSelectedProfileIds(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const handleAgentSubmit = async () => {
		if (!agentRespondCastingId || selectedProfileIds.size === 0) return
		setAgentSubmitting(true)
		try {
			const res = await api('POST', 'feed/agent-respond/', {
				casting_id: agentRespondCastingId,
				profile_ids: Array.from(selectedProfileIds),
			})
			if (res?.total_submitted > 0) {
				setMyResponseIds(prev => new Set(prev).add(agentRespondCastingId!))
				setAgentRespondCastingId(null)
			} else if (res?.results) {
				const allSkipped = res.results.every((r: any) => r.status === 'already_responded')
				if (allSkipped) {
					setMyResponseIds(prev => new Set(prev).add(agentRespondCastingId!))
				}
				setAgentRespondCastingId(null)
			}
		} catch {}
		setAgentSubmitting(false)
	}

	const normalizeCastingImageUrl = (url?: string | null) => {
		if (!url) return null
		try {
			const apiBase = new URL(API_URL, window.location.origin)
			const parsed = new URL(url, apiBase)
			if (parsed.pathname.startsWith('/uploads/')) {
				return `${apiBase.origin}${parsed.pathname}${parsed.search}`
			}
			return parsed.toString()
		} catch {
			return url
		}
	}

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
		const payload: Record<string, any> = {}
		Object.entries(form).forEach(([k, v]) => {
			if (v !== '' && v !== null && v !== undefined) {
				if (['experience', 'height', 'bust_volume', 'waist_volume', 'hip_volume'].includes(k)) {
					payload[k] = Number(v)
				} else {
					payload[k] = v
				}
			}
		})
		const res = await api('POST', 'tma/actor-profiles/', payload)
		if (res?.id) {
			setProfiles((prev) => [...prev, res])
			setAddProfileOpen(false)
			resetForm()
			// Redirect to the new profile so photos/video can be uploaded immediately
			router.push(`/cabinet/profile/${res.id}`)
		}
		setCreating(false)
	}

	const resetForm = () => setForm({
		display_name: '',
		first_name: '',
		last_name: '',
		gender: 'male',
		date_of_birth: '',
		city: '',
		phone_number: '',
		email: '',
		qualification: '',
		experience: '',
		about_me: '',
		video_intro: '',
		extra_portfolio_url: '',
		look_type: '',
		hair_color: '',
		hair_length: '',
		height: '',
		clothing_size: '',
		shoe_size: '',
		bust_volume: '',
		waist_volume: '',
		hip_volume: '',
	})

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
						<span className={styles.sectionIcon}><IconMask size={17} /></span>
						{isAgent ? 'Добавьте первого актёра' : 'Создайте вашу анкету'}
					</h2>
					<p className={styles.subtitle}>
						{isAgent
							? 'Заполните данные актёра. После создания анкеты загрузите фото и видеовизитку.'
							: 'Заполните все данные, чтобы откликаться на кастинги'}
					</p>
					<FullProfileForm form={form} setForm={setForm} isAgent={isAgent} />
					<button
						onClick={createProfile}
						disabled={creating || !form.first_name.trim()}
						className={styles.btnPrimary}
						style={{ marginTop: 8 }}
					>
						{creating ? <><IconLoader size={16} /> Создание...</> : <><IconPlus size={16} /> Создать анкету</>}
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

					<section className={styles.section}>
						<h2>
							<span className={styles.sectionIcon}>
								<IconSearch size={17} />
							</span>
							Быстрые действия
						</h2>
						<p className={styles.subtitle}>
							{isAgent
								? 'Лента кастингов, управление актёрами — всё в одном месте'
								: 'Переходите в ленту, открывайте отклики и добавляйте новые анкеты в одном месте'}
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
									<small>{isAgent ? 'Откликайте актёров' : 'Смотрите проекты'}</small>
								</span>
								<span className={styles.actionArrow}>
									<IconChevronRight size={18} />
								</span>
							</button>

							{!isAgent && (
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
										<small>{myResponses.length > 0 ? `У вас ${myResponses.length} откликов` : 'Статус заявок'}</small>
									</span>
									<span className={styles.actionBadge}>{myResponses.length}</span>
								</button>
							)}

							<button
								type="button"
								className={`${styles.actionCard} ${styles.actionCardAccent}`}
								onClick={toggleAddProfile}
							>
								<span className={styles.actionIcon}>
									<IconPlus size={18} />
								</span>
								<span className={styles.actionBody}>
									<strong>{addProfileOpen ? 'Скрыть форму' : isAgent ? 'Добавить актёра' : 'Добавить анкету'}</strong>
									<small>{isAgent ? 'Новый актёр в портфеле' : 'Ещё одно амплуа'}</small>
								</span>
								<span className={styles.actionArrow}>
									<IconChevronRight size={18} />
								</span>
							</button>
						</div>
					</section>

					{isAgent && (
						<section className={styles.section}>
							<h2>
								<span className={styles.sectionIcon}><IconFilm size={17} /></span>
								Лента кастингов
							</h2>
							<p className={styles.subtitle}>Текущие кастинги — откликайте своих актёров</p>

							{feedLoading ? (
								<div className={styles.feedLoading}><IconLoader size={20} /> Загрузка...</div>
							) : feedCastings.length === 0 ? (
								<div className={styles.feedEmpty}>Пока нет доступных кастингов</div>
							) : (
								<div className={styles.feedGrid}>
									{feedCastings.map((c: any) => {
										const responded = myResponseIds.has(c.id)
										return (
											<div key={c.id} className={styles.feedCard}>
												<div className={styles.feedCardCover}>
													{c.image_url ? (
														<img src={normalizeCastingImageUrl(c.image_url) || ''} alt="" />
													) : (
														<div className={styles.feedCardCoverPlaceholder}><IconFilm size={28} /></div>
													)}
												</div>
												<div className={styles.feedCardBody}>
													<div className={styles.feedCardProject}>{c.project_title}</div>
													<h3 className={styles.feedCardTitle}>{c.title}</h3>
													{c.description && (
														<p className={styles.feedCardDesc}>
															{c.description.length > 80 ? c.description.slice(0, 80) + '…' : c.description}
														</p>
													)}
													<div className={styles.feedCardMeta}>
														{c.publisher_name && (
															<span className={styles.feedCardMetaItem}>
																<IconUser size={12} /> {c.publisher_name}
															</span>
														)}
														{c.created_at && (
															<span className={styles.feedCardMetaItem}>
																<IconCalendar size={12} />{' '}
																{new Date(c.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
															</span>
														)}
													</div>
													<div className={styles.feedCardActions}>
														{responded ? (
															<span className={styles.feedCardBadge}><IconCheck size={14} /> Актёры откликнуты</span>
														) : (
															<button
																className={styles.feedCardBtn}
																onClick={() => handleAgentRespond(c.id)}
																disabled={respondingTo === c.id}
															>
																<IconZap size={14} /> Откликнуть актёров
															</button>
														)}
													</div>
												</div>
											</div>
										)
									})}
								</div>
							)}
						</section>
					)}

					{addProfileOpen && (
						<section className={styles.section} ref={addProfileSectionRef}>
							<h2>
								<span className={styles.sectionIcon}><IconPlus size={17} /></span>
								{isAgent ? 'Добавить ещё актёра' : 'Добавить ещё анкету'}
							</h2>
							<p className={styles.subtitle}>
								{isAgent
									? 'Заполните полные данные нового актёра. Фото загрузите после создания.'
									: 'Создайте несколько профилей для разных амплуа'}
							</p>
							<FullProfileForm form={form} setForm={setForm} isAgent={isAgent} />
							<button
								onClick={createProfile}
								disabled={creating || !form.first_name.trim()}
								className={styles.addProfileBtn}
								style={{ marginTop: 8 }}
							>
								{creating ? <IconLoader size={15} /> : <IconPlus size={15} />}
								{creating ? 'Добавление...' : 'Добавить профиль'}
							</button>
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

			{agentRespondCastingId !== null && (
				<div className={styles.agentModalOverlay} onClick={() => setAgentRespondCastingId(null)}>
					<div className={styles.agentModal} onClick={e => e.stopPropagation()}>
						<div className={styles.agentModalHeader}>
							<h3>Выберите актёров</h3>
							<button onClick={() => setAgentRespondCastingId(null)} className={styles.agentModalClose}><IconX size={18} /></button>
						</div>
						<p className={styles.agentModalHint}>Выберите, кого откликнуть на этот кастинг</p>
						{profiles.length === 0 ? (
							<p className={styles.agentModalEmpty}>У вас нет актёров. Создайте анкету выше.</p>
						) : (
							<div className={styles.agentModalList}>
								{profiles.map((p: any) => {
									const sel = selectedProfileIds.has(p.id)
									return (
										<button key={p.id} className={`${styles.agentModalItem} ${sel ? styles.agentModalItemSelected : ''}`} onClick={() => toggleProfileSelection(p.id)}>
											<div className={styles.agentModalItemAvatar}>
												{(p.primary_photo || p.photo_url) ? (
													<img src={normalizeMediaUrl(p.primary_photo || p.photo_url) || ''} alt="" />
												) : (
													(p.first_name?.[0] || '?').toUpperCase()
												)}
											</div>
											<div className={styles.agentModalItemInfo}>
												<strong>{p.first_name} {p.last_name}</strong>
												<small>{p.city || 'Город не указан'} · {p.gender === 'male' ? 'Муж' : 'Жен'}</small>
											</div>
											<span className={styles.agentModalItemCheck}>{sel ? <IconCheck size={16} /> : null}</span>
										</button>
									)
								})}
							</div>
						)}
						<div className={styles.agentModalActions}>
							<button onClick={() => setAgentRespondCastingId(null)} className={styles.agentModalCancel}>Отмена</button>
							<button onClick={handleAgentSubmit} disabled={selectedProfileIds.size === 0 || agentSubmitting} className={styles.agentModalSubmit}>
								{agentSubmitting ? <><IconLoader size={14} /> Отправка...</> : `Откликнуть (${selectedProfileIds.size})`}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
