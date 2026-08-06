'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { publicGet, publicPost } from '~/shared/api-client'
import { DISTRIBUTION_CATEGORIES, ALL_DISTRIBUTION_CATEGORY_KEYS } from '~/shared/distribution-categories'
import { IconShield, IconCheck, IconLoader, IconAlertCircle, IconFileText } from '~packages/ui/icons'
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
 * Кроме самого подтверждения полномочий (Согласие Актёра на обработку
 * данных Агентом / Согласие законного представителя несовершеннолетнего —
 * см. /legal/agent-authority-consent и /legal/minor-consent) здесь же
 * собираются относящиеся лично к Актёру согласия, которые Агент не может
 * дать за него: трансграничная передача, использование изображения и
 * детальный выбор категорий для распространения персональных данных
 * (Каст-листы) — см. actor_profiles.service.confirm_authority на бэкенде.
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

	const [acceptCrossBorder, setAcceptCrossBorder] = useState(false)
	const [acceptImage, setAcceptImage] = useState(false)
	const [categories, setCategories] = useState<Record<string, boolean>>(
		() => Object.fromEntries(ALL_DISTRIBUTION_CATEGORY_KEYS.map((key) => [key, true])),
	)

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

	const canConfirm = acceptCrossBorder && acceptImage

	const handleConfirm = async () => {
		if (!token || !canConfirm) return
		setConfirming(true)
		const allowedCategories = ALL_DISTRIBUTION_CATEGORY_KEYS.filter((key) => categories[key])
		const res = await publicPost(`public/actor-profiles/authority/${token}/confirm/`, {
			accept_cross_border: acceptCrossBorder,
			accept_image: acceptImage,
			distribution_categories: allowedCategories,
		})
		if (!res || res.detail) {
			setError(
				typeof res?.detail === 'string'
					? res.detail
					: res?.detail?.message || 'Не удалось подтвердить. Попробуйте ещё раз.',
			)
			setConfirming(false)
			return
		}
		setConfirmed(true)
		setConfirming(false)
	}

	const fullName = [info?.first_name, info?.last_name].filter(Boolean).join(' ') || 'актёра'
	const primaryDocUrl = info?.is_minor ? '/legal/minor-consent' : '/legal/agent-authority-consent'
	const primaryDocTitle = info?.is_minor
		? 'Согласие законного представителя на обработку персональных данных несовершеннолетнего'
		: 'Согласие Актёра на обработку и передачу персональных данных Агентом'

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
								? 'Если вы законный представитель этого актёра, ознакомьтесь и примите согласия ниже.'
								: 'Если вы согласны с тем, что этот агент представляет вас на платформе, ознакомьтесь и примите согласия ниже.'}
						</p>
						<div className={styles.notice}>
							<IconAlertCircle size={16} />
							<span>Пока согласия не приняты, анкета не видна кастинг-директорам и по ней нельзя откликаться.</span>
						</div>

						<div className={styles.docList}>
							<div className={styles.docItem}>
								<span className={styles.docBadge}>
									<IconCheck size={13} />
								</span>
								<span className={styles.docText}>
									<strong>{primaryDocTitle}</strong>
									<a href={primaryDocUrl} target="_blank" rel="noopener noreferrer">
										<IconFileText size={13} />
										Открыть и прочитать полностью
									</a>
									<small>Нажатие «Подтверждаю» ниже фиксирует акцепт этого документа</small>
								</span>
							</div>

							<label className={styles.docItem}>
								<input
									type="checkbox"
									checked={acceptCrossBorder}
									onChange={(e) => setAcceptCrossBorder(e.target.checked)}
								/>
								<span className={styles.docCheckbox}>
									{acceptCrossBorder && <IconCheck size={13} />}
								</span>
								<span className={styles.docText}>
									<strong>Согласие на трансграничную передачу персональных данных</strong>
									<a href="/legal/cross-border-consent" target="_blank" rel="noopener noreferrer">
										<IconFileText size={13} />
										Открыть и прочитать полностью
									</a>
								</span>
							</label>

							<label className={styles.docItem}>
								<input
									type="checkbox"
									checked={acceptImage}
									onChange={(e) => setAcceptImage(e.target.checked)}
								/>
								<span className={styles.docCheckbox}>
									{acceptImage && <IconCheck size={13} />}
								</span>
								<span className={styles.docText}>
									<strong>Согласие на использование изображения, фотографий и видео</strong>
									<a href="/legal/image-consent" target="_blank" rel="noopener noreferrer">
										<IconFileText size={13} />
										Открыть и прочитать полностью
									</a>
								</span>
							</label>

							<div className={styles.docItem}>
								<span className={styles.docText} style={{ width: '100%' }}>
									<strong>Согласие на распространение персональных данных (Каст-листы)</strong>
									<a href="/legal/distribution-consent" target="_blank" rel="noopener noreferrer">
										<IconFileText size={13} />
										Открыть и прочитать полностью
									</a>
									<small>По умолчанию разрешены все категории — можно отключить любую</small>
								</span>
								<div className={styles.categoryList}>
									{DISTRIBUTION_CATEGORIES.map((cat) => (
										<label key={cat.key} className={styles.categoryRow}>
											<input
												type="checkbox"
												checked={!!categories[cat.key]}
												onChange={(e) =>
													setCategories((prev) => ({ ...prev, [cat.key]: e.target.checked }))
												}
											/>
											<span>{cat.label}</span>
										</label>
									))}
								</div>
							</div>
						</div>

						<button type="button" className={styles.confirmButton} onClick={handleConfirm} disabled={!canConfirm || confirming}>
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
