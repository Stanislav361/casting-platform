'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import {
	useUploadPhoto,
	useActorProfile,
	useUpdateProfile,
} from '~models/actor-profile'
import { validateVideoUrl } from '~/shared/video-link'
import Page from '~widgets/page'
import { DataLoader } from '~packages/lib'
import { Loader } from '~packages/ui'
import AlertError from '~widgets/alert-error'

import styles from './page.module.scss'

const ACCEPTED_PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/heif,image/heic'
const MAX_PHOTO_SIZE = 20 * 1024 * 1024  // 20MB

export default function MediaUploadPage() {
	const params = useParams()
	const router = useRouter()
	const profileId = Number(params.id)

	const photoInputRef = useRef<HTMLInputElement>(null)

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const uploadPhoto = useUploadPhoto(profileId)
	const updateProfile = useUpdateProfile(profileId)

	const [uploadProgress, setUploadProgress] = useState<string | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [uploadResult, setUploadResult] = useState<'success' | 'error' | null>(null)
	const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
	const [videoUrl, setVideoUrl] = useState('')

	useEffect(() => {
		setVideoUrl(profile?.video_intro || '')
	}, [profile?.video_intro])

	const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (file.size > MAX_PHOTO_SIZE) {
			toast.error('Фото слишком большое. Максимум 20МБ')
			return
		}

		const reader = new FileReader()
		reader.onload = (ev) => setPreviewUrl(ev.target?.result as string)
		reader.readAsDataURL(file)
		setSelectedPhoto(file)
		setUploadResult(null)
	}

	const handlePhotoUpload = async () => {
		if (!selectedPhoto) return

		try {
			setUploadProgress('⏳ Загрузка фото...')
			await uploadPhoto.mutateAsync(selectedPhoto)
			toast.success('✅ Фото сохранено!')
			setUploadResult('success')
			setSelectedPhoto(null)
			setPreviewUrl(null)
		} catch {
			toast.error('❌ Ошибка при загрузке. Попробуйте ещё раз.')
			setUploadResult('error')
		} finally {
			setUploadProgress(null)
			if (photoInputRef.current) photoInputRef.current.value = ''
		}
	}

	const handleCancelPhoto = () => {
		setSelectedPhoto(null)
		setPreviewUrl(null)
		setUploadResult(null)
		if (photoInputRef.current) photoInputRef.current.value = ''
	}

	const handleSaveVideoLink = async () => {
		const trimmed = videoUrl.trim()
		if (trimmed && !validateVideoUrl(trimmed)) {
			toast.error('Введите корректную ссылку на видео')
			return
		}
		try {
			await updateProfile.mutateAsync({
				video_intro: trimmed || null,
			} as any)
			toast.success(trimmed ? '✅ Ссылка на видеовизитку сохранена' : '✅ Ссылка удалена')
		} catch {
			toast.error('❌ Не удалось сохранить ссылку')
		}
	}

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
				<div className={styles.mediaUpload}>
					<div className={styles.header}>
						<button
							className={styles.backButton}
							onClick={() => router.back()}
						>
							← Назад
						</button>
						<h1 className={styles.title}>Загрузка медиа</h1>
					</div>

					{/* Upload Progress */}
					{uploadProgress && (
						<div className={styles.progressBanner}>
							<div className={styles.spinner} />
							<span>{uploadProgress}</span>
						</div>
					)}

					{/* Selected photo preview + Save */}
					{selectedPhoto && (
						<div className={styles.selectedFile}>
							{previewUrl && (
								<div className={styles.preview}>
									<img src={previewUrl} alt="Preview" />
								</div>
							)}
							<div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
								<button
									onClick={handlePhotoUpload}
									disabled={!!uploadProgress}
									style={{
										flex: 1, padding: '14px 0', borderRadius: 10,
										border: 'none', background: '#f5c518', color: '#000',
										fontSize: 16, fontWeight: 600, cursor: uploadProgress ? 'wait' : 'pointer',
										opacity: uploadProgress ? 0.5 : 1,
									}}
								>
									{uploadProgress ? '⏳ Загрузка...' : '💾 Сохранить'}
								</button>
								<button
									onClick={handleCancelPhoto}
									disabled={!!uploadProgress}
									style={{
										padding: '14px 20px', borderRadius: 10,
										border: '1px solid #444', background: 'transparent', color: '#aaa',
										fontSize: 14, cursor: 'pointer',
									}}
								>
									Отмена
								</button>
							</div>
						</div>
					)}

					{uploadResult === 'success' && !selectedFile && (
						<div style={{ padding: 16, background: '#1a2e1a', border: '1px solid #2d5a2d', borderRadius: 10, marginBottom: 16, color: '#4ade80', textAlign: 'center' }}>
							✅ Файл успешно сохранён в профиль
						</div>
					)}

					{/* Upload Buttons */}
					{!selectedPhoto && (
						<div className={styles.uploadOptions}>
							<div
								className={styles.uploadCard}
								onClick={() => photoInputRef.current?.click()}
							>
								<div className={styles.uploadIcon}>📷</div>
								<div className={styles.uploadLabel}>Загрузить фото</div>
								<div className={styles.uploadHint}>
									JPEG, PNG, WebP, HEIF — до 20МБ
								</div>
								<div className={styles.uploadHint}>
									Автоматический ресайз и оптимизация
								</div>
							</div>
						</div>
					)}

					<div className={styles.linkCard}>
						<h2>Видеовизитка по ссылке</h2>
						<p className={styles.linkCardText}>
							Видео больше не нужно загружать на наш сервер. Вставьте ссылку на YouTube, Rutube,
							Vimeo, Яндекс Диск или другой внешний источник.
						</p>
						<input
							type="url"
							value={videoUrl}
							onChange={(e) => setVideoUrl(e.target.value)}
							placeholder="https://..."
							className={styles.linkInput}
						/>
						<div className={styles.linkActions}>
							<button
								type="button"
								className={styles.linkSaveBtn}
								onClick={handleSaveVideoLink}
								disabled={updateProfile.isPending}
							>
								{updateProfile.isPending ? 'Сохранение...' : 'Сохранить ссылку'}
							</button>
							<button
								type="button"
								className={styles.linkClearBtn}
								onClick={() => setVideoUrl('')}
								disabled={updateProfile.isPending}
							>
								Очистить
							</button>
						</div>
						{profile?.video_intro && (
							<a
								href={profile.video_intro}
								target="_blank"
								rel="noreferrer"
								className={styles.currentVideoLink}
							>
								Открыть текущую видеоссылку
							</a>
						)}
					</div>

					{/* Hidden inputs */}
					<input
						ref={photoInputRef}
						type="file"
						accept={ACCEPTED_PHOTO_TYPES}
						onChange={handlePhotoSelect}
						style={{ display: 'none' }}
					/>

					{/* Current Media */}
					{profile?.media_assets && profile.media_assets.length > 0 && (
						<div className={styles.currentMedia}>
							<h2>Загруженные файлы ({profile.media_assets.length})</h2>
							<div className={styles.mediaList}>
								{profile.media_assets.map((asset) => (
									<div key={asset.id} className={styles.mediaItem}>
										{asset.file_type === 'photo' ? (
											<img
												src={asset.thumbnail_url || asset.processed_url || asset.original_url}
												alt="Media"
											/>
										) : (
											<div className={styles.videoThumb}>
												{asset.thumbnail_url ? (
													<img src={asset.thumbnail_url} alt="Video" />
												) : (
													<span>🎬</span>
												)}
											</div>
										)}
										<div className={styles.mediaItemInfo}>
											<span className={styles.mediaType}>
												{asset.file_type === 'photo' ? 'Фото' : 'Видео'}
												{asset.is_primary && ' ★'}
											</span>
											{asset.file_size && (
												<span className={styles.mediaSize}>
													{(asset.file_size / (1024 * 1024)).toFixed(1)} МБ
												</span>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</Page>
		</DataLoader>
	)
}


