'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { getCoverImage } from '~/shared/fallback-cover'
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
	IconCamera,
	IconAlertCircle,
	IconFilter,
} from '~packages/ui/icons'
import { RUSSIAN_CITIES, ROLE_TYPES } from '~/shared/casting-dictionaries'
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
	// Filters
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [filterCity, setFilterCity] = useState('')
	const [filterFeeFrom, setFilterFeeFrom] = useState('')
	const [filterFeeTo, setFilterFeeTo] = useState('')
	const [filterRole, setFilterRole] = useState('')
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
				const detail = res?.detail || 'Неизвестная ошибка при отклике.'
				alert(detail)
			}
		} catch (err: any) {
			const detail = err?.response?.data?.detail || err?.message || 'Ошибка сети.'
			alert(`Ошибка при отклике: ${detail}`)
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

	// Объединяем список городов из справочника и те, что уже встречаются в
	// кастингах (на случай нестандартных значений).
	const citiesFromProjects = new Set(
		projects.map((p: any) => p.city).filter(Boolean) as string[]
	)
	const cityOptions = Array.from(new Set([...RUSSIAN_CITIES, ...citiesFromProjects]))
		.sort((a, b) => a.localeCompare(b, 'ru'))

	// Роли берём из общего справочника + все кастомные, которые встретились
	const rolesFromProjects = new Set(
		projects.flatMap((p: any) =>
			Array.isArray(p.role_types) ? p.role_types : []
		).filter(Boolean) as string[]
	)
	const roleOptions = Array.from(new Set([...ROLE_TYPES, ...rolesFromProjects]))

	// Парсим числовое значение из строки гонорара ("5 000 ₽", "от 10000", "5000-15000" …)
	const parseFeeNumber = (raw?: string | null): number | null => {
		if (!raw) return null
		const digits = String(raw).match(/\d[\d\s.,]*/g)
		if (!digits || digits.length === 0) return null
		// Берём максимальное число, встреченное в строке
		const nums = digits
			.map(s => parseInt(s.replace(/[\s.,]/g, ''), 10))
			.filter(n => Number.isFinite(n))
		if (nums.length === 0) return null
		return Math.max(...nums)
	}

	const activeFiltersCount =
		(filterCity ? 1 : 0) +
		(filterFeeFrom || filterFeeTo ? 1 : 0) +
		(filterRole ? 1 : 0)

	const resetFilters = () => {
		setFilterCity('')
		setFilterFeeFrom('')
		setFilterFeeTo('')
		setFilterRole('')
	}

	const filtered = projects.filter((p: any) => {
		// Поиск по названию/описанию
		if (search.trim()) {
			const q = search.toLowerCase()
			const titleMatch = p.title?.toLowerCase().includes(q)
			const descMatch = p.description?.toLowerCase().includes(q)
			if (!titleMatch && !descMatch) return false
		}
		// Город
		if (filterCity && p.city !== filterCity) return false
		// Гонорар: от/до применимы только если удалось распарсить число
		if (filterFeeFrom || filterFeeTo) {
			const fee = parseFeeNumber(p.financial_conditions)
			if (fee == null) return false
			if (filterFeeFrom && fee < parseInt(filterFeeFrom, 10)) return false
			if (filterFeeTo && fee > parseInt(filterFeeTo, 10)) return false
		}
		// Тип роли
		if (filterRole) {
			const roles = Array.isArray(p.role_types) ? p.role_types : []
			if (!roles.includes(filterRole)) return false
		}
		return true
	})

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
				<div className={styles.toolbar}>
					<div className={styles.searchWrap}>
						<IconSearch size={15} />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Поиск по названию или описанию..."
							className={styles.searchInput}
						/>
					</div>
					<button
						className={`${styles.filterBtn} ${activeFiltersCount > 0 ? styles.filterBtnActive : ''}`}
						onClick={() => setFiltersOpen(true)}
					>
						<IconFilter size={15} />
						<span>Фильтры</span>
						{activeFiltersCount > 0 && (
							<span className={styles.filterBadge}>{activeFiltersCount}</span>
						)}
					</button>
					{activeFiltersCount > 0 && (
						<button
							className={styles.filterResetBtn}
							onClick={resetFilters}
							title="Сбросить фильтры"
						>
							<IconX size={14} />
						</button>
					)}
				</div>

				{/* Чипы активных фильтров */}
				{activeFiltersCount > 0 && (
					<div className={styles.activeFilters}>
						{filterCity && (
							<button
								className={styles.activeChip}
								onClick={() => setFilterCity('')}
							>
								📍 {filterCity}
								<IconX size={11} />
							</button>
						)}
						{(filterFeeFrom || filterFeeTo) && (
							<button
								className={styles.activeChip}
								onClick={() => { setFilterFeeFrom(''); setFilterFeeTo('') }}
							>
								💰 {filterFeeFrom || '0'}–{filterFeeTo || '∞'} ₽
								<IconX size={11} />
							</button>
						)}
						{filterRole && (
							<button
								className={styles.activeChip}
								onClick={() => setFilterRole('')}
							>
								🎭 {filterRole}
								<IconX size={11} />
							</button>
						)}
					</div>
				)}

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
											<img
												src={getCoverImage(normalizeCastingImageUrl(p.image_url), p.id || p.title)}
												alt={p.title}
												className={styles.cardImg}
											/>
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

											{(p.city || p.project_category || p.gender || p.age_from || p.age_to || p.financial_conditions || p.shooting_dates || (p.role_types && p.role_types.length > 0)) && (
												<div className={styles.cardMetaTags}>
													{p.city && <span className={styles.cardMetaTag}>📍 {p.city}</span>}
													{p.project_category && <span className={styles.cardMetaTag}>{p.project_category}</span>}
													{p.gender && <span className={styles.cardMetaTag}>{p.gender}</span>}
													{(p.age_from || p.age_to) && <span className={styles.cardMetaTag}>{p.age_from || '?'}–{p.age_to || '?'} лет</span>}
													{p.role_types && p.role_types.length > 0 && <span className={styles.cardMetaTag}>{p.role_types.join(', ')}</span>}
													{p.financial_conditions && <span className={styles.cardMetaTag}>💰 {p.financial_conditions}</span>}
													{p.shooting_dates && <span className={styles.cardMetaTag}>📅 {p.shooting_dates}</span>}
												</div>
											)}

											{p.description && p.description !== '-' ? (
												<p className={styles.cardDesc}>
													{descShort}
													{p.description.length > 150 && (
														<button
															className={styles.expandBtn}
															onClick={() => router.push(`/cabinet/feed/${p.id}`)}
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
													onClick={() => router.push(`/cabinet/feed/${p.id}`)}
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
												<span className={`${styles.profileStatus} ${styles[`profileStatus_${p.readiness || 'incomplete'}`]}`}>
													{p.readiness === 'ready'
														? <><IconCheck size={11} /> {p.readiness_label}</>
														: <><IconAlertCircle size={11} /> {p.readiness_label}</>
													}
												</span>
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

			{/* Панель фильтров */}
			{filtersOpen && (
				<div className={styles.filterOverlay} onClick={() => setFiltersOpen(false)}>
					<aside className={styles.filterPanel} onClick={(e) => e.stopPropagation()}>
						<div className={styles.filterHeader}>
							<h3>Фильтры</h3>
							<button className={styles.filterClose} onClick={() => setFiltersOpen(false)}>
								<IconX size={16} />
							</button>
						</div>

						<div className={styles.filterBody}>
							<div className={styles.filterField}>
								<label>📍 Город</label>
								<select
									className={styles.filterSelect}
									value={filterCity}
									onChange={(e) => setFilterCity(e.target.value)}
								>
									<option value="">Все города</option>
									{cityOptions.map((c) => (
										<option key={c} value={c}>{c}</option>
									))}
								</select>
							</div>

							<div className={styles.filterField}>
								<label>💰 Гонорар, ₽</label>
								<div className={styles.filterRange}>
									<input
										type="number"
										inputMode="numeric"
										min="0"
										placeholder="от"
										className={styles.filterRangeInput}
										value={filterFeeFrom}
										onChange={(e) => setFilterFeeFrom(e.target.value.replace(/[^0-9]/g, ''))}
									/>
									<span className={styles.filterRangeDash}>–</span>
									<input
										type="number"
										inputMode="numeric"
										min="0"
										placeholder="до"
										className={styles.filterRangeInput}
										value={filterFeeTo}
										onChange={(e) => setFilterFeeTo(e.target.value.replace(/[^0-9]/g, ''))}
									/>
								</div>
							</div>

							<div className={styles.filterField}>
								<label>🎭 Тип роли</label>
								<div className={styles.filterChips}>
									<button
										type="button"
										className={`${styles.filterChip} ${!filterRole ? styles.filterChipActive : ''}`}
										onClick={() => setFilterRole('')}
									>
										Все
									</button>
									{roleOptions.map((r) => (
										<button
											key={r}
											type="button"
											className={`${styles.filterChip} ${filterRole === r ? styles.filterChipActive : ''}`}
											onClick={() => setFilterRole(r === filterRole ? '' : r)}
										>
											{r}
										</button>
									))}
								</div>
							</div>
						</div>

						<div className={styles.filterFooter}>
							<button
								className={styles.filterResetFull}
								onClick={resetFilters}
								disabled={activeFiltersCount === 0}
							>
								Сбросить
							</button>
							<button
								className={styles.filterApply}
								onClick={() => setFiltersOpen(false)}
							>
								Показать ({filtered.length})
							</button>
						</div>
					</aside>
				</div>
			)}
		</div>
	)
}
