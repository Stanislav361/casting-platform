'use client'

import { useEffect, useMemo, useState } from 'react'
import { getToken } from '~/shared/api-client'
import { API_URL } from '~/shared/api-url'
import { RUSSIAN_CITIES } from '~/shared/casting-dictionaries'

type CityResponseItem = {
	name?: string | null
	full_name?: string | null
}

const toCityName = (city: CityResponseItem) => {
	const name = city.name?.trim()
	if (name) return name
	return city.full_name?.split(',')[0]?.trim() || ''
}

export const mergeCityOptions = (...groups: Array<Array<string | null | undefined>>) => {
	const cities = new Set<string>()
	for (const group of groups) {
		for (const city of group) {
			const value = city?.trim()
			if (value) cities.add(value)
		}
	}
	return Array.from(cities).sort((a, b) => a.localeCompare(b, 'ru'))
}

// Список городов статичен в рамках сессии. Кэшируем результат на уровне модуля,
// чтобы не дёргать /cities/ (1200 строк) при каждом открытии формы профиля.
// Под наплывом регистраций это заметно снижает нагрузку на бэкенд.
let citiesCache: string[] | null = null
let citiesInFlight: Promise<string[]> | null = null

const fetchCitiesOnce = (token: string | null): Promise<string[]> => {
	if (citiesCache) return Promise.resolve(citiesCache)
	if (citiesInFlight) return citiesInFlight

	citiesInFlight = fetch(`${API_URL}cities/?page_size=1200&page_number=1`, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	})
		.then(res => (res.ok ? res.json() : null))
		.then(data => {
			const fetched = (data?.response || [])
				.map((city: CityResponseItem) => toCityName(city))
				.filter(Boolean)
			const merged = fetched.length
				? mergeCityOptions(fetched, RUSSIAN_CITIES)
				: RUSSIAN_CITIES
			citiesCache = merged
			return merged
		})
		.catch(() => RUSSIAN_CITIES)
		.finally(() => {
			citiesInFlight = null
		})

	return citiesInFlight
}

export const useRussianCities = (enabled = true, authRequired = true) => {
	const [cities, setCities] = useState<string[]>(citiesCache || RUSSIAN_CITIES)

	useEffect(() => {
		let cancelled = false
		if (!enabled) return undefined
		if (citiesCache) {
			setCities(citiesCache)
			return undefined
		}
		const token = getToken()
		if (authRequired && !token) return undefined

		fetchCitiesOnce(token).then(result => {
			if (!cancelled) setCities(result)
		})

		return () => { cancelled = true }
	}, [enabled, authRequired])

	return useMemo(() => mergeCityOptions(cities), [cities])
}
