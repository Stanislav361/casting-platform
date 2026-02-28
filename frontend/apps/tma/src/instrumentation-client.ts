// This file is normally used for setting up analytics and other
// services that require one-time initialization on the client
import { mockEnv } from '~mock-env'

import { init } from '~packages/core'
import { IS_PROD } from '~packages/system'

import { IS_DEV } from '@prostoprobuy/system'

performance.mark('app-init')

mockEnv().then(() => {
	try {
		init({
			debug: IS_DEV,
			eruda: !IS_PROD,
		})
	} catch (e) {
		reportError(e)
	}
})
