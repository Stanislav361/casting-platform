import { IconPencil } from '@tabler/icons-react'
import { PropsWithChildren } from 'react'

import { Card, CardBody, CardTitle } from '~packages/ui'

interface FormCardProps extends PropsWithChildren {
	title: string
	onEdit?: () => void
	justify?: boolean
}

export const FormCard = ({
	title,
	children,
	onEdit,
	justify,
}: FormCardProps) => {
	return (
		<Card radius={'lg'}>
			<CardTitle
				justify={justify}
				action={
					onEdit ? <IconPencil size={22} onClick={onEdit} /> : null
				}
			>
				{title}
			</CardTitle>
			<CardBody>{children}</CardBody>
		</Card>
	)
}
