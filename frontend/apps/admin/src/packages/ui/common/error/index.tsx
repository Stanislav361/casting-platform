import { memo, PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const Error = memo(({ children }: PropsWithChildren) => (
	<div className={styles.error}>{children}</div>
))
