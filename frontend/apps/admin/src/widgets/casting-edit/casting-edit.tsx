import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'

import {
	useDeleteCastingImage,
	useUpdateCasting,
	WithCasting,
} from '~models/casting'

import { QuillEditor } from '~packages/lib'
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
import {
	CastingStatus,
	IUpdateCasting,
	WriteableCastingSchema,
} from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

export function CastingEdit({ casting }: WithCasting) {
	const req = useUpdateCasting(casting.id)
	const img = useDeleteCastingImage()

	const { register, set, handleSubmit, errors, get } =
		useForm<IUpdateCasting>({
			defaultValues: {
				title: casting.title,
				description: casting.description,
			},
			resolver: zodResolver(WriteableCastingSchema),
		})

	const onSubmit = async (data: IUpdateCasting) => {
		await tryAsync(async () => {
			if (data.image && casting.image[0]?.id) {
				await img.mutateAsync(casting.image[0]?.id)
			}

			await req.mutateAsync(data)

			toast.success('Кастинг успешно изменен')
		})
	}

	return (
		<>
			<Title href={links.castings.byId(casting.id)}>
				{casting.title}
			</Title>
			<Spacing v={'ml'} />
			<FormCard title={'Редактировать кастинг'}>
				<Form onSubmit={handleSubmit(onSubmit)}>
					<FormRow label={'Обложка кастинга'}>
						<FileInput
							file={casting.image[0]?.photo_url}
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
						view={'brand'}
						loading={req.isPending}
						disabled={casting.status !== CastingStatus.unpublished}
					>
						Изменить
					</Button>
				</Form>
			</FormCard>
		</>
	)
}
