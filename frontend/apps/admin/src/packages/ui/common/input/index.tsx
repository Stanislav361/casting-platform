import cn from 'classnames'
import { forwardRef, ReactNode } from 'react'

import { DetailedInputProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

export interface InputProps extends DetailedInputProps {
	radius?: Size
	error?: boolean | string | null
	before?: ReactNode
	after?: ReactNode
}

const radiusStyle = {
	sm: styles.input__radius__sm,
	md: styles.input__radius__md,
	lg: styles.input__radius__lg,
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ radius = 'md', className, error, before, after, ...rest }, ref) => (
		<div
			className={cn(
				className,
				styles.input,
				radiusStyle[radius],
				error && styles.input__error,
			)}
		>
			{before}
			<input ref={ref} {...rest} />
			{after}
		</div>
	),
)
