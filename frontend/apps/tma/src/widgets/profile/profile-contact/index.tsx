'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Section } from '@telegram-apps/telegram-ui'
import { useRouter } from 'next/navigation'

import { setProfile, setProfileTab, useProfileStore } from '~widgets/profile'

import { WithMainButton } from '~features/shared'

import { useUpdateProfile } from '~models/profile'

import { tryAsync } from '~packages/lib'
import { FormContainer, FormRow, Input, PhoneInput } from '~packages/ui'

import { useForm, useMount } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { IUpdateProfile, WriteableProfileSchema } from '@prostoprobuy/models'
import { nullable } from '@prostoprobuy/toolkit'

type ProfileContact = Pick<IUpdateProfile, 'email' | 'phone_number'>

export default function ProfileContact() {
	const { email, phone_number } = useProfileStore()
	const router = useRouter()

	const req = useUpdateProfile()

	const { handleSubmit, register, errors } = useForm<ProfileContact>({
		defaultValues: {
			email,
			phone_number,
		},
		resolver: zodResolver(
			WriteableProfileSchema.pick({
				email: true,
				phone_number: true,
			}),
		),
	})

	useMount(() => {
		setProfileTab({
			tab: 1,
		})
	})

	const onSubmit = async (data: ProfileContact) => {
		await tryAsync(async () => {
			setProfile({
				...data,
			})

			await req.mutateAsync({
				...data,
				email: nullable(data.email),
			})

			router.replace(links.profile.info)
		})
	}

	return (
		<WithMainButton
			onClick={handleSubmit(onSubmit)}
			disabled={req.isPending}
			loading={req.isPending}
		>
			<FormContainer title={'Контактная информация'}>
				<FormRow
					required={true}
					header={'Номер телефона'}
					footer={errors.phone_number?.message}
				>
					<PhoneInput
						inputMode={'tel'}
						placeholder='+79999999999'
						error={errors.phone_number?.message}
						{...register('phone_number')}
					/>
				</FormRow>

				<FormRow header='E-mail' footer={errors.email?.message}>
					<Input
						type='email'
						inputMode={'email'}
						placeholder='example@mail.ru'
						error={errors.email?.message}
						{...register('email')}
					/>
				</FormRow>
			</FormContainer>
		</WithMainButton>
	)
}
