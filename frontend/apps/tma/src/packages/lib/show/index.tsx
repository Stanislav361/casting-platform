import { PropsWithChildren, ReactNode } from 'react'

interface ShowProps extends PropsWithChildren {
	when: undefined | null | boolean
	fallback: ReactNode
}

export const Show = ({ when, fallback, children }: ShowProps) => {
	return when ? children : fallback
}
