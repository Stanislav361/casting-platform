'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { useAuth } from '~models/auth'

import { useInitData, useInitDataRaw } from '~packages/hooks'
import { AUTH_PREFIX, INIT_DATA_RAW } from '~packages/system'
import { Loader } from '~packages/ui'

import { useMount } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { login } from '@prostoprobuy/models'

export const Processor = () => {
	const router = useRouter()

	const data = useInitData()
	const init_str = useInitDataRaw()

	const auth = useAuth()

	const handler = useCallback(async () => {
		try {
			const res = await auth.mutateAsync({
				init_str: `${AUTH_PREFIX} ${data.start_param === 'debug' ? INIT_DATA_RAW : init_str}`,
			})

			if (!res.data) {
				router.replace(links.alert)
				return
			}

			login({
				access_token: res.data,
			})

			router.replace(links.profile.form)
		} catch (e) {
			router.replace(links.alert)
		}
	}, [auth, data.start_param, init_str, router])

	useMount(() => {
		handler()
	})

	return <Loader />
}
