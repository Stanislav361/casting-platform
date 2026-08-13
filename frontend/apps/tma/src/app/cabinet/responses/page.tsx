'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSmartBack } from '~/shared/smart-back'
import { apiCall } from '~/shared/api-client'
import { useDialog } from '~/shared/dialog/dialog-provider'
import { normalizeMediaUrl } from '~/shared/media-url'
import { getCoverImage, getFallbackCoverImage } from '~/shared/fallback-cover'
import {
	IconArrowLeft,
	IconSend,
	IconLoader,
	IconCamera,
	IconUser,
	IconX,
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
	if (s === 'pending' || s === 'in_review') return { text: 'На рассмотрении', cls: 'warn' }
	if (s === 'approved') return { text: 'Утвержден', cls: 'ok' }
	if (s === 'favorited') return { text: 'В избранном', cls: 'ok' }
	if (s === 'rejected') return { text: 'Отклонено', cls: 'err' }
	return { text: status || '—', cls: 'neutral' }
}

/** Завершённый кастинг отменить нельзя — там уже нечего отзывать. */
function isCastingFinished(status?: string): boolean {
	const s = (status || '').toLowerCase()
	return s === 'closed' || s === 'finished' || s === 'archived' || s === 'cancelled' || s === 'canceled'
}

function castingStatusLabel(status?: string): string {
	const s = (status || '').toLowerCase()
	if (s === 'published' || s === 'open' || s === 'active') return 'Опубликован'
	if (s === 'draft' || s === 'unpublished') return 'Черновик'
	if (s === 'closed' || s === 'finished' || s === 'archived') return 'Завершён'
	if (s === 'cancelled' || s === 'canceled') return 'Отменён'
	return status || '—'
}

export default function ResponsesPage() {
	const router = useRouter()
	const goBack = useSmartBack()
	const dialog = useDialog()
	const [responses, setResponses] = useState<Response[]>([])
	const [loading, setLoading]     = useState(true)
	const [cancelling, setCancelling] = useState<number | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		const data = await apiCall('GET', 'feed/my-responses/')
		setResponses(data?.responses || [])
		setLoading(false)
	}, [])

	useEffect(() => { load() }, [load])

	const cancelResponse = async (response: Response) => {
		const ok = await dialog.confirm({
			title: 'Отменить отклик?',
			message: `Отклик на «${response.casting_title}» будет отменён, а команда кастинга получит уведомление. Пока кастинг открыт, откликнуться можно снова.`,
			confirmLabel: 'Да, отменить',
			cancelLabel: 'Оставить отклик',
			tone: 'danger',
		})
		if (!ok) return

		setCancelling(response.id)
		try {
			const res = await apiCall('DELETE', `feed/responses/${response.id}/`)
			if (res?.cancelled) {
				setResponses(prev => prev.filter(item => item.id !== response.id))
			} else {
				dialog.error({
					title: 'Отклик не отменён',
					message: typeof res?.detail === 'string' ? res.detail : 'Попробуйте ещё раз через минуту.',
				})
			}
		} catch {
			dialog.error({
				title: 'Нет связи',
				message: 'Проверьте интернет и попробуйте ещё раз.',
			})
		} finally {
			setCancelling(null)
		}
	}

	return (
		<div className={styles.root}>
			<div className={styles.header}>
				<button className={styles.backBtn} onClick={goBack}>
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
				{responses.map((r, idx) => {
					const badge = statusBadge(r.actor_status || r.response_status, r.actor_status_label)
					const coverSeed = r.casting_id || r.casting_title
					const cover = getCoverImage(normalizeMediaUrl(r.image_url), coverSeed, idx)
					const coverFallback = getFallbackCoverImage(coverSeed, idx)
						return (
							<div key={r.id} className={styles.card}>
								<div className={styles.cardCover}>
									{cover
										? <img
											src={cover}
											alt=""
											loading="lazy"
											onError={(e) => {
												// Если реальная картинка не загрузилась (битый/удалённый
												// файл) — показываем нашу обложку вместо «битой».
												const img = e.currentTarget
												if (img.dataset.fellBack) return
												img.dataset.fellBack = '1'
												img.src = coverFallback
											}}
										/>
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
										<span className={styles.dot}>Кастинг: {castingStatusLabel(r.casting_status)}</span>
									</div>

									<div className={styles.cardFooter}>
										<button
											className={styles.btnGo}
											onClick={() => router.push(`/cabinet/feed/${r.casting_id}`)}
										>
											К кастингу →
										</button>

										{!isCastingFinished(r.casting_status) && (
											<button
												className={styles.btnCancel}
												onClick={() => cancelResponse(r)}
												disabled={cancelling === r.id}
											>
												{cancelling === r.id
													? <IconLoader size={13} />
													: <IconX size={13} />}
												Отменить отклик
											</button>
										)}

										{r.actors && r.actors.length > 0 && (
											<div className={styles.submittedActors} title={`Отправлено актёров: ${r.actors.length}`}>
												<div className={styles.actorRow}>
													{r.actors.slice(0, 4).map(a => {
														const avatar = normalizeMediaUrl(a.primary_photo)
														return (
															<div key={a.id} className={styles.actorChip} title={[a.last_name, a.first_name].filter(Boolean).join(' ')}>
																{avatar
																	? <img
																		src={avatar}
																		alt=""
																		onError={(e) => { e.currentTarget.style.display = 'none' }}
																	/>
																	: <IconUser size={12} />}
															</div>
														)
													})}
													{r.actors.length > 4 && (
														<div className={styles.actorMore}>+{r.actors.length - 4}</div>
													)}
												</div>
												<span className={styles.actorCount}>
													<b>{r.actors.length}</b> актёр{r.actors.length === 1 ? '' : r.actors.length < 5 ? 'а' : 'ов'}
												</span>
											</div>
										)}
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
