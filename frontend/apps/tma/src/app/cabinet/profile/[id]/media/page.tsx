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
const MAX_PHOTO_COUNT = 10
const PHOTO_CATEGORY_OPTIONS = [
	{ value: 'portrait', label: 'Портрет', required: true },
	{ value: 'profile', label: 'Профиль', required: true },
	{ value: 'full_height', label: 'Полный рост', required: true },
	{ value: 'additional', label: 'Дополнительное фото', required: false },
] as const
const REQUIRED_PHOTO_CATEGORIES = PHOTO_CATEGORY_OPTIONS.filter((item) => item.required)
const PHOTO_CATEGORY_RULES: Record<(typeof PHOTO_CATEGORY_OPTIONS)[number]['value'], string> = {
	portrait: 'Крупный портретный кадр: лицо и верх корпуса, вертикально.',
	profile: 'Боковой ракурс актёра, вертикальный кадр, без лишних объектов.',
	full_height: 'Актёр должен быть целиком с головы до ног, вертикальный кадр.',
	additional: 'Любой дополнительный сильный кадр для анкеты.',
}
const PHOTO_CATEGORY_EXAMPLES: Record<
	(typeof PHOTO_CATEGORY_OPTIONS)[number]['value'],
	{ title: string; hint: string; image: string }
> = {
	portrait: {
		title: 'Портрет',
		hint: 'Лицо и верх корпуса занимают основную часть кадра.',
		image: '/photo-examples/portrait.png',
	},
	profile: {
		title: 'Профиль',
		hint: 'Боковой ракурс актёра, фигура развёрнута в сторону.',
		image: '/photo-examples/profile.png',
	},
	full_height: {
		title: 'Полный рост',
		hint: 'Человек виден полностью с головы до ног.',
		image: '/photo-examples/full-height.png',
	},
	additional: {
		title: 'Дополнительно',
		hint: 'Сильный дополнительный кадр без лишнего фона.',
		image: '/photo-examples/portrait.png',
	},
}

async function getImageMeta(file: File): Promise<{ width: number; height: number }> {
	const objectUrl = URL.createObjectURL(file)
	try {
		const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
			const image = new window.Image()
			image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
			image.onerror = () => reject(new Error('Image load failed'))
			image.src = objectUrl
		})
		return dimensions
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

