'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { getCoverImage } from '~/shared/fallback-cover'
import { useSmartBack } from '~/shared/smart-back'
import {
	IconArrowLeft,
	IconLoader,
	IconUser,
	IconFilm,
	IconCalendar,
	IconCheck,
	IconZap,
	IconEye,
} from '~packages/ui/icons'
import styles from './page.module.scss'

export default function AdminProfilePage() {
	const params = useParams()
	const router = useRouter()
	const goBack = useSmartBack()
	const userId = Number(params.id)
	const [profile, setProfile] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const api = useCallback(async (method: string, path: string, body?: any) => {
		return apiCall(method, path, body)
	}, [])

	const normalizeCastingImageUrl = (url?: string | null) => {
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

	useEffect(() => {
		if (!userId) return
		api('GET', `feed/admin-profile/${userId}/`)
			.then((data) => {
				setProfile(data)
				setLoading(false)
			})
			.catch((e) => {
				setError('Не удалось загрузить профиль')
				setLoading(false)
			})
	}, [userId, api])

	if (loading) {
		return (
			<div className={styles.root}>
				<p className={styles.center}>
					<IconLoader size={20} /> Загрузка...
				</p>
			</div>
		)
	}

	if (error || !profile) {
		return (
			<div className={styles.root}>
				<header className={styles.header}>
					<button onClick={goBack} className={styles.backBtn}>
						<IconArrowLeft size={14} /> Назад
					</button>
				</header>
				<p className={styles.center}>{error || 'Профиль не найден'}</p>
			</div>
		)
	}

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button onClick={goBack} className={styles.backBtn}>
					<IconArrowLeft size={14} /> Назад
				</button>
				<h1 className={styles.headerTitle}>Профиль работодателя</h1>
			</header>

			<section className={styles.profileCard}>
				<div className={styles.avatar}>
					{profile.photo_url ? (
						<img src={profile.photo_url} alt={profile.display_name} className={styles.avatarImg} />
					) : (
						<div className={styles.avatarFallback}>
							<IconUser size={36} />
						</div>
					)}
				</div>
				<div className={styles.profileInfo}>
					<h2 className={styles.name}>{profile.display_name}</h2>
					<span className={styles.roleBadge}>{profile.role_label}</span>
					{profile.member_since && (
						<span className={styles.memberSince}>
							<IconCalendar size={12} /> На платформе с {profile.member_since}
						</span>
					)}
				</div>
			</section>

			<section className={styles.statsRow}>
				<div className={styles.statCard}>
					<span className={styles.statValue}>{profile.published_castings_count}</span>
					<span className={styles.statLabel}>Активных кастингов</span>
				</div>
				<div className={styles.statCard}>
					<span className={styles.statValue}>{profile.total_castings_count}</span>
					<span className={styles.statLabel}>Всего кастингов</span>
				</div>
			</section>

			{profile.recent_castings && profile.recent_castings.length > 0 && (
				<section className={styles.castingsSection}>
					<h3 className={styles.sectionTitle}>
						<IconFilm size={16} /> Активные кастинги
					</h3>
					<div className={styles.castingsList}>
						{profile.recent_castings.map((c: any) => (
							<div key={c.id} className={styles.castingCard}>
								<div className={styles.castingMedia}>
									<img
										src={getCoverImage(normalizeCastingImageUrl(c.image_url), c.id || c.title)}
										alt={c.title}
										className={styles.castingImg}
									/>
								</div>
								<div className={styles.castingBody}>
									<h4 className={styles.castingTitle}>{c.title}</h4>
									{c.description && (
										<p className={styles.castingDesc}>{c.description}</p>
									)}
									{c.created_at && (
										<span className={styles.castingDate}>
											<IconCalendar size={11} />
											{new Date(c.created_at).toLocaleDateString('ru-RU', {
												day: '2-digit', month: '2-digit', year: 'numeric',
											})}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</section>
			)}
		</div>
	)
}
