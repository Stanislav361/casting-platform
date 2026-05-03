'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { useSmartBack } from '~/shared/smart-back'
import { formatLookTypeLabel, formatHairColorLabel, formatQualificationLabel } from '~/shared/profile-labels'
import { getVideoPlayback } from '~/shared/video-link'
import {
	IconArrowLeft,
	IconLoader,
	IconHeart,
	IconStar,
	IconSend,
	IconTrash,
	IconX,
	IconUsers,
} from '~packages/ui/icons'
import styles from './actor-detail.module.scss'

export default function ActorDetailPage() {
	const params = useParams()
	const profileId = params.id as string
	const goBack = useSmartBack('/dashboard/actors')

	const [token, setToken] = useState<string | null>(null)
	const [actor, setActor] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const [photoIdx, setPhotoIdx] = useState(0)
	const [lightboxOpen, setLightboxOpen] = useState(false)
	const [showContacts, setShowContacts] = useState(false)

	const [isFav, setIsFav] = useState(false)
	const [favLoading, setFavLoading] = useState(false)

	const [reviews, setReviews] = useState<any[]>([])
	const [avgRating, setAvgRating] = useState(5.0)
	const [reviewCount, setReviewCount] = useState(0)
	const [myRating, setMyRating] = useState(0)
	const [myComment, setMyComment] = useState('')
	const [reviewLoading, setReviewLoading] = useState(false)
	const [submittingReview, setSubmittingReview] = useState(false)

	const [availableReports, setAvailableReports] = useState<any[]>([])
	const [showReportPicker, setShowReportPicker] = useState(false)
	const [addedToReports, setAddedToReports] = useState<Set<number>>(new Set())
	const [addingToReport, setAddingToReport] = useState<number | null>(null)

	useEffect(() => {
		const session = $session.getState()
		if (session?.access_token) setToken(session.access_token)
	}, [])

	const normalizeMediaUrl = useCallback((url?: string | null) => {
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

	useEffect(() => {
		if (!token || !profileId) return
		setLoading(true)
		setError(null)

		Promise.all([
			apiCall('GET', `employer/actors/by-profile/${profileId}/`).catch(() => null),
			apiCall('GET', 'employer/favorites/ids/').catch(() => null),
			apiCall('GET', 'employer/reports/').catch(() => null),
		]).then(([actorData, favsData, reportsData]) => {
			if (!actorData) {
				setError('Не удалось загрузить профиль актёра')
				setLoading(false)
				return
			}
			setActor(actorData)
			if (favsData?.profile_ids) {
				setIsFav(favsData.profile_ids.includes(Number(profileId)))
			}
			const reports = reportsData?.reports || []
			setAvailableReports(reports)
			setLoading(false)
		})
	}, [token, profileId])

	const loadReviews = useCallback(async (pid: number) => {
		setReviewLoading(true)
		try {
			const data = await apiCall('GET', `employer/actors/${pid}/reviews/`)
			if (data) {
				setReviews(data.reviews || [])
				setAvgRating(data.avg_rating ?? 5.0)
				setReviewCount(data.review_count ?? 0)
				const mine = (data.reviews || []).find((r: any) => r.is_mine)
				if (mine) { setMyRating(mine.rating); setMyComment(mine.comment || '') }
			}
		} catch {}
		setReviewLoading(false)
	}, [])

	useEffect(() => {
		if (actor?.profile_id) loadReviews(actor.profile_id)
	}, [actor?.profile_id, loadReviews])

	const toggleFavorite = async () => {
		if (!actor?.profile_id || favLoading) return
		setFavLoading(true)
		const prev = isFav
		setIsFav(!prev)
		const res = await apiCall('POST', `employer/favorites/toggle/?profile_id=${actor.profile_id}`)
		if (!res?.ok) setIsFav(prev)
		setFavLoading(false)
	}

	const addToReport = async (reportId: number) => {
		if (!actor?.profile_id) return
		setAddingToReport(reportId)
		const res = await apiCall('POST', `employer/reports/${reportId}/add-actors/?profile_ids=${actor.profile_id}`)
		if (res?.added !== undefined) {
			setAddedToReports(prev => new Set(prev).add(reportId))
		}
		setAddingToReport(null)
		setShowReportPicker(false)
	}

	const submitReview = async () => {
		if (!actor?.profile_id || myRating < 1) return
		setSubmittingReview(true)
		try {
			await apiCall('POST', `employer/actors/${actor.profile_id}/reviews/`, { rating: myRating, comment: myComment })
			await loadReviews(actor.profile_id)
		} catch {}
		setSubmittingReview(false)
	}

	const deleteReview = async (reviewId: number) => {
		if (!actor?.profile_id) return
		await apiCall('DELETE', `employer/actors/${actor.profile_id}/reviews/${reviewId}/`)
		await loadReviews(actor.profile_id)
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

	const photos = actor ? (actor.media_assets || []).filter((m: any) => m.file_type === 'photo') : []
	const videos = actor ? (actor.media_assets || []).filter((m: any) => m.file_type === 'video') : []
	const currentPhoto = photos[photoIdx]
	const actorVideoUrl = videos[0]?.processed_url || videos[0]?.original_url || actor?.video_intro || null
	const actorVideoPlayback = getVideoPlayback(actorVideoUrl, { poster: videos[0]?.thumbnail_url || null })
	const displayName = actor?.display_name || `${actor?.first_name || ''} ${actor?.last_name || ''}`.trim() || 'Актёр'

	if (!token) return null

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} />
					<span>Назад</span>
				</button>
				{!loading && actor && (
					<h1 className={styles.headerTitle}>{displayName}</h1>
				)}
				{!loading && actor && (
					<div className={styles.headerActions}>
						<button
							className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ''}`}
							onClick={toggleFavorite}
							disabled={favLoading}
							aria-label="В избранное"
						>
							<IconHeart size={18} style={isFav ? { fill: 'currentColor' } : {}} />
						</button>
						{availableReports.length > 0 && (
							<button
								className={styles.reportBtn}
								onClick={() => setShowReportPicker(true)}
								aria-label="В отчёт"
							>
								<IconSend size={18} />
							</button>
						)}
					</div>
				)}
			</header>

			{loading ? (
				<div className={styles.loadingState}>
					<IconLoader size={28} />
					<span>Загрузка профиля…</span>
				</div>
			) : error ? (
				<div className={styles.errorState}>
					<IconUsers size={40} />
					<p>{error}</p>
					<button className={styles.retryBtn} onClick={goBack}>← Назад</button>
				</div>
			) : actor ? (
				<div className={styles.content}>

					{/* Photo carousel */}
					<div
						className={styles.carousel}
						onClick={() => photos.length > 0 && setLightboxOpen(true)}
					>
						{photos.length > 0 && currentPhoto ? (
							<>
								<img
									src={normalizeMediaUrl(currentPhoto.processed_url || currentPhoto.original_url) || ''}
									alt={displayName}
									className={styles.carouselImg}
								/>
								{photos.length > 1 && (
									<>
										<button
											className={`${styles.carouselNav} ${styles.carouselPrev}`}
											onClick={e => { e.stopPropagation(); setPhotoIdx(i => (i - 1 + photos.length) % photos.length) }}
										>‹</button>
										<button
											className={`${styles.carouselNav} ${styles.carouselNext}`}
											onClick={e => { e.stopPropagation(); setPhotoIdx(i => (i + 1) % photos.length) }}
										>›</button>
										<div className={styles.carouselDots}>
											{photos.map((_: any, i: number) => (
												<button
													key={i}
													className={`${styles.carouselDot} ${i === photoIdx ? styles.carouselDotActive : ''}`}
													onClick={e => { e.stopPropagation(); setPhotoIdx(i) }}
												/>
											))}
										</div>
									</>
								)}
							</>
						) : actor.photo_url ? (
							<img src={normalizeMediaUrl(actor.photo_url) || ''} alt={displayName} className={styles.carouselImg} />
						) : (
							<div className={styles.carouselEmpty}>
								{(actor.first_name?.[0] || '?').toUpperCase()}
							</div>
						)}
					</div>

					{/* Rating badge */}
					<div className={styles.ratingRow}>
						<IconStar size={16} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
						<span className={styles.ratingValue}>{avgRating}</span>
						{reviewCount > 0 && <span className={styles.ratingCount}>({reviewCount} отзывов)</span>}
					</div>

					{/* Video link */}
					{actorVideoUrl && actorVideoPlayback && (
						<button
							className={styles.videoBtn}
							onClick={() => {
								if (actorVideoPlayback.type === 'external') {
									window.open(actorVideoPlayback.src, '_blank', 'noopener,noreferrer')
								}
							}}
						>
							{actorVideoPlayback.type === 'external' ? 'Видеоссылка →' : 'Видеовизитка →'}
						</button>
					)}

					{/* Main info */}
					<section className={styles.section}>
						<h2 className={styles.sectionTitle}>Основное</h2>
						{[
							{ label: 'Пол',             value: actor.gender === 'male' ? 'Мужчина' : actor.gender === 'female' ? 'Женщина' : actor.gender },
							{ label: 'Дата рождения',   value: actor.date_of_birth },
							{ label: 'Возраст',         value: actor.age ? `${actor.age} лет` : null },
							{ label: 'Город',           value: actor.city },
							{ label: 'Рост',            value: actor.height ? `${actor.height} см` : null },
							{ label: 'Вес',             value: actor.weight ? `${actor.weight} кг` : null },
							{ label: 'Размер одежды',   value: actor.clothing_size },
							{ label: 'Размер обуви',    value: actor.shoe_size },
							{ label: 'Тип внешности',   value: formatLookTypeLabel(actor.look_type) },
							{ label: 'Цвет волос',      value: formatHairColorLabel(actor.hair_color) },
							{ label: 'Квалификация',    value: formatQualificationLabel(actor.qualification) },
							{ label: 'Опыт',            value: actor.experience },
						].filter(row => row.value && row.value !== '—').map(row => (
							<div key={row.label} className={styles.dataRow}>
								<span className={styles.dataLabel}>{row.label}</span>
								<span className={styles.dataValue}>{row.value}</span>
							</div>
						))}
					</section>

					{/* Contacts */}
					<section className={styles.section}>
						<h2 className={styles.sectionTitle}>Контакты</h2>
						<div className={styles.dataRow}>
							<span className={styles.dataLabel}>Телефон</span>
							<div className={styles.contactCell}>
								<span className={styles.dataValue}>
									{showContacts ? (actor.phone_number || '—') : maskPhone(actor.phone_number)}
								</span>
								{!showContacts && actor.phone_number && (
									<button className={styles.showContactBtn} onClick={() => setShowContacts(true)}>
										Показать
									</button>
								)}
							</div>
						</div>
						<div className={styles.dataRow}>
							<span className={styles.dataLabel}>Email</span>
							<span className={styles.dataValue}>
								{showContacts ? (actor.email || '—') : maskEmail(actor.email)}
							</span>
						</div>
					</section>

					{/* About */}
					{actor.about_me && (
						<section className={styles.section}>
							<h2 className={styles.sectionTitle}>О себе</h2>
							<p className={styles.aboutText}>{actor.about_me}</p>
						</section>
					)}

					{/* Reviews */}
					<section className={styles.section}>
						<h2 className={styles.sectionTitle}>
							Оценки и отзывы
							<span className={styles.ratingInline}>
								<IconStar size={14} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
								{avgRating}
								{reviewCount > 0 && <span className={styles.ratingCount}>({reviewCount})</span>}
							</span>
						</h2>

						<div className={styles.starPicker}>
							{[1, 2, 3, 4, 5].map(star => (
								<button
									key={star}
									className={`${styles.starBtn} ${star <= myRating ? styles.starBtnActive : ''}`}
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

						{reviewLoading ? (
							<div className={styles.reviewLoading}><IconLoader size={16} /> Загрузка отзывов…</div>
						) : reviews.length === 0 ? (
							<p className={styles.reviewEmpty}>Пока нет отзывов. Будьте первым!</p>
						) : (
							<div className={styles.reviewList}>
								{reviews.map((r: any) => (
									<div key={r.id} className={styles.reviewCard}>
										<div className={styles.reviewHeader}>
											<span className={styles.reviewAuthor}>{r.reviewer_name}</span>
											<span className={styles.reviewRole}>{r.reviewer_role_label}</span>
											<div className={styles.reviewStars}>
												{[1, 2, 3, 4, 5].map(s => (
													<IconStar
														key={s}
														size={11}
														style={s <= r.rating ? { color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' } : { color: '#333' }}
													/>
												))}
											</div>
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
					</section>
				</div>
			) : null}

			{/* Fullscreen lightbox */}
			{lightboxOpen && actor && (
				<div className={styles.lightbox} onClick={() => setLightboxOpen(false)}>
					<button className={styles.lightboxClose} onClick={() => setLightboxOpen(false)}>
						<IconX size={24} />
					</button>
					{photos.length > 0 && currentPhoto ? (
						<img
							src={normalizeMediaUrl(currentPhoto.processed_url || currentPhoto.original_url) || ''}
							alt=""
							className={styles.lightboxImg}
							onClick={e => e.stopPropagation()}
						/>
					) : actor.photo_url ? (
						<img
							src={normalizeMediaUrl(actor.photo_url) || ''}
							alt=""
							className={styles.lightboxImg}
							onClick={e => e.stopPropagation()}
						/>
					) : null}
					{photos.length > 1 && (
						<>
							<button
								className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
								onClick={e => { e.stopPropagation(); setPhotoIdx(i => (i - 1 + photos.length) % photos.length) }}
							>‹</button>
							<button
								className={`${styles.lightboxNav} ${styles.lightboxNext}`}
								onClick={e => { e.stopPropagation(); setPhotoIdx(i => (i + 1) % photos.length) }}
							>›</button>
						</>
					)}
				</div>
			)}

			{/* Report picker overlay */}
			{showReportPicker && (
				<div className={styles.reportPickerOverlay} onClick={() => setShowReportPicker(false)}>
					<div className={styles.reportPickerSheet} onClick={e => e.stopPropagation()}>
						<div className={styles.reportPickerHeader}>
							<span>Добавить в отчёт</span>
							<button onClick={() => setShowReportPicker(false)}><IconX size={18} /></button>
						</div>
						<div className={styles.reportPickerList}>
							{availableReports.map((r: any) => (
								<button
									key={r.id}
									className={`${styles.reportPickerItem} ${addedToReports.has(r.id) ? styles.reportPickerItemDone : ''}`}
									onClick={() => !addedToReports.has(r.id) && addToReport(r.id)}
									disabled={addingToReport === r.id || addedToReports.has(r.id)}
								>
									<span>{r.title || 'Отчёт'}</span>
									{addingToReport === r.id
										? <IconLoader size={14} />
										: addedToReports.has(r.id)
											? <IconSend size={14} style={{ opacity: 0.5 }} />
											: <IconSend size={14} />
									}
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
