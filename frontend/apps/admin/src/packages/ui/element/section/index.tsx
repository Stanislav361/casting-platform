import cn from 'classnames'
import { CSSProperties, PropsWithChildren, ReactNode } from 'react'

import styles from './index.module.scss'

interface SectionProps extends PropsWithChildren {
	header?: ReactNode
	footer?: ReactNode
	height?: CSSProperties['height']
	inline?: boolean
}

export const Section = ({
	children,
	header,
	footer,
	height,
	inline,
}: SectionProps) => {
	return (
		<section className={styles.section}>
			{header && (
				<header
					className={cn(
						styles.section__header,
						inline && styles.section__header__inline,
					)}
				>
					{header}
				</header>
			)}
			<article
				className={cn(
					styles.section__content,
					inline && styles.section__content__inline,
				)}
				style={{ height }}
			>
				{children}
			</article>
			{footer && (
				<footer className={styles.section__footer}>{footer}</footer>
			)}
		</section>
	)
}
