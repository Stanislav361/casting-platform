'use client'

import { ACCEPTED_PHOTO_TYPES } from '~/shared/photo-upload'
import styles from './photo-file-input.module.scss'

/**
 * Поле выбора фото поверх слота.
 *
 * В Telegram и Android нельзя вызывать `.click()` у скрытого input и нельзя
 * оборачивать слот в `<label>`: WebView считает это программным кликом и
 * молча ничего не открывает. Человек должен нажать именно сам input.
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
