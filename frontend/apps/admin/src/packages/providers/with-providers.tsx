import { PropsWithChildren } from 'react'

import WithProgressBar from './with-progress-bar'
import WithReactQuery from './with-react-query'
import WithToaster from './with-toaster'

export const WithProviders = ({ children }: PropsWithChildren) => {
	return (
		<WithReactQuery>
			<WithProgressBar>
				<WithToaster>{children}</WithToaster>
			</WithProgressBar>
		</WithReactQuery>
	)
}
