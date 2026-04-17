'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiCall } from '~/shared/api-client'
import { getCoverImage } from '~/shared/fallback-cover'
import {
	IconArrowLeft,
	IconSend,
	IconLoader,
	IconCamera,
	IconUser,
} from '~packages/ui/icons'
import styles from './responses.module.scss'

interface SubmittedActor {
	id: number
	first_name?: string
	last_name?: string
	primary_photo?: string | null
	city?: string
	gender?: string
}

interface Response {
	id: number
	casting_id: number
	casting_title: string
	casting_description?: string
	casting_status: string
	response_status: string
	self_test_url?: string | null
	image_url?: string | null
	actor_status?: string
	actor_status_label?: string
	actors?: SubmittedActor[]
	responded_at: string
}

function formatDate(raw?: string): string {
	if (!raw) return ''
	try {
		const d = new Date(raw)
		if (isNaN(d.getTime())) return raw.split('T')[0] || raw
		return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
	} catch { return raw }
}

function statusBadge(status?: string, label?: string): { text: string; cls: string } {
	const s = (status || '').toLowerCase()
	if (label) {
		if (s === 'approved' || s === 'favorited')  return { text: label, cls: 'ok' }
		if (s === 'rejected')                        return { text: label, cls: 'err' }
		if (s === 'in_review' || s === 'pending')    return { text: label, cls: 'warn' }
		return { text: label, cls: 'neutral' }
	}
	if (s === 'pending') return { text: 'На рассмотрении', cls: 'warn' }
	if (s === 'approved' || s === 'favorited') return { text: 'Принят', cls: 'ok' }
	if (s === 'rejected') return { text: 'Отклонено', cls: 'err' }
	return { text: status || '—', cls: 'neutral' }
}

export default function ResponsesPage() {
	const router = useRouter()
	const [responses, setResponses] = useState<Response[]>([])
	const [loading, setLoading]     = useState(true)

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'feed/my-responses/')
		setResponses(data?.responses || [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={() => router.push('/cabinet')}>
					<IconArrowLeft size={16} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Мои отклики</h1>
				<span className={styles.headerBadge}>{responses.length}</span>
			</div>

			{loading ? (
				<div className={styles.state}>
					<IconLoader size={22} /> Загрузка откликов…
				</div>
			) : responses.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}><IconSend size={26} /></div>
					<h3>Откликов пока нет</h3>
					<p>Вы ещё не отправляли актёров ни на один кастинг. Откройте ленту и выберите подходящие.</p>
					<button className={styles.emptyBtn} onClick={() => router.push('/cabinet/feed')}>
						Открыть ленту
					</button>
				</div>
			) : (
				<div className={styles.list}>
					{responses.map(r => {
						const badge = statusBadge(r.actor_status || r.response_status, r.actor_status_label)
						const cover = getCoverImage(r.image_url, r.casting_id || r.casting_title)
						return (
							<div key={r.id} className={styles.card}>
								<div className={styles.cardCover}>
									{cover
										? <img src={cover} alt="" loading="lazy" />
										: <div className={styles.cardCoverStub}><IconCamera size={20} /></div>}
								</div>

								<div className={styles.cardBody}>
									<div className={styles.cardHead}>
										<h3 className={styles.cardTitle}>{r.casting_title}</h3>
										<span className={`${styles.badge} ${styles[`badge_${badge.cls}`]}`}>
											{badge.text}
										</span>
									</div>

									<div className={styles.cardMeta}>
										<span>Отклик: {formatDate(r.responded_at)}</span>
										<span className={styles.dot}>Статус кастинга: {r.casting_status}</span>
									</div>

									{r.actors && r.actors.length > 0 && (
										<div className={styles.submittedActors}>
											<p className={styles.submittedTitle}>
												Отправлено актёров: <b>{r.actors.length}</b>
											</p>
											<div className={styles.actorRow}>
												{r.actors.slice(0, 6).map(a => (
													<div key={a.id} className={styles.actorChip} title={[a.last_name, a.first_name].filter(Boolean).join(' ')}>
														{a.primary_photo
															? <img src={a.primary_photo} alt="" />
															: <IconUser size={14} />}
													</div>
												))}
												{r.actors.length > 6 && (
													<div className={styles.actorMore}>+{r.actors.length - 6}</div>
												)}
											</div>
										</div>
									)}

									<div className={styles.cardActions}>
										<button
											className={styles.btnGo}
											onClick={() => router.push(`/cabinet/feed?casting=${r.casting_id}`)}
										>
											К кастингу →
										</button>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
