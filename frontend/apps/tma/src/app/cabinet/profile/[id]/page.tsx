'use client'

import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import {
	useActorProfile,
	useDeleteMedia,
	useSetPrimaryMedia,
} from '~models/actor-profile'
import { API_URL } from '~/shared/api-url'
import { formatPhone } from '~/shared/phone-mask'
import { getVideoPlayback, type VideoPlayback } from '~/shared/video-link'
import Page from '~widgets/page'
import { DataLoader } from '~packages/lib'
import { Loader } from '~packages/ui'
import AlertError from '~widgets/alert-error'
import {
	IconArrowLeft,
	IconLogOut,
	IconEdit,
	IconCamera,
	IconImage,
	IconPlayCircle,
} from '~packages/ui/icons'
import { formatLookTypeLabel } from '~/shared/profile-labels'

import styles from './page.module.scss'

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
const PHOTO_CATEGORY_LABELS: Record<string, string> = {
	portrait: 'Портрет', profile: 'Профиль',
	full_height: 'Полный рост', additional: 'Доп. фото',
}
const tr = (val: string | null | undefined, map: Record<string, string>) => val ? (map[val] || val) : null

const formatGender = (value?: string | null) => {
	if (!value) return null
	if (value === 'male') return 'Мужской'
	if (value === 'female') return 'Женский'
	return value
}

const formatDate = (value?: string | null) => {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const getAgeLabel = (value?: string | null) => {
	if (!value) return null
	const birthDate = new Date(value)
	if (Number.isNaN(birthDate.getTime())) return null
	const now = new Date()
	let age = now.getFullYear() - birthDate.getFullYear()
	const m = now.getMonth() - birthDate.getMonth()
	if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1
	return age > 0 ? `${age} ${pluralizeYears(age)}` : null
}

function pluralizeYears(age: number) {
	const m10 = age % 10, m100 = age % 100
	if (m10 === 1 && m100 !== 11) return 'год'
	if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'года'
	return 'лет'
}

const normalizeMediaUrl = (url?: string | null) => {
	if (!url) return null
	try {
		const apiBase = new URL(API_URL, window.location.origin)
		const parsed = new URL(url, apiBase)
		if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
			return `${apiBase.origin}${parsed.pathname}${parsed.search}`
		}
		return parsed.toString()
	} catch {
		return url
	}
}

type TabId = 'info' | 'photos' | 'video' | 'basic' | 'contact' | 'physical' | 'professional'

