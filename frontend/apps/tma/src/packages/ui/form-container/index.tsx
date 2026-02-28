import { Title } from '@telegram-apps/telegram-ui'
import { FormHTMLAttributes, PropsWithChildren } from 'react'

import { Form } from '~packages/ui'

import styles from './index.module.scss'

interface FormContainerProps
	extends PropsWithChildren,
		Pick<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
	title: string
	subtitle?: string
}

export const FormContainer = ({
	title,
	children,
	subtitle,
	onSubmit,
}: FormContainerProps) => {
	return (
		<div className={styles.formContainer}>
			{subtitle && (
				<span className={styles.formSubtitle}>{subtitle}</span>
			)}
			<Title level={'2'} weight={'1'}>
				{title}
			</Title>
			<Form onSubmit={onSubmit}>{children}</Form>
		</div>
	)
}
