'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { publicGet, publicPost } from '~/shared/api-client'
import { IconShield, IconCheck, IconLoader, IconAlertCircle } from '~packages/ui/icons'
import styles from './page.module.scss'

type AuthorityInfo = {
	profile_id: number
	first_name?: string | null
	last_name?: string | null
	is_minor: boolean
	agent_name?: string | null
	already_confirmed: boolean
}

/**
 * Публичная страница подтверждения полномочий Агента, создавшего анкету
 * Актёра. Ссылку на неё Агент отправляет самому Актёру (или его законному
 * представителю, если Актёр несовершеннолетний) — без авторизации, так как
 * у них может не быть аккаунта на Платформе.
 *
 * До подтверждения анкета не публикуется и не участвует в откликах
 * (см. actor_profiles.service.compute_profile_readiness на бэкенде).
 */
export default function ConfirmAuthorityPage() {
	const params = useParams<{ token: string }>()
	const token = params?.token

	const [info, setInfo] = useState<AuthorityInfo | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [confirming, setConfirming] = useState(false)
	const [confirmed, setConfirmed] = useState(false)

	useEffect(() => {
		if (!token) return
		let cancelled = false
		;(async () => {
			setLoading(true)
			const res = await publicGet(`public/actor-profiles/authority/${token}/`)
			if (cancelled) return
			if (!res || res.detail) {
				setError(
					typeof res?.detail === 'string'
						? res.detail
						: 'Ссылка недействительна или уже использована',
				)
			} else {
				setInfo(res)
				if (res.already_confirmed) setConfirmed(true)
			}
			setLoading(false)
		})()
		return () => {
			cancelled = true
		}
	}, [token])

	const handleConfirm = async () => {
		if (!token) return
		setConfirming(true)
		const res = await publicPost(`public/actor-profiles/authority/${token}/confirm/`)
		if (!res || res.detail) {
			setError(typeof res?.detail === 'string' ? res.detail : 'Не удалось подтвердить. Попробуйте ещё раз.')
			setConfirming(false)
			return
		}
		setConfirmed(true)
		setConfirming(false)
	}

	const fullName = [info?.first_name, info?.last_name].filter(Boolean).join(' ') || 'актёра'

	return (
		<div className={styles.page}>
			<div className={styles.card}>
				<div className={styles.iconWrap}>
					<IconShield size={28} />
				</div>

				{loading && (
					<div className={styles.loading}>
						<IconLoader size={20} />
						<span>Загрузка…</span>
					</div>
				)}

				{!loading && error && !confirmed && (
					<>
						<h1 className={styles.title}>Ссылка недействительна</h1>
						<p className={styles.text}>{error}</p>
					</>
				)}

				{!loading && !error && confirmed && (
					<>
						<div className={styles.successIcon}>
							<IconCheck size={22} />
						</div>
						<h1 className={styles.title}>Полномочия подтверждены</h1>
						<p className={styles.text}>
							Анкета «{fullName}» опубликована и теперь доступна кастинг-директорам —
							по ней можно откликаться на кастинги.
						</p>
					</>
				)}

				{!loading && !error && !confirmed && info && (
					<>
						<h1 className={styles.title}>Подтверждение полномочий</h1>
						<p className={styles.text}>
							{info.agent_name ? <strong>{info.agent_name}</strong> : 'Агент'} создал(а) на
							платформе prostoprobuy.pro анкету актёра «{fullName}»
							{info.is_minor ? ', являющегося несовершеннолетним' : ''}.
						</p>
						<p className={styles.text}>
							{info.is_minor
								? 'Если вы законный представитель этого актёра и согласны с созданием анкеты и обработкой его персональных данных, подтвердите полномочия агента ниже.'
								: 'Если вы согласны с тем, что этот агент представляет вас на платформе и с обработкой ваших персональных данных, подтвердите полномочия ниже.'}
						</p>
						<div className={styles.notice}>
							<IconAlertCircle size={16} />
							<span>Пока полномочия не подтверждены, анкета не видна кастинг-директорам и по ней нельзя откликаться.</span>
						</div>
						<button type="button" className={styles.confirmButton} onClick={handleConfirm} disabled={confirming}>
							{confirming ? (
								<>
									<IconLoader size={16} /> Подтверждаем…
								</>
							) : (
								<>
									<IconCheck size={16} /> Подтверждаю полномочия
								</>
							)}
						</button>
					</>
				)}
			</div>
		</div>
	)
}
