import { IconChevronDown } from '@tabler/icons-react'
import cn from 'classnames'
import { forwardRef, Fragment, ReactNode } from 'react'

import { Error } from '~packages/ui'

import type { DetailedSelectProps, SelectOption } from '@prostoprobuy/types'

import styles from './index.module.scss'

export interface SelectProps extends DetailedSelectProps {
	radius?: Size
	error?: boolean | string
	options: SelectOption[]
	icon?: ReactNode
	variant?: 'input' | 'overlay'
	width?: 'max' | 'auto'
}

const radiusStyle = {
	sm: styles.input__radius__sm,
	md: styles.input__radius__md,
	lg: styles.input__radius__lg,
}

const variantStyle = {
	input: styles.select__default,
	overlay: styles.select__overlay,
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
	(
		{
			radius = 'md',
			options,
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
			<div
				className={cn(
					styles.select__wrap,
					width === 'max' && styles.select__width__max,
				)}
			>
				<select
					className={cn(
						className,
						styles.select,
						radiusStyle[radius],
						variantStyle[variant],
						width === 'max' && styles.select__width__max,
					)}
					ref={ref}
					defaultValue={value}
					{...rest}
				>
					{options.map((item, index) => (
						<Fragment key={index}>
							<option
								value={item.value}
								selected={value === item.value}
								disabled={item.disabled}
							>
								{item.label}
							</option>
							{item.hr && <hr />}
						</Fragment>
					))}
				</select>
				<div className={styles.select__icon}>
					{icon ? icon : <IconChevronDown size={20} />}
				</div>
			</div>
			{error && <Error>{error}</Error>}
		</>
	),
)