async function validatePhotoBeforeUpload(
	file: File,
	category: (typeof PHOTO_CATEGORY_OPTIONS)[number]['value'],
): Promise<string | null> {
	if (category === 'additional') return null

	const { width, height } = await getImageMeta(file)
	if (width < 600 || height < 800) {
		return 'Фото слишком маленькое. Нужен чёткий вертикальный кадр не меньше 600x800.'
	}
	if (height <= width) {
		return 'Для обязательных фото нужен вертикальный кадр.'
	}
	const aspectRatio = height / width
	if (category === 'full_height' && aspectRatio < 1.45) {
		return 'Для фото "Полный рост" нужен более высокий вертикальный кадр, где актёр виден целиком.'
	}
	if ((category === 'portrait' || category === 'profile') && aspectRatio > 2.4) {
		return 'Кадр слишком узкий и вытянутый. Выберите более естественное вертикальное фото.'
	}
	return null
}

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
	const [selectedPhotoCategory, setSelectedPhotoCategory] = useState<(typeof PHOTO_CATEGORY_OPTIONS)[number]['value']>('portrait')
	const [videoUrl, setVideoUrl] = useState('')
	const [portfolioUrl, setPortfolioUrl] = useState('')

	useEffect(() => {
		setVideoUrl(profile?.video_intro || '')
		setPortfolioUrl(profile?.extra_portfolio_url || '')
	}, [profile?.video_intro, profile?.extra_portfolio_url])

	const photoAssets = (profile?.media_assets || []).filter((asset) => asset.file_type === 'photo')
	const photoCount = photoAssets.length
	const missingRequiredPhotos = REQUIRED_PHOTO_CATEGORIES.filter(
		(category) => !photoAssets.some((asset) => asset.photo_category === category.value),
	)
	const canUploadMorePhotos = photoCount < MAX_PHOTO_COUNT
	const additionalLocked = missingRequiredPhotos.length > 0

	const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (!canUploadMorePhotos) {
			toast.error(`Можно загрузить не больше ${MAX_PHOTO_COUNT} фото`)
			if (photoInputRef.current) photoInputRef.current.value = ''
			return
		}

		if (file.size > MAX_PHOTO_SIZE) {
			toast.error('Фото слишком большое. Максимум 20МБ')
			if (photoInputRef.current) photoInputRef.current.value = ''
			return
		}

		try {
			const validationError = await validatePhotoBeforeUpload(file, selectedPhotoCategory)
			if (validationError) {
				toast.error(validationError)
				if (photoInputRef.current) photoInputRef.current.value = ''
				return
			}
		} catch {
			toast.error('Не удалось прочитать изображение. Попробуйте другой файл.')
			if (photoInputRef.current) photoInputRef.current.value = ''
			return
		}

		const reader = new FileReader()
		reader.onload = (ev) => setPreviewUrl(ev.target?.result as string)
		reader.readAsDataURL(file)
		setSelectedPhoto(file)
		setUploadResult(null)
	}

	const openUploadForCategory = (category: (typeof PHOTO_CATEGORY_OPTIONS)[number]['value']) => {
		if (!canUploadMorePhotos) {
			toast.error(`Можно загрузить не больше ${MAX_PHOTO_COUNT} фото`)
			return
		}
		if (category === 'additional' && additionalLocked) {
			toast.error('Сначала загрузите портрет, профиль и полный рост')
			return
		}
		setSelectedPhotoCategory(category)
		setSelectedPhoto(null)
		setPreviewUrl(null)
		setUploadResult(null)
		if (photoInputRef.current) {
			photoInputRef.current.value = ''
			photoInputRef.current.click()
		}
	}

	const handlePhotoUpload = async () => {
		if (!selectedPhoto) return

		try {
			setUploadProgress('⏳ Загрузка фото...')
			await uploadPhoto.mutateAsync({
				file: selectedPhoto,
				photoCategory: selectedPhotoCategory,
			})
			toast.success('✅ Фото сохранено!')
			setUploadResult('success')
			setSelectedPhoto(null)
			setPreviewUrl(null)
		} catch (error: any) {
			const message =
				error?.response?.data?.detail?.message ||
				error?.response?.data?.message ||
				'❌ Ошибка при загрузке. Попробуйте ещё раз.'
			toast.error(message)
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

	const handleSavePortfolioLink = async () => {
		const trimmed = portfolioUrl.trim()
		if (trimmed) {
			try {
				new URL(trimmed)
			} catch {
				toast.error('Введите корректную ссылку на портфолио')
				return
			}
		}

		try {
			await updateProfile.mutateAsync({
				extra_portfolio_url: trimmed || null,
			} as any)
			toast.success(trimmed ? '✅ Ссылка на портфолио сохранена' : '✅ Ссылка удалена')
		} catch {
			toast.error('❌ Не удалось сохранить ссылку')
		}
	}

	const getPhotoCategoryLabel = (value: string | null) =>
		PHOTO_CATEGORY_OPTIONS.find((item) => item.value === value)?.label || 'Фото'

	const selectedCategoryMeta =
		PHOTO_CATEGORY_OPTIONS.find((item) => item.value === selectedPhotoCategory) || PHOTO_CATEGORY_OPTIONS[0]

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

					<div className={styles.requirementsCard}>
						<div className={styles.requirementsHead}>
							<h2>Фото для анкеты</h2>
							<span className={styles.photoCounter}>{photoCount}/{MAX_PHOTO_COUNT}</span>
						</div>
						<p className={styles.requirementsText}>
							Обязательно загрузите 3 фото: портрет, профиль и полный рост. Всего в анкете можно держать не больше 10 фото.
						</p>
						<div className={styles.requiredGrid}>
							{REQUIRED_PHOTO_CATEGORIES.map((item) => {
								const uploadedAsset = photoAssets.find((asset) => asset.photo_category === item.value)
								const uploaded = Boolean(uploadedAsset)
								return (
									<button
										type="button"
										key={item.value}
										className={`${uploaded ? styles.requiredDone : styles.requiredMissing} ${styles.requiredSlot}`}
										onClick={() => openUploadForCategory(item.value)}
									>
										<span>{uploaded ? 'Готово' : 'Нужно'}</span>
										<strong>{item.label}</strong>
										<small>{PHOTO_CATEGORY_RULES[item.value]}</small>
										<b>{uploaded ? 'Заменить фото' : 'Загрузить фото'}</b>
									</button>
								)
							})}
						</div>
						{missingRequiredPhotos.length > 0 && (
							<div className={styles.requirementsWarning}>
								Не хватает: {missingRequiredPhotos.map((item) => item.label).join(', ')}
							</div>
						)}
					</div>

					<div className={styles.examplesCard}>
						<div className={styles.examplesHead}>
							<h2>Примеры нужных кадров</h2>
							<span>Ориентир перед загрузкой</span>
						</div>
						<div className={styles.examplesGrid}>
							{REQUIRED_PHOTO_CATEGORIES.map((item) => {
								const example = PHOTO_CATEGORY_EXAMPLES[item.value]
								const isActive = selectedPhotoCategory === item.value
								return (
								<div
									key={item.value}
									className={`${styles.exampleCard} ${isActive ? styles.exampleCardActive : ''}`}
								>
									<div className={styles.exampleFrame}>
										<img src={example.image} alt={example.title} className={styles.exampleImg} />
									</div>
									<div className={styles.exampleMeta}>
										<strong>{example.title}</strong>
										<p>{example.hint}</p>
									</div>
								</div>
								)
							})}
						</div>
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
							<div className={styles.selectedCategory}>
								<div className={styles.selectedCategoryBadge}>{selectedCategoryMeta.label}</div>
								<p>{PHOTO_CATEGORY_RULES[selectedCategoryMeta.value]}</p>
							</div>
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

					{uploadResult === 'success' && !selectedPhoto && (
						<div style={{ padding: 16, background: '#1a2e1a', border: '1px solid #2d5a2d', borderRadius: 10, marginBottom: 16, color: '#4ade80', textAlign: 'center' }}>
							✅ Файл успешно сохранён в профиль
						</div>
					)}

					{/* Upload Buttons */}
					{!selectedPhoto && (
						<div className={styles.uploadOptions}>
							<button
								type="button"
								className={styles.uploadCard}
								onClick={() => openUploadForCategory('additional')}
								disabled={!canUploadMorePhotos || additionalLocked}
							>
								<div className={styles.uploadIcon}>📷</div>
								<div className={styles.uploadLabel}>Дополнительное фото</div>
								<div className={styles.uploadHint}>
									JPEG, PNG, WebP, HEIF, HEIC — до 20МБ
								</div>
								<div className={styles.uploadHint}>
									{additionalLocked
										? 'Сначала закройте 3 обязательных фото, затем откроются дополнительные'
										: 'Загружайте сюда только дополнительные кадры'}
								</div>
							</button>
						</div>
					)}

					<div className={styles.linkCard}>
						<h2>Дополнительное портфолио</h2>
						<p className={styles.linkCardText}>
							Сюда можно добавить ссылку на папку, сайт, Яндекс Диск, Google Drive или другое внешнее портфолио.
						</p>
						<input
							type="url"
							value={portfolioUrl}
							onChange={(e) => setPortfolioUrl(e.target.value)}
							placeholder="https://..."
							className={styles.linkInput}
						/>
						<div className={styles.linkActions}>
							<button
								type="button"
								className={styles.linkSaveBtn}
								onClick={handleSavePortfolioLink}
								disabled={updateProfile.isPending}
							>
								{updateProfile.isPending ? 'Сохранение...' : 'Сохранить ссылку'}
							</button>
							<button
								type="button"
								className={styles.linkClearBtn}
								onClick={() => setPortfolioUrl('')}
								disabled={updateProfile.isPending}
							>
								Очистить
							</button>
						</div>
						{profile?.extra_portfolio_url && (
							<a
								href={profile.extra_portfolio_url}
								target="_blank"
								rel="noreferrer"
								className={styles.currentVideoLink}
							>
								Открыть дополнительное портфолио
							</a>
						)}
					</div>

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
												{asset.file_type === 'photo'
													? getPhotoCategoryLabel(asset.photo_category)
													: 'Видео'}
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


