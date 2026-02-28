import { PropsWithChildren } from 'react'

import styles from './with-app-root.module.scss'

let AppRoot: any = null
try {
	const tgUI = require('@telegram-apps/telegram-ui')
	AppRoot = tgUI.AppRoot
} catch {}

const WithAppRoot = ({ children }: PropsWithChildren) => {
	if (AppRoot) {
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
	return (
		<div className={styles.appRoot} id="root">
			{children}
		</div>
	)
}

export default WithAppRoot
