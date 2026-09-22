'use client'

import { ACCEPTED_PHOTO_TYPES } from '~/shared/photo-upload'
import styles from './photo-file-input.module.scss'

/**
 * Поле выбора фото поверх слота.
 *
 * Не вызывать `.click()` и не оборачивать слот в `<label>`: на Android и в
 * Telegram это считается программным кликом, галерея не открывается. Человек
 * должен нажать само поле. Кнопка «выбрать файл» растянута на весь слот —
 * иначе нажатие в плюс подсвечивает рамку и ничего не делает.
 */
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
