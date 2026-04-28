'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { formatPhone, rawPhone } from '~/shared/phone-mask'
import { LOOK_TYPE_OPTIONS } from '~/shared/profile-labels'
import {
	IconFilm,
	IconBriefcase,
	IconMask,
	IconLogOut,
	IconPlus,
	IconCamera,
	IconUser,
	IconPhone,
	IconLoader,
	IconX,
	IconCheck,
	IconEye,
	IconEdit,
	IconMail,
	IconAlertCircle,
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
	value: string
	onChange: (value: string) => void
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
				: '',
		)
	}

	return (
		<div className={styles.dateFields}>
			<select
				value={day}
				onChange={(e) => updatePart('day', e.target.value)}
				className={styles.input}
			>
				<option value="">День</option>
				{Array.from({ length: daysInMonth }, (_, index) => {
					const value = String(index + 1).padStart(2, '0')
					return (
						<option key={value} value={value}>
							{index + 1}
						</option>
					)
				})}
			</select>
			<select
				value={month}
				onChange={(e) => updatePart('month', e.target.value)}
				className={styles.input}
			>
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
				className={`${styles.input} ${styles.dateYear}`}
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
						<BirthDateField
							value={form.date_of_birth}
							onChange={(value) => f('date_of_birth', value)}
						/>
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
	const [loading, setLoading] = useState(true)
	const [creating, setCreating] = useState(false)
	const [savingAgent, setSavingAgent] = useState(false)
	const [uploadingPhoto, setUploadingPhoto] = useState(false)
	const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)
	const [editingAgent, setEditingAgent] = useState(false)
	const [addProfileOpen, setAddProfileOpen] = useState(false)
	const addProfileSectionRef = useRef<HTMLElement | null>(null)
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

	useEffect(() => {
		if (!profiles.length) {
			setAddProfileOpen(true)
		}
	}, [profiles.length])

	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams(window.location.search)
		if (params.get('add') === '1') {
			setAddProfileOpen(true)
			setTimeout(() => addProfileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
		}
	}, [])

	useEffect(() => {
		// Актёр с анкетами: стартовая страница — лента кастингов, а не свой профиль.
		// В свой профиль можно попасть через пункт "Анкета" в меню.
		if (!loading && !isAgent && profiles.length >= 1) {
			if (typeof window !== 'undefined') {
				const params = new URLSearchParams(window.location.search)
				// ?add=1 — пропускаем (пользователь хочет создать ещё анкету)
				if (params.get('add') === '1') return
			}
			router.replace('/cabinet/feed')
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

	if (!isAgent && profiles.length >= 1) return null

	const hasProfiles = profiles.length > 0

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
							<div className={styles.actorGrid}>
								{profiles.map((p: any) => {
									const photoUrl = normalizeMediaUrl(p.primary_photo || p.photo_url)
									const ageNum = p.age
									const ageStr = ageNum
										? `${ageNum}\u00a0${ageNum % 10 === 1 && ageNum !== 11 ? 'год' : ageNum % 10 >= 2 && ageNum % 10 <= 4 && (ageNum < 12 || ageNum > 14) ? 'года' : 'лет'}`
										: null
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
												<p className={styles.actorCardSub}>
													{[ageStr, p.city].filter(Boolean).join('\u00a0·\u00a0') || 'Данные не заполнены'}
												</p>
												{(p.height || p.clothing_size || p.shoe_size) ? (
													<div className={styles.actorCardParams}>
														{p.height && (
															<span><span className={styles.paramIcon}>↕</span>{p.height}\u00a0см</span>
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
						</section>

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
