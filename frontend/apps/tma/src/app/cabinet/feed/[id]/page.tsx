'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { $session } from '@prostoprobuy/models'
import { apiCall, publicGet } from '~/shared/api-client'
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
	const [respondLoading, setRespondLoading] = useState(false)

	// agent modal
	const [agentProfiles, setAgentProfiles] = useState<any[]>([])
	const [selectedProfileIds, setSelectedProfileIds] = useState<Set<number>>(new Set())
	const [agentModalOpen, setAgentModalOpen] = useState(false)
	const [agentSubmitting, setAgentSubmitting] = useState(false)

	// Anonymous visitors (e.g. coming from the Telegram channel) can VIEW the
	// casting. Login is only required when they actually try to respond.
	useEffect(() => {
		const session = $session.getState()
		if (session?.access_token) {
			setToken(session.access_token)
			setIsAuthed(true)
			try {
				const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
				if (payload?.role === 'agent') setIsAgent(true)
				if (payload?.role === 'user') setIsActor(true)
			} catch {}
		}
		setAuthChecked(true)
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

				if (isAgent || isActor) {
					const profiles = await apiCall('GET', 'tma/actor-profiles/my/').catch(() => ({ profiles: [] }))
					setAgentProfiles(profiles?.profiles || [])
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
		if (!isAgent && isActor && agentProfiles.length > 1) {
			setAgentModalOpen(true)
			setSelectedProfileIds(new Set())
			return
		}
		setRespondLoading(true)
		try {
			const payload: any = { casting_id: casting.id }
			if (!isAgent && isActor && agentProfiles.length === 1) payload.actor_profile_id = agentProfiles[0].id
			const res = await apiCall('POST', 'feed/respond/', payload)
			if (res?.id || res?.ok) {
				setAlreadyResponded(true)
			} else if (res?.detail) {
				const detail = typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.'
				if (detail.includes('Сначала создайте профиль актёра')) {
					const target = `/cabinet/feed/${casting.id}`
					setPendingReturnUrl(target)
					const shouldCreate = await dialog.confirm({
						title: 'Нужна анкета актёра',
						message: 'Чтобы откликнуться, сначала создайте анкету актёра. После создания анкеты вы вернётесь к этому кастингу.',
						confirmLabel: 'Создать анкету',
						cancelLabel: 'Позже',
						tone: 'warning',
					})
					if (shouldCreate) router.push('/cabinet/profile/create')
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
		setAgentSubmitting(true)
		const res = isAgent
			? await apiCall('POST', 'feed/agent-respond/', {
				casting_id: casting.id,
				profile_ids: Array.from(selectedProfileIds),
			})
			: await apiCall('POST', 'feed/respond/', {
				casting_id: casting.id,
				actor_profile_id: Array.from(selectedProfileIds)[0],
			})
		setAgentSubmitting(false)
		if (res?.ok || res?.id || Number(res?.total_submitted) > 0 || (Array.isArray(res?.results) && res.results.some((r: any) => r.status === 'ok' || r.status === 'already_responded'))) {
			setAlreadyResponded(true)
			setAgentModalOpen(false)
			setSelectedProfileIds(new Set())
		} else if (res?.detail) {
			dialog.error({
				title: 'Не получилось откликнуться',
				message: typeof res.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
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

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Лента
				</button>
				<h1 className={styles.headerTitle}>Кастинг</h1>
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

					<div className={styles.actions}>
						{alreadyResponded ? (
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
									if (isAgent) setAgentModalOpen(true)
									else handleRespond()
								}}
							>
								{respondLoading ? (
									<><IconLoader size={14} /> Отправка...</>
								) : isAgent ? (
									<><IconUser size={14} /> Откликнуть актёров</>
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
							<h3>{isAgent ? 'Выберите актёров для отклика' : 'Выберите анкету для отклика'}</h3>
							<button className={styles.modalClose} onClick={() => setAgentModalOpen(false)}>
								<IconX size={16} />
							</button>
						</div>
						{agentProfiles.length === 0 ? (
							<p className={styles.modalEmpty}>{isAgent ? 'У вас ещё нет анкет актёров. Создайте их в разделе «Актёры».' : 'Сначала создайте анкету актёра.'}</p>
						) : (
							<div className={styles.profileList}>
								{agentProfiles.map(p => {
									const selected = selectedProfileIds.has(p.id)
									return (
										<button
											key={p.id}
											className={`${styles.profileItem} ${selected ? styles.profileItemActive : ''}`}
											onClick={() => toggleAgentProfile(p.id)}
										>
											<span className={styles.profileCheckbox}>{selected ? '✓' : ''}</span>
											<span className={styles.profileName}>
												{[p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name || 'Актёр'}
											</span>
											<span className={styles.profileCity}>{p.city || ''}</span>
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
