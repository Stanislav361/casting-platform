'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Caption } from '@telegram-apps/telegram-ui'
import { useRouter } from 'next/navigation'

import { setProfile, setProfileTab, useProfileStore } from '~widgets/profile'

import { WithMainButton } from '~features/shared'

import { CitySelect } from '~models/city'
import { useUpdateProfile } from '~models/profile'

import { tryAsync } from '~packages/lib'
import { FormContainer, FormRow, Input, Select, Textarea } from '~packages/ui'
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
	formatDateInUSA,
	GenderMap,
	isExperienceValidForAge,
	nullable,
	QualificationMap, toUndefined,
} from '@prostoprobuy/toolkit'

type ProfileInfo = Pick<
	IUpdateProfile,
	| 'first_name'
	| 'last_name'
	| 'gender'
	| 'date_of_birth'
	| 'about_me'
	| 'experience'
	| 'qualification'
	| 'city'
>

export default function ProfileInfo() {
	const {
		first_name,
		last_name,
		gender,
		date_of_birth,
		about_me,
		experience,
		qualification,
		city,
	} = useProfileStore()
	const router = useRouter()

	const req = useUpdateProfile()

	const { handleSubmit, register, errors, err, get, set } =
		useForm<ProfileInfo>({
			defaultValues: {
				first_name,
				last_name,
				gender,
				date_of_birth,
				about_me,
				qualification,
				city,
				experience: experience?.toString(),
			},
			resolver: zodResolver(
				WriteableProfileSchema.pick({
					first_name: true,
					last_name: true,
					gender: true,
					date_of_birth: true,
					about_me: true,
					qualification: true,
					experience: true,
					city: true,
				}),
			),
		})

	useMount(() => {
		setProfileTab({
			tab: 2,
		})
	})

	const onSubmit = async (data: ProfileInfo) => {
		await tryAsync(async () => {
			const dfb: Date = formatDateInUSA(
				data.date_of_birth as string,
			) as Date

			const experience = toUndefined(data.experience)

			setProfile({
				...data,
				experience,
				date_of_birth: dfb,
			} as IUpdateProfile)

			await req.mutateAsync({
				...data,
				experience,
				date_of_birth: dfb,
			} as IUpdateProfile)

			router.push(links.profile.param)
		})
	}

	return (
		<WithMainButton
			onClick={handleSubmit(onSubmit)}
			disabled={req.isPending}
			loading={req.isPending}
		>
			<FormContainer title={'Персональная информация'}>
				<FormRow
					header='Фамилия'
					footer={errors.first_name?.message}
					required={true}
				>
					<Input
						type='text'
						error={errors.first_name?.message}
						placeholder=''
						{...register('first_name')}
					/>
				</FormRow>

				<FormRow
					header='Имя'
					footer={errors.last_name?.message}
					required={true}
				>
					<Input
						type='text'
						error={errors.last_name?.message}
						placeholder=''
						{...register('last_name')}
					/>
				</FormRow>

				<FormRow
					header={PhysicalParametersMap[PhysicalParameters.gender]}
					footer={errors.gender?.message}
					required={true}
				>
					<Select
						{...register('gender')}
						error={errors.gender?.message}
					>
						{jsxSelectOptions(GenderMap)}
					</Select>
				</FormRow>

				<FormRow
					required={true}
					header='Дата рождения'
					footer={errors.date_of_birth?.message}
				>
					<Input
						type={'date'}
						error={errors.date_of_birth?.message}
						placeholder=''
						{...register('date_of_birth')}
					/>
				</FormRow>

				<FormRow
					required={true}
					header='Город'
					footer={errors.city?.message}
				>
					<CitySelect
						selected={get('city')}
						onSelect={e => {
							set('city', e)
							err('city', '')
						}}
						error={errors.city?.message}
						{...register('city')}
					/>
				</FormRow>

				<FormRow
					header={
						PhysicalParametersMap[PhysicalParameters.qualification]
					}
					footer={errors.qualification?.message}
					required={true}
				>
					<Select
						{...register('qualification')}
						error={errors.qualification?.message}
					>
						{jsxSelectOptions(QualificationMap)}
					</Select>
				</FormRow>

				<FormRow
					header={
						PhysicalParametersMap[PhysicalParameters.experience]
					}
					footer={errors.experience?.message}
				>
					<Input
						type='number'
						error={errors.experience?.message}
						placeholder=''
						after={<Caption>лет</Caption>}
						{...register('experience')}
					/>
				</FormRow>

				<FormRow header='О себе' footer={errors.about_me?.message}>
					<Textarea
						error={errors.about_me?.message}
						{...register('about_me')}
					/>
				</FormRow>
			</FormContainer>
		</WithMainButton>
	)
}
