import styles from './index.module.scss'
import { sanitizeRichText } from './sanitize'

interface formattedProps {
	html: string
}

// Текст приходит от пользователей (описания кастингов, анкеты), поэтому в
// разметку он попадает только через санитайзер: иначе сохранённый в описании
// <img onerror=...> выполнялся бы у каждого, кто открыл карточку.
export const Formatted = ({ html }: formattedProps) => {
	return (
		<div
			className={styles.formatted}
			dangerouslySetInnerHTML={{
				__html: sanitizeRichText(html),
			}}
		/>
	)
}
