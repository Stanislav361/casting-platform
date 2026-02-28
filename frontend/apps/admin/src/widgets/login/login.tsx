import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

import { BodyCard, TelegramAuth } from '~features/shared'

import { PredicateButton, useAuth } from '~models/auth'

import { links } from '@prostoprobuy/links'
import { login, TelegramAuthData } from '@prostoprobuy/models'
import { IS_DEV } from '@prostoprobuy/system'
import { tryAsync } from '@prostoprobuy/toolkit'

export const Login = () => {
	const router = useRouter()
	const req = useAuth()

	const onLogin = async (data: TelegramAuthData) => {
		if (!data) {
			toast.success('Теперь вы можете войти в систему')
			return
		}

		await tryAsync(async () => {
			const res = await req.mutateAsync(data)

			if (res.status !== 200 || !res.data) {
				toast.error('Ошибка авторизации')
				return
			}

			login({
				access_token: res.data,
			})

			router.replace(links.actors.index)
		})
	}

	const onError = async (error) => {
		console.error(error)
		toast.error("Ошибка авторизации")
	}

	return (
		<BodyCard
			title={'Вход в систему'}
			description={'Войдите через Telegram для доступа к админ панели'}
		>
			<TelegramAuth onLogin={onLogin} onError={onError} />
			{IS_DEV && <PredicateButton />}
		</BodyCard>
	)
}
