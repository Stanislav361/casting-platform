'use client'

import { ACCEPTED_PHOTO_TYPES } from '~/shared/photo-upload'
import styles from './photo-file-input.module.scss'

/**
 * Прозрачное поле выбора фото поверх слота.
 *
 * Не вызывайте `.click()` у скрытого input — на Android это часто не открывает
 * галерею. Родитель должен быть `position: relative`.
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
			onClick={(event) => event.stopPropagation()}
			onChange={(event) => {
				const file = event.target.files?.[0]
				event.target.value = ''
				if (file) onFile(file)
			}}
		/>
	)
}
