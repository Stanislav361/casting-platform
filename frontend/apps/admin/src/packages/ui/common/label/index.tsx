import cn from 'classnames'
import { memo, ReactNode } from 'react'

import { DetailedLabelProps } from '@prostoprobuy/types'

import styles from './index.module.scss'

interface LabelProps extends DetailedLabelProps {
	children?: ReactNode
	required?: boolean
}

export const Label = memo(
	({ children, required, className, ...rest }: LabelProps) => (
		<label className={cn(className, styles.label__field)} {...rest}>
			{children} {required && <span>*</span>}
		</label>
	),
)
