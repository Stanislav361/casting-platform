import { CSSProperties, memo, PropsWithChildren, ReactNode } from 'react'

import { Flex } from '~packages/ui'

import styles from './index.module.scss'

interface TagProps extends PropsWithChildren {
	icon?: ReactNode
	label?: string
	color?: string
	flexDirection?: CSSProperties['flexDirection']
	gap?: CSSProperties['gap']
}

export const Tag = memo(
	({
		icon,
		children,
		label,
		color,
		flexDirection = 'column',
		gap,
	}: TagProps) => {
		return (
			<div className={styles.tag}>
				{icon}
				<Flex flexDirection={flexDirection} gap={gap}>
					<span>{label}</span>
					<p style={{ color }}>{children}</p>
				</Flex>
			</div>
		)
	},
)
