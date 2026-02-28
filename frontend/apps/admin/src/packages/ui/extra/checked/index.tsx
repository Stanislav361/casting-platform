import { IconCheck } from '@tabler/icons-react'
import cn from 'classnames'
import { memo } from 'react'

import styles from './index.module.scss'

interface CheckedProps {
	checked: boolean
}

export const Checked = memo(({ checked }: CheckedProps) => {
	return (
		<div className={cn(styles.checked, checked && styles.checkedActive)}>
			<IconCheck size={16} />
		</div>
	)
})
