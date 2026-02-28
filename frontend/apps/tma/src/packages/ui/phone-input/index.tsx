import { useMask } from '@react-input/mask'
import { forwardRef, ReactNode } from 'react'

import { PHONE_MASK } from '@prostoprobuy/system'
import { mergeRefs } from '@prostoprobuy/toolkit'
import { DetailedInputProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface PhoneInputProps extends Omit<DetailedInputProps, 'className'> {
	error?: boolean | string
	before?: ReactNode
	after?: ReactNode
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
	({ error, before, after, id, ...props }, ref) => {
		const inputRef = useMask({
			mask: PHONE_MASK,
			replacement: { _: /\d/ },
			showMask: true,
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
