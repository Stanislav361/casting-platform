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
import { getPendingRole } from '~/shared/pending-role'

interface ProcessorProps {
	returnUrl?: string
}

const ADMIN_ROLES = ['owner', 'employer_pro', 'employer', 'administrator', 'manager', 'admin', 'admin_pro']

const getRoleFromToken = (token: string): string => {
	try {
		const rawToken = token.includes(' ') ? token.split(' ').pop() : token
		return JSON.parse(atob(rawToken?.split('.')[1] || '')).role || 'user'
	} catch {
		return 'user'
	}
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
			const role = getRoleFromToken(res.data)
			const pendingRole = getPendingRole()
			if (pendingRole) {
				router.replace('/login/role?auto=1')
				return
			}
			if (target && !ADMIN_ROLES.includes(role)) {
				router.replace(target)
				return
			}
			if (role === 'owner') {
				router.replace('/dashboard/admin')
				return
			}
			router.replace(ADMIN_ROLES.includes(role) ? '/dashboard' : '/actor-home')
		} catch (e) {
			router.replace(links.alert)
		}
	}, [auth, data.start_param, init_str, returnUrl, router])

	useMount(() => {
		handler()
	})

	return <Loader />
}
