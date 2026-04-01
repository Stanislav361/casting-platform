'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { $session } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import { IconLoader, IconUsers, IconCheck, IconArrowLeft } from '~packages/ui/icons'
import styles from './page.module.scss'

export default function ProjectInvitePage() {
	const params = useParams()
	const router = useRouter()
	const inviteToken = String(params.token || '')
	const [hasSession, setHasSession] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [acceptedProjectId, setAcceptedProjectId] = useState<number | null>(null)
	const [alreadyJoined, setAlreadyJoined] = useState(false)

	const apiBase = useMemo(() => API_URL.replace(/\/+$/, ''), [])

	useEffect(() => {
		const session = $session.getState()
		setHasSession(Boolean(session?.access_token))
	}, [])

	const acceptInvite = async () => {
		const session = $session.getState()
		if (!session?.access_token) {
			setHasSession(false)
			return
		}
		setLoading(true)
		setError(null)
		try {
			const res = await fetch(
				`${apiBase}/employer/projects/collaborators/accept-invite/?token=${encodeURIComponent(inviteToken)}`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${session.access_token}`,
					},
				},
			)
			const data = await res.json().catch(() => null)
			if (!res.ok) {
				throw new Error(data?.detail || 'Не удалось принять приглашение')
			}
			setAcceptedProjectId(Number(data?.casting_id))
			setAlreadyJoined(Boolean(data?.already_joined))
		} catch (err: any) {
			setError(err?.message || 'Не удалось принять приглашение')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className={styles.page}>
			<div className={styles.card}>
				<div className={styles.badge}><IconUsers size={14} /> Приглашение в команду проекта</div>
				<h1>Вступление в команду</h1>
				<p className={styles.subtitle}>
					Эта ссылка добавляет вас в команду проекта. Для принятия приглашения нужно войти в аккаунт. Если ссылку создал SuperAdmin, активная подписка для вступления не требуется.
				</p>

				{!hasSession && (
					<div className={styles.notice}>
						Сначала войдите в аккаунт, затем снова откройте эту ссылку и подтвердите вступление в команду.
					</div>
				)}

				{error && <div className={styles.error}>{error}</div>}

				{acceptedProjectId ? (
					<div className={styles.success}>
						<div className={styles.successTitle}><IconCheck size={16} /> {alreadyJoined ? 'Вы уже были в команде проекта' : 'Вы добавлены в команду проекта'}</div>
						<button className={styles.primaryBtn} onClick={() => router.push(`/dashboard/project/${acceptedProjectId}`)}>
							Открыть проект
						</button>
					</div>
				) : (
					<div className={styles.actions}>
						{hasSession ? (
							<button className={styles.primaryBtn} disabled={loading} onClick={acceptInvite}>
								{loading ? <IconLoader size={14} /> : <IconCheck size={14} />}
								Принять приглашение
							</button>
						) : (
							<button className={styles.primaryBtn} onClick={() => router.push('/login/email')}>
								Войти в аккаунт
							</button>
						)}
						<button className={styles.secondaryBtn} onClick={() => router.back()}>
							<IconArrowLeft size={14} />
							Назад
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
