'use client'

/**
 * Универсальный провайдер диалогов:
 *  - dialog.alert({ title, message, ... })       — заменяет нативный window.alert
 *  - dialog.confirm({ title, message, ... })     — заменяет нативный window.confirm
 *  - dialog.success({ ... }) / dialog.error({ ... }) / dialog.info({ ... })
 *
 * Все вызовы возвращают Promise<boolean> (true = подтверждено / закрыто-OK,
 * false = отменено пользователем). Это позволяет писать:
 *
 *   if (await dialog.confirm({ title: 'Завершить?' })) { ... }
 *
 * Дизайн модалки: тёмная глассморф-карточка с большой иконкой,
 * крупным заголовком и понятным текстом. Подходит даже бабушке.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'
import {
	IconAlertCircle,
	IconCheck,
	IconX,
} from '~packages/ui/icons'
import styles from './dialog.module.scss'

type DialogTone = 'info' | 'success' | 'warning' | 'danger'

interface DialogOptions {
	title?: string
	message?: ReactNode
	confirmLabel?: string
	cancelLabel?: string
	tone?: DialogTone
	icon?: ReactNode
	hideCancel?: boolean
}

interface DialogState extends DialogOptions {
	id: number
	resolve: (value: boolean) => void
}

interface DialogApi {
	alert: (opts: DialogOptions) => Promise<boolean>
	confirm: (opts: DialogOptions) => Promise<boolean>
	success: (opts: DialogOptions) => Promise<boolean>
	error: (opts: DialogOptions) => Promise<boolean>
	info: (opts: DialogOptions) => Promise<boolean>
	warn: (opts: DialogOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogApi | null>(null)

let externalDialog: DialogApi | null = null

/**
 * Глобальная ссылка для использования вне React-компонентов
 * (например, в утилитах вроде api-client.ts или try-async).
 *
 * Если провайдер ещё не смонтирован — fallback на нативный alert/confirm,
 * чтобы не терять сообщения в edge-кейсах.
 */
export const dialog: DialogApi = {
	alert: (opts) => {
		if (externalDialog) return externalDialog.alert(opts)
		if (typeof window !== 'undefined') window.alert(stringifyForNative(opts))
		return Promise.resolve(true)
	},
	confirm: (opts) => {
		if (externalDialog) return externalDialog.confirm(opts)
		if (typeof window !== 'undefined') return Promise.resolve(Boolean(window.confirm(stringifyForNative(opts))))
		return Promise.resolve(false)
	},
	success: (opts) =>
		externalDialog
			? externalDialog.success(opts)
			: Promise.resolve(true),
	error: (opts) =>
		externalDialog
			? externalDialog.error(opts)
			: Promise.resolve(false),
	info: (opts) =>
		externalDialog
			? externalDialog.info(opts)
			: Promise.resolve(true),
	warn: (opts) =>
		externalDialog
			? externalDialog.warn(opts)
			: Promise.resolve(true),
}

function stringifyForNative(opts: DialogOptions): string {
	const parts: string[] = []
	if (opts.title) parts.push(opts.title)
	if (typeof opts.message === 'string') parts.push(opts.message)
	return parts.join('\n\n')
}

export function useDialog(): DialogApi {
	const ctx = useContext(DialogContext)
	return ctx ?? dialog
}

export default function DialogProvider({ children }: { children: ReactNode }) {
	const [stack, setStack] = useState<DialogState[]>([])
	const counterRef = useRef(0)

	const push = useCallback(
		(opts: DialogOptions, mode: 'alert' | 'confirm', defaultTone: DialogTone) => {
			return new Promise<boolean>((resolve) => {
				counterRef.current += 1
				const item: DialogState = {
					id: counterRef.current,
					tone: defaultTone,
					hideCancel: mode === 'alert' ? true : false,
					confirmLabel: mode === 'alert' ? 'Понятно' : 'Да',
					cancelLabel: 'Отмена',
					...opts,
					resolve,
				}
				setStack((prev) => [...prev, item])
			})
		},
		[],
	)

	const close = useCallback((id: number, value: boolean) => {
		setStack((prev) => {
			const target = prev.find((d) => d.id === id)
			if (target) target.resolve(value)
			return prev.filter((d) => d.id !== id)
		})
	}, [])

	const api = useMemo<DialogApi>(
		() => ({
			alert: (opts) => push(opts, 'alert', opts.tone || 'info'),
			confirm: (opts) => push(opts, 'confirm', opts.tone || 'warning'),
			success: (opts) => push(opts, 'alert', 'success'),
			error: (opts) => push(opts, 'alert', 'danger'),
			info: (opts) => push(opts, 'alert', 'info'),
			warn: (opts) => push(opts, 'alert', 'warning'),
		}),
		[push],
	)

	// Регистрируем глобальный API для использования вне React (api-client и т.д.)
	useEffect(() => {
		externalDialog = api
		return () => {
			if (externalDialog === api) externalDialog = null
		}
	}, [api])

	// Закрываем самый верхний диалог по клавише Esc
	useEffect(() => {
		if (stack.length === 0) return
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				const top = stack[stack.length - 1]
				if (top) close(top.id, false)
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [stack, close])

	const top = stack[stack.length - 1]

	return (
		<DialogContext.Provider value={api}>
			{children}
			{top && (
				<div
					className={styles.overlay}
					onClick={(e) => {
						if (e.target === e.currentTarget) close(top.id, false)
					}}
					role="dialog"
					aria-modal="true"
				>
					<div className={`${styles.card} ${styles[top.tone || 'info']}`}>
						<div className={styles.iconWrap}>
							{top.icon ?? defaultIcon(top.tone)}
						</div>
						{top.title && <h3 className={styles.title}>{top.title}</h3>}
						{top.message && (
							<div className={styles.message}>
								{typeof top.message === 'string' ? <p>{top.message}</p> : top.message}
							</div>
						)}
						<div className={styles.actions}>
							{!top.hideCancel && (
								<button
									type="button"
									className={styles.cancel}
									onClick={() => close(top.id, false)}
								>
									{top.cancelLabel || 'Отмена'}
								</button>
							)}
							<button
								type="button"
								className={`${styles.confirm} ${styles[`btn_${top.tone || 'info'}`]}`}
								onClick={() => close(top.id, true)}
								autoFocus
							>
								{top.confirmLabel || (top.hideCancel ? 'Понятно' : 'Да')}
							</button>
						</div>
					</div>
				</div>
			)}
		</DialogContext.Provider>
	)
}

function defaultIcon(tone?: DialogTone): ReactNode {
	switch (tone) {
		case 'success':
			return <IconCheck size={28} />
		case 'danger':
		case 'warning':
			return <IconAlertCircle size={28} />
		case 'info':
		default:
			return <IconAlertCircle size={28} />
	}
}

// Маленький утилитарный компонент: x-кнопка для закрытия (используется
// в кастомных диалогах с контентом-нодой).
export function DialogClose({ onClose }: { onClose: () => void }) {
	return (
		<button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
			<IconX size={16} />
		</button>
	)
}
