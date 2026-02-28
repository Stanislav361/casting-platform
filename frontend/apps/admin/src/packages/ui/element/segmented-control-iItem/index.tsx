import cn from 'classnames'
import { memo, PropsWithChildren } from 'react'

import styles from './index.module.scss'

interface SegmentedControlIItemProps extends PropsWithChildren {
	selected?: boolean
	onClick?: () => void
}

export const SegmentedControlIItem = memo(
	({ children, selected, onClick }: SegmentedControlIItemProps) => {
		return (
			<div
				onClick={onClick}
				className={cn(
					styles.segmented__control__item,
					selected && styles.segmented__control__item__active,
				)}
			>
				{children}
			</div>
		)
	},
)
