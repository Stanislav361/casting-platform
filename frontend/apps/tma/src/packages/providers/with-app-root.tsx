'use client'

import { PropsWithChildren, useRef, useMemo } from 'react'
import { AppRootContext } from '@telegram-apps/telegram-ui/dist/components/Service/AppRoot/AppRootContext'

import styles from './with-app-root.module.scss'

const WithAppRoot = ({ children }: PropsWithChildren) => {
	const portalRef = useRef<HTMLDivElement>(null)

	const ctx = useMemo(
		() => ({
			platform: 'ios' as const,
			appearance: 'dark' as const,
			portalContainer: portalRef,
			isRendered: true,
		}),
		[],
	)

	return (
		<AppRootContext.Provider value={ctx}>
			<div
				ref={portalRef}
				className={`tgui-6a12827a138e8827 tgui-56dbb42c1dbd5e2b tgui-865b921add8ee075 ${styles.appRoot}`}
				id="root"
			>
				{children}
			</div>
		</AppRootContext.Provider>
	)
}

export default WithAppRoot
