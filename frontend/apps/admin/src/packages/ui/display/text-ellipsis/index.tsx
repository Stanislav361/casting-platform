import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const TextEllipsis = ({ children }: PropsWithChildren) => (
	<div className={styles.textEllipsis}>{children}</div>
)
