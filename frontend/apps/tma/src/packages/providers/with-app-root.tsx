import { PropsWithChildren } from 'react'
import { AppRoot } from '@telegram-apps/telegram-ui'

import styles from './with-app-root.module.scss'

const WithAppRoot = ({ children }: PropsWithChildren) => {
	return (
		<AppRoot
			className={styles.appRoot}
			appearance={'dark'}
			platform={'ios'}
			id={'root'}
		>
			{children}
		</AppRoot>
	)
}

export default WithAppRoot
