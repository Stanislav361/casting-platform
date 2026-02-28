import { PropsWithChildren } from 'react'

import { PublicLayout as PublicWidgetLayout } from '~widgets/layouts'

export default function PublicLayout({
	children,
}: Readonly<PropsWithChildren>) {
	return <PublicWidgetLayout>{children}</PublicWidgetLayout>
}
