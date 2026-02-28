import cn from 'classnames'
import { memo } from 'react'

import type { DetailedDivProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface CardProps extends Omit<DetailedDivProps, 'style'> {
	radius?: Size
	padding?: Size
	fullWidth?: boolean
	isHoverable?: boolean
	height?: string
	view?: 'outline' | 'filled'
}

const radiusStyle = {
	sm: styles.card__radius__sm,
	md: styles.card__radius__md,
	lg: styles.card__radius__lg,
}

const paddingStyle = {
	sm: styles.card__padding__sm,
	md: styles.card__padding__md,
	lg: styles.card__padding__lg,
}

const viewStyle = {
	outline: styles.card__view__outline,
	filled: styles.card__view__filled,
}

export const Card = memo(
	({
		radius = 'sm',
		fullWidth,
		isHoverable,
		style,
		padding,
		view = 'outline',
		className,
		...rest
	}: CardProps) => {
		return (
			<div
				style={style}
				className={cn(
					className,
					styles.card,
					radiusStyle[radius],
					paddingStyle[padding],
					fullWidth && styles.card__full__width,
					isHoverable && styles.card__hoverable,
					viewStyle[view],
				)}
				{...rest}
			/>
		)
	},
)
