'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { $session } from '@prostoprobuy/models'
import { API_URL } from '~/shared/api-url'
import styles from './project.module.scss'

export default function ProjectPage() {
	const router = useRouter()
	const params = useParams()
	const projectId = params.id

	const [token, setToken] = useState<string | null>(null)
	const [project, setProject] = useState<any>(null)
	const [respondents, setRespondents] = useState<any[]>([])
	const [chatLogs, setChatLogs] = useState<any[]>([])
	const [editing, setEditing] = useState(false)
	const [title, setTitle] = useState('')
	const [desc, setDesc] = useState('')
	const [comment, setComment] = useState('')
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const session = $session.getState()
		if (!session?.access_token) { router.replace('/login'); return }
		setToken(session.access_token)
	}, [router])

	const api = useCallback(async (method: string, path: string, body?: any) => {
		if (!token) return null
		const res = await fetch(`${API_URL}${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: body ? JSON.stringify(body) : undefined,
		})
		return res.json()
	}, [token])

	useEffect(() => {
		if (!token || !projectId) return
		const load = async () => {
			try {
				const [projList, resp, logs] = await Promise.all([
					api('GET', 'employer/projects/'),
					api('GET', `employer/projects/${projectId}/respondents/`).catch(() => ({ respondents: [] })),
					api('GET', `collaboration/casting/${projectId}/log/`).catch(() => ({ logs: [] })),
				])
				const proj = projList?.projects?.find((p: any) => p.id === Number(projectId))
				if (proj) {
					setProject(proj)
					setTitle(proj.title)
					setDesc(proj.description)
				}
				setRespondents(resp?.respondents || [])
				setChatLogs(logs?.logs || [])
			} catch {}
			setLoading(false)
		}
		load()
	}, [token, projectId, api])

	const saveProject = async () => {
		const res = await api('PATCH', `employer/projects/${projectId}/`, { title, description: desc })
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

	const sendComment = async () => {
		if (!comment.trim()) return
		await api('POST', `collaboration/casting/${projectId}/comment/?message=${encodeURIComponent(comment)}`)
		setComment('')
		const logs = await api('GET', `collaboration/casting/${projectId}/log/`)
		setChatLogs(logs?.logs || [])
	}

	if (loading) return <div className={styles.root}><p className={styles.center}>Загрузка...</p></div>

	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<button onClick={() => router.back()} className={styles.backBtn}>← Назад</button>
				<h1>Проект #{projectId}</h1>
			</header>

			<div className={styles.content}>
				{/* Project Info */}
				<section className={styles.section}>
					<div className={styles.sectionHeader}>
						<h2>Информация</h2>
						<div className={styles.actions}>
							{!editing && <button onClick={() => setEditing(true)} className={styles.btnEdit}>✏️ Редактировать</button>}
							<button onClick={deleteProject} className={styles.btnDelete}>🗑️ Удалить</button>
						</div>
					</div>

					{editing ? (
						<div className={styles.editForm}>
							<input value={title} onChange={e => setTitle(e.target.value)} className={styles.input} placeholder="Название" />
							<textarea value={desc} onChange={e => setDesc(e.target.value)} className={styles.textarea} placeholder="Описание" rows={3} />
							<div className={styles.editActions}>
								<button onClick={saveProject} className={styles.btnSave}>💾 Сохранить</button>
								<button onClick={() => setEditing(false)} className={styles.btnCancel}>Отмена</button>
							</div>
						</div>
					) : (
						<div className={styles.infoCard}>
							<h3>{project?.title}</h3>
							<p>{project?.description}</p>
							<div className={styles.meta}>
								<span>Статус: <b>{project?.status}</b></span>
								<span>Откликов: <b>{respondents.length}</b></span>
								<span>Создан: {project?.created_at?.split('T')[0]}</span>
							</div>
						</div>
					)}
				</section>

				{/* Respondents */}
				<section className={styles.section}>
					<h2>Откликнувшиеся актёры ({respondents.length})</h2>
					{respondents.length === 0 ? (
						<p className={styles.empty}>Пока нет откликов</p>
					) : (
						<div className={styles.actorList}>
							{respondents.map((r: any, i: number) => (
								<div key={i} className={styles.actorCard}>
									<div className={styles.actorAvatar}>
										{r.photo_url ? <img src={r.photo_url} alt="" /> : <span>👤</span>}
									</div>
									<div className={styles.actorInfo}>
										<h4>{r.first_name} {r.last_name}</h4>
										<p>{r.city} · {r.gender} · {r.qualification || 'Без опыта'}</p>
									</div>
									<span className={styles.actorDate}>{r.responded_at?.split('T')[0]}</span>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Chat / Action Log */}
				<section className={styles.section}>
					<h2>Обсуждение</h2>
					<div className={styles.chatBox}>
						{chatLogs.length === 0 ? (
							<p className={styles.empty}>Нет сообщений</p>
						) : (
							chatLogs.map((log: any, i: number) => (
								<div key={i} className={styles.chatMsg}>
									<span className={styles.chatUser}>User #{log.user_id}</span>
									<span className={styles.chatText}>{log.message}</span>
									<span className={styles.chatTime}>{log.created_at?.split('.')[0]}</span>
								</div>
							))
						)}
					</div>
					<div className={styles.chatInput}>
						<input
							value={comment}
							onChange={e => setComment(e.target.value)}
							placeholder="Написать комментарий..."
							className={styles.input}
							onKeyDown={e => e.key === 'Enter' && sendComment()}
						/>
						<button onClick={sendComment} className={styles.btnSend}>→</button>
					</div>
				</section>
			</div>
		</div>
	)
}
