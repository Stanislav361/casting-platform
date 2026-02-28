import { persist } from 'effector-storage/local'

import { IUpdateProfile } from '@prostoprobuy/models'
import { createModelApi } from '@prostoprobuy/toolkit'
import {
	Gender,
	HairColor,
	HairLength,
	LookType,
	Qualification,
} from '@prostoprobuy/types'

export const { setModel: setProfile, $store: $profile } = createModelApi<
	Partial<IUpdateProfile>
>({
	first_name: null,
	last_name: null,
	gender: Gender.male,
	look_type: LookType.asian,
	hair_color: HairColor.blonde,
	hair_length: HairLength.short,
	qualification: Qualification.professional,
	date_of_birth: null,
	phone_number: null,
	email: null,
	about_me: null,
})

persist({
	store: $profile,
	key: 'profile-storage',
})

type ProfileTab = {
	tab: 1 | 2 | 3 | 4
}

export const { setModel: setProfileTab, $store: $profileTab } =
	createModelApi<ProfileTab>({
		tab: 1,
	})

persist({
	store: $profileTab,
	key: 'profile-tab-storage',
})
