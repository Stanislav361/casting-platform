import { memo } from 'react'

import styles from './index.module.scss'

interface SkeletonProps {
	variant?: 'rounded' | 'rectangular' | 'text' | 'ellipsis'
	width?: number
	height?: number
	maxHeight?: number
	maxWidth?: number
}

const variantBorderRadius: Record<
	'rounded' | 'rectangular' | 'text' | 'ellipsis',
	string
> = {
	rounded: '50%',
	rectangular: '0.5rem',
	text: '4px',
	ellipsis: '20px',
}

export const Skeleton = memo(
	({
		variant = 'text',
		width = false,
		height = false,
		maxHeight,
		maxWidth,
	}: SkeletonProps) => {
		return (
			<div
				className={styles.skeleton}
				style={{
					width: width ? `${width}px` : '100%',
					height: height ? `${height}px` : 'auto',
					maxHeight: maxHeight ? `${maxHeight}px` : 'none',
					maxWidth: maxWidth ? `${maxWidth}px` : 'none',
					borderRadius: variantBorderRadius[variant],
				}}
			/>
		)
	},
)
