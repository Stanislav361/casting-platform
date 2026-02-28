import cn from 'classnames'

import styles from './index.module.scss'

interface SeparatorProps {
	variant?: 'default' | 'white'
}

const separatorStyle = {
	default: styles.separator__default,
	grey: styles.separator__white,
}

export const Separator = ({ variant = 'default' }: SeparatorProps) => (
	<div className={cn(styles.separator__block, separatorStyle[variant])} />
)
