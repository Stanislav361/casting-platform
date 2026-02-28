'use client'

import { IconArrowLeft } from '@tabler/icons-react'
import cn from 'classnames'
import { useRouter } from 'next/navigation'
import { PropsWithChildren, ReactNode, useMemo } from 'react'

import { Flex } from '~packages/ui'

import styles from './index.module.scss'

interface CardTitleProps extends PropsWithChildren {
	size?: Size
	caption?: ReactNode
	justify?: boolean
	action?: ReactNode
	backHref?: string
}

export const CardTitle = ({
	children,
	action,
	justify,
	caption,
	backHref,
}: CardTitleProps) => {
	const router = useRouter()

	const header = useMemo(
		() => (
			<Flex flexDirection={'column'} gap={3}>
				<h2>{children}</h2>
				{caption}
			</Flex>
		),
		[children, caption],
	)

	const handleBack = () => router.replace(backHref)

	return (
		<div
			className={cn(
				styles.card__title,
				justify && styles.card__title__justify,
			)}
		>
			{backHref ? (
				<Flex
					gap={12}
					alignItems={'center'}
					onClick={handleBack}
					cursor={'pointer'}
				>
					<IconArrowLeft size={26} /> {header}
				</Flex>
			) : (
				header
			)}
			{action}
		</div>
	)
}
