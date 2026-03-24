'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
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
} from '~packages/ui/icons'
import styles from './actors.module.scss'

export default function ActorsPage() {
	const router = useRouter()
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

	const openActor = (a: any) => {
		setSelectedActor(a)
		setPhotoIdx(0)
		setShowContacts(false)
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

	const photos = selectedActor
		? (selectedActor.media_assets || []).filter((m: any) => m.file_type === 'photo')
		: []
	const videos = selectedActor
		? (selectedActor.media_assets || []).filter((m: any) => m.file_type === 'video')
		: []
	const currentPhoto = photos[photoIdx]

	if (!token) return null

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button onClick={() => router.push('/dashboard')} className={styles.backBtn}>
					<IconArrowLeft size={14} /> Назад
				</button>
				<div className={styles.headerTitle}>
					<IconUsers size={16} />
					<h1>База актёров</h1>
				</div>
				<span className={styles.headerCount}>{total}</span>
			</header>

			<div className={styles.content}>
				<div className={styles.searchWrap}>
					<IconSearch size={15} />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Поиск по имени..."
						className={styles.searchInput}
					/>
				</div>

				{loading ? (
					<p className={styles.center}>
						<IconLoader size={20} /> Загрузка...
					</p>
				) : actors.length === 0 ? (
					<div className={styles.empty}>
						<IconUsers size={40} />
						<h3>{searchDebounced ? 'Ничего не найдено' : 'Нет актёров'}</h3>
						<p>{searchDebounced ? 'Попробуйте изменить запрос' : 'Актёры появятся после регистрации'}</p>
					</div>
				) : (
					<>
						<div className={styles.actorGrid}>
							{actors.map((a: any) => {
								const name = a.display_name || `${a.last_name || ''} ${a.first_name || ''}`.trim() || 'Актёр'
								const initials = (a.first_name?.[0] || '') + (a.last_name?.[0] || '')
								return (
									<div key={a.profile_id} className={styles.actorCard} onClick={() => openActor(a)}>
										<div className={styles.actorPhoto}>
											{a.photo_url ? <img src={a.photo_url} alt="" /> : initials.toUpperCase() || '?'}
										</div>
										<div className={styles.actorInfo}>
											<div className={styles.actorName}>{name}</div>
											<div className={styles.actorMeta}>
												{a.city && <span><IconMapPin size={11} /> {a.city}</span>}
												{a.gender && <span><IconUser size={11} /> {a.gender}</span>}
												{a.age && <span>{a.age} лет</span>}
												{a.qualification && <span><IconBriefcase size={11} /> {a.qualification}</span>}
											</div>
											{a.about_me && (
												<div className={styles.actorAbout}>
													{a.about_me.length > 80 ? a.about_me.slice(0, 80) + '…' : a.about_me}
												</div>
											)}
										</div>
										<div className={styles.actorActions}>
											<span className={styles.actorArrow}>›</span>
										</div>
									</div>
								)
							})}
						</div>

						{totalPages > 1 && (
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

			{selectedActor && (
				<div className={styles.modalOverlay} onClick={() => setSelectedActor(null)}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<span className={styles.modalTitle}>
								{selectedActor.display_name || `${selectedActor.first_name || ''} ${selectedActor.last_name || ''}`.trim() || 'Актёр'}
							</span>
							<button className={styles.modalClose} onClick={() => setSelectedActor(null)}>
								<IconX size={16} />
							</button>
						</div>
						<div className={styles.modalBody}>
							<div className={styles.carousel}>
								{photos.length > 0 && currentPhoto ? (
									<>
										<img src={currentPhoto.processed_url || currentPhoto.original_url} alt="" />
										{photos.length > 1 && (
											<>
												<button className={`${styles.carouselNav} ${styles.prev}`} onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)}>‹</button>
												<button className={`${styles.carouselNav} ${styles.next}`} onClick={() => setPhotoIdx(i => (i + 1) % photos.length)}>›</button>
												<div className={styles.carouselDots}>
													{photos.map((_: any, i: number) => (
														<button key={i} className={`${styles.carouselDot} ${i === photoIdx ? styles.active : ''}`} onClick={() => setPhotoIdx(i)} />
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

							{videos.length > 0 && (
								<div className={styles.detailSection}>
									<div className={styles.detailSectionTitle}>Видео</div>
									<div className={styles.videosList}>
										{videos.map((v: any) => (
											<video key={v.id} src={v.processed_url || v.original_url} controls preload="metadata" />
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
