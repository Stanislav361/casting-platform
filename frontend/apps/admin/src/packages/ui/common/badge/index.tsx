import { CSSProperties, PropsWithChildren, ReactNode, useMemo } from 'react'

import { Relative } from '~packages/ui'

interface BadgeContainerProps extends PropsWithChildren {
	colorText: string
}

export const BadgeContainer = ({
	children,
	colorText,
}: BadgeContainerProps) => {
	const style: CSSProperties = useMemo(
		() => ({
			placeContent: 'center',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1,
			color: 'var(--color-white)',
			width: '18px',
			height: '18px',
			background: colorText,
			top: '-4px',
			right: '-5px',
			borderRadius: '100px',
			position: 'absolute',
			fontSize: '12px',
			transformOrigin: 'center',
			userSelect: 'none',
			lineHeight: 0,
		}),
		[colorText],
	)

	return <div style={style}>{children}</div>
}

interface BadgeProps {
	content?: string
	variant?: 'danger' | 'success'
	placement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
	isInvisible?: boolean
	children: ReactNode
}

const colorVariant = {
	danger: '#F96E65',
	success: 'var(--color-success)',
}

export const Badge = ({
	content,
	isInvisible = true,
	children,
	variant = 'danger',
}: BadgeProps) => {
	return (
		<Relative>
			{children}
			{isInvisible && (
				<BadgeContainer colorText={colorVariant[variant]}>
					{content}
				</BadgeContainer>
			)}
		</Relative>
	)
}
