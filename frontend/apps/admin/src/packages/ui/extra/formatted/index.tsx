import styles from './index.module.scss'

interface formattedProps {
	html: string
}

export const Formatted = ({ html }: formattedProps) => {
	return (
		<div
			className={styles.formatted}
			dangerouslySetInnerHTML={{
				__html: html,
			}}
		/>
	)
}
