import { useMask } from '@react-input/mask'
import { forwardRef, ReactNode } from 'react'

import { DATE_MASK } from '@prostoprobuy/system'
import { mergeRefs } from '@prostoprobuy/toolkit'
import { DetailedInputProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface DateInputProps extends Omit<DetailedInputProps, 'className'> {
	error?: boolean | string
	before?: ReactNode
	after?: ReactNode
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
	({ error, before, after, id, ...props }, ref) => {
		const inputRef = useMask({
			mask: DATE_MASK,
			replacement: { d: /\d/, m: /\d/, y: /\d/ },
			showMask: true,
			separate: true,
		})

		return (
			<label
				htmlFor={id}
				className={`${styles.label} ${error && styles.labelError}`}
			>
				{before}
				<input
					id={id}
					className={styles.input}
					ref={mergeRefs(ref, inputRef)}
					{...props}
				/>
				{after}
			</label>
		)
	},
)
