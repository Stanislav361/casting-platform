import { PropsWithChildren } from 'react'
import { Toaster } from 'react-hot-toast'

const WithToaster = ({ children }: PropsWithChildren) => {
	return (
		<>
			{children}
			<Toaster
				position={'bottom-right'}
				reverseOrder={false}
				containerStyle={{
					fontFamily: 'var(--font-noto-sans)',
				}}
			/>
		</>
	)
}

export default WithToaster