export default function ProfileDetailPage() {
	const params = useParams()
	const router = useRouter()
	const profileId = Number(params.id)

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const deleteMedia = useDeleteMedia(profileId)
	const setPrimaryMedia = useSetPrimaryMedia(profileId)

	const [activeTab, setActiveTab] = useState<TabId>('info')
	const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
	const [selectedVideo, setSelectedVideo] = useState<VideoPlayback | null>(null)

	const handleEdit = () => router.push(`/cabinet/profile/${profileId}/edit`)
	const handleBack = () => router.push('/cabinet')
	const handleLogout = () => {
		const { logout } = require('@prostoprobuy/models')
		logout()
		router.replace('/login')
	}
	const handleMediaUpload = () => router.push(`/cabinet/profile/${profileId}/media`)

	const handleDeleteMedia = async (assetId: number) => {
		if (confirm('Удалить этот файл?')) await deleteMedia.mutateAsync(assetId)
	}
	const handleSetPrimary = async (assetId: number) => {
		await setPrimaryMedia.mutateAsync(assetId)
	}

	const openVideoPlayer = (playback: VideoPlayback | null) => {
		if (!playback) return
		if (playback.type === 'external') {
			window.open(playback.src, '_blank', 'noopener,noreferrer')
			return
		}
		setSelectedVideo(playback)
	}

	const profileDetails = useMemo(() => {
		if (!profile) return null
		return {
			name: profile.display_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Профиль актёра',
			age: getAgeLabel(profile.date_of_birth),
			qualification: tr(profile.qualification, QUAL_LABELS),
			basicRows: [
				{ label: 'Имя', value: profile.first_name },
				{ label: 'Фамилия', value: profile.last_name },
				{ label: 'Пол', value: formatGender(profile.gender) },
				{ label: 'Дата рождения', value: formatDate(profile.date_of_birth) },
				{ label: 'Город', value: profile.city },
			],
			contactRows: profile.has_agent
				? [
					{ label: 'Агент', value: profile.agent_name || 'Агент' },
					{ label: 'Тел. агента', value: profile.phone_number ? formatPhone(profile.phone_number) : null },
					{ label: 'Email агента', value: profile.email },
				]
				: [
					{ label: 'Телефон', value: profile.phone_number ? formatPhone(profile.phone_number) : null },
					{ label: 'Email', value: profile.email },
				],
			professionalRows: [
				{ label: 'Квалификация', value: tr(profile.qualification, QUAL_LABELS) },
				{ label: 'Опыт', value: profile.experience ? `${profile.experience} ${pluralizeYears(profile.experience)}` : null },
				{ label: 'Доп. портфолио', value: profile.extra_portfolio_url || null },
			],
			physicalRows: [
				{ label: 'Тип внешности', value: formatLookTypeLabel(profile.look_type) },
				{ label: 'Цвет волос', value: tr(profile.hair_color, HAIR_COLOR_LABELS) },
				{ label: 'Длина волос', value: tr(profile.hair_length, HAIR_LEN_LABELS) },
				{ label: 'Рост', value: profile.height ? `${profile.height} см` : null },
				{ label: 'Размер одежды', value: profile.clothing_size },
				{ label: 'Размер обуви', value: profile.shoe_size },
				{ label: 'Объём груди', value: profile.bust_volume ? `${profile.bust_volume} см` : null },
				{ label: 'Объём талии', value: profile.waist_volume ? `${profile.waist_volume} см` : null },
				{ label: 'Объём бёдер', value: profile.hip_volume ? `${profile.hip_volume} см` : null },
			].filter(item => item.value),
		}
	}, [profile])

	if (!profileId) return null

	const photoAssets = (profile?.media_assets || []).filter((a: any) => a.file_type === 'photo')
	const videoAssets = (profile?.media_assets || []).filter((a: any) => a.file_type === 'video')
	const primaryPhoto = photoAssets.find((a: any) => a.is_primary) || photoAssets[0] || null

	const uploadedVideoPlayback = videoAssets[0]
		? getVideoPlayback(normalizeMediaUrl(videoAssets[0].processed_url || videoAssets[0].original_url), {
			poster: normalizeMediaUrl(videoAssets[0].thumbnail_url) || null,
			label: 'Видеовизитка',
		})
		: null
	const externalVideoPlayback = profile?.video_intro
		? getVideoPlayback(profile.video_intro, { label: 'Ссылка на видео' })
		: null
	const activeVideoPlayback = uploadedVideoPlayback || externalVideoPlayback

	const TABS: { id: TabId; label: string; count?: number }[] = [
		{ id: 'info', label: 'Главная' },
		{ id: 'basic', label: 'Основная' },
		{ id: 'contact', label: 'Контакты' },
		{ id: 'physical', label: 'Параметры' },
		{ id: 'professional', label: 'Квалификация' },
		{ id: 'photos', label: 'Фото', count: photoAssets.length || undefined },
		{ id: 'video', label: 'Видео', count: activeVideoPlayback ? 1 : undefined },
	]

	return (
		<DataLoader
			isLoading={isLoading}
			hasError={isError}
			errorFallback={<Page><AlertError /></Page>}
			loadingFallback={<Loader />}
		>
			<Page>
				{profile && profileDetails && (
					<div className={styles.root}>
						{/* Top bar */}
						<div className={styles.topBar}>
							<button className={styles.topBarBtn} onClick={handleBack}>
								<IconArrowLeft size={18} />
							</button>
							<span className={styles.topBarTitle}>{profileDetails.name}</span>
							<button className={styles.topBarBtn} onClick={handleLogout}>
								<IconLogOut size={18} />
							</button>
						</div>

						{/* Cover / avatar area */}
						<div className={styles.heroSection}>
							<div className={styles.heroCover} />
							<div className={styles.heroAvatar}>
								<button
									className={styles.avatarBtn}
									onClick={() => primaryPhoto && setLightboxIdx(
										photoAssets.findIndex((a: any) => a.id === primaryPhoto.id)
									)}
								>
									{primaryPhoto ? (
										<img
											src={normalizeMediaUrl(primaryPhoto.processed_url || primaryPhoto.original_url) || ''}
											alt={profileDetails.name}
											className={styles.avatarImg}
										/>
									) : (
										<div className={styles.avatarFallback}>
											{profileDetails.name[0]?.toUpperCase() || '?'}
										</div>
									)}
								</button>
							</div>
						</div>

						{/* Name + meta */}
						<div className={styles.nameBlock}>
							<h1 className={styles.name}>{profileDetails.name}</h1>
							{profile.about_me && (
								<p className={styles.about}>{profile.about_me}</p>
							)}
							<div className={styles.metaChips}>
								{profileDetails.age && (
									<span className={styles.chip}>Возраст: {profileDetails.age}</span>
								)}
								{profile.experience ? (
									<span className={styles.chip}>Опыт: {profile.experience} {pluralizeYears(profile.experience)}</span>
								) : null}
								{profileDetails.qualification && (
									<span className={styles.chip}>{profileDetails.qualification}</span>
								)}
								{profile.city && (
									<span className={styles.chip}>{profile.city}</span>
								)}
							</div>

							{/* Action buttons */}
							<div className={styles.actions}>
								<button className={styles.actionPrimary} onClick={handleEdit}>
									<IconEdit size={16} />
									Редактировать
								</button>
								<button className={styles.actionSecondary} onClick={handleMediaUpload}>
									<IconCamera size={16} />
									Загрузить медиа
								</button>
							</div>
						</div>

						{/* Tabs */}
						<div className={styles.tabs}>
							{TABS.map(tab => (
								<button
									key={tab.id}
									className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
									onClick={() => setActiveTab(tab.id)}
								>
									{tab.label}
									{tab.count !== undefined && (
										<span className={styles.tabBadge}>{tab.count}</span>
									)}
								</button>
							))}
						</div>

						{/* Tab: Info (overview — empty, sections open via tabs) */}
						{activeTab === 'info' && (
							<div className={styles.tabContent} />
						)}

						{/* Tab: Basic info */}
						{activeTab === 'basic' && (
							<div className={styles.tabContent}>
								<div className={styles.sectionCard}>
									<div className={styles.infoList}>
										{profileDetails.basicRows.map(row => (
											<button key={row.label} type="button" className={styles.infoRow} onClick={handleEdit}>
												<span className={styles.infoLabel}>{row.label}</span>
												<span className={`${styles.infoValue} ${!row.value ? styles.infoValueEmpty : ''}`}>
													{row.value || 'Не указано'}
												</span>
											</button>
										))}
									</div>
								</div>
							</div>
						)}

						{/* Tab: Contact */}
						{activeTab === 'contact' && (
							<div className={styles.tabContent}>
								<div className={styles.sectionCard}>
									{profile?.has_agent && (
										<p className={styles.sectionNote}>
											🤝 Этот актёр представлен агентом. Используйте контакты агента.
										</p>
									)}
									<div className={styles.infoList}>
										{profileDetails.contactRows.map(row => (
											<button key={row.label} type="button" className={styles.infoRow} onClick={handleEdit}>
												<span className={styles.infoLabel}>{row.label}</span>
												<span className={`${styles.infoValue} ${!row.value ? styles.infoValueEmpty : ''}`}>
													{row.value || 'Не указано'}
												</span>
											</button>
										))}
									</div>
								</div>
							</div>
						)}

						{/* Tab: Physical */}
						{activeTab === 'physical' && (
							<div className={styles.tabContent}>
								<div className={styles.sectionCard}>
									{profileDetails.physicalRows.length > 0 ? (
										<div className={styles.physicalGrid}>
											{profileDetails.physicalRows.map(row => (
												<div key={row.label} className={styles.physicalCard}>
													<span className={styles.physicalLabel}>{row.label}</span>
													<strong className={styles.physicalValue}>{row.value}</strong>
												</div>
											))}
										</div>
									) : (
										<div className={styles.emptySection}>
											<p>Физические параметры не заполнены</p>
											<button className={styles.emptyTabBtn} onClick={handleEdit}>Заполнить</button>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Tab: Professional */}
						{activeTab === 'professional' && (
							<div className={styles.tabContent}>
								<div className={styles.sectionCard}>
									<div className={styles.infoList}>
										{profileDetails.professionalRows.map(row => (
											<button key={row.label} type="button" className={styles.infoRow} onClick={handleEdit}>
												<span className={styles.infoLabel}>{row.label}</span>
												<span className={`${styles.infoValue} ${!row.value ? styles.infoValueEmpty : ''}`}>
													{row.value || 'Не указано'}
												</span>
											</button>
										))}
									</div>
								</div>
							</div>
						)}

						{/* Tab: Photos */}
						{activeTab === 'photos' && (
							<div className={styles.tabContent}>
								{photoAssets.length > 0 ? (
									<div className={styles.photoGrid}>
										{photoAssets.map((asset: any) => (
											<div
												key={asset.id}
												className={`${styles.photoItem} ${asset.is_primary ? styles.photoItemPrimary : ''}`}
											>
												<img
													src={normalizeMediaUrl(asset.processed_url || asset.original_url) || ''}
													alt="Фото актёра"
													className={styles.photoImg}
													onClick={() => setLightboxIdx(
														photoAssets.findIndex((p: any) => p.id === asset.id)
													)}
												/>
												<div className={styles.photoActions}>
													{!asset.is_primary && (
														<button
															className={styles.photoActionBtn}
															onClick={() => handleSetPrimary(asset.id)}
															title="Сделать основным"
														>★</button>
													)}
													<button
														className={`${styles.photoActionBtn} ${styles.photoActionDelete}`}
														onClick={() => handleDeleteMedia(asset.id)}
														title="Удалить"
													>✕</button>
												</div>
												{asset.is_primary && (
													<span className={styles.photoPrimaryBadge}>Основное</span>
												)}
											</div>
										))}
									</div>
								) : (
									<div className={styles.emptyTab}>
										<div className={styles.emptyTabIcon}><IconImage size={32} /></div>
										<p>Фотографий пока нет</p>
										<button className={styles.emptyTabBtn} onClick={handleMediaUpload}>
											Загрузить фото
										</button>
									</div>
								)}
							</div>
						)}

						{/* Tab: Video */}
						{activeTab === 'video' && (
							<div className={styles.tabContent}>
								{activeVideoPlayback ? (
									<div className={styles.videoSection}>
										<button
											className={styles.videoCard}
											onClick={() => openVideoPlayer(activeVideoPlayback)}
										>
											<div className={styles.videoThumb}>
												{activeVideoPlayback.type === 'direct' ? (
													<video
														src={activeVideoPlayback.src}
														className={styles.videoEl}
														controls={false}
														preload="metadata"
														muted
														playsInline
														poster={activeVideoPlayback.poster || undefined}
													/>
												) : (
													<div className={styles.videoExternal}>
														<span>{activeVideoPlayback.label}</span>
													</div>
												)}
												<div className={styles.videoPlay}>▶</div>
											</div>
											<div className={styles.videoCardInfo}>
												<span className={styles.videoCardTitle}>
													{activeVideoPlayback.type === 'direct' ? 'Видеовизитка' : 'Ссылка на видео'}
												</span>
											</div>
										</button>
										{videoAssets[0] && (
											<button
												className={styles.videoDeleteBtn}
												onClick={() => handleDeleteMedia(videoAssets[0].id)}
											>
												Удалить видео
											</button>
										)}
									</div>
								) : (
									<div className={styles.emptyTab}>
										<div className={styles.emptyTabIcon}><IconPlayCircle size={32} /></div>
										<p>Видеовизитки пока нет</p>
										<button className={styles.emptyTabBtn} onClick={handleMediaUpload}>
											Загрузить видео
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* Lightbox */}
				{lightboxIdx !== null && profile && (() => {
					const photos = profile.media_assets.filter((a: any) => a.file_type === 'photo')
					if (!photos[lightboxIdx]) return null
					return (
						<div className={styles.lightbox} onClick={() => setLightboxIdx(null)}>
							<button className={styles.lightboxClose} onClick={e => { e.stopPropagation(); setLightboxIdx(null) }}>✕</button>
							{lightboxIdx > 0 && (
								<button className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}>‹</button>
							)}
							<img
								src={normalizeMediaUrl(photos[lightboxIdx].processed_url || photos[lightboxIdx].original_url) || ''}
								alt=""
								className={styles.lightboxImg}
								onClick={e => e.stopPropagation()}
							/>
							{lightboxIdx < photos.length - 1 && (
								<button className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}>›</button>
							)}
							<div className={styles.lightboxCounter}>{lightboxIdx + 1} / {photos.length}</div>
							<button className={styles.lightboxCloseBottom} onClick={e => { e.stopPropagation(); setLightboxIdx(null) }}>
								Закрыть
							</button>
						</div>
					)
				})()}

				{/* Video player */}
				{selectedVideo && (
					<div className={styles.lightbox} onClick={() => setSelectedVideo(null)}>
						<button className={styles.lightboxClose} onClick={e => { e.stopPropagation(); setSelectedVideo(null) }}>✕</button>
						{selectedVideo.type === 'direct' ? (
							<video
								src={selectedVideo.src}
								className={styles.lightboxVideo}
								poster={selectedVideo.poster || undefined}
								controls autoPlay playsInline preload="metadata"
								onClick={e => e.stopPropagation()}
							/>
						) : (
							<iframe
								src={selectedVideo.src}
								className={styles.lightboxFrame}
								allow="autoplay; fullscreen; picture-in-picture"
								allowFullScreen
								onClick={e => e.stopPropagation()}
							/>
						)}
						<button className={styles.lightboxCloseBottom} onClick={e => { e.stopPropagation(); setSelectedVideo(null) }}>
							Закрыть
						</button>
					</div>
				)}
			</Page>
		</DataLoader>
	)
}
