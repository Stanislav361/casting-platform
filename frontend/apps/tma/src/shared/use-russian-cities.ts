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

// Список городов почти не меняется. Раньше каждый экран с фильтром тащил
// 1200 строк через Калифорнию (~2 с / 150 КБ) — на мобильной сети без VPN
// это выглядело как «приложение зависло». Сначала показываем то, что уже есть
// (статика или localStorage), а справочник с сервера подтягиваем фоном.
const CITIES_STORAGE_KEY = 'pp_ru_cities_v1'
const CITIES_STORAGE_AT_KEY = 'pp_ru_cities_v1_at'
const CITIES_REFRESH_MS = 24 * 60 * 60 * 1000

let citiesCache: string[] | null = null
let citiesInFlight: Promise<string[]> | null = null

const readStoredCities = (): string[] | null => {
	if (typeof window === 'undefined') return null
	try {
		const parsed = JSON.parse(window.localStorage.getItem(CITIES_STORAGE_KEY) || 'null')
		if (Array.isArray(parsed) && parsed.length > 50) {
			return parsed.filter((city): city is string => typeof city === 'string' && Boolean(city.trim()))
		}
	} catch {
		// битая запись — просто перезапросим
	}
	return null
}

const storedAt = () => {
	if (typeof window === 'undefined') return 0
	return Number(window.localStorage.getItem(CITIES_STORAGE_AT_KEY) || 0) || 0
}

if (typeof window !== 'undefined' && !citiesCache) {
	citiesCache = readStoredCities()
}

const persistCities = (cities: string[]) => {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(CITIES_STORAGE_KEY, JSON.stringify(cities))
		window.localStorage.setItem(CITIES_STORAGE_AT_KEY, String(Date.now()))
	} catch {
		// quota / private mode
	}
}

const fetchCitiesOnce = (token: string | null): Promise<string[]> => {
	if (citiesCache && Date.now() - storedAt() < CITIES_REFRESH_MS) {
		return Promise.resolve(citiesCache)
	}
	if (citiesInFlight) return citiesInFlight

	// Справочник живёт в разделе tma (см. routers/router_include.py). Без префикса
	// запрос отвечал 404, и список городов молча оставался коротким — из
	// статического набора в casting-dictionaries.
	citiesInFlight = fetch(`${API_URL}tma/cities/?page_size=1200&page_number=1`, {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	})
		.then(res => (res.ok ? res.json() : null))
		.then(data => {
			const fetched = (data?.response || [])
				.map((city: CityResponseItem) => toCityName(city))
				.filter(Boolean)
			const merged = fetched.length
				? mergeCityOptions(fetched, RUSSIAN_CITIES)
				: (citiesCache || RUSSIAN_CITIES)
			citiesCache = merged
			persistCities(merged)
			return merged
		})
		.catch(() => citiesCache || RUSSIAN_CITIES)
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
