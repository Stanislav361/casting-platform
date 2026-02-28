'use client'

import { useMemo } from 'react'

import Page from '~widgets/page'
import {
	ProfileContact,
	ProfileInfo,
	ProfileParam,
	ProfileSelf,
	ProfileSteps,
	useProfileTabStore,
} from '~widgets/profile'

export default function Profile() {
	const { tab } = useProfileTabStore()

	const content = useMemo(() => {
		switch (tab) {
			case 1:
				return <ProfileContact />
			case 2:
				return <ProfileInfo />
			case 3:
				return <ProfileParam />
			case 4:
				return <ProfileSelf />
			default:
				return null
		}
	}, [tab])

	return (
		<Page>
			<ProfileSteps />
			{content}
		</Page>
	)
}
