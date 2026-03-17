'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import {
	IconArrowLeft,
	IconZap,
	IconEdit,
	IconTrash,
	IconSend,
	IconLoader,
	IconUser,
	IconX,
	IconMask,
	IconCamera,
	IconStar,
	IconCheck,
	IconEye,
	IconBan,
	IconClock,
} from '~packages/ui/icons'
import styles from './project.module.scss'
import LiveChat from '../../components/live-chat'

export default function ProjectPage() {
	const router = useRouter()
	const params = useParams()
	const projectId = params.id

	const [token, setToken] = useState<string | null>(null)
	const [project, setProject] = useState<any>(null)
	const [respondents, setRespondents] = useState<any[]>([])
	const [chatLogs, setChatLogs] = useState<any[]>([])
	const [editing, setEditing] = useState(false)
	const [title, setTitle] = useState('')
	const [desc, setDesc] = useState('')
	const [comment, setComment] = useState('')
	const [loading, setLoading] = useState(true)
	const [selectedActor, setSelectedActor] = useState<any>(null)
	const [favorites, setFavorites] = useState<Set<number>>(new Set())
	const [showFavorites, setShowFavorites] = useState(false)
	const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

	const toggleFavorite = (profileId: number) => {
		setFavorites(prev => {
			const next = new Set(prev)
			if (next.has(profileId)) next.delete(profileId)
			else next.add(profileId)
			return next
		})
	}

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
	}, [router])

	const api = useCallback(
		async (method: string, path: string, body?: any) => {
			if (!token) return null
			const res = await fetch(`${API_URL}${path}`, {
				method,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: body ? JSON.stringify(body) : undefined,
			})
			return res.json()
		},
		[token],
	)

	useEffect(() => {
		if (!token || !projectId) return
		const load = async () => {
			try {
				const [projList, resp, logs] = await Promise.all([
					api('GET', 'employer/projects/'),
					api('GET', `employer/projects/${projectId}/respondents/?page_size=200`).catch(
						() => ({ respondents: [] }),
					),
					api('GET', `collaboration/casting/${projectId}/log/`).catch(
						() => ({ logs: [] }),
					),
				])
				const proj = projList?.projects?.find(
					(p: any) => p.id === Number(projectId),
				)
				if (proj) {
					setProject(proj)
					setTitle(proj.title)
					setDesc(proj.description)
				}
				setRespondents(resp?.respondents || [])
				setChatLogs(logs?.logs || [])
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, projectId, api])

	const saveProject = async () => {
		const res = await api('PATCH', `employer/projects/${projectId}/`, {
			title,
			description: desc,
		})
		if (res?.id) {
			setProject(res)
			setEditing(false)
		}
	}

	const deleteProject = async () => {
		if (!confirm('Удалить проект?')) return
		await api('DELETE', `employer/projects/${projectId}/`)
		router.replace('/dashboard')
	}

	const publishProject = async () => {
		const res = await api(
			'POST',
			`employer/projects/${projectId}/publish/`,
		)
		if (res?.id) {
			setProject(res)
			return
		}
		alert(res?.detail || 'Не удалось опубликовать проект')
	}

	const sendComment = async () => {
		if (!comment.trim()) return
		await api(
			'POST',
			`collaboration/casting/${projectId}/comment/?message=${encodeURIComponent(comment)}`,
		)
		setComment('')
		const logs = await api(
			'GET',
			`collaboration/casting/${projectId}/log/`,
		)
		setChatLogs(logs?.logs || [])
	}

	const RESPONSE_STATUSES = [
		{ value: 'pending', label: 'На рассмотрении', cls: styles.rsPending, icon: <IconClock size={11} /> },
		{ value: 'viewed', label: 'Просмотрено', cls: styles.rsViewed, icon: <IconEye size={11} /> },
		{ value: 'shortlisted', label: 'В шорт-листе', cls: styles.rsShortlisted, icon: <IconStar size={11} /> },
		{ value: 'approved', label: 'Одобрено', cls: styles.rsApproved, icon: <IconCheck size={11} /> },
		{ value: 'rejected', label: 'Отклонено', cls: styles.rsRejected, icon: <IconBan size={11} /> },
	]

	const updateResponseStatus = async (responseId: number, newStatus: string) => {
		const res = await api(
			'PATCH',
			`employer/projects/${projectId}/responses/${responseId}/status/`,
			{ status: newStatus },
		)
		if (res?.ok) {
			setRespondents(prev =>
				prev.map(r =>
					r.response_id === responseId ? { ...r, response_status: newStatus } : r
				)
			)
		}
	}

	const genderLabel = (g: string | null) => {
		if (!g) return '—'
		if (g === 'male') return 'Мужской'
		if (g === 'female') return 'Женский'
		return g
	}

	const qualLabel = (q: string | null) => {
		if (!q) return '—'
		const m: Record<string, string> = {
			professional: 'Профессионал',
			skilled: 'Опытный',
			enthusiast: 'Энтузиаст',
			beginner: 'Начинающий',
			other: 'Другое',
		}
		return m[q] || q
	}

	const lookLabel = (l: string | null) => {
		if (!l) return '—'
		const m: Record<string, string> = {
			european: 'Европейский',
			asian: 'Азиатский',
			slavic: 'Славянский',
			african: 'Африканский',
			latino: 'Латиноамериканский',
			middle_eastern: 'Ближневосточный',
			caucasian: 'Кавказский',
			south_asian: 'Южноазиатский',
			mixed: 'Смешанный',
			other: 'Другой',
		}
		return m[l] || l
	}

	const hairColorLabel = (c: string | null) => {
		if (!c) return '—'
		const m: Record<string, string> = {
			blonde: 'Блонд',
			brunette: 'Брюнет',
			brown: 'Шатен',
			light_brown: 'Русый',
			red: 'Рыжий',
			gray: 'Седой',
			other: 'Другой',
		}
		return m[c] || c
	}

	const hairLenLabel = (l: string | null) => {
		if (!l) return '—'
		const m: Record<string, string> = {
			short: 'Короткие',
			medium: 'Средние',
			long: 'Длинные',
			bald: 'Лысый',
		}
		return m[l] || l
	}

	if (loading)
		return (
			<div className={styles.root}>
				<p className={styles.center}>
					<IconLoader size={18} /> Загрузка...
				</p>
			</div>
		)

	const renderActorModal = () => {
		if (!selectedActor) return null
		const a = selectedActor
		const photos = (a.media_assets || []).filter(
			(m: any) => m.file_type === 'photo',
		)
		const videos = (a.media_assets || []).filter(
			(m: any) => m.file_type === 'video',
		)

		const curSt = RESPONSE_STATUSES.find(s => s.value === (a.response_status || 'pending')) || RESPONSE_STATUSES[0]

		return (
			<div
				className={styles.modalOverlay}
				onClick={() => setSelectedActor(null)}
			>
				<div
					className={styles.modalCard}
					onClick={(e) => e.stopPropagation()}
				>
					<div className={styles.modalHeader}>
						<h3>
							{a.display_name ||
								`${a.first_name || ''} ${a.last_name || ''}`.trim() ||
								'Актёр'}
						</h3>
						<button
							className={styles.modalClose}
							onClick={() => setSelectedActor(null)}
						>
							<IconX size={14} />
						</button>
					</div>
					{a.response_id && (
						<div className={styles.modalStatusBar}>
							<span className={styles.modalStatusLabel}>Статус отклика:</span>
							<div className={styles.rsRow}>
								{RESPONSE_STATUSES.map(s => {
									const active = curSt.value === s.value
									return (
										<button
											key={s.value}
											className={`${styles.rsChip} ${active ? s.cls : ''}`}
											onClick={() => {
												if (!active) {
													updateResponseStatus(a.response_id, s.value)
													setSelectedActor({ ...a, response_status: s.value })
												}
											}}
										>
											{s.icon}
											<span>{s.label}</span>
										</button>
									)
								})}
							</div>
						</div>
					)}
					<div className={styles.modalBody}>
						{photos.length > 0 && (
							<div className={styles.mediaGallery}>
							{photos.map((m: any) => (
								<img
									key={m.id}
									src={m.processed_url || m.original_url}
									alt=""
									className={styles.galleryImg}
									onClick={() => setLightboxIdx(photos.indexOf(m))}
									style={{ cursor: 'pointer' }}
								/>
							))}
							</div>
						)}

						<section className={styles.detailSection}>
							<h4>Личные данные</h4>
							<div className={styles.detailRow}>
								<span>Имя</span>
								<b>{a.first_name || '—'}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Фамилия</span>
								<b>{a.last_name || '—'}</b>
							</div>
							{a.display_name && (
								<div className={styles.detailRow}>
									<span>Отображаемое имя</span>
									<b>{a.display_name}</b>
								</div>
							)}
							<div className={styles.detailRow}>
								<span>Пол</span>
								<b>{genderLabel(a.gender)}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Дата рождения</span>
								<b>
									{a.date_of_birth?.split('T')[0] ||
										(a.age ? `~${a.age} лет` : '—')}
								</b>
							</div>
							<div className={styles.detailRow}>
								<span>Город</span>
								<b>{a.city || '—'}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Телефон</span>
								<b>{a.phone_number || '—'}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Email</span>
								<b>{a.email || '—'}</b>
							</div>
						</section>

						<section className={styles.detailSection}>
							<h4>Профессиональные данные</h4>
							<div className={styles.detailRow}>
								<span>Квалификация</span>
								<b>{qualLabel(a.qualification)}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Опыт</span>
								<b>
									{a.experience != null
										? `${a.experience} лет`
										: '—'}
								</b>
							</div>
							<div className={styles.detailRow}>
								<span>О себе</span>
								<b className={styles.multiLine}>
									{a.about_me || '—'}
								</b>
							</div>
							{a.video_intro && (
								<div className={styles.detailRow}>
									<span>Видео-визитка</span>
									<b>
										<a
											href={a.video_intro}
											target="_blank"
											rel="noreferrer"
											className={styles.link}
										>
											{a.video_intro}
										</a>
									</b>
								</div>
							)}
							{a.self_test_url && (
								<div className={styles.detailRow}>
									<span>Самопроба</span>
									<b>
										<a
											href={a.self_test_url}
											target="_blank"
											rel="noreferrer"
											className={styles.link}
										>
											{a.self_test_url}
										</a>
									</b>
								</div>
							)}
						</section>

						<section className={styles.detailSection}>
							<h4>Параметры внешности</h4>
							<div className={styles.detailRow}>
								<span>Тип внешности</span>
								<b>{lookLabel(a.look_type)}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Цвет волос</span>
								<b>{hairColorLabel(a.hair_color)}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Длина волос</span>
								<b>{hairLenLabel(a.hair_length)}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Рост</span>
								<b>{a.height ? `${a.height} см` : '—'}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Размер одежды</span>
								<b>{a.clothing_size || '—'}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Размер обуви</span>
								<b>{a.shoe_size || '—'}</b>
							</div>
							<div className={styles.detailRow}>
								<span>Обхват груди</span>
								<b>
									{a.bust_volume
										? `${a.bust_volume} см`
										: '—'}
								</b>
							</div>
							<div className={styles.detailRow}>
								<span>Обхват талии</span>
								<b>
									{a.waist_volume
										? `${a.waist_volume} см`
										: '—'}
								</b>
							</div>
							<div className={styles.detailRow}>
								<span>Обхват бёдер</span>
								<b>
									{a.hip_volume
										? `${a.hip_volume} см`
										: '—'}
								</b>
							</div>
						</section>

						{a.trust_score > 0 && (
							<section className={styles.detailSection}>
								<h4>Рейтинг</h4>
								<div className={styles.detailRow}>
									<span>Trust Score</span>
									<b>{a.trust_score}</b>
								</div>
							</section>
						)}

						{videos.length > 0 && (
							<section className={styles.detailSection}>
								<h4>Видео ({videos.length})</h4>
								<div className={styles.mediaGallery}>
									{videos.map((m: any) => (
										<video
											key={m.id}
											src={
												m.processed_url ||
												m.original_url
											}
											controls
											className={styles.galleryVideo}
										/>
									))}
								</div>
							</section>
						)}

						<div className={styles.detailRow}>
							<span>Дата отклика</span>
							<b>
								{a.responded_at
									? new Date(a.responded_at).toLocaleDateString('ru-RU')
									: '—'}
							</b>
						</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<>
			<div className={styles.root}>
				<header className={styles.header}>
					<button
						onClick={() => router.back()}
						className={styles.backBtn}
					>
						<IconArrowLeft size={14} /> Назад
					</button>
					<h1>Проект #{projectId}</h1>
				</header>

				<div className={styles.content}>
					<section className={styles.section}>
						<div className={styles.sectionHeader}>
							<h2>Информация</h2>
							<div className={styles.actions}>
								{project?.status !== 'published' && (
									<button
										onClick={publishProject}
										className={styles.btnPublish}
									>
										<IconZap size={13} /> Опубликовать
									</button>
								)}
								{!editing && (
									<button
										onClick={() => setEditing(true)}
										className={styles.btnEdit}
									>
										<IconEdit size={13} /> Редактировать
									</button>
								)}
								<button
									onClick={deleteProject}
									className={styles.btnDelete}
								>
									<IconTrash size={13} /> Удалить
								</button>
							</div>
						</div>

						{editing ? (
							<div className={styles.editForm}>
								<input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className={styles.input}
									placeholder="Название"
								/>
								<textarea
									value={desc}
									onChange={(e) => setDesc(e.target.value)}
									className={styles.textarea}
									placeholder="Описание"
									rows={3}
								/>
								<div className={styles.editActions}>
									<button
										onClick={saveProject}
										className={styles.btnSave}
									>
										Сохранить
									</button>
									<button
										onClick={() => setEditing(false)}
										className={styles.btnCancel}
									>
										Отмена
									</button>
								</div>
							</div>
						) : (
							<div className={styles.infoCard}>
								<h3>{project?.title}</h3>
								<p>{project?.description}</p>
								<div className={styles.meta}>
									<span>
										Статус: <b>{project?.status}</b>
									</span>
									<span>
										Откликов: <b>{respondents.length}</b>
									</span>
									<span>
										Создан:{' '}
										{project?.created_at?.split('T')[0]}
									</span>
								</div>
							</div>
						)}
					</section>

				<section className={styles.section}>
					<h2>
						<IconMask size={16} /> Откликнувшиеся актёры (
						{respondents.length})
						{favorites.size > 0 && <button onClick={() => setShowFavorites(!showFavorites)} className={styles.btnFav}><IconStar size={13} /> Избранные ({favorites.size})</button>}
					</h2>
					{respondents.length === 0 ? (
							<p className={styles.empty}>Пока нет откликов</p>
						) : (
						<div className={styles.actorList}>
							{(showFavorites ? respondents.filter((r: any) => favorites.has(r.profile_id)) : respondents).map((r: any, i: number) => {
									const photoCount = (
										r.media_assets || []
									).filter(
										(m: any) => m.file_type === 'photo',
									).length
									return (
										<div
											key={i}
											className={styles.actorCard}
											onClick={() => setSelectedActor(r)}
										>
											<div className={styles.actorAvatar}>
												{r.photo_url ? (
													<img
														src={r.photo_url}
														alt=""
													/>
												) : (
													<IconUser size={20} />
												)}
											</div>
											<div className={styles.actorInfo}>
												<h4>
													{r.display_name ||
														`${r.first_name || ''} ${r.last_name || ''}`}
												</h4>
												<p>
													{r.city || '—'} ·{' '}
													{genderLabel(r.gender)} ·{' '}
													{qualLabel(r.qualification)}
													{r.height
														? ` · ${r.height} см`
														: ''}
												</p>
												{photoCount > 0 && (
													<p className={styles.actorMediaCount}>
														<IconCamera size={11} />{' '}
														{photoCount} фото
													</p>
												)}
												<div className={styles.rsRow}>
													{RESPONSE_STATUSES.map(s => {
														const active = (r.response_status || 'pending') === s.value
														return (
															<button
																key={s.value}
																className={`${styles.rsChip} ${active ? s.cls : ''}`}
																onClick={(e) => {
																	e.stopPropagation()
																	if (!active && r.response_id) updateResponseStatus(r.response_id, s.value)
																}}
																title={s.label}
															>
																{s.icon}
																{active && <span>{s.label}</span>}
															</button>
														)
													})}
												</div>
											</div>
											<button
												className={`${styles.favBtn} ${favorites.has(r.profile_id) ? styles.favBtnActive : ''}`}
												onClick={(e) => { e.stopPropagation(); toggleFavorite(r.profile_id) }}
												title={favorites.has(r.profile_id) ? 'Убрать из избранного' : 'В избранное'}
											>
												<IconStar size={14} />
											</button>
											<span className={styles.actorDate}>
												{r.responded_at
													? new Date(
															r.responded_at,
														).toLocaleDateString(
															'ru-RU',
														)
													: ''}
											</span>
										</div>
									)
								})}
							</div>
						)}
					</section>

					<section className={styles.section}>
						<h2>Обсуждение</h2>
						<div className={styles.chatBox}>
							{chatLogs.length === 0 ? (
								<p className={styles.empty}>Нет сообщений</p>
							) : (
								chatLogs.map((log: any, i: number) => (
									<div key={i} className={styles.chatMsg}>
										<span className={styles.chatUser}>
											{log.user_name ||
												`User #${log.user_id}`}
										</span>
										<span className={styles.chatText}>
											{log.message}
										</span>
										<span className={styles.chatTime}>
											{log.created_at?.split('.')[0]}
										</span>
									</div>
								))
							)}
						</div>
						<div className={styles.chatInput}>
							<input
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								placeholder="Написать комментарий..."
								className={styles.input}
								onKeyDown={(e) =>
									e.key === 'Enter' && sendComment()
								}
							/>
							<button
								onClick={sendComment}
								className={styles.btnSend}
							>
								<IconSend size={14} />
							</button>
						</div>
					</section>
				</div>
				<LiveChat castingId={Number(projectId) || 0} />
			</div>

			{renderActorModal()}

			{lightboxIdx !== null && selectedActor && (() => {
				const photos = (selectedActor.media_assets || []).filter((m: any) => m.file_type === 'photo')
				if (!photos[lightboxIdx]) return null
				return (
					<div className={styles.lightbox} onClick={() => setLightboxIdx(null)}>
						<button className={styles.lightboxClose} onClick={() => setLightboxIdx(null)}><IconX size={20} /></button>
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
		</>
	)
}
