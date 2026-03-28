'use client'

import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import {
	useActorProfile,
	useUpdateProfile,
	useDeleteMedia,
	useSetPrimaryMedia,
	IActorProfileUpdate,
} from '~models/actor-profile'
import { formatPhone } from '~/shared/phone-mask'
import Page from '~widgets/page'
import { DataLoader } from '~packages/lib'
import { Loader } from '~packages/ui'
import AlertError from '~widgets/alert-error'

import styles from './page.module.scss'

const LOOK_LABELS: Record<string, string> = {
	european: 'Европейский', asian: 'Азиатский', slavic: 'Славянский',
	african: 'Африканский', latino: 'Латиноамериканский', middle_eastern: 'Ближневосточный',
	caucasian: 'Кавказский', south_asian: 'Южноазиатский', mixed: 'Смешанный', other: 'Другой',
}
const HAIR_COLOR_LABELS: Record<string, string> = {
	blonde: 'Блонд', brunette: 'Брюнет', brown: 'Шатен', light_brown: 'Русый',
	red: 'Рыжий', gray: 'Седой', other: 'Другой',
}
const HAIR_LEN_LABELS: Record<string, string> = {
	short: 'Короткие', medium: 'Средние', long: 'Длинные', bald: 'Лысый',
}
const QUAL_LABELS: Record<string, string> = {
	professional: 'Профессионал', skilled: 'Опытный', enthusiast: 'Энтузиаст',
	beginner: 'Начинающий', other: 'Другое',
}
const tr = (val: string | null | undefined, map: Record<string, string>) => val ? (map[val] || val) : null

