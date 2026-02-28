import { CastingChip, CastingTags, WithCasting } from '~models/casting'

import { CardImage, Flex, Group, Title } from '~packages/ui'

import image from '~public/view-placeholder.png'

export default function CastingHeader({ casting }: WithCasting) {
	return (
		<Flex justifyContent={'space-between'}>
			<Flex gap={24}>
				<CardImage
					src={casting.image[0]?.photo_url || image}
					alt={casting.title}
					width={231}
					height={218}
				/>
				<Group>
					<Title>
						Кастинг для фильма <br /> "{casting.title}"
					</Title>
					<CastingTags
						closed_at={casting.closed_at}
						response_quantity={casting.response_quantity}
						published_at={casting.published_at}
						created_at={casting.created_at}
					/>
				</Group>
			</Flex>
			<CastingChip status={casting.status} size={'md'} />
		</Flex>
	)
}
