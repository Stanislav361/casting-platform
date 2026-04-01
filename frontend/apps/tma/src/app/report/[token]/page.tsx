'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { API_URL } from '~/shared/api-url'
import {
	IconLoader,
	IconUser,
	IconShield,
	IconX,
	IconArrowLeft,
	IconChevronUp,
	IconChevronDown,
	IconSearch,
} from '~packages/ui/icons'
import {
	formatGenderLabel,
	formatHairColorLabel,
	formatHairLengthLabel,
	formatLookTypeLabel,
	formatQualificationLabel,
} from '~/shared/profile-labels'
import styles from './page.module.scss'

type ProfileImage = {
	id: number
	photo_url: string
	crop_photo_url?: string | null
	image_type?: string | null
}

type PublicReportProfile = {
	id: number
	first_name?: string | null
	last_name?: string | null
	gender?: string | null
	height?: number | null
	date_of_birth?: string | null
	city?: string | null
	qualification?: string | null
	look_type?: string | null
	about_me?: string | null
	experience?: number | null
	clothing_size?: number | null
	shoe_size?: number | null
	hair_color?: string | null
	hair_length?: string | null
	bust_volume?: number | null
	waist_volume?: number | null
	hip_volume?: number | null
	video_intro?: string | null
	images?: ProfileImage[]
	is_favorite?: boolean
}

type PublicReportResponse = {
	report_id: number
	title: string
	profiles: PublicReportProfile[]
	updated_at?: string | null
}

const API_BASE = API_URL.replace(/\/+$/, '')

const normalizeMediaUrl = (url?: string | null) => {
	if (!url) return null
	if (url.startsWith('http://') || url.startsWith('https://')) return url
	return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}

const getAge = (date?: string | null) => {
	if (!date) return null
	const birthDate = new Date(date)
	if (Number.isNaN(birthDate.getTime())) return null
	const now = new Date()
	let age = now.getFullYear() - birthDate.getFullYear()
	const monthDiff = now.getMonth() - birthDate.getMonth()
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) age -= 1
	return age > 0 ? age : null
}

