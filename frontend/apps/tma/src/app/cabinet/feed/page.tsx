'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import {
	IconFilm,
	IconArrowLeft,
	IconLoader,
	IconCheck,
	IconSearch,
	IconZap,
	IconCalendar,
	IconEye,
	IconX,
	IconUser,
} from '~packages/ui/icons'
import styles from './feed.module.scss'

export default function FeedPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [isAgent, setIsAgent] = useState(false)
	const [agentProfiles, setAgentProfiles] = useState<any[]>([])
	const [projects, setProjects] = useState<any[]>([])
	const [myResponseIds, setMyResponseIds] = useState<Set<number>>(new Set())
	const [loading, setLoading] = useState(true)
	const [respondingTo, setRespondingTo] = useState<number | null>(null)
	const [search, setSearch] = useState('')
	const [selectedProject, setSelectedProject] = useState<any | null>(null)
	// Agent respond modal
	const [agentRespondCastingId, setAgentRespondCastingId] = useState<number | null>(null)
	const [selectedProfileIds, setSelectedProfileIds] = useState<Set<number>>(new Set())
	const [agentSubmitting, setAgentSubmitting] = useState(false)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
		try {
			const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
			const role = payload?.role
			if (role === 'agent') {
				setIsAgent(true)
			}
		} catch {}
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		return apiCall(method, path, body)
	}, [])

	const normalizeCastingImageUrl = (url?: string | null) => {
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
		const promises: Promise<any>[] = [
			api('GET', 'feed/projects/?page_size=100').catch(() => ({ projects: [] })),
			api('GET', 'feed/my-responses/').catch(() => ({ responses: [] })),
		]
		if (isAgent) {
			promises.push(api('GET', 'tma/actor-profiles/my/').catch(() => ({ profiles: [] })))
		}
		Promise.all(promises).then(([feedData, responsesData, profilesData]) => {
			setProjects(feedData?.projects || [])
			const ids = new Set<number>(
				(responsesData?.responses || []).map((r: any) => r.casting_id)
			)
			setMyResponseIds(ids)
			if (profilesData) {
				setAgentProfiles(profilesData?.profiles || [])
			}
			setLoading(false)
		})
	}, [token, api, isAgent])

	const handleRespond = async (castingId: number) => {
		if (isAgent) {
			setAgentRespondCastingId(castingId)
			setSelectedProfileIds(new Set())
			return
		}
		setRespondingTo(castingId)
		try {
			const res = await api('POST', 'feed/respond/', { casting_id: castingId })
			if (res?.id) {
				setMyResponseIds(prev => new Set(prev).add(castingId))
			} else if (res?.detail) {
				alert(typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail))
			} else if (!res) {
				alert('Ошибка сервера. Попробуйте ещё раз.')
			}
		} catch {
			alert('Ошибка при отклике. Проверьте соединение.')
		}
		setRespondingTo(null)
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
					alert('Все выбранные актёры уже откликнулись на этот кастинг.')
					setMyResponseIds(prev => new Set(prev).add(agentRespondCastingId!))
				}
				setAgentRespondCastingId(null)
			} else {
				alert('Ошибка при отклике.')
			}
		} catch {
			alert('Ошибка при отклике. Проверьте соединение.')
		}
		setAgentSubmitting(false)
	}

	const normalizeMediaUrl = (url?: string | null) => {
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

	const filtered = search.trim()
		? projects.filter(
				(p: any) =>
					p.title?.toLowerCase().includes(search.toLowerCase()) ||
					p.description?.toLowerCase().includes(search.toLowerCase())
			)
		: projects

	if (loading)
		return (
			<div className={styles.root}>
				<p className={styles.center}>
					<IconLoader size={20} style={{ marginRight: 8 }} />
					Загрузка ленты...
				</p>
			</div>
		)

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button onClick={() => router.push('/cabinet')} className={styles.backBtn}>
					<IconArrowLeft size={14} /> Кабинет
				</button>
				<div className={styles.headerTitle}>
					<IconFilm size={16} />
					<h1>Лента кастингов</h1>
				</div>
				<span className={styles.headerCount}>{projects.length}</span>
			</header>

			<div className={styles.content}>
				<div className={styles.searchWrap}>
					<IconSearch size={15} />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Поиск по названию или описанию..."
						className={styles.searchInput}
					/>
				</div>

				{filtered.length === 0 ? (
					<div className={styles.empty}>
						<IconFilm size={40} />
						<h3>{search ? 'Ничего не найдено' : 'Пока нет кастингов'}</h3>
						<p>
							{search
								? 'Попробуйте изменить поисковый запрос'
								: 'Когда работодатели опубликуют проекты, они появятся здесь'}
						</p>
					</div>
				) : (
					<div className={styles.feedList}>
						{filtered.map((p: any) => {
							const alreadyResponded = myResponseIds.has(p.id)
							const createdAtLabel = new Date(p.created_at).toLocaleDateString('ru-RU', {
								day: '2-digit',
								month: '2-digit',
								year: 'numeric',
							})
							const descShort =
								p.description && p.description.length > 150
									? p.description.slice(0, 150) + '…'
									: p.description

							return (
								<article key={p.id} className={styles.feedCard}>
									<div className={styles.cardMain}>
										<div className={styles.cardMedia}>
											{p.image_url ? (
												<img
													src={normalizeCastingImageUrl(p.image_url) || ''}
													alt={p.title}
													className={styles.cardImg}
												/>
											) : (
												<div className={styles.cardIcon}>
													<IconFilm size={24} />
													<span>Без обложки</span>
												</div>
											)}
											<span className={styles.cardStatusFloating}>
												Опубликован
											</span>
										</div>

										<div className={styles.cardBody}>
											<div className={styles.cardHead}>
												<h3 className={styles.cardTitle}>{p.title}</h3>
												<span className={styles.cardId}>#{p.id}</span>
											</div>

											<div className={styles.cardMeta}>
												<span className={styles.cardMetaItem}>
													<IconCalendar size={12} />
													Дата: <b>{createdAtLabel}</b>
												</span>
												{p.published_by && (
													<span className={styles.cardMetaItem}>
														<IconUser size={12} />
														Опубликовал:{' '}
														{p.published_by_id ? (
															<b
																className={styles.publisherLink}
																onClick={(e) => {
																	e.stopPropagation()
																	router.push(`/cabinet/admin-profile/${p.published_by_id}`)
																}}
															>
																{p.published_by}
															</b>
														) : (
															<b>{p.published_by}</b>
														)}
													</span>
												)}
											</div>

											{p.description ? (
												<p className={styles.cardDesc}>
													{descShort}
													{p.description.length > 150 && (
														<button
															className={styles.expandBtn}
															onClick={() => setSelectedProject(p)}
														>
															Подробнее
														</button>
													)}
												</p>
											) : (
												<p className={styles.cardDescEmpty}>
													Описание пока не добавлено.
												</p>
											)}

											<div className={styles.cardActions}>
												<button
													className={styles.detailsBtn}
													onClick={() => setSelectedProject(p)}
												>
													<IconEye size={14} /> Подробнее
												</button>
											{alreadyResponded ? (
												<div className={styles.respondedBadge}>
													<IconCheck size={14} />
													{isAgent ? 'Актёры откликнуты' : 'Вы откликнулись'}
												</div>
											) : (
												<button
													className={styles.respondBtn}
													disabled={respondingTo === p.id}
													onClick={() => handleRespond(p.id)}
												>
													{respondingTo === p.id ? (
														<>
															<IconLoader size={14} /> Отправка...
														</>
													) : isAgent ? (
														<>
															<IconUser size={14} /> Откликнуть актёров
														</>
													) : (
														<>
															<IconZap size={14} /> Откликнуться
														</>
													)}
												</button>
											)}
											</div>
										</div>
									</div>
								</article>
							)
						})}
					</div>
				)}
			</div>

			{selectedProject && (
				<div className={styles.modalOverlay} onClick={() => setSelectedProject(null)}>
					<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
						<button className={styles.modalClose} onClick={() => setSelectedProject(null)}>
							<IconX size={16} />
						</button>
						<div className={styles.modalMedia}>
							{selectedProject.image_url ? (
								<img
									src={normalizeCastingImageUrl(selectedProject.image_url) || ''}
									alt={selectedProject.title}
									className={styles.modalImg}
								/>
							) : (
								<div className={styles.modalPlaceholder}>
									<IconFilm size={30} />
								</div>
							)}
						</div>
						<div className={styles.modalBody}>
							<div className={styles.modalHead}>
								<h3 className={styles.modalTitle}>{selectedProject.title}</h3>
								<span className={styles.cardStatus}>Опубликован</span>
							</div>
							<div className={styles.cardMeta}>
								<span className={styles.cardMetaItem}>
									<IconCalendar size={12} /> Дата создания
									<b>
										{new Date(selectedProject.created_at).toLocaleDateString('ru-RU', {
											day: '2-digit',
											month: '2-digit',
											year: 'numeric',
										})}
									</b>
								</span>
							{selectedProject.published_by && (
								<span className={styles.cardMetaItem}>
									<IconUser size={12} />
									Опубликовал:{' '}
									{selectedProject.published_by_id ? (
										<b
											className={styles.publisherLink}
											onClick={(e) => {
												e.stopPropagation()
												router.push(`/cabinet/admin-profile/${selectedProject.published_by_id}`)
											}}
										>
											{selectedProject.published_by}
										</b>
									) : (
										<b>{selectedProject.published_by}</b>
									)}
								</span>
							)}
							</div>
							{selectedProject.description && (
								<p className={styles.modalDesc}>{selectedProject.description}</p>
							)}
							<div className={styles.modalActions}>
							{myResponseIds.has(selectedProject.id) ? (
								<div className={styles.respondedBadge}>
									<IconCheck size={14} />
									{isAgent ? 'Актёры откликнуты' : 'Вы откликнулись'}
								</div>
							) : (
								<button
									className={styles.respondBtn}
									disabled={respondingTo === selectedProject.id}
									onClick={() => handleRespond(selectedProject.id)}
								>
									{respondingTo === selectedProject.id ? (
										<>
											<IconLoader size={14} /> Отправка...
										</>
									) : isAgent ? (
										<>
											<IconUser size={14} /> Откликнуть актёров
										</>
									) : (
										<>
											<IconZap size={14} /> Откликнуться
										</>
									)}
								</button>
							)}
							</div>
						</div>
					</div>
				</div>
			)}

			{agentRespondCastingId && (
				<div className={styles.modalOverlay} onClick={() => setAgentRespondCastingId(null)}>
					<div className={styles.agentModal} onClick={e => e.stopPropagation()}>
						<div className={styles.agentModalHeader}>
							<h3>Выберите актёров для отклика</h3>
							<button className={styles.modalClose} onClick={() => setAgentRespondCastingId(null)}>
								<IconX size={16} />
							</button>
						</div>
						<p className={styles.agentModalHint}>
							Отметьте актёров из вашей базы, которых хотите откликнуть на этот кастинг
						</p>
						{agentProfiles.length === 0 ? (
							<div className={styles.agentModalEmpty}>
								У вас ещё нет актёров. Добавьте актёра в кабинете.
							</div>
						) : (
							<div className={styles.agentProfileList}>
								{agentProfiles.map((p: any) => {
									const isSelected = selectedProfileIds.has(p.id)
									return (
										<button
											key={p.id}
											type="button"
											className={`${styles.agentProfileItem} ${isSelected ? styles.agentProfileItemSelected : ''}`}
											onClick={() => toggleProfileSelection(p.id)}
										>
											<div className={styles.agentProfileAvatar}>
												{p.primary_photo ? (
													<img src={normalizeMediaUrl(p.primary_photo) || ''} alt="" />
												) : (
													<span>{(p.first_name?.[0] || '?').toUpperCase()}</span>
												)}
											</div>
											<div className={styles.agentProfileInfo}>
												<strong>{p.first_name} {p.last_name}</strong>
												<small>{p.city || 'Город не указан'} · {p.gender === 'male' ? 'Муж' : 'Жен'}</small>
											</div>
											<div className={styles.agentProfileCheck}>
												{isSelected && <IconCheck size={16} />}
											</div>
										</button>
									)
								})}
							</div>
						)}
						<div className={styles.agentModalActions}>
							<button
								className={styles.agentModalCancel}
								onClick={() => setAgentRespondCastingId(null)}
							>
								Отмена
							</button>
							<button
								className={styles.agentModalSubmit}
								disabled={selectedProfileIds.size === 0 || agentSubmitting}
								onClick={handleAgentSubmit}
							>
								{agentSubmitting
									? <><IconLoader size={14} /> Отправка...</>
									: <><IconZap size={14} /> Откликнуть ({selectedProfileIds.size})</>
								}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
