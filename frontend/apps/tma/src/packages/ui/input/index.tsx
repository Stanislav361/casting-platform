import cn from 'classnames'
import { forwardRef, ReactNode } from 'react'

import { DetailedInputProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface InputProps extends Omit<DetailedInputProps, 'className'> {
	error?: boolean | string
	before?: ReactNode
	after?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ error, before, after, id, disabled, ...props }, ref) => (
		<label
			htmlFor={id}
			className={cn(
				styles.label,
				error && styles.labelError,
				disabled && styles.labelDisabled,
			)}
		>
			{before}
			<input
				id={id}
				className={styles.input}
				disabled={disabled}
				ref={ref}
				{...props}
			/>
			{after}
		</label>
	),
)