export default function PublicReportPage() {
	const params = useParams()
	const token = String(params.token || '')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [report, setReport] = useState<PublicReportResponse | null>(null)
	const [selectedActor, setSelectedActor] = useState<PublicReportProfile | null>(null)
	const [carouselIdx, setCarouselIdx] = useState(0)
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ main: true, about: false })
	const [searchTerm, setSearchTerm] = useState('')

	useEffect(() => {
		let mounted = true
		const load = async () => {
			setLoading(true)
			setError(null)
			try {
				const res = await fetch(`${API_BASE}/public/shortlists/view/${token}/`)
				const data = await res.json().catch(() => null)
				if (!res.ok) throw new Error(data?.detail?.message || data?.detail || 'Не удалось открыть отчёт')
				if (mounted) setReport(data)
			} catch (err: any) {
				if (mounted) setError(err?.message || 'Не удалось открыть отчёт')
			} finally {
				if (mounted) setLoading(false)
			}
		}
		if (token) load()
		return () => { mounted = false }
	}, [token])

	const allActors = useMemo(() => report?.profiles || [], [report])
	const actors = useMemo(() => {
		if (!searchTerm.trim()) return allActors
		const q = searchTerm.toLowerCase()
		return allActors.filter(a => {
			const name = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase()
			return name.includes(q) || (a.city || '').toLowerCase().includes(q)
		})
	}, [allActors, searchTerm])

	const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))

	const openActor = (actor: PublicReportProfile) => {
		setSelectedActor(actor)
		setCarouselIdx(0)
		setExpandedSections({ main: true, about: false })
	}

	const SectionHead = ({ id, title }: { id: string; title: string }) => (
		<button className={styles.sectionToggle} onClick={() => toggleSection(id)}>
			<span className={styles.sectionToggleTitle}>{title}</span>
			{expandedSections[id] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
		</button>
	)

	const renderActorModal = () => {
		if (!selectedActor) return null
		const a = selectedActor
		const photos = (a.images || []).filter(img => img.image_type !== 'video')
		const fullName = `${a.last_name || ''} ${a.first_name || ''}`.trim() || 'Актёр'
		const age = getAge(a.date_of_birth)

		return (
			<div className={styles.modalOverlay} onClick={() => setSelectedActor(null)}>
				<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
					<div className={styles.modalHeader}>
						<button className={styles.modalBackBtn} onClick={() => setSelectedActor(null)}>
							<IconArrowLeft size={16} />
						</button>
						<h3>{fullName}</h3>
						<button className={styles.modalClose} onClick={() => setSelectedActor(null)}>
							<IconX size={14} />
						</button>
					</div>

					<div className={styles.modalBody}>
						{photos.length > 0 ? (
							<div className={styles.carousel}>
								<div className={styles.carouselMain}>
									<img
										src={normalizeMediaUrl(photos[carouselIdx]?.photo_url) || ''}
										alt=""
										className={styles.carouselImg}
									/>
									{carouselIdx > 0 && (
										<button className={`${styles.carouselNav} ${styles.carouselPrev}`} onClick={() => setCarouselIdx(carouselIdx - 1)}>&#8249;</button>
									)}
									{carouselIdx < photos.length - 1 && (
										<button className={`${styles.carouselNav} ${styles.carouselNext}`} onClick={() => setCarouselIdx(carouselIdx + 1)}>&#8250;</button>
									)}
								</div>
								{photos.length > 1 && (
									<div className={styles.carouselDots}>
										{photos.map((_, idx) => (
											<button
												key={idx}
												className={`${styles.carouselDot} ${idx === carouselIdx ? styles.carouselDotActive : ''}`}
												onClick={() => setCarouselIdx(idx)}
											/>
										))}
									</div>
								)}
								{photos.length > 1 && (
									<div className={styles.carouselThumbs}>
										{photos.map((img, idx) => (
											<img
												key={img.id}
												src={normalizeMediaUrl(img.crop_photo_url || img.photo_url) || ''}
												alt=""
												className={`${styles.carouselThumb} ${idx === carouselIdx ? styles.carouselThumbActive : ''}`}
												onClick={() => setCarouselIdx(idx)}
											/>
										))}
									</div>
								)}
							</div>
						) : (
							<div className={styles.noPhoto}><IconUser size={48} /></div>
						)}

						<div className={styles.contactsBanner}>
							<IconShield size={14} />
							<span>Контактные данные скрыты в публичном отчёте</span>
						</div>

						<SectionHead id="main" title="ОСНОВНОЕ" />
						{expandedSections.main && (
							<div className={styles.sectionContent}>
								<div className={styles.detailRow}><span>Возраст</span><b>{age ? `${age} лет` : '—'}</b></div>
								<div className={styles.detailRow}><span>Пол</span><b>{formatGenderLabel(a.gender)}</b></div>
								<div className={styles.detailRow}><span>Город</span><b>{a.city || '—'}</b></div>
								<div className={styles.detailRow}><span>Квалификация</span><b>{formatQualificationLabel(a.qualification)}</b></div>
								{a.experience != null && <div className={styles.detailRow}><span>Опыт</span><b>{a.experience} лет</b></div>}
								<div className={styles.detailRow}><span>Тип внешности</span><b>{formatLookTypeLabel(a.look_type, 'feminine')}</b></div>
								<div className={styles.detailRow}><span>Рост</span><b>{a.height ? `${a.height} см` : '—'}</b></div>
								<div className={styles.detailRow}><span>Размер одежды</span><b>{a.clothing_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Размер обуви</span><b>{a.shoe_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Длина волос</span><b>{formatHairLengthLabel(a.hair_length)}</b></div>
								<div className={styles.detailRow}><span>Цвет волос</span><b>{formatHairColorLabel(a.hair_color)}</b></div>
								{a.bust_volume != null && <div className={styles.detailRow}><span>Обхват груди</span><b>{a.bust_volume} см</b></div>}
								{a.waist_volume != null && <div className={styles.detailRow}><span>Обхват талии</span><b>{a.waist_volume} см</b></div>}
								{a.hip_volume != null && <div className={styles.detailRow}><span>Обхват бёдер</span><b>{a.hip_volume} см</b></div>}
							</div>
						)}

						<SectionHead id="about" title="О СЕБЕ" />
						{expandedSections.about && (
							<div className={styles.sectionContent}>
								<p className={styles.aboutText}>{a.about_me || 'Информация отсутствует'}</p>
							</div>
						)}

						{a.video_intro && (
							<>
								<SectionHead id="video" title="ВИДЕО" />
								{expandedSections.video && (
									<div className={styles.sectionContent}>
										<a href={a.video_intro} target="_blank" rel="noreferrer" className={styles.videoLink}>
											Смотреть видеовизитку
										</a>
									</div>
								)}
							</>
						)}
					</div>
				</div>
			</div>
		)
	}

	if (loading) {
		return (
			<div className={styles.page}>
				<div className={styles.center}><IconLoader size={18} /> Загрузка отчёта...</div>
			</div>
		)
	}

	if (error || !report) {
		return (
			<div className={styles.page}>
				<div className={styles.errorCard}>
					<h1>Отчёт недоступен</h1>
					<p>{error || 'Ссылка устарела или была отключена.'}</p>
				</div>
			</div>
		)
	}

	const updatedLabel = report?.updated_at
		? new Date(report.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
			+ ' ' + new Date(report.updated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
		: null

	return (
		<div className={styles.page}>
			<div className={styles.content}>
				<header className={styles.reportHeader}>
					<div className={styles.reportHeaderMain}>
						<div>
							<h1 className={styles.reportTitle}>{report?.title || 'Отчёт'}</h1>
							<p className={styles.reportMeta}>Актёров в отчёте {allActors.length}</p>
						</div>
						{updatedLabel && (
							<span className={styles.reportDate}>Обновлён {updatedLabel}</span>
						)}
					</div>
					<div className={styles.reportSearch}>
						<IconSearch size={15} />
						<input
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Поиск"
							className={styles.reportSearchInput}
						/>
						{searchTerm && (
							<button className={styles.reportSearchClear} onClick={() => setSearchTerm('')}>
								<IconX size={12} />
							</button>
						)}
					</div>
				</header>
				<section className={styles.grid}>
					{actors.map((actor) => {
						const name = `${actor.last_name || ''} ${actor.first_name || ''}`.trim() || 'Актёр'
						const age = getAge(actor.date_of_birth)
						const primaryPhoto = normalizeMediaUrl(actor.images?.[0]?.photo_url)
						return (
					<article key={actor.id} className={styles.card} onClick={() => openActor(actor)}>
							<div className={styles.photoWrap}>
								{primaryPhoto ? (
									<img src={primaryPhoto} alt={name} className={styles.photo} />
								) : (
									<div className={styles.photoFallback}>{name.slice(0, 1).toUpperCase()}</div>
								)}
								{actor.is_favorite && <div className={styles.cardFavBadge}>★</div>}
							</div>
							<div className={styles.cardBody}>
								<p className={styles.name}>{name}</p>
								<p className={styles.metaLine}>
									{[age ? `${age} лет` : null, actor.city].filter(Boolean).join(' · ')}
								</p>
								<div className={styles.paramRow}>
									{actor.height && <span><i className={styles.paramIcon}>↕</i>{actor.height} см</span>}
									{actor.clothing_size && <span><i className={styles.paramIcon}>👔</i>{actor.clothing_size}</span>}
									{actor.shoe_size && <span><i className={styles.paramIcon}>👞</i>{actor.shoe_size}</span>}
								</div>
							</div>
						</article>
						)
					})}
				</section>
			</div>

			{renderActorModal()}
		</div>
	)
}
