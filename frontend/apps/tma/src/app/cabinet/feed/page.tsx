'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { apiCall } from '~/shared/api-client'
import {
	IconFilm,
	IconArrowLeft,
	IconLoader,
	IconSend,
	IconCheck,
	IconClock,
	IconSearch,
	IconZap,
} from '~packages/ui/icons'
import styles from './feed.module.scss'

export default function FeedPage() {
	const router = useRouter()
	const [token, setToken] = useState<string | null>(null)
	const [projects, setProjects] = useState<any[]>([])
	const [myResponseIds, setMyResponseIds] = useState<Set<number>>(new Set())
	const [loading, setLoading] = useState(true)
	const [respondingTo, setRespondingTo] = useState<number | null>(null)
	const [search, setSearch] = useState('')
	const [expandedId, setExpandedId] = useState<number | null>(null)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		return apiCall(method, path, body)
	}, [])

	useEffect(() => {
		if (!token) return
		Promise.all([
			api('GET', 'feed/projects/?page_size=100').catch(() => ({ projects: [] })),
			api('GET', 'feed/my-responses/').catch(() => ({ responses: [] })),
		]).then(([feedData, responsesData]) => {
			setProjects(feedData?.projects || [])
			const ids = new Set<number>(
				(responsesData?.responses || []).map((r: any) => r.casting_id)
			)
			setMyResponseIds(ids)
			setLoading(false)
		})
	}, [token, api])

	const handleRespond = async (castingId: number) => {
		setRespondingTo(castingId)
		try {
			const res = await api('POST', 'feed/respond/', { casting_id: castingId })
			if (res?.id) {
				setMyResponseIds(prev => new Set(prev).add(castingId))
			} else if (res?.detail) {
				alert(typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail))
			} else if (!res) {
				alert('Ошибка сервера. Попробуйте ещё раз.')
			}
		} catch {
			alert('Ошибка при отклике. Проверьте соединение.')
		}
		setRespondingTo(null)
	}

	const filtered = search.trim()
		? projects.filter(
				(p: any) =>
					p.title?.toLowerCase().includes(search.toLowerCase()) ||
					p.description?.toLowerCase().includes(search.toLowerCase())
			)
		: projects

	if (loading)
		return (
			<div className={styles.root}>
				<p className={styles.center}>
					<IconLoader size={20} style={{ marginRight: 8 }} />
					Загрузка ленты...
				</p>
			</div>
		)

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button onClick={() => router.push('/cabinet')} className={styles.backBtn}>
					<IconArrowLeft size={14} /> Кабинет
				</button>
				<div className={styles.headerTitle}>
					<IconFilm size={16} />
					<h1>Лента кастингов</h1>
				</div>
				<span className={styles.headerCount}>{projects.length}</span>
			</header>

			<div className={styles.content}>
				<div className={styles.searchWrap}>
					<IconSearch size={15} />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Поиск по названию или описанию..."
						className={styles.searchInput}
					/>
				</div>

				{filtered.length === 0 ? (
					<div className={styles.empty}>
						<IconFilm size={40} />
						<h3>{search ? 'Ничего не найдено' : 'Пока нет кастингов'}</h3>
						<p>
							{search
								? 'Попробуйте изменить поисковый запрос'
								: 'Когда работодатели опубликуют проекты, они появятся здесь'}
						</p>
					</div>
				) : (
					<div className={styles.feedList}>
						{filtered.map((p: any) => {
							const alreadyResponded = myResponseIds.has(p.id)
							const isExpanded = expandedId === p.id
							const descShort =
								p.description && p.description.length > 150
									? p.description.slice(0, 150) + '…'
									: p.description

							return (
								<article key={p.id} className={styles.feedCard}>
									<div className={styles.cardTop}>
										<div className={styles.cardIcon}>
											<IconFilm size={18} />
										</div>
										<div className={styles.cardInfo}>
											<h3 className={styles.cardTitle}>{p.title}</h3>
											<span className={styles.cardDate}>
												<IconClock size={11} />
												{new Date(p.created_at).toLocaleDateString('ru-RU', {
													day: 'numeric',
													month: 'long',
													year: 'numeric',
												})}
											</span>
										</div>
									</div>

									{p.description && (
										<p className={styles.cardDesc}>
											{isExpanded ? p.description : descShort}
											{p.description.length > 150 && (
												<button
													className={styles.expandBtn}
													onClick={() =>
														setExpandedId(isExpanded ? null : p.id)
													}
												>
													{isExpanded ? 'Свернуть' : 'Подробнее'}
												</button>
											)}
										</p>
									)}

									<div className={styles.cardActions}>
										{alreadyResponded ? (
											<div className={styles.respondedBadge}>
												<IconCheck size={14} />
												Вы откликнулись
											</div>
										) : (
											<button
												className={styles.respondBtn}
												disabled={respondingTo === p.id}
												onClick={() => handleRespond(p.id)}
											>
												{respondingTo === p.id ? (
													<>
														<IconLoader size={14} /> Отправка...
													</>
												) : (
													<>
														<IconZap size={14} /> Откликнуться
													</>
												)}
											</button>
										)}
									</div>
								</article>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
