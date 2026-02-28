import cn from 'classnames'
import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

interface TabProps extends PropsWithChildren {
	selected: boolean
	onUpdate: () => void
}

export const Tab = ({ selected, onUpdate, children }: TabProps) => {
	return (
		<div
			className={cn(styles.tab, selected && styles.tabActive)}
			onClick={onUpdate}
		>
			{children}
		</div>
	)
}

export const TabList = ({ children }: PropsWithChildren) => {
	return <div className={styles.tabList}>{children}</div>
}
