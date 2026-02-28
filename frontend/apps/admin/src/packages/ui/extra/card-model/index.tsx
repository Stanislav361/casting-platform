import { PropsWithChildren, ReactNode } from 'react'

import { Card, CardImage, Flex, Spacing } from '~packages/ui'

import styles from './index.module.scss'

interface CardModelProps extends PropsWithChildren {
	image: ImageData
	imageAlt?: string
	imageWidth?: number
	imageHeight?: number
	actions?: ReactNode
	checkbox?: ReactNode
}

export const CardModel = ({
	image,
	imageAlt,
	checkbox,
	actions,
	children,
	imageHeight,
	imageWidth,
}: CardModelProps) => {
	return (
		<Card radius={'lg'} fullWidth={true} className={styles.card__model}>
			<CardImage
				height={imageHeight}
				width={imageWidth}
				src={image}
				alt={imageAlt || ''}
				borderRadius={24}
			/>
			<Flex
				flexDirection={'column'}
				flex={1}
				padding={'20px 24px 20px 0'}
				gap={14}
			>
				{checkbox && (
					<div className={styles.checkbox__box}>{checkbox}</div>
				)}
				{children}
				{actions && (
					<div className={styles.actions__box}>
						<Spacing v={'xs'} />
						<Flex
							alignItems={'center'}
							gap={10}
							justifyContent={'end'}
						>
							{actions}
						</Flex>
						<Spacing v={'xs'} />
					</div>
				)}
			</Flex>
		</Card>
	)
}
