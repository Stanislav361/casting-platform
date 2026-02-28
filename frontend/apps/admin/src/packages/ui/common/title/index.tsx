'use client'

import { IconArrowLeft } from '@tabler/icons-react'
import cn from 'classnames'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo, PropsWithChildren } from 'react'

import { useMemoizedFn } from '@prostoprobuy/hooks'

import styles from './index.module.scss'

interface TitleProps extends PropsWithChildren {
	href?: string
	back?: boolean
	size?: Size
	className?: string
}

export const Title = memo(({ href, children, className, back }: TitleProps) => {
	const router = useRouter()

	const handleClick = useMemoizedFn(() => {
		router.back()
	})

	return href ? (
		<Link
			href={href}
			className={cn(className, styles.title, styles.title__hover)}
		>
			<IconArrowLeft size={19} />
			{children}
		</Link>
	) : (
		<h1
			className={cn(className, styles.title, back && styles.title__hover)}
			onClick={handleClick}
		>
			{back && <IconArrowLeft size={19} />}
			{children}
		</h1>
	)
})
