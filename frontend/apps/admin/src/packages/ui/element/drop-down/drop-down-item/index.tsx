import { IconCheck } from '@tabler/icons-react'
import { FC, ReactNode } from 'react'

import { Nullable } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface DropdownItemProps {
	active?: boolean
	onClick?: () => void
	children?: ReactNode
	description?: Nullable<string>
	img?: Nullable<string>
}

export const DropdownItem: FC<DropdownItemProps> = ({
	children,
	active,
	onClick,
	description,
	img,
}) => {
	return (
		<div
			className={`${styles.overlay__item} ${active && styles.overlay__item__active}`}
			onClick={onClick}
			role={'option'}
		>
			<div className={styles.overlay__item__context}>
				<span>{img && <img src={img} alt={description} />}</span>
				<div>
					{children}
					{description && <p>{description}</p>}
				</div>
			</div>
			{active && <IconCheck size={18} />}
		</div>
	)
}
