import { memo, PropsWithChildren } from 'react'

import styles from './index.module.scss'

export const SegmentedControl = memo(({ children }: PropsWithChildren) => (
	<div className={styles.segment__control}>{children}</div>
))
