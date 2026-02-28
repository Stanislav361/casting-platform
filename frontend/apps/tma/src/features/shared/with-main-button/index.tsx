import { Button } from '@telegram-apps/telegram-ui'
import { PropsWithChildren } from 'react'

import styles from './index.module.scss'

interface WithButtonProps extends PropsWithChildren {
	onClick?: (e: any) => void
	text?: string
	loading?: boolean
	disabled?: boolean
}

const WithButton = ({
	onClick,
	text = 'Продолжить',
	children,
	disabled,
	loading,
}: WithButtonProps) => {
	return (
		<>
			<div className={styles.withMainButton}>{children}</div>
			<div className={styles.withMainButtonButton}>
				<Button
					size={'l'}
					onClick={onClick}
					loading={loading}
					disabled={disabled}
				>
					{text}
				</Button>
			</div>
		</>
	)
}

export default WithButton
