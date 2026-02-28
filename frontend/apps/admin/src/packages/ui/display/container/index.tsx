import cn from 'classnames'
import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

interface ContainerProps extends PropsWithChildren {
	size?: Size
}

let styleVariant = {
	sm: styles.container__sm,
	md: styles.container__md,
	lg: styles.container__lg,
}

export const Container = ({ children, size = 'lg' }: ContainerProps) => (
	<div className={cn(styles.container, styleVariant[size])}>{children}</div>
)
