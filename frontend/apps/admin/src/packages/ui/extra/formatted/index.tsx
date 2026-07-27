import styles from './index.module.scss'
import { sanitizeRichText } from './sanitize'

interface formattedProps {
	html: string
}

// Текст приходит от пользователей (описания кастингов, «о себе» в анкетах),
// поэтому в разметку он попадает только через санитайзер: иначе сохранённый
// в тексте <img onerror=...> выполнялся бы в админ-панели с её правами.
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
