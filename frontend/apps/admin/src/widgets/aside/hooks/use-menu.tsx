import { useMemo } from 'react'

import { links } from '@prostoprobuy/links'

import castingImg from '~public/casting.png'
import logoutImg from '~public/logout.png'
import maskImg from '~public/mask.png'
import reportImg from '~public/report.png'
import userImg from '~public/user.png'

export const useMenu = (): MenuItem[] => {
	return useMemo(
		() => [
			{
				name: 'Отчёты',
				ico: reportImg,
				href: links.reports.index,
				actions: [{ href: links.reports.create }],
			},
			{
				name: 'Актёры',
				ico: maskImg,
				href: links.actors.index,
				actions: [{ href: links.actors.create }],
			},
			{
				name: 'Кастинги',
				ico: castingImg,
				href: links.castings.index,
				actions: [{ href: links.castings.create }],
			},
			{
				name: 'Пользователи',
				ico: userImg,
				href: links.users.index,
				actions: [{ href: links.users.create }],
			},
			{
				name: 'Выход',
				ico: logoutImg,
				href: links.login,
			},
		],
		[],
	)
}
