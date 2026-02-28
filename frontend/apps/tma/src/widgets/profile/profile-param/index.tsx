'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Caption } from '@telegram-apps/telegram-ui'
import { useRouter } from 'next/navigation'

import { setProfile, setProfileTab, useProfileStore } from '~widgets/profile'

import { WithMainButton } from '~features/shared'

import { useUpdateProfile } from '~models/profile'

import { tryAsync } from '~packages/lib'
import { FormContainer, FormRow, Input, Select } from '~packages/ui'
import { jsxSelectOptions } from '~packages/utils'

import { useForm, useMount } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import {
	IUpdateProfile,
	PhysicalParameters,
	PhysicalParametersMap,
	WriteableProfileSchema,
} from '@prostoprobuy/models'
import {
	HairColorMap,
	HairLengthMap,
	LookTypeMap,
	QualificationMap,
} from '@prostoprobuy/toolkit'

type ProfileParam = Pick<
	IUpdateProfile,
	| 'height'
	| 'clothing_size'
	| 'shoe_size'
	| 'look_type'
	| 'hair_color'
	| 'hair_length'
	| 'bust_volume'
	| 'waist_volume'
	| 'hip_volume'
>

export default function ProfileParam() {
	const router = useRouter()
	const profile = useProfileStore()
	const req = useUpdateProfile()

	const { handleSubmit, register, errors } = useForm<ProfileParam>({
		defaultValues: {
			height: profile.height?.toString(),
			clothing_size: profile.clothing_size?.toString(),
			shoe_size: profile.shoe_size?.toString(),
			look_type: profile.look_type,
			hair_color: profile.hair_color,
			hair_length: profile.hair_length,
			bust_volume: profile.bust_volume?.toString(),
			waist_volume: profile.waist_volume?.toString(),
			hip_volume: profile.hip_volume?.toString(),
		},
		resolver: zodResolver(
			WriteableProfileSchema.pick({
				height: true,
				clothing_size: true,
				shoe_size: true,
				look_type: true,
				hair_color: true,
				hair_length: true,
				bust_volume: true,
				waist_volume: true,
				hip_volume: true,
			}),
		),
	})

	useMount(() => {
		setProfileTab({
			tab: 3,
		})
	})

	const onSubmit = async (data: ProfileParam) => {
		await tryAsync(async () => {
			setProfile(data)
			await req.mutateAsync({
				...data,
			})
			router.push(links.profile.self)
		})
	}

	return (
		<WithMainButton
			onClick={handleSubmit(onSubmit)}
			loading={req.isPending}
		>
			<FormContainer title={'Физические параметры'}>
				<FormRow
					required={true}
					header={PhysicalParametersMap[PhysicalParameters.height]}
					footer={errors.height?.message}
				>
					<Input
						type='number'
						error={errors.height?.message}
						placeholder=''
						after={<Caption>см</Caption>}
						{...register(PhysicalParameters.height)}
					/>
				</FormRow>

				<FormRow
					required={true}
					header={
						PhysicalParametersMap[PhysicalParameters.clothing_size]
					}
					footer={errors.clothing_size?.message}
				>
					<Input
						type='number'
						error={errors.clothing_size?.message}
						placeholder=''
						after={<Caption>RU</Caption>}
						{...register(PhysicalParameters.clothing_size)}
					/>
				</FormRow>

				<FormRow
					required={true}
					header={PhysicalParametersMap[PhysicalParameters.shoe_size]}
					footer={errors.shoe_size?.message}
				>
					<Input
						type='number'
						error={errors.shoe_size?.message}
						placeholder=''
						after={<Caption>RU</Caption>}
						{...register(PhysicalParameters.shoe_size)}
					/>
				</FormRow>

				<FormRow
					required={true}
					header={PhysicalParametersMap[PhysicalParameters.look_type]}
					footer={errors.look_type?.message}
				>
					<Select
						{...register('look_type')}
						error={errors.look_type?.message}
					>
						{jsxSelectOptions(LookTypeMap)}
					</Select>
				</FormRow>

				<FormRow
					required={true}
					header={
						PhysicalParametersMap[PhysicalParameters.hair_color]
					}
					footer={errors.hair_color?.message}
				>
					<Select
						{...register('hair_color')}
						error={errors.hair_color?.message}
					>
						{jsxSelectOptions(HairColorMap)}
					</Select>
				</FormRow>

				<FormRow
					required={true}
					header={
						PhysicalParametersMap[PhysicalParameters.hair_length]
					}
					footer={errors.hair_length?.message}
				>
					<Select
						{...register('hair_length')}
						error={errors.hair_length?.message}
					>
						{jsxSelectOptions(HairLengthMap)}
					</Select>
				</FormRow>

				<FormRow
					header={
						PhysicalParametersMap[PhysicalParameters.bust_volume]
					}
					footer={errors.bust_volume?.message}
				>
					<Input
						type='number'
						error={errors.bust_volume?.message}
						placeholder=''
						after={<Caption>см</Caption>}
						{...register(PhysicalParameters.bust_volume)}
					/>
				</FormRow>

				<FormRow
					header={
						PhysicalParametersMap[PhysicalParameters.waist_volume]
					}
					footer={errors.waist_volume?.message}
				>
					<Input
						type='number'
						error={errors.waist_volume?.message}
						placeholder=''
						after={<Caption>см</Caption>}
						{...register(PhysicalParameters.waist_volume)}
					/>
				</FormRow>

				<FormRow
					header={
						PhysicalParametersMap[PhysicalParameters.hip_volume]
					}
					footer={errors.hip_volume?.message}
				>
					<Input
						type='number'
						error={errors.hip_volume?.message}
						placeholder=''
						after={<Caption>см</Caption>}
						{...register(PhysicalParameters.hip_volume)}
					/>
				</FormRow>
			</FormContainer>
		</WithMainButton>
	)
}
