'use client'

import { IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react'
import cn from 'classnames'
import { useCallback, useEffect, useState } from 'react'

import { Flex, Skeleton } from '~packages/ui'

import styles from './index.module.scss'
import PaginationItem from './pagination-item'
import { useDeviceDetect } from '~packages/hooks'

export interface PaginationProps {
	isLoading?: boolean
	page?: number
	total: number
	limit?: number
	midSize?: number
	position?: 'left' | 'right' | 'center'
	onPageChange: (page: number) => void
}

export const Pagination = ({
	total,
	page = 1,
	midSize = 2,
	limit = 25,
	position = 'center',
	onPageChange,
	isLoading,
}: PaginationProps) => {
	const { isMobile } = useDeviceDetect()

	const [positionStyle, setPositionStyle] = useState(
		styles.pagination__center,
	)
	const [countPages, setCountPages] = useState(Math.ceil(total / limit))

	useEffect(() => {
		if (position === 'left') setPositionStyle(styles.pagination__left)
		if (position === 'right') setPositionStyle(styles.pagination__right)
	}, [position])

	useEffect(() => {
		setCountPages(Math.ceil(total / limit))
	}, [total, limit])

	const pageHandler = useCallback(
		(page: number) => {
			onPageChange(page)
		},
		[onPageChange],
	)

	const renderLeftPages = useCallback(() => {
		const pages: JSX.Element[] = []

		for (let i = midSize; i > 0; i--) {
			if (page - i > 0) {
				pages.push(
					<PaginationItem
						key={i}
						onClick={() => pageHandler(page - i)}
					>
						{page - i}
					</PaginationItem>,
				)
			}
		}

		return pages.length > 0 ? pages : null
	}, [midSize, page, pageHandler])

	const renderRightPages = useCallback(() => {
		const pages: JSX.Element[] = []

		for (let i = 1; i <= midSize; i++) {
			if (page + i <= countPages) {
				pages.push(
					<PaginationItem
						key={i}
						onClick={() => pageHandler(page + i)}
					>
						{page + i}
					</PaginationItem>,
				)
			}
		}

		return pages.length > 0 ? pages : null
	}, [midSize, page, countPages, pageHandler])

	return (
		<Flex alignItems={'center'} justifyContent={'space-between'} gap={isMobile && 16} flexDirection={isMobile ? 'column' : 'row'}>
			<div className={styles.paginationText}>Всего {total}</div>
			{
				<ul className={cn(styles.pagination, positionStyle)}>
					{isLoading ? (
						<></>
					) : (
						<>
							{page > midSize + 1 && (
								<PaginationItem
									data-page={1}
									onClick={() => pageHandler(1)}
								>
									<IconChevronsLeft size={21} />
								</PaginationItem>
							)}

							{renderLeftPages()}

							<PaginationItem data-page={page} active={true}>
								{page}
							</PaginationItem>

							{renderRightPages()}

							{page < countPages - midSize - 1 && <li>...</li>}

							{page < countPages - midSize && (
								<PaginationItem
									data-page={countPages}
									onClick={() => pageHandler(countPages)}
								>
									{countPages}
								</PaginationItem>
							)}

							{page < countPages && (
								<PaginationItem
									data-page={page + 1}
									onClick={() => pageHandler(page + 1)}
								>
									<IconChevronsRight size={21} />
								</PaginationItem>
							)}
						</>
					)}
				</ul>
			}
		</Flex>
	)
}
