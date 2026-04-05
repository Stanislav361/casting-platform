'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import {
	useActorProfile,
	useDeleteMedia,
	useSetPrimaryMedia,
} from '~models/actor-profile'
import { API_URL } from '~/shared/api-url'
import { apiCall } from '~/shared/api-client'
import { formatPhone } from '~/shared/phone-mask'
import { getVideoPlayback, type VideoPlayback } from '~/shared/video-link'
import Page from '~widgets/page'
import { DataLoader } from '~packages/lib'
import { Loader } from '~packages/ui'
import AlertError from '~widgets/alert-error'
import {
	IconSearch,
	IconZap,
	IconPlus,
	IconChevronRight,
	IconArrowLeft,
	IconClock,
	IconFilm,
	IconCalendar,
	IconEye,
	IconStar,
	IconCheck,
	IconBan,
	IconX,
} from '~packages/ui/icons'

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
const PHOTO_CATEGORY_LABELS: Record<string, string> = {
	portrait: 'Портрет',
	profile: 'Профиль',
	full_height: 'Полный рост',
	additional: 'Доп. фото',
}
const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
	in_app: 'В приложении',
	email: 'Email',
	sms: 'SMS',
	telegram: 'Telegram',
}

type CurrentUserNotificationSettings = {
	email?: string | null
	phone_number?: string | null
	telegram_connected?: boolean
	casting_notification_channel?: string
	available_casting_notification_channels?: string[]
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
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}

const getAgeLabel = (value?: string | null) => {
	if (!value) return null
	const birthDate = new Date(value)
	if (Number.isNaN(birthDate.getTime())) return null
	const now = new Date()
	let age = now.getFullYear() - birthDate.getFullYear()
	const monthDiff = now.getMonth() - birthDate.getMonth()
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
		age -= 1
	}
	return age > 0 ? `${age} ${pluralizeYears(age)}` : null
}

function pluralizeYears(age: number) {
	const mod10 = age % 10
	const mod100 = age % 100
	if (mod10 === 1 && mod100 !== 11) return 'год'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'года'
	return 'лет'
}

