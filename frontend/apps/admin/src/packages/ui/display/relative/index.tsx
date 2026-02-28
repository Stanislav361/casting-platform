import { forwardRef, PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const Relative = forwardRef<HTMLDivElement, PropsWithChildren>(
	({ children }, ref) => (
		<div ref={ref} className={styles.relative}>
			{children}
		</div>
	),
)
