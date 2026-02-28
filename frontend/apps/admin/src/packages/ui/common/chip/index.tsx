import Link from 'next/link'
import { CSSProperties, memo, PropsWithChildren, ReactNode } from 'react'

import styles from './index.module.scss'

export interface ChipProps extends PropsWithChildren {
	variant?: ChipVariant
	size?: Size | 's'
	startContent?: ReactNode
	endContent?: ReactNode
	hoverable?: boolean
	withOutPadding?: boolean
	href?: string
	weight?: CSSProperties['fontWeight']
}

const valiantBackground: Record<ChipVariant, string> = {
	default: 'var(--color-overlay)',
	primary: 'var(--color-primary)',
	success: 'var(--color-success)',
	warning: 'var(--color-warning)',
	danger: 'var(--color-danger)',
	black: 'var(--color-accent-primary)',
	gray: '#717171',
	tiny: 'transparent',
	'brand-overlay': 'var(--color-brand-overlay)',
	info: '#DBEAFE',
	flat: '#DCFCE7',
}

const variantColor: Record<ChipVariant, string> = {
	default: 'var(--color-text)',
	primary: 'var(--color-white)',
	success: 'var(--color-white)',
	warning: 'var(--color-white)',
	danger: 'var(--color-white)',
	black: 'var(--color-white)',
	gray: 'var(--color-white)',
	tiny: '#717171',
	'brand-overlay': 'var(--color-black)',
	info: '#1E40AF',
	flat: '#166534',
}

const variantHeight = {
	s: '22px',
	sm: '22px',
	md: '28px',
	lg: '32px',
}

const variantPadding = {
	s: '0',
	sm: '0 6px',
	md: '0 10px',
	lg: '0 14px',
}

const variantSize = {
	s: '14px',
	sm: '12px',
	md: '14px',
	lg: '16px',
}

const chipStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '5px',
	borderRadius: '50px',
	width: 'fit-content',
	fontWeight: '400',
	lineHeight: 1,
	whiteSpace: 'nowrap',
	flexShrink: 0,
}

const ChipContent = memo(
	({
		variant = 'default',
		children,
		size = 'sm',
		endContent,
		startContent,
		hoverable,
		weight = '400',
	}: ChipProps) => (
		<div
			className={hoverable ? styles.chip__hover : undefined}
			style={{
				...chipStyle,
				fontWeight: weight,
				backgroundColor: valiantBackground[variant],
				color: variantColor[variant],
				fontSize: variantSize[size],
				padding: variantPadding[size],
				height: variantHeight[size],
				cursor: hoverable ? 'pointer' : 'default',
			}}
		>
			{startContent}
			{children}
			{endContent}
		</div>
	),
)

export const Chip = ({
	variant,
	children,
	size,
	endContent,
	startContent,
	hoverable,
	href,
	weight,
}: ChipProps) => {
	return href ? (
		<Link href={href}>
			<ChipContent
				variant={variant}
				size={size}
				endContent={endContent}
				startContent={startContent}
				hoverable={hoverable}
				children={children}
				weight={weight}
			/>
		</Link>
	) : (
		<ChipContent
			variant={variant}
			size={size}
			endContent={endContent}
			startContent={startContent}
			hoverable={hoverable}
			children={children}
			weight={weight}
		/>
	)
}