export default function ProfileDetailPage() {
	const params = useParams()
	const router = useRouter()
	const profileId = Number(params.id)

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const deleteMedia = useDeleteMedia(profileId)
	const setPrimaryMedia = useSetPrimaryMedia(profileId)
	const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
	const [selectedVideo, setSelectedVideo] = useState<VideoPlayback | null>(null)
	const [myResponses, setMyResponses] = useState<any[]>([])
	const [responsesExpanded, setResponsesExpanded] = useState(false)
	const [selectedResponseCasting, setSelectedResponseCasting] = useState<any | null>(null)
	const [notificationSettings, setNotificationSettings] = useState<CurrentUserNotificationSettings | null>(null)
	const [savingNotificationChannel, setSavingNotificationChannel] = useState(false)
	const [notificationSettingsError, setNotificationSettingsError] = useState<string | null>(null)
	const [reviewStatus, setReviewStatus] = useState<{ in_review: boolean; items: any[] }>({ in_review: false, items: [] })
	const [reviewExpanded, setReviewExpanded] = useState(false)

	const handleEdit = () => {
		router.push(`/cabinet/profile/${profileId}/edit`)
	}

	const handleBack = () => {
		router.push('/cabinet')
	}

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

	const openVideoPlayer = (playback: VideoPlayback | null) => {
		if (!playback) return
		if (playback.type === 'external') {
			window.open(playback.src, '_blank', 'noopener,noreferrer')
			return
		}
		setSelectedVideo(playback)
	}

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
		Promise.all([
			apiCall('GET', 'feed/my-responses/').catch(() => ({ responses: [] })),
			apiCall('GET', 'auth/v2/me/').catch(() => null),
			apiCall('GET', 'feed/my-review-status/').catch(() => ({ in_review: false, items: [] })),
		]).then(([responsesData, meData, reviewData]) => {
			setMyResponses(responsesData?.responses || [])
			if (meData) {
				setNotificationSettings({
					email: meData.email,
					phone_number: meData.phone_number,
					telegram_connected: meData.telegram_connected,
					casting_notification_channel: meData.casting_notification_channel || 'in_app',
					available_casting_notification_channels: meData.available_casting_notification_channels || ['in_app'],
				})
			}
			if (reviewData) {
				setReviewStatus(reviewData)
			}
		})
	}, [])

	const saveNotificationChannel = async (channel: string) => {
		if (!notificationSettings || savingNotificationChannel) return
		setSavingNotificationChannel(true)
		setNotificationSettingsError(null)
		try {
			const result = await apiCall('PATCH', 'auth/v2/me/', {
				casting_notification_channel: channel,
			})
			setNotificationSettings({
				email: result?.email,
				phone_number: result?.phone_number,
				telegram_connected: result?.telegram_connected,
				casting_notification_channel: result?.casting_notification_channel || channel,
				available_casting_notification_channels: result?.available_casting_notification_channels || ['in_app'],
			})
		} catch {
			setNotificationSettingsError('Не удалось сохранить канал уведомлений')
		} finally {
			setSavingNotificationChannel(false)
		}
	}

	const profileDetails = useMemo(() => {
		if (!profile) return null

		return {
			name:
				profile.display_name ||
				`${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
				'Профиль актёра',
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
					{ label: '🤝 Агент', value: profile.agent_name || 'Агент' },
					{ label: '📞 Тел. агента', value: profile.phone_number ? formatPhone(profile.phone_number) : null },
					{ label: '✉️ Email агента', value: profile.email },
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
				{ label: 'Тип внешности', value: tr(profile.look_type, LOOK_LABELS) },
				{ label: 'Цвет волос', value: tr(profile.hair_color, HAIR_COLOR_LABELS) },
				{ label: 'Длина волос', value: tr(profile.hair_length, HAIR_LEN_LABELS) },
				{ label: 'Рост', value: profile.height ? `${profile.height} см` : null },
				{ label: 'Размер одежды', value: profile.clothing_size },
				{ label: 'Размер обуви', value: profile.shoe_size },
				{ label: 'Объем груди', value: profile.bust_volume ? `${profile.bust_volume} см` : null },
				{ label: 'Объем талии', value: profile.waist_volume ? `${profile.waist_volume} см` : null },
				{ label: 'Объем бедер', value: profile.hip_volume ? `${profile.hip_volume} см` : null },
			].filter((item) => item.value),
		}
	}, [profile])

	if (!profileId) return null

	const photoAssets = (profile?.media_assets || []).filter((asset: any) => asset.file_type === 'photo')
	const videoAssets = (profile?.media_assets || []).filter((asset: any) => asset.file_type === 'video')
	const primaryPhoto = photoAssets.find((asset: any) => asset.is_primary) || photoAssets[0] || null
	const uploadedVideoPlayback = videoAssets[0]
		? getVideoPlayback(videoAssets[0].processed_url || videoAssets[0].original_url, {
			poster: videoAssets[0].thumbnail_url || null,
			label: 'Загруженное видео',
		})
		: null
	const externalVideoPlayback = profile?.video_intro
		? getVideoPlayback(profile.video_intro, { label: 'Ссылка на видеовизитку' })
		: null
	const activeVideoPlayback = uploadedVideoPlayback || externalVideoPlayback
	const heroMeta = [
		profileDetails?.age ? `Возраст: ${profileDetails.age}` : null,
		profile?.experience ? `Опыт: ${profile.experience} ${pluralizeYears(profile.experience)}` : null,
		profileDetails?.qualification ? `Квалификация: ${profileDetails.qualification}` : null,
		profile?.city ? `Город: ${profile.city}` : null,
	].filter(Boolean)
	const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
		in_review: { label: 'На рассмотрении', cls: styles.statusPending, icon: <IconClock size={13} /> },
		favorited: { label: 'В избранном', cls: styles.statusShortlisted, icon: <IconStar size={13} /> },
		rejected: { label: 'Отклонено', cls: styles.statusRejected, icon: <IconBan size={13} /> },
		pending: { label: 'Ожидает', cls: styles.statusPending, icon: <IconClock size={13} /> },
	}
	const CASTING_STATUS_RU: Record<string, string> = {
		published: 'Активный',
		closed: 'Закрыт',
		unpublished: 'Не опубликован',
	}
	const selectedNotificationChannel = notificationSettings?.casting_notification_channel || 'in_app'
	const availableNotificationChannels = notificationSettings?.available_casting_notification_channels || ['in_app']
	const notificationChannelHint = selectedNotificationChannel === 'email'
		? notificationSettings?.email || 'Email не привязан'
		: selectedNotificationChannel === 'sms'
			? (notificationSettings?.phone_number ? formatPhone(notificationSettings.phone_number) : 'Телефон не привязан')
			: selectedNotificationChannel === 'telegram'
				? (notificationSettings?.telegram_connected ? 'Подключенный Telegram' : 'Telegram не подключен')
				: 'Уведомления будут в кабинете'

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
				{profile && profileDetails && (
					<div className={styles.profilePage}>
						<div className={styles.header}>
							<button
								className={styles.backButton}
								onClick={handleBack}
							>
								<IconArrowLeft size={14} />
								Назад
							</button>
							<div>
								<p className={styles.eyebrow}>Информация об актёре</p>
								<h1 className={styles.title}>{profileDetails.name}</h1>
							</div>
						</div>

						<section className={styles.summaryCard}>
							<button
								type="button"
								className={styles.summaryPhoto}
								onClick={() => primaryPhoto && setLightboxIdx(photoAssets.findIndex((asset: any) => asset.id === primaryPhoto.id))}
							>
								{primaryPhoto ? (
									<img
										src={primaryPhoto.processed_url || primaryPhoto.original_url}
										alt={profileDetails.name}
										className={styles.summaryPhotoImage}
									/>
								) : (
									<div className={styles.summaryPhotoFallback}>
										{profileDetails.name[0]?.toUpperCase() || '?'}
									</div>
								)}
							</button>

							<div className={styles.summaryBody}>
								<div className={styles.summaryTop}>
									<div className={styles.summaryInfo}>
										<h2 className={styles.summaryName}>{profileDetails.name}</h2>
										<div className={styles.summaryMeta}>
											{heroMeta.map((item) => (
												<span key={item} className={styles.summaryMetaItem}>
													{item}
												</span>
											))}
										</div>
									</div>

									<div className={styles.summaryActions}>
										<button className={styles.primaryAction} onClick={handleEdit}>
											Редактировать анкету
										</button>
										<button className={styles.secondaryAction} onClick={handleMediaUpload}>
											Загрузить фото и видео
										</button>
										{activeVideoPlayback && (
											<button
												className={styles.secondaryAction}
												onClick={() => openVideoPlayer(activeVideoPlayback)}
											>
												{activeVideoPlayback.type === 'external'
													? 'Открыть видеоссылку'
													: 'Открыть видеовизитку'}
											</button>
										)}
										{profile?.extra_portfolio_url && (
											<button
												className={styles.secondaryAction}
												onClick={() => window.open(profile.extra_portfolio_url || '', '_blank', 'noopener,noreferrer')}
											>
												Открыть доп. портфолио
											</button>
										)}
									</div>
								</div>

								{profile.about_me && (
									<p className={styles.summaryAbout}>{profile.about_me}</p>
								)}
							</div>
						</section>

						{reviewStatus.in_review && (
							<section className={styles.reviewBanner} onClick={() => setReviewExpanded(prev => !prev)}>
								<div className={styles.reviewBannerHeader}>
									<span className={styles.reviewBannerIcon}>📋</span>
									<div className={styles.reviewBannerText}>
										<strong>Ваши статусы по кастингам</strong>
										<span>{reviewStatus.items.length} {reviewStatus.items.length === 1 ? 'кастинг' : reviewStatus.items.length < 5 ? 'кастинга' : 'кастингов'}</span>
									</div>
									<span className={styles.reviewBannerToggle}>{reviewExpanded ? '▲' : '▼'}</span>
								</div>
								{reviewExpanded && (
									<div className={styles.reviewBannerList}>
										{reviewStatus.items.map((item: any, idx: number) => {
											const STATUS_STYLES: Record<string, { label: string; icon: string; cls: string }> = {
												in_review: { label: 'На рассмотрении', icon: '🔍', cls: styles.reviewStatusNew },
												favorited: { label: 'В избранном', icon: '⭐', cls: styles.reviewStatusAccepted },
												rejected: { label: 'Отклонено', icon: '❌', cls: styles.reviewStatusRejected },
											}
											const st = STATUS_STYLES[item.actor_status] || STATUS_STYLES.in_review
											return (
												<div key={idx} className={styles.reviewItem}>
													<div className={styles.reviewItemInfo}>
														<strong>{item.casting_title || item.report_title || 'Кастинг'}</strong>
														{item.report_title && <span className={styles.reviewItemCasting}>Отчёт: {item.report_title}</span>}
													</div>
													<span className={`${styles.reviewStatusBadge} ${st.cls}`}>{st.icon} {st.label}</span>
												</div>
											)
										})}
									</div>
								)}
							</section>
						)}

						<div className={styles.contentGrid}>
							<div className={styles.mainColumn}>
							<section className={styles.section}>
								<h2>
									Контактная информация
									{profile?.has_agent && (
										<span className={styles.agentContactBadge}>🤝 Контакты агента</span>
									)}
								</h2>
								{profile?.has_agent && (
									<p className={styles.agentContactNote}>
										Этот актёр представлен агентом. Для связи используйте контакты агента.
									</p>
								)}
								<div className={styles.infoGrid}>
									{profileDetails.contactRows.map((row) => (
										<InfoRow key={row.label} label={row.label} value={row.value} onClick={handleEdit} />
									))}
								</div>
							</section>

								<section className={styles.section}>
									<div className={styles.sectionHeader}>
										<h2>Фото</h2>
										<button className={styles.addButton} onClick={handleMediaUpload}>
											+ Загрузить
										</button>
									</div>

									{photoAssets.length > 0 ? (
										<div className={styles.photoGrid}>
											{photoAssets.map((asset: any) => (
												<div
													key={asset.id}
													className={`${styles.photoCard} ${asset.is_primary ? styles.photoCardPrimary : ''}`}
												>
													<img
														src={asset.processed_url || asset.original_url}
														alt="Фото актёра"
														className={styles.photoImage}
														onClick={() => setLightboxIdx(photoAssets.findIndex((photo: any) => photo.id === asset.id))}
													/>
													<div className={styles.photoFooter}>
														<span className={styles.photoLabel}>
															{asset.is_primary
																? 'Основное фото'
																: PHOTO_CATEGORY_LABELS[asset.photo_category || 'additional'] || 'Фото'}
														</span>
														<div className={styles.photoActions}>
															{!asset.is_primary && (
																<button
																	onClick={() => handleSetPrimary(asset.id)}
																	className={styles.mediaActionBtn}
																	title="Сделать основным"
																>
																	★
																</button>
															)}
															<button
																onClick={() => handleDeleteMedia(asset.id)}
																className={styles.deleteBtn}
																title="Удалить"
															>
																✕
															</button>
														</div>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className={styles.emptyState}>
											<p>Пока нет загруженных фотографий</p>
											<button className={styles.uploadButton} onClick={handleMediaUpload}>
												Загрузить первое фото
											</button>
										</div>
									)}
								</section>

								{activeVideoPlayback && (
									<section className={styles.section}>
										<h2>Видео</h2>
										<div className={styles.videoGrid}>
											<div className={styles.videoCard}>
												<button
													type="button"
													className={styles.videoCardButton}
													onClick={() => openVideoPlayer(activeVideoPlayback)}
												>
													<div className={styles.videoWrapper}>
														{activeVideoPlayback.type === 'direct' ? (
															<video
																src={activeVideoPlayback.src}
																className={styles.mediaVideo}
																controls={false}
																preload="metadata"
																muted
																playsInline
																poster={activeVideoPlayback.poster || undefined}
															/>
														) : (
															<div className={styles.videoExternalPreview}>
																<div className={styles.videoExternalBadge}>
																	{activeVideoPlayback.label}
																</div>
															</div>
														)}
														<div className={styles.videoBadge}>▶</div>
													</div>
												</button>
												<div className={styles.videoCardFooter}>
													<span className={styles.photoLabel}>
														{activeVideoPlayback.type === 'direct'
															? 'Видеовизитка'
															: `Ссылка: ${activeVideoPlayback.label}`}
													</span>
													{videoAssets[0] ? (
														<button
															onClick={() => handleDeleteMedia(videoAssets[0].id)}
															className={styles.deleteBtn}
															title="Удалить"
														>
															✕
														</button>
													) : (
														<button
															onClick={handleMediaUpload}
															className={styles.mediaActionBtn}
															title="Изменить ссылку"
														>
															↗
														</button>
													)}
												</div>
											</div>
										</div>
									</section>
								)}
							</div>

							<div className={styles.sideColumn}>
								<section className={styles.section}>
									<h2>Физические параметры</h2>
									<div className={styles.statsGrid}>
										{profileDetails.physicalRows.map((row) => (
											<div key={row.label} className={styles.statCard}>
												<span>{row.label}</span>
												<strong>{row.value}</strong>
											</div>
										))}
									</div>
								</section>

								<section className={styles.section}>
									<h2>Основная информация</h2>
									<div className={styles.infoGrid}>
										{profileDetails.basicRows.map((row) => (
											<InfoRow key={row.label} label={row.label} value={row.value} onClick={handleEdit} />
										))}
									</div>
								</section>

								<section className={styles.section}>
									<h2>Профессиональные данные</h2>
									<div className={styles.infoGrid}>
										{profileDetails.professionalRows.map((row) => (
											<InfoRow key={row.label} label={row.label} value={row.value} onClick={handleEdit} />
										))}
									</div>
								</section>
								<section className={styles.section}>
									<h2>Куда получать уведомления о кастингах</h2>
									<div className={styles.channelGrid}>
										{availableNotificationChannels.map((channel) => (
											<button
												key={channel}
												type="button"
												className={`${styles.channelButton} ${selectedNotificationChannel === channel ? styles.channelButtonActive : ''}`}
												onClick={() => saveNotificationChannel(channel)}
												disabled={savingNotificationChannel}
											>
												<strong>{NOTIFICATION_CHANNEL_LABELS[channel] || channel}</strong>
												<span>
													{channel === 'email'
														? notificationSettings?.email || 'Не привязан'
														: channel === 'sms'
															? (notificationSettings?.phone_number ? formatPhone(notificationSettings.phone_number) : 'Не привязан')
															: channel === 'telegram'
																? (notificationSettings?.telegram_connected ? 'Подключен' : 'Не подключен')
																: 'Лента уведомлений внутри кабинета'}
												</span>
											</button>
										))}
									</div>
									<p className={styles.channelHint}>
										Сейчас выбрано: <b>{NOTIFICATION_CHANNEL_LABELS[selectedNotificationChannel] || selectedNotificationChannel}</b> · {notificationChannelHint}
									</p>
									{notificationSettingsError && (
										<p className={styles.channelError}>{notificationSettingsError}</p>
									)}
								</section>
								<section className={styles.section}>
									<h2>Быстрые действия</h2>
									<div className={styles.bottomActionGrid}>
										<button
											type="button"
											className={styles.bottomActionCard}
											onClick={() => router.push('/cabinet/feed')}
										>
											<span className={styles.bottomActionIcon}>
												<IconSearch size={18} />
											</span>
											<span className={styles.bottomActionBody}>
												<strong>Лента кастингов</strong>
												<small>Смотрите проекты и откликайтесь</small>
											</span>
											<IconChevronRight size={18} />
										</button>

										<button
											type="button"
											className={`${styles.bottomActionCard} ${styles.bottomActionCardAccent}`}
											onClick={() => setResponsesExpanded((prev) => !prev)}
										>
											<span className={styles.bottomActionIcon}>
												<IconZap size={18} />
											</span>
											<span className={styles.bottomActionBody}>
												<strong>Мои отклики</strong>
												<small>{myResponses.length > 0 ? `У вас ${myResponses.length} откликов` : 'Проверяйте статусы своих заявок'}</small>
											</span>
											<span className={styles.bottomActionBadge}>{myResponses.length}</span>
										</button>

										<button
											type="button"
											className={styles.bottomActionCard}
											onClick={() => router.push('/cabinet/profile/create')}
										>
											<span className={styles.bottomActionIcon}>
												<IconPlus size={18} />
											</span>
											<span className={styles.bottomActionBody}>
												<strong>Добавить анкету</strong>
												<small>Создайте еще один профиль для другого амплуа</small>
											</span>
											<IconChevronRight size={18} />
										</button>
									</div>

									{responsesExpanded && (
										myResponses.length > 0 ? (
											<div className={styles.responseList}>
												{myResponses.map((r: any) => {
													const st = STATUS_MAP[r.actor_status] || STATUS_MAP.pending
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
							</div>
						</div>
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
						{selectedVideo.type === 'direct' ? (
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
						) : (
							<iframe
								src={selectedVideo.src}
								className={styles.lightboxFrame}
								allow="autoplay; fullscreen; picture-in-picture"
								allowFullScreen
								onClick={(e) => e.stopPropagation()}
							/>
						)}
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
										src={normalizeCastingImageUrl(selectedResponseCasting.image_url) || ''}
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


