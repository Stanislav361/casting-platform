'use client'

import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { $session } from '@prostoprobuy/models'
import { http } from '~packages/lib'
import { API_URL } from '~/shared/api-url'
import { getCoverImage } from '~/shared/fallback-cover'
import { formatPhone } from '~/shared/phone-mask'
import {
	IconArrowLeft,
	IconZap,
	IconEdit,
	IconTrash,
	IconSend,
	IconLoader,
	IconUser,
	IconX,
	IconMask,
	IconCamera,
	IconStar,
	IconCheck,
	IconEye,
	IconBan,
	IconClock,
	IconUsers,
	IconPlus,
	IconFilm,
	IconClipboard,
	IconMessageSquare,
	IconHeart,
	IconChevronDown,
	IconChevronUp,
	IconFilter,

	IconSearch,
	IconSortDesc,
	IconFileText,
	IconPhone,
	IconMail,
	IconCalendar,
} from '~packages/ui/icons'
import styles from './project.module.scss'
import LiveChat from '../../components/live-chat'

export default function ProjectPage() {
	const router = useRouter()
	const params = useParams()
	const searchParams = useSearchParams()
	const projectId = params.id
	const responsesOnly = searchParams.get('view') === 'responses'

	const [token, setToken] = useState<string | null>(null)
	const [project, setProject] = useState<any>(null)
	const [respondents, setRespondents] = useState<any[]>([])
	const [editing, setEditing] = useState(false)
	const [title, setTitle] = useState('')
	const [desc, setDesc] = useState('')
	const [loading, setLoading] = useState(true)
	const [selectedActor, setSelectedActor] = useState<any>(null)
	const [favorites, setFavorites] = useState<Set<number>>(new Set())
	const [showFavorites, setShowFavorites] = useState(false)
	const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

	const [collaborators, setCollaborators] = useState<any[]>([])
	const [collabEmail, setCollabEmail] = useState('')
	const [addingCollab, setAddingCollab] = useState(false)
	const [isSuperAdmin, setIsSuperAdmin] = useState(false)
	const [isAdminPro, setIsAdminPro] = useState(false)
	const [creatingInviteLink, setCreatingInviteLink] = useState(false)
	const [sharedInviteUrl, setSharedInviteUrl] = useState<string | null>(null)
	const [showTeamModal, setShowTeamModal] = useState(false)

	const [subCastings, setSubCastings] = useState<any[]>([])
	const [newCastTitle, setNewCastTitle] = useState('')
	const [newCastDesc, setNewCastDesc] = useState('')
	const [newCastCity, setNewCastCity] = useState('')
	const [newCastCategory, setNewCastCategory] = useState('')
	const [newCastRoleTypes, setNewCastRoleTypes] = useState<string[]>([])
	const [newCastGender, setNewCastGender] = useState('')
	const [newCastGenderCustom, setNewCastGenderCustom] = useState('')
	const [newCastAgeFrom, setNewCastAgeFrom] = useState('')
	const [newCastAgeTo, setNewCastAgeTo] = useState('')
	const [newCastFinance, setNewCastFinance] = useState('')
	const [newCastFinanceNegotiable, setNewCastFinanceNegotiable] = useState(false)
	const [newCastShootDateFrom, setNewCastShootDateFrom] = useState('')
	const [newCastShootDateTo, setNewCastShootDateTo] = useState('')
	const [creatingCast, setCreatingCast] = useState(false)

	const [reports, setReports] = useState<any[]>([])
	const [newReportTitle, setNewReportTitle] = useState('')
	const [creatingReport, setCreatingReport] = useState(false)
	const [selectedReport, setSelectedReport] = useState<any>(null)
	const [sharingReportId, setSharingReportId] = useState<number | null>(null)
	const [sharedReportUrl, setSharedReportUrl] = useState<string | null>(null)

	const [chatMessages, setChatMessages] = useState<any[]>([])
	const [chatInput, setChatInput] = useState('')
	const [chatSending, setChatSending] = useState(false)
	const chatEndRef = useRef<HTMLDivElement>(null)

	const [searchTerm, setSearchTerm] = useState('')
	const [showSearch, setShowSearch] = useState(false)
	const [sortBy, setSortBy] = useState<'date' | 'name'>('date')
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ main: true, contacts: false, skills: false, notes: false })
	const [carouselIdx, setCarouselIdx] = useState(0)
	const [actorNotes, setActorNotes] = useState<Record<number, string>>({})
	const [showContacts, setShowContacts] = useState(false)
	const [uploadingImage, setUploadingImage] = useState(false)
	const imageInputRef = useRef<HTMLInputElement>(null)

	const [showCreateCasting, setShowCreateCasting] = useState(false)
	const [showReportsSection, setShowReportsSection] = useState(false)
	const [uploadingCastingImage, setUploadingCastingImage] = useState<number | null>(null)
	const castingImageInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

	const normalizeProjectImageUrl = (url?: string | null) => {
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

	const refreshProjectCard = async () => {
		if (!projectId) return null
		try {
			const { data: detail } = await http.get(`employer/projects/${projectId}/detail/`)
			if (!detail?.id) return null
			const normalizedProject = {
				...detail,
				image_url: normalizeProjectImageUrl(detail.image_url),
			}
			setProject((prev: any) => {
				if (!prev) return normalizedProject
				return {
					...prev,
					...normalizedProject,
					image_url: normalizedProject.image_url || prev.image_url || null,
				}
			})
			return normalizedProject
		} catch {
			return null
		}
	}

	const compressForUpload = (file: globalThis.File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => {
				const img = new window.Image()
				img.onload = () => {
					const maxSide = 1280
					let w = img.width, h = img.height
					if (w > maxSide || h > maxSide) {
						const ratio = Math.min(maxSide / w, maxSide / h)
						w = Math.round(w * ratio)
						h = Math.round(h * ratio)
					}
					const canvas = document.createElement('canvas')
					canvas.width = w
					canvas.height = h
					const ctx = canvas.getContext('2d')
					if (!ctx) { reject(new Error('Canvas not supported')); return }
					ctx.drawImage(img, 0, 0, w, h)
					resolve(canvas.toDataURL('image/jpeg', 0.75))
				}
				img.onerror = () => {
					if (typeof reader.result === 'string') resolve(reader.result)
					else reject(new Error('Не удалось прочитать изображение'))
				}
				img.src = reader.result as string
			}
			reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
			reader.readAsDataURL(file)
		})
	}

	const dataUrlToBlob = async (dataUrl: string) => {
		const response = await fetch(dataUrl)
		return await response.blob()
	}

	const uploadCastingImage = async (file: globalThis.File) => {
		if (!projectId) return
		setUploadingImage(true)
		try {
			const compressed = await compressForUpload(file)
			const blob = await dataUrlToBlob(compressed)
			const formData = new FormData()
			formData.append('image', blob, 'cover.jpg')
			const { data } = await http.post(
				`employer/projects/${projectId}/upload-image/`,
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			)
			if (data?.image_url) {
				const imageUrl = normalizeProjectImageUrl(data.image_url)
				setProject((prev: any) => prev ? { ...prev, image_url: imageUrl } : prev)
			} else {
				await refreshProjectCard()
			}
		} catch (e: any) {
			const detail = e?.response?.data?.detail
			alert(
				typeof detail === 'string' ? detail :
				detail?.message || `Ошибка загрузки фото (${e?.response?.status || '?'})`,
			)
		}
		setUploadingImage(false)
	}

	const deleteCastingImage = async () => {
		if (!projectId) return
		if (!confirm('Удалить фото кастинга?')) return
		try {
			const { data } = await http.delete(`employer/projects/${projectId}/delete-image/`)
			if (data?.ok) {
				setProject((prev: any) => prev ? { ...prev, image_url: null } : prev)
			}
			await refreshProjectCard()
		} catch (e: any) {
			alert(
				e?.response?.data?.detail?.message ||
				e?.response?.data?.detail ||
				e?.message ||
				'Ошибка удаления фото',
			)
		}
	}

	const uploadSubCastingImage = async (castingId: number, file: globalThis.File) => {
		setUploadingCastingImage(castingId)
		try {
			const compressed = await compressForUpload(file)
			const blob = await dataUrlToBlob(compressed)
			const formData = new FormData()
			formData.append('image', blob, 'cover.jpg')
			const { data } = await http.post(
				`employer/projects/${castingId}/upload-image/`,
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } },
			)
			if (data?.image_url) {
				const imageUrl = normalizeProjectImageUrl(data.image_url)
				setSubCastings(prev => prev.map(c => c.id === castingId ? { ...c, image_url: imageUrl } : c))
			}
		} catch (e: any) {
			alert(
				e?.response?.data?.detail?.message ||
				e?.response?.data?.detail ||
				e?.message ||
				'Ошибка загрузки фото',
			)
		}
		setUploadingCastingImage(null)
	}

	const deleteSubCastingImage = async (castingId: number) => {
		if (!confirm('Удалить фото кастинга?')) return
		try {
			await http.delete(`employer/projects/${castingId}/delete-image/`)
			setSubCastings(prev => prev.map(c => c.id === castingId ? { ...c, image_url: null } : c))
		} catch (e: any) {
			alert(
				e?.response?.data?.detail?.message ||
				e?.response?.data?.detail ||
				e?.message ||
				'Ошибка удаления фото',
			)
		}
	}

	const toggleFavorite = async (profileId: number, e?: React.MouseEvent) => {
		if (e) e.stopPropagation()
		if (!profileId) return
		const wasFav = favorites.has(profileId)
		setFavorites(prev => {
			const next = new Set(prev)
			if (wasFav) next.delete(profileId)
			else next.add(profileId)
			return next
		})
		setRespondents(prev =>
			prev.map(r => {
				if (r.profile_id !== profileId) return r
				if (wasFav && r.response_status === 'shortlisted') return { ...r, response_status: 'pending' }
				if (!wasFav && (r.response_status === 'pending' || r.response_status === 'viewed')) return { ...r, response_status: 'shortlisted' }
				return r
			})
		)
		if (selectedActor?.profile_id === profileId) {
			setSelectedActor((prev: any) => {
				if (!prev) return prev
				if (wasFav && prev.response_status === 'shortlisted') return { ...prev, response_status: 'pending' }
				if (!wasFav && (prev.response_status === 'pending' || prev.response_status === 'viewed')) return { ...prev, response_status: 'shortlisted' }
				return prev
			})
		}
		const res = await api('POST', `employer/favorites/toggle/?profile_id=${profileId}`)
		if (res?.ok) return
		setFavorites(prev => {
			const next = new Set(prev)
			if (wasFav) next.add(profileId)
			else next.delete(profileId)
			return next
		})
		setRespondents(prev =>
			prev.map(r => r.profile_id === profileId ? { ...r, response_status: wasFav ? 'shortlisted' : 'pending' } : r)
		)
		if (res?.detail) {
			alert(`Ошибка: ${typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail)}`)
		}
	}

	const toggleSection = (key: string) => {
		setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
	}

	const openActorModal = (actor: any) => {
		setSelectedActor(actor)
		setCarouselIdx(0)
		setShowContacts(false)
		setExpandedSections({ main: true, contacts: false, skills: false, notes: false })
	}

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) {
			router.replace('/login')
			return
		}
		setToken(session.access_token)
		try {
			const payload = JSON.parse(atob(session.access_token.split('.')[1] || ''))
			setIsSuperAdmin(payload.role === 'owner')
			setIsAdminPro(payload.role === 'employer_pro')
		} catch {}
	}, [router])

	const api = useCallback(
		async (method: string, path: string, body?: any) => {
			if (!token) return null
			try {
				const res = await http.request({
					method: method as any,
					url: path,
					data: body,
				})
				return res.data
			} catch (error: any) {
				return error?.response?.data || null
			}
		},
		[token],
	)

	const getRequestErrorMessage = (error: any, fallback: string) => {
		const detail = error?.response?.data?.detail
		return typeof detail === 'string' ? detail : fallback
	}

	useEffect(() => {
		if (!token || !projectId) return
		const load = async () => {
			try {
			const [projList, projDetail, resp, collabData, castingsData, reportsData, chatData, favData] = await Promise.all([
				api('GET', 'employer/projects/'),
				api('GET', `employer/projects/${projectId}/detail/`).catch(() => null),
				api('GET', `employer/projects/${projectId}/respondents/?page_size=200`).catch(
					() => ({ respondents: [] }),
				),
				api('GET', `employer/projects/${projectId}/collaborators/`).catch(() => ({ collaborators: [] })),
				api('GET', `employer/projects/${projectId}/castings/`).catch(() => ({ castings: [] })),
				api('GET', 'employer/reports/').catch(() => ({ reports: [] })),
				http.get(`employer/projects/${projectId}/chat/`).then(res => res.data).catch(() => ({ messages: [] })),
				api('GET', 'employer/favorites/ids/').catch(() => ({ profile_ids: [] })),
			])
			const proj = projList?.projects?.find(
				(p: any) => p.id === Number(projectId),
			) || (projDetail?.id ? projDetail : null)
			if (proj) {
				setProject({
					...proj,
					image_url: normalizeProjectImageUrl(proj.image_url),
				})
				setTitle(proj.title)
				setDesc(proj.description)
			}
			setRespondents(resp?.respondents || [])
			if (favData?.profile_ids) setFavorites(new Set(favData.profile_ids))
			setCollaborators(collabData?.collaborators || [])
			const nextCastings = (castingsData?.castings || []).map((c: any) => ({
				...c,
				image_url: normalizeProjectImageUrl(c.image_url),
			}))
			setSubCastings(nextCastings)
			const relatedCastingIds = [Number(projectId), ...nextCastings.map((casting: any) => Number(casting.id))]
			setReports((reportsData?.reports || []).filter((r: any) => relatedCastingIds.includes(Number(r.casting_id))))
			setChatMessages(chatData?.messages || [])
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, projectId, api])

	const saveProject = async () => {
		const res = await api('PATCH', `employer/projects/${projectId}/`, {
			title,
			description: desc,
		})
		if (res?.id) {
			setProject(res)
			setEditing(false)
		}
	}

	const deleteProject = async () => {
		if (!confirm('Удалить проект?')) return
		await api('DELETE', `employer/projects/${projectId}/`)
		router.replace('/dashboard')
	}

	const publishProject = async () => {
		const res = await api(
			'POST',
			`employer/projects/${projectId}/publish/`,
		)
		if (res?.id) {
			setProject(res)
			return
		}
		alert(res?.detail || 'Не удалось опубликовать проект')
	}

	const resetCastingForm = () => {
		setNewCastTitle('')
		setNewCastDesc('')
		setNewCastCity('')
		setNewCastCategory('')
		setNewCastRoleTypes([])
		setNewCastGender('')
		setNewCastGenderCustom('')
		setNewCastAgeFrom('')
		setNewCastAgeTo('')
		setNewCastFinance('')
		setNewCastFinanceNegotiable(false)
		setNewCastShootDateFrom('')
		setNewCastShootDateTo('')
	}

	const createSubCasting = async () => {
		if (!newCastTitle.trim()) return
		if (!newCastShootDateFrom || !newCastShootDateTo) return
		if (newCastShootDateTo < newCastShootDateFrom) {
			alert('Дата окончания съёмок не может быть раньше даты начала')
			return
		}
		setCreatingCast(true)
		try {
			const genderValue = newCastGender === 'custom' ? newCastGenderCustom.trim() : newCastGender
			const formatDateLabel = (value: string) => {
				const [year, month, day] = value.split('-')
				if (!year || !month || !day) return value
				return `${day}.${month}.${year}`
			}
			const payload: Record<string, any> = {
				title: newCastTitle.trim(),
				description: newCastDesc.trim() || '-',
				city: newCastCity.trim() || undefined,
				project_category: newCastCategory || undefined,
				role_types: newCastRoleTypes.length > 0 ? newCastRoleTypes : undefined,
				gender: genderValue || undefined,
				age_from: newCastAgeFrom ? parseInt(newCastAgeFrom, 10) : undefined,
				age_to: newCastAgeTo ? parseInt(newCastAgeTo, 10) : undefined,
				financial_conditions: newCastFinanceNegotiable ? 'Обсуждаются индивидуально' : (newCastFinance.trim() || undefined),
				shooting_dates: `${formatDateLabel(newCastShootDateFrom)} - ${formatDateLabel(newCastShootDateTo)}`,
			}
			const res = await api('POST', `employer/projects/${projectId}/castings/`, payload)
			if (res?.id) {
				setSubCastings(prev => [res, ...prev])
				resetCastingForm()
				return
			}
			const msg = typeof res?.detail === 'string' ? res.detail : JSON.stringify(res?.detail || res)
			alert(msg || 'Ошибка создания кастинга')
		} catch {
			alert('Ошибка сети')
		} finally {
			setCreatingCast(false)
		}
	}

	const shareReport = async (reportId: number) => {
		setSharingReportId(reportId)
		try {
			const res = await http.post('public/shortlists/tokens/', { report_id: reportId })
			const token = res?.data?.token
			if (!token) {
				throw new Error('Не удалось создать ссылку')
			}
			const shareUrl = `${window.location.origin}/report/${token}`
			setSharedReportUrl(shareUrl)
			try {
				await navigator.clipboard.writeText(shareUrl)
				alert('Ссылка на отчёт скопирована в буфер обмена!')
			} catch {
				prompt('Скопируйте ссылку на отчёт:', shareUrl)
			}
		} catch (error: any) {
			alert(
				error?.response?.data?.detail?.message ||
				error?.response?.data?.detail ||
				error?.message ||
				'Не удалось сформировать ссылку на отчёт',
			)
		} finally {
			setSharingReportId(null)
		}
	}

	const generateTeamInviteLink = async () => {
		setCreatingInviteLink(true)
		try {
			const res = await api('POST', `employer/projects/${projectId}/collaborators/invite-link/?role=editor&expires_in_hours=168`)
			const inviteToken = res?.token
			if (!inviteToken) {
				throw new Error(res?.detail || 'Не удалось создать пригласительную ссылку')
			}
			const inviteUrl = `${window.location.origin}/invite/project/${inviteToken}`
			setSharedInviteUrl(inviteUrl)
			await copyTextWithFallback(inviteUrl, 'Скопируйте пригласительную ссылку:')
		} catch (error: any) {
			alert(error?.message || error?.detail || 'Не удалось создать пригласительную ссылку')
		} finally {
			setCreatingInviteLink(false)
		}
	}

	const loadChat = useCallback(async () => {
		try {
			const { data } = await http.get(`employer/projects/${projectId}/chat/`)
			setChatMessages(data?.messages || [])
		} catch {
			setChatMessages([])
		}
	}, [projectId])

	const sendChatMessage = async () => {
		if (!chatInput.trim() || chatSending) return
		setChatSending(true)
		try {
			const message = chatInput.trim()
			await http.post(`employer/projects/${projectId}/chat/?message=${encodeURIComponent(message)}`)
			setChatInput('')
			await loadChat()
		} catch (error: any) {
			alert(getRequestErrorMessage(error, 'Не удалось отправить сообщение в чат проекта'))
		} finally {
			setChatSending(false)
		}
	}

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [chatMessages])

	const RESPONSE_STATUSES = [
		{ value: 'pending', label: 'На рассмотрении', cls: styles.rsPending, icon: <IconClock size={11} /> },
		{ value: 'viewed', label: 'Просмотрено', cls: styles.rsViewed, icon: <IconEye size={11} /> },
		{ value: 'shortlisted', label: 'В избранном', cls: styles.rsShortlisted, icon: <IconStar size={11} /> },
		{ value: 'approved', label: 'Одобрено', cls: styles.rsApproved, icon: <IconCheck size={11} /> },
		{ value: 'rejected', label: 'Отклонено', cls: styles.rsRejected, icon: <IconBan size={11} /> },
	]

	const updateResponseStatus = async (responseId: number, newStatus: string) => {
		const res = await api(
			'PATCH',
			`employer/projects/${projectId}/responses/${responseId}/status/`,
			{ status: newStatus },
		)
		if (res?.ok) {
			setRespondents(prev =>
				prev.map(r =>
					r.response_id === responseId ? { ...r, response_status: newStatus } : r
				)
			)
		}
	}

	const genderLabel = (g: string | null) => {
		if (!g) return '—'
		if (g === 'male') return 'Мужской'
		if (g === 'female') return 'Женский'
		return g
	}

	const userRoleLabel = (role: string | null) => {
		if (!role) return 'Участник'
		const map: Record<string, string> = {
			owner: 'SuperAdmin',
			administrator: 'Администратор',
			manager: 'Менеджер',
			employer: 'Админ',
			employer_pro: 'Админ ПРО',
			user: 'Пользователь',
			agent: 'Агент',
		}
		return map[role] || role
	}

	const qualLabel = (q: string | null) => {
		if (!q) return '—'
		const m: Record<string, string> = {
			professional: 'Профессионал',
			skilled: 'Опытный',
			enthusiast: 'Энтузиаст',
			beginner: 'Начинающий',
			other: 'Другое',
		}
		return m[q] || q
	}

	const lookLabel = (l: string | null) => {
		if (!l) return '—'
		const m: Record<string, string> = {
			european: 'Европейский',
			asian: 'Азиатский',
			slavic: 'Славянский',
			african: 'Африканский',
			latino: 'Латиноамериканский',
			middle_eastern: 'Ближневосточный',
			caucasian: 'Кавказский',
			south_asian: 'Южноазиатский',
			mixed: 'Смешанный',
			other: 'Другой',
		}
		return m[l] || l
	}

	const hairColorLabel = (c: string | null) => {
		if (!c) return '—'
		const m: Record<string, string> = {
			blonde: 'Блонд',
			brunette: 'Брюнет',
			brown: 'Шатен',
			light_brown: 'Русый',
			red: 'Рыжий',
			gray: 'Седой',
			other: 'Другой',
		}
		return m[c] || c
	}

	const hairLenLabel = (l: string | null) => {
		if (!l) return '—'
		const m: Record<string, string> = {
			short: 'Короткие',
			medium: 'Средние',
			long: 'Длинные',
			bald: 'Лысый',
		}
		return m[l] || l
	}

	const scrollToSection = (sectionId: string) => {
		document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	const copyTextWithFallback = async (value: string, promptTitle: string) => {
		try {
			await navigator.clipboard.writeText(value)
			alert('Ссылка скопирована в буфер обмена')
		} catch {
			prompt(promptTitle, value)
		}
	}

	const projectDisplayTitle = project?.title || `Проект #${projectId}`
	const projectStatusLabel = project?.status === 'published'
		? 'Опубликован'
		: project?.status === 'closed'
			? 'Завершён'
			: 'Черновик'
	const projectTeamCount = collaborators.length + 1
	const activeCastingsCount = subCastings.filter((casting: any) => casting.status === 'published').length
	const draftCastingsCount = subCastings.filter((casting: any) => casting.status !== 'published' && casting.status !== 'closed').length
	const isProjectWorkspace = Boolean(project && !project.parent_project_id)
	const canSeeProjectActorBase = !isProjectWorkspace || isSuperAdmin || isAdminPro
	const projectCreatedDate = project?.created_at
		? new Date(project.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
		: '—'
	if (loading)
		return (
			<div className={styles.root}>
				<p className={styles.center}>
					<IconLoader size={18} /> Загрузка...
				</p>
			</div>
		)

	const renderActorModal = () => {
		if (!selectedActor) return null
		const a = selectedActor
		const photos = (a.media_assets || []).filter((m: any) => m.file_type === 'photo')
		const videos = (a.media_assets || []).filter((m: any) => m.file_type === 'video')
		const videoIntroHref = videos[0]?.processed_url || videos[0]?.original_url || a.video_intro || null
		const curSt = RESPONSE_STATUSES.find(s => s.value === (a.response_status || 'pending')) || RESPONSE_STATUSES[0]
		const fullName = a.display_name || `${a.last_name || ''} ${a.first_name || ''}`.trim() || 'Актёр'
		const isFav = favorites.has(a.profile_id)

		const maskPhone = (p: string) => {
			if (showContacts) return formatPhone(p)
			const d = p.replace(/\D/g, '')
			return `+7 *** *** ** ${d.slice(-2) || '**'}`
		}
		const maskEmail = (e: string) => {
			if (showContacts) return e
			const [u, d] = e.split('@')
			return `${u?.[0] || '*'}${'*'.repeat(Math.max(u.length - 1, 3))}@${'*'.repeat(d?.split('.')[0]?.length || 3)}.${d?.split('.')[1] || '***'}`
		}

		const SectionHead = ({ id, title }: { id: string; title: string }) => (
			<button className={styles.sectionToggle} onClick={() => toggleSection(id)}>
				<span className={styles.sectionToggleTitle}>{title}</span>
				{expandedSections[id] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
			</button>
		)

		return (
			<div className={styles.modalOverlay} onClick={() => setSelectedActor(null)}>
				<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
					<div className={styles.modalHeader}>
						<button className={styles.modalBackBtn} onClick={() => setSelectedActor(null)}>
							<IconArrowLeft size={16} />
						</button>
						<h3>{fullName}</h3>
						<button className={styles.modalClose} onClick={() => setSelectedActor(null)}>
							<IconX size={14} />
						</button>
					</div>

					{a.response_id && (
						<div className={styles.modalStatusBar}>
							<span className={styles.modalStatusLabel}>Статус отклика:</span>
							<div className={styles.rsRow}>
								{RESPONSE_STATUSES.map(s => {
									const active = curSt.value === s.value
									return (
										<button
											key={s.value}
											className={`${styles.rsChip} ${active ? s.cls : ''}`}
											onClick={() => {
												if (!active) {
													updateResponseStatus(a.response_id, s.value)
													setSelectedActor({ ...a, response_status: s.value })
												}
											}}
										>
											{s.icon}
											<span>{s.label}</span>
										</button>
									)
								})}
							</div>
						</div>
					)}

					<div className={styles.modalBody}>
						{photos.length > 0 ? (
							<div className={styles.carousel}>
								<div className={styles.carouselMain}>
									<img
										src={photos[carouselIdx]?.processed_url || photos[carouselIdx]?.original_url}
										alt=""
										className={styles.carouselImg}
										onClick={() => setLightboxIdx(carouselIdx)}
									/>
								<button
									className={`${styles.carouselFav} ${isFav ? styles.carouselFavActive : ''}`}
									onClick={(e) => toggleFavorite(a.profile_id, e)}
								>
										<IconHeart size={18} style={isFav ? { fill: 'currentColor' } : {}} />
									</button>
									{carouselIdx > 0 && (
										<button className={`${styles.carouselNav} ${styles.carouselPrev}`} onClick={() => setCarouselIdx(carouselIdx - 1)}>‹</button>
									)}
									{carouselIdx < photos.length - 1 && (
										<button className={`${styles.carouselNav} ${styles.carouselNext}`} onClick={() => setCarouselIdx(carouselIdx + 1)}>›</button>
									)}
								</div>
								{photos.length > 1 && (
									<div className={styles.carouselDots}>
										{photos.map((_: any, idx: number) => (
											<button
												key={idx}
												className={`${styles.carouselDot} ${idx === carouselIdx ? styles.carouselDotActive : ''}`}
												onClick={() => setCarouselIdx(idx)}
											/>
										))}
									</div>
								)}
								{photos.length > 1 && (
									<div className={styles.carouselThumbs}>
										{photos.map((m: any, idx: number) => (
											<img
												key={m.id}
												src={m.processed_url || m.original_url}
												alt=""
												className={`${styles.carouselThumb} ${idx === carouselIdx ? styles.carouselThumbActive : ''}`}
												onClick={() => setCarouselIdx(idx)}
											/>
										))}
									</div>
								)}
							</div>
						) : (
							<div className={styles.noPhoto}><IconUser size={48} /></div>
						)}

						{videoIntroHref && (
							<div className={styles.videoSection}>
								<a
									href={videoIntroHref}
									target="_blank"
									rel="noreferrer"
									className={styles.videoIntroBtn}
								>
									<IconFilm size={15} />
									Видеовизитка
								</a>
							</div>
						)}

					<button
						className={`${styles.favBtnLarge} ${isFav ? styles.favBtnLargeActive : ''}`}
						onClick={(e) => toggleFavorite(a.profile_id, e)}
					>
							<IconHeart size={14} style={isFav ? { fill: 'currentColor' } : {}} />
							{isFav ? 'В избранном' : '+ Избранное'}
						</button>

						<SectionHead id="main" title="ОСНОВНОЕ" />
						{expandedSections.main && (
							<div className={styles.sectionContent}>
								<div className={styles.detailRow}><span>Возраст</span><b>{a.age ? `${a.age} лет` : (a.date_of_birth ? `${new Date().getFullYear() - new Date(a.date_of_birth).getFullYear()} лет` : '—')}</b></div>
								<div className={styles.detailRow}><span>Пол</span><b>{genderLabel(a.gender)}</b></div>
								<div className={styles.detailRow}><span>Город проживания</span><b>{a.city || '—'}</b></div>
								<div className={styles.detailRow}><span>Квалификация</span><b>{qualLabel(a.qualification)}</b></div>
								{a.experience != null && <div className={styles.detailRow}><span>Опыт</span><b>{a.experience} лет</b></div>}
								<div className={styles.detailRow}><span>Тип внешности</span><b>{lookLabel(a.look_type)}</b></div>
								<div className={styles.detailRow}><span>Телосложение</span><b>{a.body_type || '—'}</b></div>
								<div className={styles.detailRow}><span>Рост</span><b>{a.height || '—'}</b></div>
								<div className={styles.detailRow}><span>Вес</span><b>{a.weight || '—'}</b></div>
								<div className={styles.detailRow}><span>Размер одежды</span><b>{a.clothing_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Размер обуви</span><b>{a.shoe_size || '—'}</b></div>
								<div className={styles.detailRow}><span>Длина волос</span><b>{hairLenLabel(a.hair_length)}</b></div>
								<div className={styles.detailRow}><span>Цвет волос</span><b>{hairColorLabel(a.hair_color)}</b></div>
								<div className={styles.detailRow}><span>Цвет глаз</span><b>{a.eye_color || '—'}</b></div>
								{a.bust_volume && <div className={styles.detailRow}><span>Обхват груди</span><b>{a.bust_volume} см</b></div>}
								{a.waist_volume && <div className={styles.detailRow}><span>Обхват талии</span><b>{a.waist_volume} см</b></div>}
								{a.hip_volume && <div className={styles.detailRow}><span>Обхват бёдер</span><b>{a.hip_volume} см</b></div>}
							</div>
						)}

						<SectionHead id="contacts" title="КОНТАКТЫ" />
						{expandedSections.contacts && (
							<div className={styles.sectionContent}>
								<div className={styles.detailRow}>
									<span><IconPhone size={13} /> Телефон</span>
									<b>{a.phone_number ? maskPhone(a.phone_number) : '—'}</b>
								</div>
								<div className={styles.detailRow}>
									<span><IconMail size={13} /> Email</span>
									<b>{a.email ? maskEmail(a.email) : '—'}</b>
								</div>
								{!showContacts && (a.phone_number || a.email) && (
									<button className={styles.showContactsBtn} onClick={() => setShowContacts(true)}>Показать</button>
								)}
								{a.self_test_url && (
									<div className={styles.detailRow}>
										<span>Самопроба</span>
										<b><a href={a.self_test_url} target="_blank" rel="noreferrer" className={styles.link}>{a.self_test_url}</a></b>
									</div>
								)}
							</div>
						)}

						<SectionHead id="about" title="О СЕБЕ" />
						{expandedSections.about && (
							<div className={styles.sectionContent}>
								<p className={styles.aboutText}>{a.about_me || 'Информация временно отсутствует'}</p>
							</div>
						)}

						<SectionHead id="skills" title="НАВЫКИ" />
						{expandedSections.skills && (
							<div className={styles.sectionContent}>
								{a.skills && a.skills.length > 0 ? (
									<div className={styles.skillTags}>
										{(typeof a.skills === 'string' ? a.skills.split(',') : a.skills).map((s: string, i: number) => (
											<span key={i} className={styles.skillTag}>{s.trim()}</span>
										))}
									</div>
								) : (
									<p className={styles.emptyInfo}>Информация временно отсутствует</p>
								)}
							</div>
						)}

						<SectionHead id="notes" title="МОИ ЗАМЕТКИ" />
						{expandedSections.notes && (
							<div className={styles.sectionContent}>
								<p className={styles.notesHint}>Здесь вы можете оставлять комментарии, личные заметки, информацию об актере, которые будут видны только вам</p>
								<textarea
									className={styles.notesArea}
									placeholder="Введите заметку..."
									value={actorNotes[a.profile_id] || ''}
									onChange={(e) => setActorNotes(prev => ({ ...prev, [a.profile_id]: e.target.value }))}
									rows={3}
								/>
							</div>
						)}

						<div className={styles.detailRow}>
							<span>Дата отклика</span>
							<b>{a.responded_at ? new Date(a.responded_at).toLocaleDateString('ru-RU') : '—'}</b>
						</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<>
			<div className={styles.root}>
				<header className={styles.header}>
					<button
						onClick={() => router.back()}
						className={styles.backBtn}
					>
						<IconArrowLeft size={14} /> Назад
					</button>
					<h1>{responsesOnly ? `Отклики по проекту «${projectDisplayTitle}»` : projectDisplayTitle}</h1>
				</header>

				<div className={styles.content}>
					{!responsesOnly && (
					<section className={styles.section}>
						<div className={styles.castingInfoHeader}>
							<h2>Проект и управление</h2>
							<div className={styles.castingInfoActions}>
								<button className={`${styles.castingInfoBtn} ${showCreateCasting ? styles.castingInfoBtnActive : ''}`} onClick={() => {
									setShowCreateCasting(prev => !prev)
									if (!showCreateCasting) setTimeout(() => scrollToSection('castings-section'), 50)
								}}>
									<IconFilm size={13} /> {showCreateCasting ? 'Скрыть создание' : 'Создать кастинг'}
								</button>
								{!isProjectWorkspace && (
									<button
										className={`${styles.castingInfoBtn} ${showReportsSection ? styles.castingInfoBtnActive : ''}`}
										onClick={() => {
											setShowReportsSection(true)
											setTimeout(() => scrollToSection('reports-section'), 50)
										}}
									>
										<IconClipboard size={13} /> Создать отчёт
									</button>
								)}
								{(isSuperAdmin || isAdminPro) && (
									<button
										className={styles.castingInfoBtn}
										onClick={() => router.push('/dashboard/actors')}
									>
										<IconUsers size={13} /> База актёров
									</button>
								)}
									{project?.status === 'published' ? (
							<button className={styles.castingInfoBtnWarn} onClick={async () => {
									const res = await api('POST', `employer/projects/${projectId}/unpublish/`)
									if (res?.id) {
										setProject(res)
									} else {
										alert(res?.detail || 'Не удалось снять с публикации')
									}
								}}>
									<IconX size={13} /> Снять с публикации
								</button>
								) : (
									<button className={styles.castingInfoBtnPublish} onClick={publishProject}>
										<IconZap size={13} /> Опубликовать
									</button>
								)}
							{project?.status !== 'closed' && (
								<button className={styles.castingInfoBtnDanger} onClick={async () => {
									if (!confirm('Завершить кастинг?')) return
									const res = await api('POST', `employer/projects/${projectId}/finish/`)
									if (res?.id) {
										setProject(res)
									} else {
										alert(res?.detail || 'Не удалось завершить проект')
									}
								}}>
									<IconX size={13} /> Завершить
								</button>
							)}
							</div>
						</div>

						{editing ? (
							<div className={styles.editForm}>
								<input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									className={styles.input}
									placeholder="Название"
								/>
								<textarea
									value={desc}
									onChange={(e) => setDesc(e.target.value)}
									className={styles.textarea}
									placeholder="Описание"
									rows={3}
								/>
								<div className={styles.editActions}>
									<button
										onClick={saveProject}
										className={styles.btnSave}
									>
										Сохранить
									</button>
									<button
										onClick={() => setEditing(false)}
										className={styles.btnCancel}
									>
										Отмена
									</button>
								</div>
							</div>
						) : (
							<>
								<input
									ref={imageInputRef}
									type="file"
									accept="image/*"
									style={{ display: 'none' }}
									onChange={(e) => {
										const file = e.target.files?.[0]
										if (file) uploadCastingImage(file)
										e.target.value = ''
									}}
								/>
								<div className={styles.castingInfoCard}>
									<div className={styles.castingInfoInner}>
										<div className={styles.castingInfoPhoto}>
											<img src={getCoverImage(project?.image_url, project?.id || project?.title)} alt={project?.title || 'Проект'} />
											<div className={styles.castingPhotoOverlay}>
												<button className={styles.castingPhotoBtn} onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
													<IconCamera size={14} /> {uploadingImage ? 'Загрузка...' : project?.image_url ? 'Заменить' : 'Добавить фото'}
												</button>
												{project?.image_url && (
													<button className={styles.castingPhotoBtnDel} onClick={deleteCastingImage}>
														<IconTrash size={14} />
													</button>
												)}
											</div>
										</div>
										<div className={styles.castingInfoBody}>
											<div className={styles.castingInfoTitleRow}>
												<h3>{project?.title}</h3>
											<span className={`${styles.castingInfoStatus} ${
												project?.status === 'published' ? styles.castingInfoStatusPub :
												project?.status === 'closed' ? styles.castingInfoStatusDone : ''
											}`}>
												{project?.status === 'published' ? 'Опубликован' : project?.status === 'closed' ? 'Завершён' : 'Черновик'}
											</span>
											</div>
								{isProjectWorkspace && (
									<div className={styles.projectOverviewGrid}>
										<button
											type="button"
											className={`${styles.projectOverviewCard} ${styles.projectOverviewCardButton}`}
											onClick={() => {
												setShowCreateCasting(true)
												setTimeout(() => scrollToSection('castings-section'), 50)
											}}
										>
											<span className={styles.projectOverviewLabel}>Кастингов в проекте</span>
											<strong>{subCastings.length}</strong>
											<small>{activeCastingsCount} активных, {draftCastingsCount} черновиков</small>
										</button>
										<button
											type="button"
											className={`${styles.projectOverviewCard} ${styles.projectOverviewCardButton}`}
											onClick={() => setShowTeamModal(true)}
										>
											<span className={styles.projectOverviewLabel}>Команда проекта</span>
											<strong>{projectTeamCount}</strong>
											<small>{collaborators.length > 0 ? `${collaborators.length} приглашённых участников` : 'Пока без приглашённых участников'}</small>
										</button>
											<button
												type="button"
												className={`${styles.projectOverviewCard} ${styles.projectOverviewCardButton} ${showReportsSection ? styles.castingInfoBtnActive : ''}`}
												onClick={() => {
													setShowReportsSection(prev => !prev)
													if (!showReportsSection) setTimeout(() => scrollToSection('reports-section'), 50)
												}}
											>
												<span className={styles.projectOverviewLabel}>Мои отчёты</span>
												<strong>{reports.length}</strong>
												<small>{reports.length > 0 ? 'Отчёты по проекту и вложенным кастингам' : 'Пока отчётов нет'}</small>
											</button>
										</div>
										)}
										<div className={styles.castingInfoDates}>
											<span><IconCalendar size={13} /> Дата создания<br /><b>{projectCreatedDate}</b></span>
											<span><IconCalendar size={13} /> Статус проекта<br /><b style={{ color: project?.status === 'closed' ? '#f97316' : project?.status === 'published' ? '#22c55e' : 'var(--c-text)' }}>{projectStatusLabel}</b></span>
											{project?.published_at && <span><IconCalendar size={13} /> Дата публикации<br /><b>{new Date(project.published_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</b></span>}
											<span><IconUser size={13} /> Откликнулось<br /><b>{respondents.length} актёров</b></span>
											<span><IconUsers size={13} /> Команда<br /><b>{collaborators.length > 0 ? collaborators.slice(0, 3).map((c: any) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email).join(', ') : 'Пока только вы'}</b></span>
										</div>
										</div>
									</div>
									<div className={styles.castingInfoEditRow}>
										<button onClick={() => setEditing(true)} className={styles.btnEdit}><IconEdit size={13} /> Редактировать</button>
										<button onClick={deleteProject} className={styles.btnDelete}><IconTrash size={13} /> Удалить</button>
									</div>
									{project?.description && (
										<div className={styles.castingInfoDesc}>
											<h4>Описание</h4>
											<div className={styles.castingInfoDescText}>{project.description}</div>
										</div>
									)}
								</div>
							</>
						)}
					</section>
					)}

				{!responsesOnly && isProjectWorkspace && showCreateCasting && (
				<section className={styles.section} id="castings-section">
					<div className={styles.projectCreateCastingHead}>
							<div>
								<h2><IconFilm size={16} /> Создать кастинг в проекте</h2>
								<p className={styles.projectSectionText}>
									Заполните все обязательные поля для публикации кастинга.
								</p>
							</div>
							<div className={styles.projectCreateCastingBadge}>
								{projectStatusLabel}
							</div>
						</div>
						<div className={styles.castingFormGrid}>
							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Заголовок <span className={styles.castingFormReq}>*</span></label>
								<input value={newCastTitle} onChange={(e) => setNewCastTitle(e.target.value)} placeholder="Название кастинга" className={styles.input} />
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Город проведения <span className={styles.castingFormReq}>*</span></label>
								<input value={newCastCity} onChange={(e) => setNewCastCity(e.target.value)} placeholder="Москва, Санкт-Петербург..." className={styles.input} />
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Категория проекта <span className={styles.castingFormReq}>*</span></label>
								<div className={styles.castingFormSelect}>
									{['Полный метр', 'Короткий метр', 'Сериал', 'Клип', 'Реклама', 'Ролик', 'Другое'].map((cat) => (
										<button
											key={cat}
											type="button"
											className={`${styles.castingFormChip} ${newCastCategory === cat ? styles.castingFormChipActive : ''}`}
											onClick={() => setNewCastCategory(newCastCategory === cat ? '' : cat)}
										>
											{cat}
										</button>
									))}
								</div>
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Тип роли <span className={styles.castingFormReq}>*</span></label>
								<div className={styles.castingFormSelect}>
									{['АМС', 'Групповка', 'Эпизодическая', 'Второго плана', 'Главная'].map((role) => (
										<label key={role} className={styles.castingFormCheckLabel}>
											<input
												type="checkbox"
												checked={newCastRoleTypes.includes(role)}
												onChange={() => {
													setNewCastRoleTypes(prev =>
														prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
													)
												}}
												className={styles.castingFormCheckbox}
											/>
											{role}
										</label>
									))}
								</div>
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Пол <span className={styles.castingFormReq}>*</span></label>
								<div className={styles.castingFormSelect}>
									{['Мужчина', 'Женщина', 'Мальчик', 'Девочка'].map((g) => (
										<button
											key={g}
											type="button"
											className={`${styles.castingFormChip} ${newCastGender === g ? styles.castingFormChipActive : ''}`}
											onClick={() => { setNewCastGender(newCastGender === g ? '' : g); setNewCastGenderCustom('') }}
										>
											{g}
										</button>
									))}
									<button
										type="button"
										className={`${styles.castingFormChip} ${newCastGender === 'custom' ? styles.castingFormChipActive : ''}`}
										onClick={() => setNewCastGender(newCastGender === 'custom' ? '' : 'custom')}
									>
										Свой вариант
									</button>
								</div>
								{newCastGender === 'custom' && (
									<input
										value={newCastGenderCustom}
										onChange={(e) => setNewCastGenderCustom(e.target.value)}
										placeholder="Укажите (напр. животное, реквизит, авто...)"
										className={styles.input}
										style={{ marginTop: 8 }}
									/>
								)}
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Требуемый возраст <span className={styles.castingFormReq}>*</span></label>
								<div className={styles.castingFormRow}>
									<input
										type="number"
										min={0}
										max={120}
										value={newCastAgeFrom}
										onChange={(e) => setNewCastAgeFrom(e.target.value)}
										placeholder="От"
										className={styles.input}
									/>
									<span className={styles.castingFormDash}>—</span>
									<input
										type="number"
										min={0}
										max={120}
										value={newCastAgeTo}
										onChange={(e) => setNewCastAgeTo(e.target.value)}
										placeholder="До"
										className={styles.input}
									/>
								</div>
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Финансовые условия <span className={styles.castingFormReq}>*</span></label>
								<label className={styles.castingFormCheckLabel} style={{ marginBottom: 8 }}>
									<input
										type="checkbox"
										checked={newCastFinanceNegotiable}
										onChange={() => { setNewCastFinanceNegotiable(!newCastFinanceNegotiable); setNewCastFinance('') }}
										className={styles.castingFormCheckbox}
									/>
									Обсуждаются индивидуально
								</label>
								{!newCastFinanceNegotiable && (
									<input
										value={newCastFinance}
										onChange={(e) => setNewCastFinance(e.target.value)}
										placeholder="Сумма (напр. 15 000 ₽)"
										className={styles.input}
									/>
								)}
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Даты съёмки <span className={styles.castingFormReq}>*</span></label>
								<div className={styles.castingFormRow}>
									<div className={styles.castingDateField}>
										<span className={styles.castingDateLabel}>С</span>
										<input
											type="date"
											value={newCastShootDateFrom}
											onChange={(e) => {
												const nextValue = e.target.value
												setNewCastShootDateFrom(nextValue)
												if (newCastShootDateTo && nextValue && newCastShootDateTo < nextValue) {
													setNewCastShootDateTo(nextValue)
												}
											}}
											className={styles.input}
										/>
									</div>
									<div className={styles.castingDateField}>
										<span className={styles.castingDateLabel}>По</span>
										<input
											type="date"
											value={newCastShootDateTo}
											min={newCastShootDateFrom || undefined}
											onChange={(e) => setNewCastShootDateTo(e.target.value)}
											className={styles.input}
										/>
									</div>
								</div>
							</div>

							<div className={styles.castingFormField}>
								<label className={styles.castingFormLabel}>Описание <span className={styles.castingFormReq}>*</span></label>
								<textarea
									value={newCastDesc}
									onChange={(e) => setNewCastDesc(e.target.value)}
									placeholder="Подробное описание кастинга, требования к актёрам..."
									className={styles.castingFormTextarea}
									rows={4}
								/>
							</div>

							<button
								className={styles.btnCastCreate}
								disabled={creatingCast || !newCastTitle.trim() || !newCastCity.trim() || !newCastCategory || newCastRoleTypes.length === 0 || (!newCastGender || (newCastGender === 'custom' && !newCastGenderCustom.trim())) || (!newCastAgeFrom && !newCastAgeTo) || (!newCastFinanceNegotiable && !newCastFinance.trim()) || !newCastShootDateFrom || !newCastShootDateTo || !newCastDesc.trim()}
								onClick={createSubCasting}
							>
								{creatingCast ? <IconLoader size={13} /> : <IconPlus size={13} />}
								Опубликовать кастинг
							</button>
						</div>
					</section>
					)}

				{!responsesOnly && isProjectWorkspace && (
				<section className={styles.section}>
					<h2><IconFilm size={16} /> Кастинги проекта ({subCastings.length})</h2>
						<p className={styles.projectSectionText}>
							Сначала открывается сам проект, а уже здесь внутри находятся все кастинги, связанные с этим проектом.
						</p>
					{subCastings.length > 0 ? (
						<div className={styles.castingCards}>
							{subCastings.map((c: any) => (
								<div key={c.id} className={styles.castingCard}>
									<input
										ref={(el) => { castingImageInputRefs.current[c.id] = el }}
										type="file"
										accept="image/*"
										style={{ display: 'none' }}
										onChange={(e) => {
											const file = e.target.files?.[0]
											if (file) uploadSubCastingImage(c.id, file)
											e.target.value = ''
										}}
									/>
									<div className={styles.castingCardPhoto}>
										<>
											<img src={getCoverImage(c.image_url, c.id || c.title)} alt={c.title} />
											<div className={styles.castingCardPhotoActions}>
												<button onClick={(e) => { e.stopPropagation(); castingImageInputRefs.current[c.id]?.click() }} disabled={uploadingCastingImage === c.id} title={c.image_url ? 'Заменить фото' : 'Добавить фото'}>
													{uploadingCastingImage === c.id ? <IconLoader size={13} /> : <IconCamera size={13} />}
												</button>
												{c.image_url && (
													<button onClick={(e) => { e.stopPropagation(); deleteSubCastingImage(c.id) }} title="Удалить фото">
														<IconTrash size={13} />
													</button>
												)}
											</div>
										</>
									</div>
									<div className={styles.castingCardBody}>
										<div className={styles.castingCardTop}>
											<h3 className={styles.castingCardTitle}>{c.title}</h3>
											<span className={`${styles.castingCardStatus} ${
												c.status === 'published' ? styles.castingCardStatusActive :
												c.status === 'closed' ? styles.castingCardStatusDone : ''
											}`}>
												{c.status === 'published' ? '● Активный' : c.status === 'closed' ? '● Закрыт' : '● Черновик'}
											</span>
										</div>
										{(c.city || c.project_category || c.gender || c.age_from || c.age_to || c.financial_conditions || c.shooting_dates || (c.role_types && c.role_types.length > 0)) && (
											<div className={styles.castingCardMeta}>
												{c.city && <span className={styles.castingCardMetaItem}>📍 {c.city}</span>}
												{c.project_category && <span className={styles.castingCardMetaItem}>{c.project_category}</span>}
												{c.gender && <span className={styles.castingCardMetaItem}>{c.gender}</span>}
												{(c.age_from || c.age_to) && <span className={styles.castingCardMetaItem}>{c.age_from || '?'}–{c.age_to || '?'} лет</span>}
												{c.role_types && c.role_types.length > 0 && <span className={styles.castingCardMetaItem}>{c.role_types.join(', ')}</span>}
												{c.financial_conditions && <span className={styles.castingCardMetaItem}>💰 {c.financial_conditions}</span>}
												{c.shooting_dates && <span className={styles.castingCardMetaItem}>📅 {c.shooting_dates}</span>}
											</div>
										)}
										{c.description && c.description !== '-' && (
											<p className={styles.castingCardDesc}>{c.description}</p>
										)}
										<div className={styles.castingCardFooter}>
											<span className={styles.castingCardResponses}>
												🎭 {c.response_count || 0} откликов
											</span>
											<button className={styles.castingCardOpenBtn} onClick={() => router.push(`/dashboard/project/${c.id}`)}>
												Открыть →
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className={styles.castingCardsEmpty}>
							<span>🎬</span>
							<p>Кастингов пока нет. Создайте первый выше.</p>
						</div>
					)}
					</section>
					)}

					{!responsesOnly && (
					<section className={styles.section} id="team-section">
						<h2><IconUsers size={16} /> Команда проекта</h2>
						<p className={styles.projectSectionText}>
							{isSuperAdmin
								? 'Вручную можно добавить только Админа или Админа ПРО. Для своей команды без активной подписки используйте пригласительную ссылку.'
								: 'Владельцы с подпиской Админ и Админ ПРО могут добавлять в команду только пользователей с ролью Админ или Админ ПРО и активной подпиской.'}
						</p>
						<div className={styles.collabList}>
							{collaborators.map((c: any) => (
								<div key={c.id} className={styles.collabItem}>
									<div className={styles.collabInfo}>
										<strong>{c.first_name || ''} {c.last_name || ''}</strong>
										<span>{c.email}</span>
									</div>
									<span className={styles.collabRole}>
										{c.role === 'editor' ? 'Редактор' : 'Наблюдатель'}
										{c.user_role ? ` · ${userRoleLabel(c.user_role)}` : ''}
									</span>
									<button className={styles.collabRemove} onClick={async () => {
										await api('DELETE', `employer/projects/${projectId}/collaborators/${c.id}/`)
										setCollaborators(prev => prev.filter(x => x.id !== c.id))
									}}>
										<IconX size={12} />
									</button>
								</div>
							))}
						</div>
						<div className={styles.collabForm}>
							<input
								value={collabEmail}
								onChange={(e) => setCollabEmail(e.target.value)}
								placeholder="Email Админа / Админа ПРО..."
								className={styles.input}
							/>
							<button
								className={styles.btnCollabAdd}
								disabled={addingCollab || !collabEmail.trim()}
								onClick={async () => {
									setAddingCollab(true)
									const res = await api('POST', `employer/projects/${projectId}/collaborators/?user_email=${encodeURIComponent(collabEmail)}&role=editor`)
									if (res?.ok) {
										const fresh = await api('GET', `employer/projects/${projectId}/collaborators/`)
										setCollaborators(fresh?.collaborators || [])
										setCollabEmail('')
									} else {
										alert(res?.detail || 'Не удалось добавить')
									}
									setAddingCollab(false)
								}}
							>
								{addingCollab ? <IconLoader size={13} /> : <IconPlus size={13} />}
								Добавить
							</button>
						</div>
						{isSuperAdmin && (
							<div className={styles.collabInviteBox}>
								<div className={styles.collabInviteInfo}>
									<strong>Пригласительная ссылка для команды</strong>
									<span>По этой ссылке участник вашей команды сможет вступить в проект без активной подписки.</span>
								</div>
								<button
									className={styles.btnCollabAdd}
									disabled={creatingInviteLink}
									onClick={generateTeamInviteLink}
								>
									{creatingInviteLink ? <IconLoader size={13} /> : <IconClipboard size={13} />}
									Создать ссылку
								</button>
							</div>
						)}
						{sharedInviteUrl && (
							<div className={styles.reportShareNotice}>
								<span>Пригласительная ссылка готова:</span>
								<a href={sharedInviteUrl} target="_blank" rel="noreferrer">{sharedInviteUrl}</a>
							</div>
						)}
					</section>
					)}

					{!responsesOnly && (
					<section className={styles.section}>
						<h2><IconMessageSquare size={16} /> Чат проекта</h2>
						<div className={styles.projectChat}>
							<div className={styles.projectChatMessages}>
								{chatMessages.length === 0 ? (
									<div className={styles.projectChatEmpty}>Нет сообщений. Начните обсуждение проекта!</div>
								) : chatMessages.map((m: any) => {
									const roleBadge = m.sender_role === 'owner' ? '👑 SuperAdmin'
										: m.sender_role === 'employer_pro' ? '⭐ Админ PRO'
										: m.sender_role === 'employer' || m.sender_role === 'administrator' || m.sender_role === 'manager' ? '📋 Админ'
										: ''
									return (
									<div key={m.id} className={`${styles.pcMsg} ${m.sender_role === 'owner' ? styles.pcMsgOwner : ''}`}>
										<div className={styles.pcMsgHead}>
											<span className={styles.pcMsgName}>{m.sender_name}</span>
											{roleBadge && <span className={styles.pcMsgRole}>{roleBadge}</span>}
											<span className={styles.pcMsgTime}>{m.created_at?.split('T')[1]?.split('.')[0]?.slice(0, 5) || ''}</span>
										</div>
										<p className={styles.pcMsgText}>{m.message}</p>
									</div>
									)
								})}
								<div ref={chatEndRef} />
							</div>
							<div className={styles.pcInputArea}>
								<input
									value={chatInput}
									onChange={(e) => setChatInput(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
									placeholder="Напишите сообщение..."
									className={styles.pcInput}
								/>
								<button
									onClick={sendChatMessage}
									disabled={chatSending || !chatInput.trim()}
									className={styles.pcSendBtn}
								>
									{chatSending ? <IconLoader size={14} /> : <IconSend size={14} />}
								</button>
							</div>
						</div>
					</section>
					)}

		{!responsesOnly && canSeeProjectActorBase && (() => {
			const favRespondents = respondents.filter((r: any) => favorites.has(r.profile_id))
			if (favRespondents.length === 0 && favorites.size === 0) return null
			return (
				<section className={styles.section}>
					<h2><IconHeart size={16} /> Избранные актёры ({favRespondents.length})</h2>
					{favRespondents.length === 0 ? (
						<p className={styles.empty}>Нажмите на сердечко у актёра, чтобы добавить в избранное</p>
					) : (
						<div className={styles.actorList}>
							{favRespondents.map((r: any, i: number) => {
								const firstPhoto = (r.media_assets || []).find((m: any) => m.file_type === 'photo')
								const favSt = RESPONSE_STATUSES.find(s => s.value === 'shortlisted') || RESPONSE_STATUSES[0]
								return (
									<div key={i} className={styles.actorCard} onClick={() => openActorModal(r)}>
										<div className={styles.actorPhoto}>
											{firstPhoto ? (
												<img src={firstPhoto.processed_url || firstPhoto.original_url || r.photo_url} alt="" />
											) : r.photo_url ? (
												<img src={r.photo_url} alt="" />
											) : (
												<div className={styles.actorPhotoPlaceholder}><IconUser size={28} /></div>
											)}
										</div>
										<div className={styles.actorInfo}>
											<h4>
												{r.display_name || `${r.last_name || ''} ${r.first_name || ''}`.trim() || 'Актёр'}
												{(r.avg_rating || r.avg_rating === 0) && (
													<span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: '#f5c518', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
														<IconStar size={11} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
														{r.avg_rating}
													</span>
												)}
											</h4>
											<span className={`${styles.actorStatusBadge} ${favSt.cls}`}>
												{favSt.icon} {favSt.label}
											</span>
										</div>
										<div className={styles.actorActions}>
											<button
												className={`${styles.actorActionBtn} ${styles.actorActionActive}`}
												onClick={(e) => toggleFavorite(r.profile_id, e)}
												title="Убрать из избранного"
											>
												<IconHeart size={16} style={{ fill: 'currentColor' }} />
											</button>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</section>
			)
		})()}

		{canSeeProjectActorBase && (
		<section className={styles.section} id="respondents-section">
			<h2>
				<IconMask size={16} /> Откликнувшиеся актёры ({respondents.length})
				{favorites.size > 0 && (
					<button onClick={() => setShowFavorites(!showFavorites)} className={`${styles.btnFav} ${showFavorites ? styles.btnFavActive : ''}`}>
						<IconHeart size={13} style={showFavorites ? { fill: 'currentColor' } : {}} /> Только избранные ({favorites.size})
					</button>
				)}
			</h2>

				{respondents.length > 0 && (
					<div className={styles.sortBar}>
						<div className={styles.sortInfo}>
							<IconSortDesc size={14} />
							<span>сортировка:</span>
							<button className={styles.sortToggle} onClick={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}>
								{sortBy === 'date' ? 'дата отклика' : 'по имени'} <IconChevronDown size={12} />
							</button>
						</div>
						<div className={styles.sortActions}>
							<button className={styles.sortIconBtn} onClick={() => setShowSearch(!showSearch)} title="Поиск"><IconSearch size={16} /></button>
							<button className={styles.sortIconBtn} title="Фильтры"><IconFilter size={16} /></button>
						</div>
					</div>
				)}

				{showSearch && (
					<div className={styles.searchBar}>
						<IconSearch size={14} />
						<input
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Поиск по имени..."
							className={styles.searchInput}
							autoFocus
						/>
						{searchTerm && (
							<button className={styles.searchClear} onClick={() => setSearchTerm('')}><IconX size={12} /></button>
						)}
					</div>
				)}

				{respondents.length === 0 ? (
					<p className={styles.empty}>Пока нет откликов</p>
				) : (
					<div className={styles.actorList}>
						{(() => {
							let list = showFavorites ? respondents.filter((r: any) => favorites.has(r.profile_id)) : respondents
							if (searchTerm.trim()) {
								const q = searchTerm.toLowerCase()
								list = list.filter((r: any) =>
									(r.first_name || '').toLowerCase().includes(q) ||
									(r.last_name || '').toLowerCase().includes(q) ||
									(r.display_name || '').toLowerCase().includes(q)
								)
							}
							if (sortBy === 'name') {
								list = [...list].sort((a, b) => ((a.last_name || a.first_name || '') > (b.last_name || b.first_name || '') ? 1 : -1))
							} else {
								list = [...list].sort((a, b) => new Date(b.responded_at || 0).getTime() - new Date(a.responded_at || 0).getTime())
							}
							return list
						})().map((r: any, i: number) => {
							const firstPhoto = (r.media_assets || []).find((m: any) => m.file_type === 'photo')
							const isFav = favorites.has(r.profile_id)
							const respondedDate = r.responded_at
								? new Date(r.responded_at).toLocaleDateString('ru-RU') + ', ' + new Date(r.responded_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
								: ''

							return (
								<div key={i} className={styles.actorCard} onClick={() => openActorModal(r)}>
									<div className={styles.actorPhoto}>
										{firstPhoto ? (
											<img src={firstPhoto.processed_url || firstPhoto.original_url || r.photo_url} alt="" />
										) : r.photo_url ? (
											<img src={r.photo_url} alt="" />
										) : (
											<div className={styles.actorPhotoPlaceholder}><IconUser size={28} /></div>
										)}
									</div>
									<div className={styles.actorInfo}>
										<h4>
											{r.display_name || `${r.last_name || ''} ${r.first_name || ''}`.trim() || 'Актёр'}
											{(r.avg_rating || r.avg_rating === 0) && (
												<span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: '#f5c518', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
													<IconStar size={11} style={{ color: '#f5c518', fill: '#f5c518', stroke: '#f5c518' }} />
													{r.avg_rating}
												</span>
											)}
										</h4>
										<span className={styles.actorDateLabel}>{respondedDate}</span>
									<button
										className={`${styles.actorFavDrop} ${isFav ? styles.actorFavDropActive : ''}`}
										onClick={(e) => toggleFavorite(r.profile_id, e)}
									>
										<IconHeart size={11} style={isFav ? { fill: 'currentColor' } : {}} />
										{isFav ? 'В избранном' : '+ Избранное'}
									</button>
									</div>
								<div className={styles.actorActions}>
									<button
										className={styles.actorActionBtn}
										onClick={(e) => { e.stopPropagation(); openActorModal(r) }}
										title="Просмотр"
									>
										<IconEye size={16} />
									</button>
									<button
										className={`${styles.actorActionBtn} ${isFav ? styles.actorActionActive : ''}`}
										onClick={(e) => toggleFavorite(r.profile_id, e)}
										title="Избранное"
									>
										<IconHeart size={16} style={isFav ? { fill: 'currentColor' } : {}} />
									</button>
								</div>
								</div>
							)
						})}
					</div>
				)}
			</section>
		)}

					{!responsesOnly && showReportsSection && (
					<section className={styles.section} id="reports-section">
						<h2><IconClipboard size={16} /> Отчёты ({reports.length})</h2>
						<p className={styles.projectSectionText}>
							Короткие списки и отчёты по этому проекту и всем вложенным кастингам.
						</p>
						{reports.length > 0 && (
							<div className={styles.reportList}>
								{reports.map((r: any) => (
									<div key={r.id} className={styles.reportItem} onClick={async () => {
										const detail = await api('GET', `employer/reports/${r.id}/`)
										setSelectedReport(detail)
									}}>
										<div className={styles.reportItemMain}>
											<strong>{r.title}</strong>
											<span>{new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
										</div>
										<button
											className={styles.reportShareBtn}
											onClick={(event) => {
												event.stopPropagation()
												shareReport(r.id)
											}}
											disabled={sharingReportId === r.id}
										>
											{sharingReportId === r.id ? <IconLoader size={13} /> : <IconSend size={13} />}
											Отправить отчёт
										</button>
									</div>
								))}
							</div>
						)}
						<div className={styles.reportForm}>
							<input value={newReportTitle} onChange={(e) => setNewReportTitle(e.target.value)} placeholder="Название отчёта" className={styles.input} />
							<button
								className={styles.btnReportCreate}
								disabled={creatingReport || !newReportTitle.trim()}
								onClick={async () => {
									setCreatingReport(true)
									const res = await api('POST', `employer/reports/create/?casting_id=${projectId}&title=${encodeURIComponent(newReportTitle)}`)
									if (res?.id) {
										setReports(prev => [{ ...res, created_at: new Date().toISOString() }, ...prev])
										setNewReportTitle('')
										if (respondents.length > 0) {
											const pids = respondents.map((r: any) => r.profile_id)
											const query = pids.map((p: number) => `profile_ids=${p}`).join('&')
											await api('POST', `employer/reports/${res.id}/add-actors/?${query}`)
										}
									}
									setCreatingReport(false)
								}}
							>
								{creatingReport ? <IconLoader size={13} /> : <IconClipboard size={13} />}
								Создать отчёт
							</button>
						</div>

						{selectedReport && (
							<div className={styles.reportDetail}>
								<div className={styles.reportDetailHeader}>
									<h3>{selectedReport.title}</h3>
									<span className={styles.reportDetailCount}>{selectedReport.actors?.length || 0} актёров</span>
									<button
										className={styles.reportShareBtn}
										onClick={() => shareReport(selectedReport.id)}
										disabled={sharingReportId === selectedReport.id}
									>
										{sharingReportId === selectedReport.id ? <IconLoader size={13} /> : <IconSend size={13} />}
										Отправить отчёт
									</button>
									<button onClick={() => setSelectedReport(null)} className={styles.reportCloseBtn}><IconX size={14} /></button>
								</div>
								{sharedReportUrl && (
									<div className={styles.reportShareNotice}>
										<span>Публичная ссылка готова:</span>
										<a href={sharedReportUrl} target="_blank" rel="noreferrer">{sharedReportUrl}</a>
									</div>
								)}
								<div className={styles.reportGrid}>
									{(selectedReport.actors || []).map((a: any) => {
										const name = a.display_name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Актёр'
										const photos = (a.media_assets || []).filter((m: any) => m.file_type === 'photo')
										const videos = (a.media_assets || []).filter((m: any) => m.file_type === 'video')
										const mainPhoto = a.photo_url || (photos[0]?.processed_url || photos[0]?.original_url)
										const videoIntroHref = videos[0]?.processed_url || videos[0]?.original_url || a.video_intro || null
										return (
											<div key={a.profile_id} className={styles.vizitka} onClick={() => {
												const found = respondents.find((r: any) => r.profile_id === a.profile_id)
												if (found) openActorModal(found)
											}}>
												{a.favorite && (
													<div className={styles.vizitkaFav}>
														<IconHeart size={14} style={{ fill: '#ef4444', color: '#ef4444' }} />
													</div>
												)}
												<div className={styles.vizitkaPhoto}>
													{mainPhoto ? (
														<img src={mainPhoto} alt={name} />
													) : (
														<div className={styles.vizitkaPhotoEmpty}>
															{(a.first_name?.[0] || '?').toUpperCase()}
														</div>
													)}
												</div>
												<div className={styles.vizitkaBody}>
													<h4 className={styles.vizitkaName}>{name}</h4>
													<span className={styles.vizitkaMeta}>
														{a.age ? `${a.age} лет` : ''}
														{a.age && a.city ? ' • ' : ''}
														{a.city || ''}
													</span>
													<div className={styles.vizitkaChips}>
														{a.height && (
															<span className={styles.vizitkaChip}>
																📏 {a.height} см
															</span>
														)}
														{a.clothing_size && (
															<span className={styles.vizitkaChip}>
																👕 {a.clothing_size}
															</span>
														)}
														{a.shoe_size && (
															<span className={styles.vizitkaChip}>
																👟 {a.shoe_size}
															</span>
														)}
													</div>
													{videoIntroHref && (
														<a
															href={videoIntroHref}
															target="_blank"
															rel="noreferrer"
															className={styles.vizitkaVideoBtn}
															onClick={(event) => event.stopPropagation()}
														>
															<IconFilm size={13} />
															Видеовизитка
														</a>
													)}
												</div>
											</div>
										)
									})}
								</div>
							</div>
						)}
					</section>
					)}

				</div>
				{!responsesOnly && <LiveChat castingId={Number(projectId) || 0} />}
			</div>

			{renderActorModal()}

			{showTeamModal && (
			<div className={styles.teamModalOverlay} onClick={() => setShowTeamModal(false)}>
				<div className={styles.teamModalCard} onClick={(e) => e.stopPropagation()}>
					<div className={styles.teamModalHeader}>
						<div>
							<div className={styles.teamModalTitle}><IconUsers size={18} /> Команда проекта</div>
							<div className={styles.teamModalSubtitle}>{project?.title}</div>
						</div>
						<button className={styles.teamModalClose} onClick={() => setShowTeamModal(false)}><IconX size={18} /></button>
					</div>

					{collaborators.length === 0 ? (
						<div className={styles.teamModalEmpty}>Пока нет участников. Добавьте первого!</div>
					) : (
						<div className={styles.teamMemberList}>
							{collaborators.map((c: any) => (
								<div key={c.id} className={styles.teamMemberItem}>
									<div className={styles.teamMemberAvatar}>
										{c.photo ? <img src={c.photo} alt="" /> : (c.first_name?.[0] || c.email?.[0] || '?').toUpperCase()}
									</div>
									<div className={styles.teamMemberInfo}>
										<span>{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email}</span>
										<small>{c.email}</small>
										<div className={styles.teamMemberRole}>{c.role === 'editor' ? 'Редактор' : 'Наблюдатель'}</div>
									</div>
									<button
										className={styles.teamMemberRemove}
										onClick={async () => {
											await http.delete(`employer/projects/${projectId}/collaborators/${c.id}/`)
											setCollaborators(prev => prev.filter((x: any) => x.id !== c.id))
										}}
									>×</button>
								</div>
							))}
						</div>
					)}

					<div className={styles.teamAddForm}>
						<input
							className={styles.teamAddInput}
							type="email"
							placeholder="Email Админа / Админа ПРО..."
							value={collabEmail}
							onChange={(e) => setCollabEmail(e.target.value)}
							onKeyDown={async (e) => {
								if (e.key === 'Enter' && collabEmail.trim() && !addingCollab) {
									setAddingCollab(true)
									const res = await http.post(`employer/projects/${projectId}/collaborators/`, { email: collabEmail.trim() })
									if (res?.data?.id) {
										setCollaborators(prev => [...prev, res.data])
										setCollabEmail('')
									} else {
										alert(res?.data?.detail || 'Не удалось добавить')
									}
									setAddingCollab(false)
								}
							}}
						/>
						<button
							className={styles.teamAddBtn}
							disabled={addingCollab || !collabEmail.trim()}
							onClick={async () => {
								if (!collabEmail.trim() || addingCollab) return
								setAddingCollab(true)
								const res = await http.post(`employer/projects/${projectId}/collaborators/`, { email: collabEmail.trim() })
								if (res?.data?.id) {
									setCollaborators(prev => [...prev, res.data])
									setCollabEmail('')
								} else {
									alert(res?.data?.detail || 'Не удалось добавить')
								}
								setAddingCollab(false)
							}}
						>
							{addingCollab ? <IconLoader size={14} /> : '+ Добавить'}
						</button>
					</div>

					{isSuperAdmin && (
						<div className={styles.teamInviteSection}>
							<button
								className={styles.teamInviteBtn}
								disabled={creatingInviteLink}
								onClick={async () => {
									setCreatingInviteLink(true)
									const res = await http.post(`employer/projects/${projectId}/collaborators/invite-link/`, {})
									if (res?.data?.invite_url) setSharedInviteUrl(res.data.invite_url)
									setCreatingInviteLink(false)
								}}
							>
								{creatingInviteLink ? <IconLoader size={14} /> : <IconClipboard size={14} />} Создать пригласительную ссылку
							</button>
							{sharedInviteUrl && (
								<div className={styles.teamInviteUrl}>
									<span>{sharedInviteUrl}</span>
									<button onClick={() => { try { navigator.clipboard.writeText(sharedInviteUrl) } catch { const el = document.createElement('textarea'); el.value = sharedInviteUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el) } }}>Копировать</button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		)}

		{lightboxIdx !== null && selectedActor && (() => {
				const photos = (selectedActor.media_assets || []).filter((m: any) => m.file_type === 'photo')
				if (!photos[lightboxIdx]) return null
				return (
					<div className={styles.lightbox} onClick={() => setLightboxIdx(null)}>
						<button className={styles.lightboxClose} onClick={() => setLightboxIdx(null)}><IconX size={20} /></button>
						{lightboxIdx > 0 && (
							<button className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }}>‹</button>
						)}
						<img src={photos[lightboxIdx].processed_url || photos[lightboxIdx].original_url} alt="" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
						{lightboxIdx < photos.length - 1 && (
							<button className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }}>›</button>
						)}
						<div className={styles.lightboxCounter}>{lightboxIdx + 1} / {photos.length}</div>
					</div>
				)
			})()}
		</>
	)
}
