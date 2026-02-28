import cn from 'classnames'
import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

interface PaginationItemProps extends PropsWithChildren {
	onClick?: () => void
	active?: boolean
}

const PaginationItem = ({ onClick, children, active }: PaginationItemProps) => {
	return (
		<li
			className={cn(
				styles.pagination__item,
				active && styles.pagination__active,
			)}
			onClick={onClick}
		>
			{children}
		</li>
	)
}

export default PaginationItem
