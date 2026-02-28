import { PropsWithChildren } from 'react'

import { HomeLayout } from '~widgets/layouts'

import { UserProvider } from '~models/user'

export default function WorkspaceLayout({
	children,
}: Readonly<PropsWithChildren>) {
	return (
		<UserProvider>
			<HomeLayout>{children}</HomeLayout>
		</UserProvider>
	)
}
