'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

import { useCreateCasting } from '~models/casting'

import { Markdown, QuillEditor } from '~packages/lib'
import {
	Button,
	FileInput,
	Form,
	FormCard,
	FormRow,
	Input,
	Spacing,
	Title,
} from '~packages/ui'

import { useForm } from '@prostoprobuy/hooks'
import { links } from '@prostoprobuy/links'
import { ICreateCasting, WriteableCastingSchema } from '@prostoprobuy/models'
import { stripTags, tryAsync } from '@prostoprobuy/toolkit'

const defaultValues: ICreateCasting = {
	title: '',
	description: '',
	image: undefined,
}

export function CastingCreate() {
	const req = useCreateCasting()
	const router = useRouter()

	const { register, set, handleSubmit, errors, get } =
		useForm<ICreateCasting>({
			defaultValues,
			resolver: zodResolver(WriteableCastingSchema),
		})

	const onSubmit = async (data: ICreateCasting) => {
		await tryAsync(async () => {
			await req.mutateAsync(data)
			toast.success('Кастинг успешно создан')
			router.replace(links.castings.index)
		})
	}

	return (
		<>
			<Title href={links.castings.index}>Кастинги</Title>
			<Spacing v={'ml'} />
			<FormCard title={'Новый кастинг'}>
				<Form onSubmit={handleSubmit(onSubmit)}>
					<FormRow label={'Обложка кастинга'}>
						<FileInput
							error={errors.image?.message}
							onSelect={file => set('image', file)}
						/>
					</FormRow>

					<FormRow
						label={'Название кастинга'}
						error={errors.title?.message}
						required
					>
						<Input
							error={errors.title?.message}
							placeholder={'Введите название кастинга'}
							{...register('title')}
						/>
					</FormRow>

					<FormRow label={'Описание'} required>
						<QuillEditor
							value={get('description')}
							onChange={value => set('description', value)}
							error={errors.description?.message}
							placeholder={'Укажите описание кастинга'}
						/>
					</FormRow>

					<Spacing v={'xs'} />
					<Button
						type={'submit'}
						loading={req.isPending}
						view={'brand'}
					>
						Создать
					</Button>
				</Form>
			</FormCard>
		</>
	)
}
