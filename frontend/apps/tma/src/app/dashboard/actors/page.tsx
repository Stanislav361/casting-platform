'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { getVideoPlayback } from '~/shared/video-link'
import {
	IconArrowLeft,
	IconUsers,
	IconLoader,
	IconSearch,
	IconChevronLeft,
	IconChevronRight,
	IconX,
	IconMapPin,
	IconUser,
	IconBriefcase,
	IconHeart,
	IconStar,
	IconSend,
	IconTrash,
} from '~packages/ui/icons'
import styles from './actors.module.scss'

export default function ActorsPageWrapper() {
	return (
		<Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Загрузка...</div>}>
			<ActorsPage />
		</Suspense>
	)
}

function ActorsPage() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const startWithFavorites = searchParams.get('favorites') === 'true'
	const [token, setToken] = useState<string | null>(null)
	const [actors, setActors] = useState<any[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState('')
	const [searchDebounced, setSearchDebounced] = useState('')
	const [page, setPage] = useState(1)
	const PAGE_SIZE = 30
	const [selectedActor, setSelectedActor] = useState<any | null>(null)
	const [photoIdx, setPhotoIdx] = useState(0)
	const [showContacts, setShowContacts] = useState(false)
	const [lightboxOpen, setLightboxOpen] = useState(false)
	const [videoOpen, setVideoOpen] = useState(false)
	const [favorites, setFavorites] = useState<Set<number>>(new Set())
	const [showFavOnly, setShowFavOnly] = useState(startWithFavorites)
	const [reviews, setReviews] = useState<any[]>([])
	const [avgRating, setAvgRating] = useState(5.0)
	const [reviewCount, setReviewCount] = useState(0)
	const [myRating, setMyRating] = useState(0)
	const [myComment, setMyComment] = useState('')
	const [reviewLoading, setReviewLoading] = useState(false)
	const [submittingReview, setSubmittingReview] = useState(false)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		try {
			return await apiCall(method, path, body)
		} catch {
			return null
		}
	}, [])

	useEffect(() => {
		if (!token) return
		api('GET', 'employer/favorites/ids/').then((data) => {
			if (data?.profile_ids) setFavorites(new Set(data.profile_ids))
		})
	}, [token, api])

	useEffect(() => {
		const t = setTimeout(() => setSearchDebounced(search), 350)
		return () => clearTimeout(t)
	}, [search])

	useEffect(() => {
		if (!token) return
		setLoading(true)
		const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
		if (searchDebounced.trim()) params.set('search', searchDebounced.trim())
		api('GET', `employer/actors/all/?${params}`).then((data) => {
			setActors(data?.respondents || [])
			setTotal(data?.total || 0)
			setLoading(false)
		})
	}, [token, api, page, searchDebounced])

	useEffect(() => {
		setPage(1)
	}, [searchDebounced])

	const totalPages = Math.ceil(total / PAGE_SIZE) || 1
	const safeText = (value: unknown) => {
		if (value === null || value === undefined) return null
		if (typeof value === 'string') return value.trim() || null
		if (typeof value === 'number') return String(value)
		if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
		try {
			const normalized = String(value).trim()
			return normalized && normalized !== '[object Object]' ? normalized : null
		} catch {
			return null
		}
	}
	const formatGender = (gender?: string | null) => {
		const normalized = safeText(gender)
		if (!normalized) return null
		if (normalized === 'male') return 'Мужчина'
		if (normalized === 'female') return 'Женщина'
		return normalized
	}
	const formatQualification = (qualification?: string | null) => {
		const normalized = safeText(qualification)
		if (!normalized) return null
		const map: Record<string, string> = {
			professional: 'Профессионал',
			skilled: 'Опытный',
			enthusiast: 'Энтузиаст',
			beginner: 'Начинающий',
			other: 'Другое',
		}
		return map[normalized] || normalized
	}

	const toggleFavorite = async (profileId: number, e?: React.MouseEvent) => {
		e?.stopPropagation()
		e?.preventDefault()
		if (!profileId) return
		const wasFav = favorites.has(profileId)
		setFavorites(prev => {
			const next = new Set(prev)
			if (wasFav) next.delete(profileId)
			else next.add(profileId)
			return next
		})
		const res = await api('POST', `employer/favorites/toggle/?profile_id=${profileId}`)
		if (res?.ok) return
		setFavorites(prev => {
			const next = new Set(prev)
			if (wasFav) next.add(profileId)
			else next.delete(profileId)
			return next
		})
		if (res?.detail) {
			alert(`Ошибка: ${typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail)}`)
		}
	}

	const openActor = (a: any) => {
		setSelectedActor(a)
		setPhotoIdx(0)
		setShowContacts(false)
		setLightboxOpen(false)
		setVideoOpen(false)
		loadReviews(a.profile_id)
	}

	const loadReviews = async (profileId: number) => {
		setReviewLoading(true)
		setReviews([])
		setMyRating(0)
		setMyComment('')
		try {
			const data = await apiCall('GET', `employer/actors/${profileId}/reviews/`)
			if (data) {
				setReviews(data.reviews || [])
				setAvgRating(data.avg_rating ?? 5.0)
				setReviewCount(data.review_count ?? 0)
				const mine = (data.reviews || []).find((r: any) => r.is_mine)
				if (mine) {
					setMyRating(mine.rating)
					setMyComment(mine.comment || '')
				}
			}
		} catch {}
		setReviewLoading(false)
	}

	const submitReview = async () => {
		if (!selectedActor || myRating < 1) return
		setSubmittingReview(true)
		try {
			await apiCall('POST', `employer/actors/${selectedActor.profile_id}/reviews/`, {
				rating: myRating,
				comment: myComment,
			})
			await loadReviews(selectedActor.profile_id)
		} catch {}
		setSubmittingReview(false)
	}

	const deleteReview = async (reviewId: number) => {
		if (!selectedActor) return
		await apiCall('DELETE', `employer/actors/${selectedActor.profile_id}/reviews/${reviewId}/`)
		await loadReviews(selectedActor.profile_id)
	}

	const maskPhone = (phone?: string) => {
		if (!phone) return '—'
		return phone.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 (***) ***-$4-$5')
	}
	const maskEmail = (email?: string) => {
		if (!email) return '—'
		const [local, domain] = email.split('@')
		return `${local?.[0] || ''}***@${domain || '***'}`
	}

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

	const getActorPreviewPhoto = (actor: any) => {
		const mediaPhotos = (actor?.media_assets || []).filter((m: any) => m.file_type === 'photo')
		const primaryPhoto = mediaPhotos.find((m: any) => m.is_primary)
		return normalizeMediaUrl(
			primaryPhoto?.thumbnail_url ||
			primaryPhoto?.processed_url ||
			primaryPhoto?.original_url ||
			mediaPhotos[0]?.thumbnail_url ||
			mediaPhotos[0]?.processed_url ||
			mediaPhotos[0]?.original_url ||
			actor?.photo_url ||
			null,
		)
	}

	const photos = selectedActor
		? (selectedActor.media_assets || []).filter((m: any) => m.file_type === 'photo')
		: []
	const videos = selectedActor
		? (selectedActor.media_assets || []).filter((m: any) => m.file_type === 'video')
		: []
	const currentPhoto = photos[photoIdx]
	const actorVideoPlayback = getVideoPlayback(
		videos[0]?.processed_url || videos[0]?.original_url || selectedActor?.video_intro || null,
		{ poster: videos[0]?.thumbnail_url || null },
	)

	const displayActors = showFavOnly
		? actors.filter(a => favorites.has(a.profile_id))
		: actors

	if (!token) return null

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button onClick={() => router.push('/dashboard')} className={styles.backBtn}>
					<IconArrowLeft size={14} /> Назад
				</button>
				<div className={styles.headerTitle}>
					{showFavOnly ? <IconHeart size={16} /> : <IconUsers size={16} />}
					<h1>{showFavOnly ? 'Избранные актёры' : 'База актёров'}</h1>
				</div>
				<span className={styles.headerCount}>{showFavOnly ? favorites.size : total}</span>
			</header>

			<div className={styles.content}>
				<div className={styles.toolbar}>
					<div className={styles.searchWrap}>
						<IconSearch size={15} />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Поиск по имени, городу или описанию..."
							className={styles.searchInput}
						/>
					</div>

					<div className={styles.filterRow}>
						<button
							className={`${styles.favFilterBtn} ${!showFavOnly ? styles.favFilterBtnActive : ''}`}
							onClick={() => setShowFavOnly(false)}
						>
							Все актёры
						</button>
						{(favorites.size > 0 || showFavOnly) && (
							<button
								className={`${styles.favFilterBtn} ${showFavOnly ? styles.favFilterBtnActive : ''}`}
								onClick={() => setShowFavOnly(!showFavOnly)}
							>
								<IconHeart size={13} style={showFavOnly ? { fill: 'currentColor' } : {}} />
								Избранные ({favorites.size})
							</button>
						)}
					</div>
				</div>

				{loading ? (
					<p className={styles.center}>
						<IconLoader size={20} /> Загрузка...
					</p>
				) : displayActors.length === 0 ? (
					<div className={styles.empty}>
						<IconUsers size={40} />
						<h3>{searchDebounced ? 'Ничего не найдено' : showFavOnly ? 'Нет избранных' : 'Нет актёров'}</h3>
						<p>{searchDebounced ? 'Попробуйте изменить запрос' : showFavOnly ? 'Добавьте актёров в избранное' : 'Актёры появятся после регистрации'}</p>
					</div>
				) : (
					<>
						<div className={styles.actorGrid}>
							{displayActors.map((a: any) => {
								const firstName = safeText(a.first_name) || ''
								const lastName = safeText(a.last_name) || ''
								const displayName = safeText(a.display_name)
								const city = safeText(a.city)
								const aboutMe = safeText(a.about_me)
								const ageValue = typeof a.age === 'number' ? a.age : Number(a.age)
								const age = Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null
								const height = safeText(a.height)
								const clothingSize = safeText(a.clothing_size)
								const shoeSize = safeText(a.shoe_size)
								const name = displayName || `${lastName} ${firstName}`.trim() || 'Актёр'
								const initials = (firstName[0] || '') + (lastName[0] || '')
								const isFav = favorites.has(a.profile_id)
								const previewPhoto = getActorPreviewPhoto(a)
								const actorMeta = [
									age ? `${age} ${age === 1 ? 'год' : 'лет'}` : null,
									city,
									formatGender(a.gender),
								].filter(Boolean)
								const actorFacts = [
									height ? `${height} см` : null,
									clothingSize ? `${clothingSize} размер` : null,
									shoeSize ? `${shoeSize} обувь` : null,
								].filter(Boolean)
								return (
									<div key={a.profile_id} className={styles.actorCard} onClick={() => openActor(a)}>
										<div className={styles.actorPhotoWrap}>
											<div className={styles.actorPhoto}>
												{previewPhoto ? <img src={previewPhoto} alt={name} /> : initials.toUpperCase() || '?'}
											</div>
											<button
												className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
												onClick={(e) => toggleFavorite(a.profile_id, e)}
											>
												<IconHeart size={16} style={isFav ? { fill: 'currentColor' } : {}} />
											</button>
										</div>
										<div className={styles.actorBody}>
											<div className={styles.actorInfo}>
												<div className={styles.actorName}>{name}</div>
												<div className={styles.actorSubtitle}>
													{actorMeta.join(' • ') || 'Актёрская анкета'}
												</div>
											</div>
											<div className={styles.actorMeta}>
												{city && <span><IconMapPin size={11} /> {city}</span>}
												{formatGender(a.gender) && <span><IconUser size={11} /> {formatGender(a.gender)}</span>}
												{age && <span>{age} лет</span>}
												{formatQualification(a.qualification) && <span><IconBriefcase size={11} /> {formatQualification(a.qualification)}</span>}
												{actorFacts.map((fact: string) => <span key={fact}>{fact}</span>)}
											</div>
											<div className={styles.actorFooter}>
												<div className={styles.actorRating}>
													<IconStar size={13} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
													<span>{a.avg_rating ?? '5.0'}</span>
													{(a.review_count ?? 0) > 0 && <span className={styles.ratingCount}>({a.review_count})</span>}
												</div>
												<div className={styles.actorViewCta}>
													<IconEye size={14} />
													Посмотреть
												</div>
											</div>
											{aboutMe && (
												<div className={styles.actorAbout}>
													{aboutMe.length > 120 ? aboutMe.slice(0, 120) + '…' : aboutMe}
												</div>
											)}
										</div>
									</div>
								)
							})}
						</div>

						{totalPages > 1 && !showFavOnly && (
							<div className={styles.pagination}>
								<button
									className={styles.pageBtn}
									disabled={page <= 1}
									onClick={() => setPage(p => p - 1)}
								>
									<IconChevronLeft size={14} /> Назад
								</button>
								<span className={styles.pageInfo}>{page} / {totalPages}</span>
								<button
									className={styles.pageBtn}
									disabled={page >= totalPages}
									onClick={() => setPage(p => p + 1)}
								>
									Далее <IconChevronRight size={14} />
								</button>
							</div>
						)}
					</>
				)}
			</div>

			{/* Actor Detail Modal */}
			{selectedActor && !lightboxOpen && !videoOpen && (
				<div className={styles.modalOverlay} onClick={() => setSelectedActor(null)}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<span className={styles.modalTitle}>
								{selectedActor.display_name || `${selectedActor.first_name || ''} ${selectedActor.last_name || ''}`.trim() || 'Актёр'}
								<span className={styles.ratingBig}>
									<IconStar size={14} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
									{avgRating}
								</span>
							</span>
							<div className={styles.modalHeaderRight}>
								<button
									className={`${styles.favBtnHeader} ${favorites.has(selectedActor.profile_id) ? styles.favBtnHeaderActive : ''}`}
									onClick={() => toggleFavorite(selectedActor.profile_id)}
								>
									<IconHeart size={16} style={favorites.has(selectedActor.profile_id) ? { fill: 'currentColor' } : {}} />
								</button>
								<button className={styles.modalClose} onClick={() => setSelectedActor(null)}>
									<IconX size={16} />
								</button>
							</div>
						</div>
						<div className={styles.modalBody}>
							<div className={styles.carousel} onClick={() => { if (photos.length > 0 || selectedActor.photo_url) setLightboxOpen(true) }}>
								{photos.length > 0 && currentPhoto ? (
									<>
										<img src={currentPhoto.processed_url || currentPhoto.original_url} alt="" />
										{photos.length > 1 && (
											<>
												<button className={`${styles.carouselNav} ${styles.prev}`} onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i - 1 + photos.length) % photos.length) }}>‹</button>
												<button className={`${styles.carouselNav} ${styles.next}`} onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i + 1) % photos.length) }}>›</button>
												<div className={styles.carouselDots}>
													{photos.map((_: any, i: number) => (
														<button key={i} className={`${styles.carouselDot} ${i === photoIdx ? styles.active : ''}`} onClick={(e) => { e.stopPropagation(); setPhotoIdx(i) }} />
													))}
												</div>
											</>
										)}
									</>
								) : selectedActor.photo_url ? (
									<img src={selectedActor.photo_url} alt="" />
								) : (
									<div className={styles.carouselEmpty}>
										{(selectedActor.first_name?.[0] || '?').toUpperCase()}
									</div>
								)}
							</div>

							{actorVideoUrl && (
								<button
									type="button"
									className={styles.videoVisitBtn}
									onClick={() => {
										if (!actorVideoPlayback) return
										if (actorVideoPlayback.type === 'external') {
											window.open(actorVideoPlayback.src, '_blank', 'noopener,noreferrer')
											return
										}
										setVideoOpen(true)
									}}
								>
									{actorVideoPlayback?.type === 'external' ? 'Видеоссылка' : 'Видеовизитка'}
								</button>
							)}

							<div className={styles.detailSection}>
								<div className={styles.detailSectionTitle}>Основное</div>
								<div className={styles.detailRow}>
									<span>Пол</span>
									<b>{selectedActor.gender || '—'}</b>
								</div>
								{selectedActor.date_of_birth && (
									<div className={styles.detailRow}>
										<span>Дата рождения</span>
										<b>{selectedActor.date_of_birth}</b>
									</div>
								)}
								{selectedActor.age && (
									<div className={styles.detailRow}>
										<span>Возраст</span>
										<b>{selectedActor.age} лет</b>
									</div>
								)}
								<div className={styles.detailRow}>
									<span>Город</span>
									<b>{selectedActor.city || '—'}</b>
								</div>
								{selectedActor.height && (
									<div className={styles.detailRow}>
										<span>Рост</span>
										<b>{selectedActor.height} см</b>
									</div>
								)}
								{selectedActor.look_type && (
									<div className={styles.detailRow}>
										<span>Тип внешности</span>
										<b>{selectedActor.look_type}</b>
									</div>
								)}
								{selectedActor.hair_color && (
									<div className={styles.detailRow}>
										<span>Цвет волос</span>
										<b>{selectedActor.hair_color}</b>
									</div>
								)}
								{selectedActor.qualification && (
									<div className={styles.detailRow}>
										<span>Квалификация</span>
										<b>{selectedActor.qualification}</b>
									</div>
								)}
								{selectedActor.experience && (
									<div className={styles.detailRow}>
										<span>Опыт</span>
										<b>{selectedActor.experience}</b>
									</div>
								)}
							</div>

							<div className={styles.detailSection}>
								<div className={styles.detailSectionTitle}>Контакты</div>
								<div className={styles.detailRow}>
									<span>Телефон</span>
									<div className={styles.contactMasked}>
										<b>{showContacts ? (selectedActor.phone_number || '—') : maskPhone(selectedActor.phone_number)}</b>
										{!showContacts && selectedActor.phone_number && (
											<button className={styles.showContactBtn} onClick={() => setShowContacts(true)}>Показать</button>
										)}
									</div>
								</div>
								<div className={styles.detailRow}>
									<span>Email</span>
									<div className={styles.contactMasked}>
										<b>{showContacts ? (selectedActor.email || '—') : maskEmail(selectedActor.email)}</b>
									</div>
								</div>
							</div>

							{selectedActor.about_me && (
								<div className={styles.detailSection}>
									<div className={styles.detailSectionTitle}>О себе</div>
									<div className={styles.detailAbout}>{selectedActor.about_me}</div>
								</div>
							)}

							{/* Reviews */}
							<div className={styles.detailSection}>
								<div className={styles.detailSectionTitle}>
									Оценка и отзывы
									<span className={styles.ratingBig}>
										<IconStar size={16} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
										{avgRating}
										<span className={styles.ratingCountBig}>({reviewCount})</span>
									</span>
								</div>

								<div className={styles.reviewForm}>
									<div className={styles.starPicker}>
										{[1, 2, 3, 4, 5].map(star => (
											<button
												key={star}
												className={`${styles.starBtn} ${star <= myRating ? styles.starActive : ''}`}
												onClick={() => setMyRating(star)}
											>
												<IconStar size={22} style={star <= myRating ? { color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' } : { color: '#555' }} />
											</button>
										))}
										{myRating > 0 && <span className={styles.starLabel}>{myRating}.0</span>}
									</div>
									<div className={styles.reviewInputRow}>
										<input
											className={styles.reviewInput}
											placeholder="Оставьте отзыв..."
											value={myComment}
											onChange={e => setMyComment(e.target.value)}
											onKeyDown={e => e.key === 'Enter' && submitReview()}
										/>
										<button
											className={styles.reviewSubmitBtn}
											onClick={submitReview}
											disabled={myRating < 1 || submittingReview}
										>
											{submittingReview ? <IconLoader size={14} /> : <IconSend size={14} />}
										</button>
									</div>
								</div>

								{reviewLoading ? (
									<div className={styles.reviewLoading}><IconLoader size={16} /> Загрузка...</div>
								) : reviews.length === 0 ? (
									<p className={styles.reviewEmpty}>Пока нет отзывов. Будьте первым!</p>
								) : (
									<div className={styles.reviewList}>
										{reviews.map((r: any) => (
											<div key={r.id} className={styles.reviewCard}>
												<div className={styles.reviewHeader}>
													<span className={styles.reviewAuthor}>{r.reviewer_name}</span>
													<span className={styles.reviewRole}>{r.reviewer_role_label}</span>
													<span className={styles.reviewStars}>
														{[1, 2, 3, 4, 5].map(s => (
															<IconStar
																key={s}
																size={11}
																style={s <= r.rating ? { color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' } : { color: '#333' }}
															/>
														))}
													</span>
													<span className={styles.reviewDate}>{r.created_at?.split('T')[0]}</span>
													{r.is_mine && (
														<button className={styles.reviewDeleteBtn} onClick={() => deleteReview(r.id)}>
															<IconTrash size={12} />
														</button>
													)}
												</div>
												{r.comment && <p className={styles.reviewText}>{r.comment}</p>}
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Fullscreen Lightbox */}
			{lightboxOpen && selectedActor && (
				<div className={styles.lightbox} onClick={() => setLightboxOpen(false)}>
					<button className={styles.lightboxClose} onClick={() => setLightboxOpen(false)}>
						<IconX size={24} />
					</button>

					{photos.length > 0 && currentPhoto ? (
						<img
							src={currentPhoto.processed_url || currentPhoto.original_url}
							alt=""
							className={styles.lightboxImg}
							onClick={(e) => e.stopPropagation()}
						/>
					) : selectedActor.photo_url ? (
						<img
							src={selectedActor.photo_url}
							alt=""
							className={styles.lightboxImg}
							onClick={(e) => e.stopPropagation()}
						/>
					) : null}

					{photos.length > 1 && (
						<>
							<button
								className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
								onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i - 1 + photos.length) % photos.length) }}
							>‹</button>
							<button
								className={`${styles.lightboxNav} ${styles.lightboxNext}`}
								onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i + 1) % photos.length) }}
							>›</button>
							<div className={styles.lightboxCounter} onClick={(e) => e.stopPropagation()}>
								{photoIdx + 1} / {photos.length}
							</div>
						</>
					)}
				</div>
			)}

			{videoOpen && selectedActor && actorVideoPlayback && actorVideoPlayback.type !== 'external' && (
				<div className={styles.lightbox} onClick={() => setVideoOpen(false)}>
					<button className={styles.lightboxClose} onClick={() => setVideoOpen(false)}>
						<IconX size={24} />
					</button>
					{actorVideoPlayback.type === 'direct' ? (
						<video
							src={actorVideoPlayback.src}
							poster={actorVideoPlayback.poster || undefined}
							className={styles.lightboxVideo}
							controls
							autoPlay
							playsInline
							preload="metadata"
							onClick={(e) => e.stopPropagation()}
						/>
					) : (
						<iframe
							src={actorVideoPlayback.src}
							className={styles.lightboxFrame}
							allow="autoplay; fullscreen; picture-in-picture"
							allowFullScreen
							onClick={(e) => e.stopPropagation()}
						/>
					)}
				</div>
			)}
		</div>
	)
}
