import { memo, ReactNode } from 'react'

import styles from './index.module.scss'

interface PlaceholderProps {
	title?: string | ReactNode
	text?: string | ReactNode
}

export const Placeholder = memo(
	({
		title = 'Нет данных',
		text = 'Попробуйте изменить параметры поиска',
	}: PlaceholderProps) => (
		<div className={styles.placeholder}>
			<div className={styles.placeholderTitle}>{title}</div>
			<div>{text}</div>
		</div>
	),
)
