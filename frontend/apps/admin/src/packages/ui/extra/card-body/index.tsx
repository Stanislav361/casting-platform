import cn from 'classnames'
import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

interface CardBodyProps extends PropsWithChildren {
	relative?: boolean
}

export const CardBody = ({ children, relative }: CardBodyProps) => {
	return (
		<div
			className={cn(
				styles.card__body,
				relative && styles.card__body__hidden,
			)}
		>
			{children}
		</div>
	)
}
