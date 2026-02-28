import { PropsWithChildren } from 'react'

import WithAppRoot from './with-app-root'
import WithReactQuery from './with-react-query'

export const WithProviders = ({ children }: PropsWithChildren) => {
	return (
		<WithReactQuery>
			<WithAppRoot>{children}</WithAppRoot>
		</WithReactQuery>
	)
}