export default function ProfileDetailPage() {
	const params = useParams()
	const router = useRouter()
	const profileId = Number(params.id)

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const deleteMedia = useDeleteMedia(profileId)
	const setPrimaryMedia = useSetPrimaryMedia(profileId)
	const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
	const [selectedVideo, setSelectedVideo] = useState<{ src: string; poster?: string | null } | null>(null)

	const handleEdit = () => {
		router.push(`/cabinet/profile/${profileId}/edit`)
	}
	const formatGender = (value?: string | null) => {
		if (!value) return null
		if (value === 'male') return 'Мужской'
		if (value === 'female') return 'Женский'
		return value
	}

	const infoRows = useMemo(() => {
		if (!profile) return null
		return {
			personal: [
				{ label: 'Имя', value: profile.first_name },
				{ label: 'Фамилия', value: profile.last_name },
				{ label: 'Пол', value: formatGender(profile.gender) },
				{ label: 'Дата рождения', value: profile.date_of_birth },
				{ label: 'Телефон', value: profile.phone_number ? formatPhone(profile.phone_number) : undefined },
				{ label: 'Email', value: profile.email },
				{ label: 'Город', value: profile.city },
			],
			professional: [
				{ label: 'Квалификация', value: tr(profile.qualification, QUAL_LABELS) },
				{ label: 'Опыт (лет)', value: profile.experience?.toString() },
				{ label: 'О себе', value: profile.about_me },
			],
			physical: [
				{ label: 'Тип внешности', value: tr(profile.look_type, LOOK_LABELS) },
				{ label: 'Цвет волос', value: tr(profile.hair_color, HAIR_COLOR_LABELS) },
				{ label: 'Длина волос', value: tr(profile.hair_length, HAIR_LEN_LABELS) },
				{ label: 'Рост', value: profile.height ? `${profile.height} см` : null },
				{ label: 'Размер одежды', value: profile.clothing_size },
				{ label: 'Размер обуви', value: profile.shoe_size },
				{ label: 'Обхват груди', value: profile.bust_volume ? `${profile.bust_volume} см` : null },
				{ label: 'Обхват талии', value: profile.waist_volume ? `${profile.waist_volume} см` : null },
				{ label: 'Обхват бёдер', value: profile.hip_volume ? `${profile.hip_volume} см` : null },
			],
		}
	}, [profile])


	const handleMediaUpload = () => {
		router.push(`/cabinet/profile/${profileId}/media`)
	}

	const handleDeleteMedia = async (assetId: number) => {
		if (confirm('Удалить этот файл?')) {
			await deleteMedia.mutateAsync(assetId)
		}
	}

	const handleSetPrimary = async (assetId: number) => {
		await setPrimaryMedia.mutateAsync(assetId)
	}

	const openVideoPlayer = (asset: any) => {
		const src = asset.processed_url || asset.original_url
		if (!src) return
		setSelectedVideo({
			src,
			poster: asset.thumbnail_url || null,
		})
	}

	if (!profileId) return null

	return (
		<DataLoader
			isLoading={isLoading}
			hasError={isError}
			errorFallback={
				<Page>
					<AlertError />
				</Page>
			}
			loadingFallback={<Loader />}
		>
			<Page>
				{profile && (
					<div className={styles.profilePage}>
						{/* Header */}
						<div className={styles.header}>
							<button
								className={styles.backButton}
								onClick={() => router.push('/cabinet')}
							>
								← Назад
							</button>
							<h1 className={styles.title}>
								{profile.display_name ||
									`${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
									'Профиль актёра'}
							</h1>
						</div>

						{/* Feed Banner */}
						<button
							className={styles.feedBanner}
							onClick={() => router.push('/cabinet/feed')}
						>
							<div className={styles.feedBannerIcon}>🎬</div>
							<div className={styles.feedBannerText}>
								<strong>Лента кастингов</strong>
								<span>Смотрите проекты и откликайтесь</span>
							</div>
							<span className={styles.feedBannerArrow}>→</span>
						</button>

						{/* Media Gallery */}
						<section className={styles.section}>
							<div className={styles.sectionHeader}>
								<h2>Фото и видео</h2>
								<button
									className={styles.addButton}
									onClick={handleMediaUpload}
								>
									+ Загрузить
								</button>
							</div>

							{profile.media_assets?.length > 0 ? (
								<div className={styles.mediaGrid}>
									{profile.media_assets.map((asset) => (
										<div
											key={asset.id}
											className={`${styles.mediaCard} ${
												asset.is_primary ? styles.primary : ''
											}`}
										>
											{asset.file_type === 'photo' ? (
											<img
												src={
													asset.processed_url ||
													asset.original_url
												}
												alt="Actor photo"
												className={styles.mediaImage}
												onClick={() => {
													const photoAssets = profile!.media_assets.filter((a: any) => a.file_type === 'photo')
													setLightboxIdx(photoAssets.indexOf(asset))
												}}
												style={{ cursor: 'pointer' }}
											/>
											) : (
												<button
													type="button"
													className={styles.videoCardButton}
													onClick={() => openVideoPlayer(asset)}
												>
													<div className={styles.videoWrapper}>
														<video
															src={
																asset.processed_url ||
																asset.original_url
															}
															className={styles.mediaVideo}
															controls={false}
															preload="metadata"
															muted
															playsInline
															poster={asset.thumbnail_url || undefined}
														/>
														<div className={styles.videoBadge}>▶</div>
													</div>
												</button>
											)}

											<div className={styles.mediaActions}>
												{asset.file_type === 'photo' && !asset.is_primary && (
													<button
														onClick={() =>
															handleSetPrimary(asset.id)
														}
														className={styles.mediaActionBtn}
														title="Сделать основным"
													>
														★
													</button>
												)}
												{asset.is_primary && (
													<span className={styles.primaryBadge}>
														Основное
													</span>
												)}
												<button
													onClick={() =>
														handleDeleteMedia(asset.id)
													}
													className={styles.deleteBtn}
													title="Удалить"
												>
													✕
												</button>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className={styles.emptyState}>
									<p>Нет загруженных медиа</p>
									<button
										className={styles.uploadButton}
										onClick={handleMediaUpload}
									>
										Загрузить первое фото
									</button>
								</div>
							)}
						</section>

						{/* Profile Info */}
						<section className={styles.section}>
							<div className={styles.sectionHeader}>
								<h2>Личные данные</h2>
								<button
									className={styles.editButton}
									onClick={handleEdit}
								>
									Редактировать
								</button>
							</div>

							<div className={styles.infoGrid}>
								{infoRows?.personal.map((row) => (
									<InfoRow key={row.label} label={row.label} value={row.value} onClick={handleEdit} />
								))}
							</div>
						</section>

						{/* Professional Info */}
						<section className={styles.section}>
							<h2>Профессиональные данные</h2>
							<div className={styles.infoGrid}>
								{infoRows?.professional.map((row) => (
									<InfoRow key={row.label} label={row.label} value={row.value} onClick={handleEdit} />
								))}
							</div>
						</section>

						{/* Physical Parameters */}
						<section className={styles.section}>
							<h2>Параметры</h2>
							<div className={styles.infoGrid}>
								{infoRows?.physical.map((row) => (
									<InfoRow key={row.label} label={row.label} value={row.value} onClick={handleEdit} />
								))}
							</div>
						</section>

						{/* Trust Score */}
						<section className={styles.section}>
							<h2>Рейтинг доверия</h2>
							<div className={styles.trustScore}>
								<div className={styles.scoreValue}>
									{profile.trust_score}
								</div>
								<div className={styles.scoreLabel}>Trust Score</div>
							</div>
						</section>
					</div>
				)}

				{lightboxIdx !== null && profile && (() => {
					const photos = profile.media_assets.filter((a: any) => a.file_type === 'photo')
					if (!photos[lightboxIdx]) return null
					return (
						<div className={styles.lightbox} onClick={() => setLightboxIdx(null)}>
							<button className={styles.lightboxClose} onClick={() => setLightboxIdx(null)}>✕</button>
							{lightboxIdx > 0 && (
								<button className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}>‹</button>
							)}
							<img src={photos[lightboxIdx].processed_url || photos[lightboxIdx].original_url} alt="" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
							{lightboxIdx < photos.length - 1 && (
								<button className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}>›</button>
							)}
							<div className={styles.lightboxCounter}>{lightboxIdx + 1} / {photos.length}</div>
						</div>
					)
				})()}

				{selectedVideo && (
					<div className={styles.lightbox} onClick={() => setSelectedVideo(null)}>
						<button className={styles.lightboxClose} onClick={() => setSelectedVideo(null)}>✕</button>
						<video
							src={selectedVideo.src}
							className={styles.lightboxVideo}
							poster={selectedVideo.poster || undefined}
							controls
							autoPlay
							playsInline
							preload="metadata"
							onClick={(e) => e.stopPropagation()}
						/>
					</div>
				)}
			</Page>
		</DataLoader>
	)
}

function InfoRow({
	label,
	value,
	onClick,
}: {
	label: string
	value: string | null | undefined
	onClick?: () => void
}) {
	const empty = !value
	return (
		<button
			type="button"
			className={`${styles.infoRow} ${onClick ? styles.infoRowClickable : ''}`}
			onClick={onClick}
		>
			<span className={styles.infoLabel}>{label}</span>
			<span className={`${styles.infoValue} ${empty ? styles.infoValueHint : ''}`}>
				{value || 'Нажмите, чтобы заполнить'}
			</span>
		</button>
	)
}


