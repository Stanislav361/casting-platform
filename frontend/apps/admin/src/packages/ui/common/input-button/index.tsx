import { IconChevronDown } from '@tabler/icons-react'
import cn from 'classnames'
import { forwardRef, Fragment, ReactNode } from 'react'

import { Error } from '~packages/ui'

import type { DetailedButtonProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

export interface InputButtonProps extends DetailedButtonProps {
	radius?: Size
	error?: boolean | string
	icon?: ReactNode
	variant?: 'input' | 'overlay'
}

const radiusStyle = {
	sm: styles.input__button__radius__sm,
	md: styles.input__button__radius__md,
	lg: styles.input__button__radius__lg,
}

const variantStyle = {
	input: styles.input__button__default,
	overlay: styles.input__button__overlay,
}

export const InputButton = forwardRef<HTMLButtonElement, InputButtonProps>(
	(
		{
			children,
			radius = 'md',
			error,
			className,
			icon,
			variant = 'input',
			value,
			width,
			...rest
		},
		ref,
	) => (
		<>
			<div className={styles.input__button__wrap}>
				<button
					className={cn(
						className,
						styles.input__button,
						radiusStyle[radius],
						variantStyle[variant],
						error && styles.input__button__error,
					)}
					ref={ref}
					defaultValue={value}
					{...rest}
				>
					{children}
				</button>
				<div className={styles.input__button__icon}>
					{icon ? icon : <IconChevronDown size={20} />}
				</div>
			</div>
			{error && <Error>{error}</Error>}
		</>
	),
)
