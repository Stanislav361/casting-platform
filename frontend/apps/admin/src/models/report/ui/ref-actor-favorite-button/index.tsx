import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import toast from 'react-hot-toast'

import {
	useCreateReportActorFavorite,
	useDeleteReportActorFavorite,
} from '~models/report'

import { Button } from '~packages/ui'

import { WithActorID, WithReportPublicID } from '@prostoprobuy/models'
import { tryAsync } from '@prostoprobuy/toolkit'

import styles from './index.module.scss'

interface RefActorFavoriteButtonProps extends WithActorID, WithReportPublicID {
	favorite: boolean
}

export const RefActorFavoriteButton = ({
	actor,
	favorite,
	report,
}: RefActorFavoriteButtonProps) => {
	const add = useCreateReportActorFavorite(report)
	const remove = useDeleteReportActorFavorite(report)

	const handleClick = async () => {
		if (favorite) {
			await tryAsync(async () => {
				await remove.mutateAsync({ actor_id: actor })
				toast.success('Успешно удалено')
			})
		} else {
			await tryAsync(async () => {
				await add.mutate({ actor_id: actor })
				toast.success('Успешно добавлено')
			})
		}
	}

	return (
		<Button
			onClick={handleClick}
			loading={add.isPending || remove.isPending}
			view={'overlay'}
			width={'auto'}
			className={styles.favoriteButton}
		>
			{favorite ? (
				<IconHeartFilled size={20} color={'var(--color-error)'} />
			) : (
				<IconHeart size={20} color={'var(--color-white)'} />
			)}
		</Button>
	)
}
