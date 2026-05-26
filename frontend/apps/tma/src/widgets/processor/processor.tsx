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
import { consumePendingReturnUrl } from '~/shared/pending-return-url'

interface ProcessorProps {
	returnUrl?: string
}

export const Processor = ({ returnUrl }: ProcessorProps) => {
	const router = useRouter()

	const data = useInitData()
	const init_str = useInitDataRaw()

	const auth = useAuth()

	const handler = useCallback(async () => {
		const liveInitStr =
			init_str ||
			(typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp?.initData || '' : '')
		try {
			const res = await auth.mutateAsync({
				init_str: `${AUTH_PREFIX} ${data.start_param === 'debug' ? INIT_DATA_RAW : liveInitStr}`,
			})

			if (!res.data) {
				router.replace(links.alert)
				return
			}

			login({
				access_token: res.data,
			})

			const target = returnUrl || consumePendingReturnUrl()
			router.replace(target || links.profile.form)
		} catch (e) {
			router.replace(links.alert)
		}
	}, [auth, data.start_param, init_str, returnUrl, router])

	useMount(() => {
		handler()
	})

	return <Loader />
}
