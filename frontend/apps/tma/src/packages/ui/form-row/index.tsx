import { Section, Text } from '@telegram-apps/telegram-ui'
import { PropsWithChildren, ReactNode } from 'react'

import styles from './index.module.scss'

interface FormRowProps extends PropsWithChildren {
	header?: string
	required?: boolean
	footer?: ReactNode
}

export const FormRow = ({
	header,
	footer,
	required,
	children,
}: FormRowProps) => {
	return (
		<Section
			header={
				<div className={styles.label}>
					{header}{' '}
					{required && <span className={styles.labelSpan}>*</span>}
				</div>
			}
			footer={footer}
		>
			{children}
		</Section>
	)
}
