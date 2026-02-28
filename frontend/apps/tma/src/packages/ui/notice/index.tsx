import { Subheadline, Text } from '@telegram-apps/telegram-ui'
import { PropsWithChildren, ReactNode } from 'react'

import styles from './index.module.scss'

interface NoticeProps extends PropsWithChildren {
	icon: ReactNode
}

export const Notice = ({ icon, children }: NoticeProps) => {
	return (
		<div className={styles.notice}>
			{icon}
			<Subheadline level={2}>{children}</Subheadline>
		</div>
	)
}
