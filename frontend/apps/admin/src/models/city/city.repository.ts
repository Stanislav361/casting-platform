import { http, withPrefix } from '~packages/lib'

import { cityConfig, ICity, UseCities } from '@prostoprobuy/models'
import { ReadonlyRepository } from '@prostoprobuy/toolkit'
import { ListResponse } from '@prostoprobuy/types'

export const CityRepository = new ReadonlyRepository<
	ListResponse<ICity>,
	ICity,
	UseCities
>(http, withPrefix(cityConfig.cities))
