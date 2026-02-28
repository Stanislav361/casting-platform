import cn from 'classnames'
import type { CSSProperties, PropsWithChildren } from 'react'

import { Spin } from '~packages/ui'

import type { DetailedButtonProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface ButtonProps extends DetailedButtonProps, PropsWithChildren {
	width?: ButtonWidth
	radius?: Size | 'cr'
	height?: CSSProperties['height']
	long?: CSSProperties['height']
	size?: 'default' | 'circle'
	view?: ButtonView
	loading?: boolean
}

const variantStyle: Record<ButtonView, string> = {
	default: styles.button__default,
	primary: styles.button__primary,
	secondary: styles.button__secondary,
	black: styles.button__black,
	danger: styles.button__danger,
	overlay: styles.button__overlay,
	brand: styles.button__brand,
	'brand-overlay': styles.button__brand__overlay,
}

const radiusStyle = {
	sm: styles.button__radius__sm,
	md: styles.button__radius__md,
	lg: styles.button__radius__lg,
	cr: styles.button__radius__cr,
}

const sizeStyle = {
	default: styles.button__size__default,
	circle: styles.button__size__circle,
}

export const Button = ({
	radius = 'md',
	view = 'default',
	size = 'default',
	width = 'auto',
	height,
	disabled,
	className,
	children,
	loading,
	long,
	style,
	...rest
}: ButtonProps) => {
	return (
		<button
			className={cn(
				className,
				styles.button,
				variantStyle[view],
				radiusStyle[radius],
				sizeStyle[size],
				width === 'max' && styles.button__full,
			)}
			disabled={disabled || loading}
			style={{
				height,
				width: long,
				maxWidth: long,
				...style,
			}}
			{...rest}
		>
			{children}
			{loading && <Spin size={'sm'} />}
		</button>
	)
}
