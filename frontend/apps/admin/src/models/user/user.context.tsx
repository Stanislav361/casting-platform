'use client'

import { useRouter } from 'next/navigation'
import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react'

import { useCurrentUser } from '~models/user/user.queries'

import { links } from '@prostoprobuy/links'
import { IUser, Roles } from '@prostoprobuy/models'
import { Nullable } from '@prostoprobuy/types'

type UserContextType = {
	isLoading: boolean
	isError: boolean
	isSuccess: boolean
	user: Nullable<IUser>
}

const UserContext = createContext<UserContextType>({
	isLoading: false,
	isError: false,
	isSuccess: false,
	user: null,
})

const accessRoles: string[] = [Roles.administrator, Roles.producer]

export const UserProvider = ({ children }: PropsWithChildren) => {
	const router = useRouter()

	const { isError, isSuccess, isLoading, data } = useCurrentUser()

	const [user, setUser] = useState<Nullable<IUser>>(null)

	useEffect(() => {
		if (!isLoading && data?.data) {
			if (!accessRoles.includes(data.data.role))
				return router.replace(links.accessDenied)

			setUser(data.data)
		}

		if (isError) {
			return router.replace(links.accessDenied)
		}
	}, [data, isLoading, isError])

	const auth = useMemo(
		() => ({
			isLoading,
			isError,
			isSuccess,
			user,
		}),
		[isLoading, isError, isSuccess, user],
	)

	return <UserContext value={auth}>{children}</UserContext>
}

export const useUser = () => {
	const context = useContext(UserContext)
	if (context === undefined) {
		throw new Error('useUser must be used within a UserProvider')
	}
	return context
}
