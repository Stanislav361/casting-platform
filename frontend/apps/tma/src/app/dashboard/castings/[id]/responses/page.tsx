'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconEye,
	IconLoader,
	IconSearch,
	IconUsers,
} from '~packages/ui/icons'
import styles from './responses.module.scss'

interface Respondent {
	profile_id: number
	first_name?: string | null
	last_name?: string | null
	display_name?: string | null
	age?: number | null
	city?: string | null
	height?: number | string | null
	clothing_size?: number | string | null
	shoe_size?: number | string | null
	photo_url?: string | null
	media_assets?: Array<{
		file_type?: string | null
		processed_url?: string | null
		thumbnail_url?: string | null
		original_url?: string | null
		is_primary?: boolean | null
	}>
	responded_at?: string | null
}

function normalizeMediaUrl(url?: string | null): string | null {
	if (!url) return null
	try {
		const apiBase = new URL(API_URL, window.location.origin)
		const parsed = new URL(url, apiBase)
		if (parsed.pathname.startsWith('/uploads/')) {
			return `${apiBase.origin}${parsed.pathname}${parsed.search}`
		}
		return parsed.toString()
	} catch {
		return url
	}
}

function getActorPhoto(actor: Respondent): string | null {
	const photos = (actor.media_assets || []).filter(m => m.file_type === 'photo')
	const primary = photos.find(m => m.is_primary)
	return normalizeMediaUrl(
		primary?.thumbnail_url ||
		primary?.processed_url ||
		primary?.original_url ||
		photos[0]?.thumbnail_url ||
		photos[0]?.processed_url ||
		photos[0]?.original_url ||
		actor.photo_url ||
		null,
	)
}

function formatDate(raw?: string | null): string {
	if (!raw) return ''
	const date = new Date(raw)
	if (Number.isNaN(date.getTime())) return ''
	return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

function initials(name: string): string {
	return name
		.split(/\s+/)
		.map(part => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join('')
		.toUpperCase() || '?'
}

export default function CastingResponsesPage() {
	const params = useParams()
	const router = useRouter()
	const castingId = Number(params.id)
	const goBack = useSmartBack(`/dashboard/castings/${castingId}`)

	const [items, setItems] = useState<Respondent[]>([])
	const [title, setTitle] = useState('Кастинг')
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [query, setQuery] = useState('')

	const load = useCallback(async () => {
		if (!castingId) return
		setLoading(true)
		const data = await apiCall('GET', `employer/projects/${castingId}/respondents/?page=1&page_size=200`)
		if (data && !data.detail) {
			setItems(data.respondents || data.items || [])
			setTotal(data.total || (data.respondents || data.items || []).length || 0)
			if (data.project_title) setTitle(data.project_title)
		} else {
			setItems([])
			setTotal(0)
		}
		setLoading(false)
	}, [castingId])

	useEffect(() => { load() }, [load])

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return items
		return items.filter(actor => {
			const name = [
				actor.display_name,
				actor.last_name,
				actor.first_name,
				actor.city,
			].filter(Boolean).join(' ').toLowerCase()
			return name.includes(q)
		})
	}, [items, query])

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<div className={styles.headerTitle}>
					<IconUsers size={18} />
					<div>
						<h1>Отклики</h1>
						<p>{title}</p>
					</div>
				</div>
				<span className={styles.headerCount}>{total}</span>
			</header>

			<main className={styles.content}>
				<div className={styles.searchBox}>
					<IconSearch size={16} />
					<input
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="Поиск по имени или городу..."
					/>
				</div>

				{loading ? (
					<div className={styles.state}>
						<IconLoader size={22} />
						<span>Загружаем отклики…</span>
					</div>
				) : filtered.length === 0 ? (
					<div className={styles.empty}>
						<IconUsers size={36} />
						<h2>{items.length === 0 ? 'Пока никто не откликнулся' : 'Ничего не найдено'}</h2>
						<p>
							{items.length === 0
								? 'Когда актёры откликнутся на этот кастинг, они появятся здесь.'
								: 'Попробуйте изменить поисковый запрос.'}
						</p>
					</div>
				) : (
					<div className={styles.grid}>
						{filtered.map(actor => {
							const name = actor.display_name ||
								[actor.last_name, actor.first_name].filter(Boolean).join(' ') ||
								'Актёр'
							const photo = getActorPhoto(actor)
							const meta = [
								actor.age ? `${actor.age} лет` : null,
								actor.city,
							].filter(Boolean)
							return (
								<article
									key={actor.profile_id}
									className={styles.card}
									onClick={() => router.push(`/dashboard/actors/${actor.profile_id}`)}
								>
									<div className={styles.photo}>
										{photo ? <img src={photo} alt={name} /> : <span>{initials(name)}</span>}
									</div>
									<div className={styles.body}>
										<h2>{name}</h2>
										<p>{meta.join(' · ') || 'Актёрская анкета'}</p>
										<div className={styles.params}>
											{actor.height && <span>Рост {actor.height} см</span>}
											{actor.clothing_size && <span>Одежда {actor.clothing_size}</span>}
											{actor.shoe_size && <span>Обувь {actor.shoe_size}</span>}
										</div>
										<div className={styles.footer}>
											<span>{formatDate(actor.responded_at) || 'Дата отклика не указана'}</span>
											<button type="button">
												<IconEye size={14} /> Анкета
											</button>
										</div>
									</div>
								</article>
							)
						})}
					</div>
				)}
			</main>
		</div>
	)
}
