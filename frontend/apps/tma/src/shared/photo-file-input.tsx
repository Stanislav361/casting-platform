'use client'

import { ACCEPTED_PHOTO_TYPES } from '~/shared/photo-upload'
import styles from './photo-file-input.module.scss'

/**
 * Поле выбора фото поверх слота.
 *
 * Слот не оборачивать в `<label>`: Telegram считает такой клик программным
 * и не открывает галерею. Если нажатие попало в подпись, а не в само поле,
 * родитель в том же клике вызывает `openPhotoInput`.
 */
export function openPhotoInput(event: { target: EventTarget | null; currentTarget: EventTarget & { querySelector(selector: string): Element | null } }) {
	const input = event.currentTarget.querySelector('input[type="file"]')
	if (!(input instanceof HTMLInputElement) || event.target === input || input.disabled) return
	input.click()
}

export function PhotoFileInput({
	onFile,
	accept = ACCEPTED_PHOTO_TYPES,
	disabled,
	'aria-label': ariaLabel,
}: {
	onFile: (file: File) => void
	accept?: string
	disabled?: boolean
	'aria-label'?: string
}) {
	return (
		<input
			type="file"
			accept={accept}
			disabled={disabled}
			aria-label={ariaLabel}
			className={styles.input}
			onChange={(event) => {
				const file = event.target.files?.[0]
				event.target.value = ''
				if (file) onFile(file)
			}}
		/>
	)
}
