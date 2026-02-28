import { Chip, ChipProps, Flex } from '~packages/ui'

interface ChipListProps {
	size?: Size
	chipsVariant?: ChipVariant
	chips: ChipProps[]
}

export const ChipList = ({ chips, size, chipsVariant }: ChipListProps) => {
	return (
		<Flex alignItems={'center'} gap={8} flexWrap={'wrap'}>
			{chips.map(
				(
					{
						startContent,
						value,
						variant,
						hoverable,
						href,
						endContent,
					},
					index,
				) =>
					value && (
						<Chip
							key={index}
							size={size}
							variant={variant || chipsVariant}
							hoverable={hoverable}
							href={href}
							startContent={startContent}
							endContent={endContent}
						>
							{value}
						</Chip>
					),
			)}
		</Flex>
	)
}
