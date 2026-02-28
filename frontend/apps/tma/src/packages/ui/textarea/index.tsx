import { forwardRef, ReactNode } from 'react'

import { DetailedTextareaProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface TextareaProps extends Omit<DetailedTextareaProps, 'className'> {
	error?: boolean | string
	before?: ReactNode
	after?: ReactNode
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ error, before, after, id, ...props }, ref) => (
		<label
			htmlFor={id}
			className={`${styles.label} ${error && styles.labelError}`}
		>
			{before}
			<textarea
				className={styles.textarea}
				ref={ref}
				id={id}
				{...props}
			/>
			{after}
		</label>
	),
)
