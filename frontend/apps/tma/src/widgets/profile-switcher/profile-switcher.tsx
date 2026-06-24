'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { login as doLogin } from '@prostoprobuy/models'
import { apiCall, getToken } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import {
	IconUser,
	IconPlus,
	IconCheck,
	IconLoader,
	IconChevronDown,
} from '~packages/ui/icons'
import styles from './profile-switcher.module.scss'

interface ProfileItem {
	id: number
	first_name?: string | null
	last_name?: string | null
	display_name?: string | null
	primary_photo?: string | null
	readiness?: string | null
}

function normalizeUrl(url?: string | null): string {
	if (!url) return ''
	if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://')
	if (/^https?:\/\//.test(url)) return url
	if (url.startsWith('/')) {
		try {
			const base = new URL(API_URL)
			return `${base.protocol}//${base.host}${url}`
		} catch { return url }
	}
	return url
}

function profileName(p?: ProfileItem | null): string {
	if (!p) return 'Профиль'
	const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
	return n || p.display_name || `Профиль #${p.id}`
}

function activeProfileIdFromToken(): number | null {
	try {
		const token = getToken()
		if (!token) return null
		const payload = JSON.parse(atob(token.split('.')[1]))
		const raw = payload.profile_id
		return raw != null ? Number(raw) : null
	} catch {
		return null
	}
}

interface Props {
	/** Вызывается после успешного переключения профиля. */
	onSwitched?: (profileId: number) => void
}

/**
 * Переключатель активной анкеты актёра. Меняет profile_id в токене через
 * auth/v2/switch-profile/ (с credentials, чтобы обновилась и refresh-cookie),
 * после чего весь интерфейс (лента, отклики, статусы) работает от лица
 * выбранной анкеты.
 */
export default function ProfileSwitcher({ onSwitched }: Props) {
	const router = useRouter()
	const [profiles, setProfiles] = useState<ProfileItem[]>([])
	const [currentId, setCurrentId] = useState<number | null>(null)
	const [open, setOpen] = useState(false)
	const [switching, setSwitching] = useState<number | null>(null)
	const wrapRef = useRef<HTMLDivElement>(null)

	const load = useCallback(async () => {
		const data = await apiCall('GET', 'tma/actor-profiles/my/').catch(() => null)
		const list: ProfileItem[] = data?.profiles || data?.items || []
		setProfiles(list)
		// Активный профиль из токена приоритетнее ответа API (тот может кэшироваться).
		const cur = activeProfileIdFromToken() ?? data?.current_profile_id
		setCurrentId(cur ?? (list[0]?.id ?? null))
	}, [])

	useEffect(() => { load() }, [load])

	useEffect(() => {
		if (!open) return
		const onDocClick = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', onDocClick)
		return () => document.removeEventListener('mousedown', onDocClick)
	}, [open])

	const switchTo = useCallback(async (profileId: number) => {
		if (profileId === currentId) { setOpen(false); return }
		setSwitching(profileId)
		try {
			// Прямой fetch с credentials: switch-profile ставит новую refresh-cookie
			// с новым profile_id, иначе после обновления токена активный профиль
			// «откатился» бы на прежний.
			const res = await fetch(`${API_URL}auth/v2/switch-profile/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${getToken() || ''}`,
				},
				credentials: 'include',
				body: JSON.stringify({ profile_id: profileId }),
			})
			const data = await res.json().catch(() => null)
			if (res.ok && data?.access_token) {
				doLogin({ access_token: data.access_token })
				setCurrentId(profileId)
				setOpen(false)
				onSwitched?.(profileId)
			}
		} catch {}
		setSwitching(null)
	}, [currentId, onSwitched])

	if (profiles.length === 0) return null

	const current = profiles.find(p => p.id === currentId) || profiles[0]
	const currentPhoto = normalizeUrl(current?.primary_photo)

	return (
		<div className={styles.wrap} ref={wrapRef}>
			<button
				type="button"
				className={styles.trigger}
				onClick={() => setOpen(o => !o)}
				aria-label="Сменить активный профиль"
			>
				<span className={styles.avatar}>
					{currentPhoto ? <img src={currentPhoto} alt="" /> : <IconUser size={16} />}
				</span>
				<span className={styles.triggerText}>
					<span className={styles.triggerLabel}>Активный профиль</span>
					<span className={styles.triggerName}>{profileName(current)}</span>
				</span>
				<span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
					<IconChevronDown size={16} />
				</span>
			</button>

			{open && (
				<div className={styles.menu}>
					{profiles.map(p => {
						const photo = normalizeUrl(p.primary_photo)
						const isActive = p.id === currentId
						return (
							<button
								key={p.id}
								type="button"
								className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
								onClick={() => switchTo(p.id)}
								disabled={switching !== null}
							>
								<span className={styles.avatarSm}>
									{photo ? <img src={photo} alt="" /> : <IconUser size={14} />}
								</span>
								<span className={styles.itemName}>{profileName(p)}</span>
								{switching === p.id
									? <IconLoader size={16} />
									: isActive ? <IconCheck size={16} /> : null}
							</button>
						)
					})}

					<button
						type="button"
						className={styles.addItem}
						onClick={() => { setOpen(false); router.push('/cabinet/profile/create') }}
					>
						<span className={styles.avatarSm}><IconPlus size={14} /></span>
						<span className={styles.itemName}>Добавить профиль</span>
					</button>
				</div>
			)}
		</div>
	)
}
