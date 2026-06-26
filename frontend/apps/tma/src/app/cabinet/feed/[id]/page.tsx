'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { apiCall, ensureAccessToken, getToken, publicGet } from '~/shared/api-client'
import { useSmartBack } from '~/shared/smart-back'
import { API_URL } from '~/shared/api-url'
import { getCoverImage } from '~/shared/fallback-cover'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { setPendingReturnUrl } from '~/shared/pending-return-url'
import { clearPendingRole } from '~/shared/pending-role'
import {
	IconArrowLeft,
	IconLoader,
	IconCheck,
	IconZap,
	IconCalendar,
	IconUser,
	IconX,
	IconAlertCircle,
} from '~packages/ui/icons'
import styles from './casting-detail.module.scss'

interface CastingDetail {
	id: number
	title: string
	description?: string | null
	image_url?: string | null
	status?: string
	created_at: string
	published_at?: string | null
	published_by?: string | null
	published_by_id?: number | null
	city?: string | null
	project_category?: string | null
	gender?: string | null
	age_from?: number | null
	age_to?: number | null
	financial_conditions?: string | null
	shooting_dates?: string | null
	role_types?: string[] | null
}

export default function CastingDetailPage() {
	const router = useRouter()
	const goBack = useSmartBack('/cabinet/feed')
	const params = useParams()
	const castingId = Number(params?.id)
	const dialog = useDialog()

	const [token, setToken] = useState<string | null>(null)
	const [isAuthed, setIsAuthed] = useState(false)
	const [authChecked, setAuthChecked] = useState(false)
	const [isAgent, setIsAgent] = useState(false)
	const [isActor, setIsActor] = useState(false)
	const [casting, setCasting] = useState<CastingDetail | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [alreadyResponded, setAlreadyResponded] = useState(false)
	// Для агента: какие актёры уже откликнуты на ЭТОТ кастинг (actor_profile_id),
	// чтобы можно было докликивать оставшихся по одному.
	const [respondedActorIds, setRespondedActorIds] = useState<Set<number>>(new Set())
	const [respondLoading, setRespondLoading] = useState(false)

	// agent modal
	const [agentProfiles, setAgentProfiles] = useState<any[]>([])
	const [activeProfileId, setActiveProfileId] = useState<number | null>(null)
	const [selectedProfileIds, setSelectedProfileIds] = useState<Set<number>>(new Set())
	const [agentModalOpen, setAgentModalOpen] = useState(false)
	const [agentSubmitting, setAgentSubmitting] = useState(false)

	// Anonymous visitors (e.g. coming from the Telegram channel) can VIEW the
	// casting. Login is only required when they actually try to respond.
	useEffect(() => {
		let cancelled = false

		const restore = async () => {
			const accessToken = await ensureAccessToken()
			if (cancelled) return
			if (accessToken) {
				setToken(accessToken)
				setIsAuthed(true)
				try {
					const rawToken = accessToken.includes(' ') ? accessToken.split(' ').pop() : accessToken
					const payload = JSON.parse(atob(rawToken?.split('.')[1] || ''))
					if (payload?.role === 'agent') setIsAgent(true)
					if (payload?.role === 'user') setIsActor(true)
				} catch {}
			}
			setAuthChecked(true)
		}

		restore()
		return () => { cancelled = true }
	}, [])

	const promptLogin = useCallback(async () => {
		const target = `/cabinet/feed/${castingId}`
		setPendingReturnUrl(target)
		const ok = await dialog.confirm({
			title: 'Нужен аккаунт',
			message: 'Чтобы откликнуться на кастинг, войдите или зарегистрируйтесь. После входа вы вернётесь к этому кастингу.',
			confirmLabel: 'Зарегистрироваться',
			cancelLabel: 'Войти',
		})
		if (ok) {
			// Start from a clean role choice so the visitor sees the role-selection
			// screen (Актёр / Агент / Администратор) instead of a stale role.
			clearPendingRole()
		}
		router.push(`/login?next=${encodeURIComponent(target)}`)
	}, [castingId, dialog, router])

	// Анкета актёра считается готовой только когда заполнены данные и
	// загружены обязательные фото (readiness === 'ready' приходит с бэка).
	const profileReady = agentProfiles.some((p: any) => p.readiness === 'ready')

	const promptCompleteProfile = useCallback(async () => {
		const target = `/cabinet/feed/${castingId}`
		setPendingReturnUrl(target)
		const go = await dialog.confirm({
			title: isAgent ? 'Заполните профиль актёра' : 'Заполните профиль полностью',
			message: isAgent
				? 'Чтобы откликнуться, заполните хотя бы один профиль актёра полностью: данные и обязательные фото (портрет, профиль, полный рост).'
				: 'Чтобы откликнуться на кастинг, заполните профиль и добавьте обязательные фото (портрет, профиль, полный рост).',
			confirmLabel: 'Заполнить',
			cancelLabel: 'Позже',
			tone: 'warning',
		})
		if (go) {
			const incomplete = agentProfiles.find((p: any) => p.readiness !== 'ready') || agentProfiles[0]
			if (incomplete?.id) router.push(`/cabinet/profile/${incomplete.id}`)
			else router.push('/cabinet/profile/create')
		}
	}, [agentProfiles, castingId, dialog, isAgent, router])

	const normalizeCastingImageUrl = useCallback((url?: string | null) => {
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
	}, [])

	const load = useCallback(async () => {
		if (!castingId || !authChecked) return
		setLoading(true)
		setError(null)
		try {
			// Authenticated users get the full detail (with team-aware access);
			// anonymous visitors get the public view of published castings.
			let data: CastingDetail | null = token
				? await apiCall('GET', `employer/projects/${castingId}/detail/`)
				: await publicGet(`employer/projects/${castingId}/public-detail/`)
			if ((!data || (data as any).detail) && token) {
				// Fall back to the public view if the authed detail is not accessible.
				data = await publicGet(`employer/projects/${castingId}/public-detail/`)
			}
			if (!data || (data as any).detail) {
				setError('Кастинг не найден или недоступен')
				setCasting(null)
			} else {
				setCasting(data)
			}

			if (token) {
				const resp = await apiCall('GET', 'feed/my-responses/').catch(() => ({ responses: [] }))
				const responded = new Set((resp?.responses || []).map((r: any) => r.casting_id))
				setAlreadyResponded(responded.has(castingId))
				const actorIds = new Set<number>()
				for (const r of (resp?.responses || [])) {
					if (Number(r.casting_id) !== castingId) continue
					for (const a of (r.actors || [])) {
						if (a?.id != null) actorIds.add(Number(a.id))
					}
				}
				setRespondedActorIds(actorIds)

				if (isAgent || isActor) {
					const profiles = await apiCall('GET', 'tma/actor-profiles/my/').catch(() => ({ profiles: [] }))
					setAgentProfiles(profiles?.profiles || [])
					// Активный профиль берём из токена (надёжно), затем из API.
					let tokenProfileId: number | null = null
					try {
						const s = getToken()
						if (s) {
							const payload = JSON.parse(atob(s.split('.')[1] || ''))
							tokenProfileId = payload?.profile_id != null ? Number(payload.profile_id) : null
						}
					} catch {}
					const activeId = tokenProfileId ?? profiles?.current_profile_id ?? null
					if (activeId != null) setActiveProfileId(activeId)
				}
			}
		} catch (e: any) {
			setError(e?.message || 'Не удалось загрузить кастинг')
		} finally {
			setLoading(false)
		}
	}, [castingId, token, authChecked, isAgent, isActor])

	useEffect(() => { load() }, [load])

	const handleRespond = async () => {
		if (!casting) return
		// Актёр откликается от лица АКТИВНОЙ анкеты (переключатель профиля),
		// без выбора анкеты при отклике.
		let actorActiveId: number | null = null
		if (!isAgent && isActor) {
			const active = agentProfiles.find((p: any) => p.id === activeProfileId) || agentProfiles[0]
			// Нельзя откликаться с пустой/неполной активной анкетой.
			if (!active || active.readiness !== 'ready') {
				await promptCompleteProfile()
				return
			}
			actorActiveId = active.id
		}
		setRespondLoading(true)
		try {
			const payload: any = { casting_id: casting.id }
			if (!isAgent && isActor && actorActiveId != null) payload.actor_profile_id = actorActiveId
			const res = await apiCall('POST', 'feed/respond/', payload)
			if (res?.id || res?.ok) {
				setAlreadyResponded(true)
			} else if (res?.detail) {
				const raw = res.detail
				if (raw && typeof raw === 'object' && raw.code === 'profile_incomplete') {
					await promptCompleteProfile()
					return
				}
				const detail = typeof raw === 'string' ? raw : 'Попробуйте ещё раз через минуту.'
				if (detail.includes('Сначала создайте профиль актёра')) {
					const target = `/cabinet/feed/${casting.id}`
					setPendingReturnUrl(target)
					const shouldCreate = await dialog.confirm({
						title: 'Нужен профиль актёра',
						message: 'Чтобы откликнуться, сначала создайте профиль актёра. После создания профиля вы вернётесь к этому кастингу.',
						confirmLabel: 'Создать профиль',
						cancelLabel: 'Позже',
						tone: 'warning',
					})
					if (shouldCreate) router.push('/cabinet/profile/create')
					return
				}
				// «Already responded» — отклик уже есть, показываем как откликнутый.
				if (detail.toLowerCase().includes('already responded')) {
					setAlreadyResponded(true)
					return
				}
				dialog.error({
					title: 'Не получилось откликнуться',
					message: detail,
				})
			}
		} finally {
			setRespondLoading(false)
		}
	}

	const toggleAgentProfile = (id: number) => {
		setSelectedProfileIds(prev => {
			if (!isAgent) return new Set([id])
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const submitAgentRespond = async () => {
		if (!casting) return
		if (selectedProfileIds.size === 0) {
			dialog.warn({
				title: 'Выберите актёра',
				message: 'Чтобы откликнуться, отметьте хотя бы одного актёра в списке.',
			})
			return
		}
		const submittedIds = Array.from(selectedProfileIds)
		setAgentSubmitting(true)
		const res = isAgent
			? await apiCall('POST', 'feed/agent-respond/', {
				casting_id: casting.id,
				profile_ids: submittedIds,
			})
			: await apiCall('POST', 'feed/respond/', {
				casting_id: casting.id,
				actor_profile_id: submittedIds[0],
			})
		setAgentSubmitting(false)
		if (res?.ok || res?.id || Number(res?.total_submitted) > 0 || (Array.isArray(res?.results) && res.results.some((r: any) => r.status === 'ok' || r.status === 'already_responded'))) {
			setAlreadyResponded(true)
			if (isAgent) {
				setRespondedActorIds(prev => {
					const next = new Set(prev)
					submittedIds.forEach(id => next.add(id))
					return next
				})
			}
			setAgentModalOpen(false)
			setSelectedProfileIds(new Set())
		} else if (res?.detail) {
			const raw = res.detail
			if (raw && typeof raw === 'object' && raw.code === 'profile_incomplete') {
				dialog.warn({
					title: 'Заполните профиль полностью',
					message: typeof raw.message === 'string'
						? raw.message
						: 'Профиль заполнен не полностью. Добавьте данные и обязательные фото.',
				})
				return
			}
			// «Already responded» — отклик уже есть, показываем как откликнутый.
			if (typeof raw === 'string' && raw.toLowerCase().includes('already responded')) {
				setAlreadyResponded(true)
				setAgentModalOpen(false)
				return
			}
			dialog.error({
				title: 'Не получилось откликнуться',
				message: typeof raw === 'string' ? raw : 'Попробуйте ещё раз через минуту.',
			})
		}
	}

	if (loading) {
		return (
			<div className={styles.root}>
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка кастинга…
				</div>
			</div>
		)
	}

	if (error || !casting) {
		return (
			<div className={styles.root}>
				<div className={styles.header}>
					<button className={styles.backBtn} onClick={goBack}>
						<IconArrowLeft size={16} /> Лента кастингов
					</button>
				</div>
				<div className={styles.emptyState}>
					<h3>Кастинг недоступен</h3>
					<p>{error || 'Не удалось загрузить кастинг.'}</p>
					<button className={styles.emptyBtn} onClick={goBack}>
						К ленте
					</button>
				</div>
			</div>
		)
	}

	const dateStr = new Date(casting.created_at).toLocaleDateString('ru-RU', {
		day: '2-digit', month: '2-digit', year: 'numeric',
	})

	// Для агента «откликнуто» — по конкретным актёрам, чтобы можно было
	// докликивать оставшихся по одному (в т.ч. позже).
	const readyActorIds = isAgent
		? agentProfiles.filter((p: any) => p.readiness === 'ready').map((p: any) => Number(p.id))
		: []
	const agentSomeResponded = isAgent && respondedActorIds.size > 0
	const agentAllResponded =
		isAgent && readyActorIds.length > 0 && readyActorIds.every((id: number) => respondedActorIds.has(id))
	const showRespondedBadge = isAgent ? agentAllResponded : alreadyResponded

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<div className={styles.headerTop}>
					<button className={styles.backBtn} onClick={goBack}>
						<IconArrowLeft size={16} /> Лента
					</button>
					<h1 className={styles.headerTitle}>Кастинг</h1>
				</div>
				{isAuthed && (isActor || isAgent) && alreadyResponded && (
					<button
						className={styles.headerProfileBtn}
						onClick={() => router.push('/actor-home')}
					>
						<IconUser size={15} /> Перейти в профиль
					</button>
				)}
			</div>

			<div className={styles.hero}>
				<div className={styles.heroImage} style={{ '--bg-image': `url(${getCoverImage(normalizeCastingImageUrl(casting.image_url), casting.id || casting.title)})` } as React.CSSProperties}>
					<img
						src={getCoverImage(normalizeCastingImageUrl(casting.image_url), casting.id || casting.title)}
						alt={casting.title}
					/>
				</div>
				<div className={styles.heroBody}>
					<div className={styles.heroTitleRow}>
						<h2 className={styles.heroTitle}>{casting.title}</h2>
						{casting.status === 'published' && (
							<span className={styles.statusBadge}>Опубликован</span>
						)}
					</div>

					<div className={styles.metaRow}>
						<span className={styles.metaItem}>
							<IconCalendar size={13} /> Дата создания <b>{dateStr}</b>
						</span>
						{casting.published_by && (
							<span className={styles.metaItem}>
								<IconUser size={13} /> Опубликовал:{' '}
								{casting.published_by_id ? (
									<b
										className={styles.publisherLink}
										onClick={() => router.push(`/cabinet/admin-profile/${casting.published_by_id}`)}
									>{casting.published_by}</b>
								) : <b>{casting.published_by}</b>}
							</span>
						)}
					</div>

					{(casting.city || casting.project_category || casting.gender || casting.age_from || casting.age_to
						|| casting.financial_conditions || casting.shooting_dates
						|| (casting.role_types && casting.role_types.length > 0)) && (
						<div className={styles.tagsRow}>
							{casting.city && <span className={styles.tag}>📍 {casting.city}</span>}
							{casting.project_category && <span className={styles.tag}>{casting.project_category}</span>}
							{casting.gender && <span className={styles.tag}>{casting.gender}</span>}
							{(casting.age_from || casting.age_to) && <span className={styles.tag}>{casting.age_from || '?'}–{casting.age_to || '?'} лет</span>}
							{casting.role_types && casting.role_types.length > 0 && <span className={styles.tag}>{casting.role_types.join(', ')}</span>}
							{casting.financial_conditions && <span className={styles.tag}>💰 {casting.financial_conditions}</span>}
							{casting.shooting_dates && <span className={styles.tag}>📅 {casting.shooting_dates}</span>}
						</div>
					)}

					{casting.description && casting.description !== '-' && (
						<div className={styles.description}>
							<h3>Описание</h3>
							<p>{casting.description}</p>
						</div>
					)}

					{isAuthed && (isActor || isAgent) && !alreadyResponded && !profileReady && (
						<div className={styles.profileBanner}>
							<div className={styles.profileBannerIcon}>
								<IconAlertCircle size={18} />
							</div>
							<div className={styles.profileBannerBody}>
								<strong>{isAgent ? 'Заполните профиль актёра полностью' : 'Заполните профиль полностью'}</strong>
								<span>
									{isAgent
										? 'Чтобы откликаться на кастинги, заполните хотя бы один профиль актёра и добавьте обязательные фото.'
										: 'Чтобы откликаться на кастинги, заполните профиль и добавьте обязательные фото.'}
								</span>
							</div>
							<button className={styles.profileBannerBtn} onClick={promptCompleteProfile}>
								Заполнить
							</button>
						</div>
					)}

					<div className={styles.actions}>
						{showRespondedBadge ? (
							<div className={styles.respondedBadge}>
								<IconCheck size={14} />
								{isAgent ? 'Актёры откликнуты' : 'Вы откликнулись'}
							</div>
						) : !isAuthed ? (
							<button
								className={styles.respondBtn}
								onClick={promptLogin}
							>
								<IconZap size={14} /> Откликнуться
							</button>
						) : isActor || isAgent ? (
							<button
								className={styles.respondBtn}
								disabled={respondLoading || agentSubmitting}
								onClick={() => {
									if (isAgent) {
										if (!profileReady) promptCompleteProfile()
										else setAgentModalOpen(true)
									} else handleRespond()
								}}
							>
								{respondLoading ? (
									<><IconLoader size={14} /> Отправка...</>
								) : isAgent ? (
									<><IconUser size={14} /> {agentSomeResponded ? 'Откликнуть ещё' : 'Откликнуть актёров'}</>
								) : (
									<><IconZap size={14} /> Откликнуться</>
								)}
							</button>
						) : (
							<div className={styles.respondedBadge}>
								<IconUser size={14} />
								Только актёры и агенты могут откликаться
							</div>
						)}
					</div>
				</div>
			</div>

			{agentModalOpen && (
				<div className={styles.modalOverlay} onClick={() => setAgentModalOpen(false)}>
					<div className={styles.modalCard} onClick={e => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<h3>{isAgent ? 'Выберите актёров для отклика' : 'Выберите профиль для отклика'}</h3>
							<button className={styles.modalClose} onClick={() => setAgentModalOpen(false)}>
								<IconX size={16} />
							</button>
						</div>
						{agentProfiles.length === 0 ? (
							<p className={styles.modalEmpty}>{isAgent ? 'У вас ещё нет профилей актёров. Создайте их в разделе «Актёры».' : 'Сначала создайте профиль актёра.'}</p>
						) : (
							<div className={styles.profileList}>
								{agentProfiles.map(p => {
									const selected = selectedProfileIds.has(p.id)
									const ready = p.readiness === 'ready'
									const responded = isAgent && respondedActorIds.has(Number(p.id))
									const disabled = !ready || responded
									return (
										<button
											key={p.id}
											className={`${styles.profileItem} ${selected ? styles.profileItemActive : ''} ${disabled ? styles.profileItemDisabled : ''}`}
											onClick={() => { if (!disabled) toggleAgentProfile(p.id) }}
											disabled={disabled}
											title={responded ? 'Этот актёр уже откликнут' : (ready ? '' : 'Профиль заполнен не полностью')}
										>
											<span className={styles.profileCheckbox}>{(selected || responded) ? '✓' : ''}</span>
											<span className={styles.profileName}>
												{[p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name || 'Актёр'}
											</span>
											<span className={`${styles.profileCity} ${(!ready && !responded) ? styles.profileCityWarn : ''}`}>
												{responded ? 'Уже откликнут' : (ready ? (p.city || '') : (p.readiness_label || 'Заполните профиль'))}
											</span>
										</button>
									)
								})}
							</div>
						)}
						<div className={styles.modalFooter}>
							<button
								className={styles.respondBtn}
								disabled={agentSubmitting || selectedProfileIds.size === 0}
								onClick={submitAgentRespond}
							>
								{agentSubmitting ? (
									<><IconLoader size={14} /> Отправка...</>
								) : (
									<>{isAgent ? `Откликнуть (${selectedProfileIds.size})` : 'Откликнуться'}</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
