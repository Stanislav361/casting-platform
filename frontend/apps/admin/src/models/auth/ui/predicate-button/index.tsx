import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import toast from 'react-hot-toast'

import { useAuth, usePredicate } from '~models/auth'

import { Button } from '~packages/ui'

import { links } from '@prostoprobuy/links'
import { login } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export const PredicateButton = () => {
	const router = useRouter()
	const req = usePredicate()
	const auth = useAuth()

	const handleClick = useCallback(async () => {
		await tryAsync(async () => {
			await req.mutateAsync(undefined)

			const res = await auth.mutateAsync({
				id: 0,
				first_name: 'string',
				last_name: 'string',
				username: 'string',
				photo_url: 'string',
				auth_date: 0,
				hash: 'string',
			})

			if (!res.data) toast.error('Ошибка авторизации')

			login({
				access_token: res.data,
			})

			router.replace(links.actors.index)
		})
	}, [req, auth, router])

	return (
		<Button
			width={'max'}
			onClick={handleClick}
			loading={req.isPending}
			view={'danger'}
		>
			DEV авторизация
		</Button>
	)
}
