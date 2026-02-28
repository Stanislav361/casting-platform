import { forwardRef } from 'react'

import { DetailedInputProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface CheckboxProps extends Omit<DetailedInputProps, 'className'> {
	label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
	({ label, id, ...rest }, ref) => {
		return (
			<div className={styles.checkbox__wrapper}>
				<label htmlFor={id}>
					<input type='checkbox' id={id} ref={ref} {...rest} />
					{label && <span>{label}</span>}
				</label>
			</div>
		)
	},
)
