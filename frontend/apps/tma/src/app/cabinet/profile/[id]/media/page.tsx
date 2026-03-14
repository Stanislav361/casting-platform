'use client'

import { useParams, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'

import {
	useUploadPhoto,
	useUploadVideo,
	useActorProfile,
} from '~models/actor-profile'
import Page from '~widgets/page'
import { DataLoader } from '~packages/lib'
import { Loader } from '~packages/ui'
import AlertError from '~widgets/alert-error'

import styles from './page.module.scss'

const ACCEPTED_PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/heif,image/heic'
const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm'
const MAX_PHOTO_SIZE = 20 * 1024 * 1024  // 20MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

export default function MediaUploadPage() {
	const params = useParams()
	const router = useRouter()
	const profileId = Number(params.id)

	const photoInputRef = useRef<HTMLInputElement>(null)
	const videoInputRef = useRef<HTMLInputElement>(null)

	const { data: profile, isLoading, isError } = useActorProfile(profileId)
	const uploadPhoto = useUploadPhoto(profileId)
	const uploadVideo = useUploadVideo(profileId)

	const [uploadProgress, setUploadProgress] = useState<string | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [uploadResult, setUploadResult] = useState<'success' | 'error' | null>(null)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [fileType, setFileType] = useState<'photo' | 'video' | null>(null)

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
		setSelectedFile(file)
		setFileType('photo')
		setUploadResult(null)
	}

	const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (file.size > MAX_VIDEO_SIZE) {
			toast.error('Видео слишком большое. Максимум 100МБ')
			return
		}

		setSelectedFile(file)
		setFileType('video')
		setPreviewUrl(null)
		setUploadResult(null)
	}

	const handleUpload = async () => {
		if (!selectedFile || !fileType) return

		try {
			setUploadProgress(fileType === 'photo' ? '⏳ Загрузка фото...' : '⏳ Загрузка видео...')
			if (fileType === 'photo') {
				await uploadPhoto.mutateAsync(selectedFile)
			} else {
				await uploadVideo.mutateAsync(selectedFile)
			}
			toast.success(fileType === 'photo' ? '✅ Фото сохранено!' : '✅ Видео сохранено!')
			setUploadResult('success')
			setSelectedFile(null)
			setPreviewUrl(null)
			setFileType(null)
		} catch {
			toast.error('❌ Ошибка при загрузке. Попробуйте ещё раз.')
			setUploadResult('error')
		} finally {
			setUploadProgress(null)
			if (photoInputRef.current) photoInputRef.current.value = ''
			if (videoInputRef.current) videoInputRef.current.value = ''
		}
	}

	const handleCancel = () => {
		setSelectedFile(null)
		setPreviewUrl(null)
		setFileType(null)
		setUploadResult(null)
		if (photoInputRef.current) photoInputRef.current.value = ''
		if (videoInputRef.current) videoInputRef.current.value = ''
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

					{/* Selected file preview + Save */}
					{selectedFile && (
						<div className={styles.selectedFile}>
							{previewUrl && (
								<div className={styles.preview}>
									<img src={previewUrl} alt="Preview" />
								</div>
							)}
							{fileType === 'video' && (
								<div className={styles.preview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, background: '#1a1a1a', borderRadius: 12 }}>
									<span style={{ fontSize: 40 }}>🎬</span>
									<span style={{ marginLeft: 12, color: '#aaa' }}>{selectedFile.name}</span>
								</div>
							)}
							<div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
								<button
									onClick={handleUpload}
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
									onClick={handleCancel}
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
					{!selectedFile && (
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

							<div
								className={styles.uploadCard}
								onClick={() => videoInputRef.current?.click()}
							>
								<div className={styles.uploadIcon}>🎬</div>
								<div className={styles.uploadLabel}>Загрузить видео</div>
								<div className={styles.uploadHint}>
									MP4, MOV, WebM — до 100МБ
								</div>
								<div className={styles.uploadHint}>
									Автоматическое транскодирование в MP4
								</div>
							</div>
						</div>
					)}

					{/* Hidden inputs */}
					<input
						ref={photoInputRef}
						type="file"
						accept={ACCEPTED_PHOTO_TYPES}
						onChange={handlePhotoSelect}
						style={{ display: 'none' }}
					/>
					<input
						ref={videoInputRef}
						type="file"
						accept={ACCEPTED_VIDEO_TYPES}
						onChange={handleVideoSelect}
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


