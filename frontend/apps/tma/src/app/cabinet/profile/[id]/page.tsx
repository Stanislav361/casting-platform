'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

import {
	useActorProfile,
	useUpdateProfile,
	useDeleteMedia,
	useSetPrimaryMedia,
	IActorProfileUpdate,
} from '~models/actor-profile'
import Page from '~widgets/page'
import { DataLoader } from '~packages/lib'
import { Loader } from '~packages/ui'
import AlertError from '~widgets/alert-error'

import styles from './page.module.scss'

export default function ProfileDetailPage() {
	const params = useParams()
	const router = useRouter()
	const profileId = Number(params.id)

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const updateProfile = useUpdateProfile(profileId)
	const deleteMedia = useDeleteMedia(profileId)
	const setPrimaryMedia = useSetPrimaryMedia(profileId)

	const [isEditing, setIsEditing] = useState(false)

	const handleEdit = () => {
		router.push(`/cabinet/profile/${profileId}/edit`)
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
												/>
											) : (
												<div className={styles.videoWrapper}>
													<video
														src={
															asset.processed_url ||
															asset.original_url
														}
														className={styles.mediaVideo}
														controls={false}
														poster={asset.thumbnail_url || undefined}
													/>
													<div className={styles.videoBadge}>▶</div>
												</div>
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
								<InfoRow label="Имя" value={profile.first_name} />
								<InfoRow label="Фамилия" value={profile.last_name} />
								<InfoRow label="Пол" value={profile.gender} />
								<InfoRow
									label="Дата рождения"
									value={profile.date_of_birth}
								/>
								<InfoRow label="Телефон" value={profile.phone_number} />
								<InfoRow label="Email" value={profile.email} />
								<InfoRow label="Город" value={profile.city} />
							</div>
						</section>

						{/* Professional Info */}
						<section className={styles.section}>
							<h2>Профессиональные данные</h2>
							<div className={styles.infoGrid}>
								<InfoRow
									label="Квалификация"
									value={profile.qualification}
								/>
								<InfoRow
									label="Опыт (лет)"
									value={profile.experience?.toString()}
								/>
								<InfoRow label="О себе" value={profile.about_me} />
							</div>
						</section>

						{/* Physical Parameters */}
						<section className={styles.section}>
							<h2>Параметры</h2>
							<div className={styles.infoGrid}>
								<InfoRow label="Тип внешности" value={profile.look_type} />
								<InfoRow label="Цвет волос" value={profile.hair_color} />
								<InfoRow label="Длина волос" value={profile.hair_length} />
								<InfoRow
									label="Рост"
									value={
										profile.height
											? `${profile.height} см`
											: null
									}
								/>
								<InfoRow
									label="Размер одежды"
									value={profile.clothing_size}
								/>
								<InfoRow
									label="Размер обуви"
									value={profile.shoe_size}
								/>
								<InfoRow
									label="Обхват груди"
									value={
										profile.bust_volume
											? `${profile.bust_volume} см`
											: null
									}
								/>
								<InfoRow
									label="Обхват талии"
									value={
										profile.waist_volume
											? `${profile.waist_volume} см`
											: null
									}
								/>
								<InfoRow
									label="Обхват бёдер"
									value={
										profile.hip_volume
											? `${profile.hip_volume} см`
											: null
									}
								/>
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
			</Page>
		</DataLoader>
	)
}

function InfoRow({
	label,
	value,
}: {
	label: string
	value: string | null | undefined
}) {
	return (
		<div className={styles.infoRow}>
			<span className={styles.infoLabel}>{label}</span>
			<span className={styles.infoValue}>{value || '—'}</span>
		</div>
	)
}


