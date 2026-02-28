'use client'

import { Steps } from '@telegram-apps/telegram-ui'

import { useProfileTabStore } from '~widgets/profile'

export default function ProfileSteps() {
	const { tab } = useProfileTabStore()

	return <Steps count={4} progress={tab} />
}
