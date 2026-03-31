'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { API_URL } from '~/shared/api-url'
import {
	IconLoader,
	IconUsers,
	IconMapPin,
	IconUser,
	IconFilm,
	IconShield,
} from '~packages/ui/icons'
import styles from './page.module.scss'

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
	images?: Array<{ id: number; photo_url: string; image_type?: string | null }>
	is_favorite?: boolean
}

type PublicReportResponse = {
	report_id: number
	title: string
	profiles: PublicReportProfile[]
	updated_at?: string | null
}

const normalizeMediaUrl = (url?: string | null) => {
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

const getAge = (date?: string | null) => {
	if (!date) return null
	const birthDate = new Date(date)
	if (Number.isNaN(birthDate.getTime())) return null
	const now = new Date()
	let age = now.getFullYear() - birthDate.getFullYear()
	const monthDiff = now.getMonth() - birthDate.getMonth()
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
		age -= 1
	}
	return age > 0 ? age : null
}

const genderLabel = (gender?: string | null) => {
	if (!gender) return null
	if (gender === 'male') return 'Мужчина'
	if (gender === 'female') return 'Женщина'
	return gender
}

export default function PublicReportPage() {
	const params = useParams()
	const token = String(params.token || '')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [report, setReport] = useState<PublicReportResponse | null>(null)

	useEffect(() => {
		let isMounted = true
		const load = async () => {
			setLoading(true)
			setError(null)
			try {
				const res = await fetch(`${API_URL}/public/shortlists/view/${token}/`)
				const data = await res.json().catch(() => null)
				if (!res.ok) {
					throw new Error(data?.detail?.message || data?.detail || 'Не удалось открыть отчёт')
				}
				if (isMounted) setReport(data)
			} catch (err: any) {
				if (isMounted) setError(err?.message || 'Не удалось открыть отчёт')
			} finally {
				if (isMounted) setLoading(false)
			}
		}
		if (token) load()
		return () => {
			isMounted = false
		}
	}, [token])

	const actors = useMemo(() => report?.profiles || [], [report])

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

	return (
		<div className={styles.page}>
			<div className={styles.content}>
				<section className={styles.hero}>
					<div className={styles.heroTop}>
						<div>
							<span className={styles.eyebrow}>Публичный отчёт</span>
							<h1>{report.title}</h1>
							<p className={styles.subtitle}>
								Отчёт можно открыть без регистрации. Контактные данные актёров скрыты и недоступны в публичной версии.
							</p>
						</div>
						<div className={styles.heroStats}>
							<div className={styles.statCard}>
								<IconUsers size={16} />
								<strong>{actors.length}</strong>
								<span>актёров</span>
							</div>
							<div className={styles.statCard}>
								<IconShield size={16} />
								<strong>Скрыто</strong>
								<span>контакты</span>
							</div>
							<div className={styles.statCard}>
								<IconFilm size={16} />
								<strong>{report.updated_at ? new Date(report.updated_at).toLocaleDateString('ru-RU') : 'Сейчас'}</strong>
								<span>обновлено</span>
							</div>
						</div>
					</div>
				</section>

				<section className={styles.notice}>
					<IconShield size={16} />
					<span>Телефон, email, мессенджеры и другие контактные данные актёров не показываются в этой ссылке.</span>
				</section>

				<section className={styles.grid}>
					{actors.map((actor) => {
						const name = `${actor.last_name || ''} ${actor.first_name || ''}`.trim() || 'Актёр'
						const age = getAge(actor.date_of_birth)
						const primaryPhoto = normalizeMediaUrl(actor.images?.[0]?.photo_url)
						return (
							<article key={actor.id} className={styles.card}>
								<div className={styles.photoWrap}>
									{primaryPhoto ? (
										<img src={primaryPhoto} alt={name} className={styles.photo} />
									) : (
										<div className={styles.photoFallback}>{name.slice(0, 1).toUpperCase()}</div>
									)}
								</div>
								<div className={styles.cardBody}>
									<h2 className={styles.name}>{name}</h2>
									<div className={styles.metaLine}>
										{age ? `${age} лет` : null}
										{age && actor.city ? ' • ' : null}
										{actor.city || null}
									</div>
									<div className={styles.chips}>
										{actor.city && <span><IconMapPin size={12} /> {actor.city}</span>}
										{genderLabel(actor.gender) && <span><IconUser size={12} /> {genderLabel(actor.gender)}</span>}
										{actor.height && <span>📏 {actor.height} см</span>}
										{actor.qualification && <span>⭐ {actor.qualification}</span>}
										{actor.look_type && <span>{actor.look_type}</span>}
									</div>
									<div className={styles.hiddenNote}>Контакты скрыты</div>
								</div>
							</article>
						)
					})}
				</section>
			</div>
		</div>
	)
}
