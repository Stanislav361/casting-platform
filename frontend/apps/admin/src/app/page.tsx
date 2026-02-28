'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { match } from 'ts-pattern'

import { Flex, Spin } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { useCheckAuth } from '@prostoprobuy/models'

export default function HomePage() {
	const router = useRouter()
	const isAuth = useCheckAuth()

	useEffect(() => {
		match(isAuth)
			.with(true, () => router.replace(links.actors.index))
			.with(false, () => router.replace(links.login))
			.exhaustive()
	}, [isAuth])

	return (
		<Flex
			width={'100%'}
			height={'100vh'}
			alignItems={'center'}
			justifyContent={'center'}
		>
			<Spin size={'lg'} />
		</Flex>
	)
}
