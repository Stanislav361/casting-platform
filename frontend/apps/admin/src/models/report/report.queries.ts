import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useUnit } from 'effector-react'

import { $producerReport } from '~models/report/report.atom'
import {
	ProducerReportRepository,
	ReportRepository,
} from '~models/report/report.repository'

import {
	ActorID,
	Formation,
	reportConfig,
	ReportID,
	ReportPublicID,
	UseProducerReportActors,
	UseReportActors,
	UseReports,
} from '@prostoprobuy/models'

export const useReports = (params?: Partial<UseReports>) => {
	return useQuery({
		queryKey: [reportConfig.reports, params],
		queryFn: () => ReportRepository.all(params),
		placeholderData: keepPreviousData,
	})
}

export const useReport = (id: ReportID, params?: Partial<UseReportActors>) => {
	return useQuery({
		queryKey: [reportConfig.report, id, params],
		queryFn: () => ReportRepository.getById(id, params),
		enabled: !!id,
	})
}

export const useFullReport = (
	id: ReportID,
	params?: Partial<UseReportActors>,
) => {
	return useQuery({
		queryKey: [reportConfig.report, id, params],
		queryFn: () => ReportRepository.getFullById(id, params),
		enabled: !!id,
	})
}

export const useReportWidget = (id: ReportID) => {
	return useQuery({
		queryKey: [reportConfig.report, id],
		queryFn: () => ReportRepository.getById(id),
		enabled: !!id,
	})
}

export const useReportActors = (
	id: ReportID,
	params?: Partial<UseReportActors>,
) => {
	return useQuery({
		queryKey: [reportConfig.reportsActors, params],
		queryFn: () => ReportRepository.getActors(id, params),
		placeholderData: keepPreviousData,
		enabled: !!id,
	})
}

export const useReportActorsIds = (
	id: ReportID,
	params?: Partial<UseReportActors>,
) => {
	return useQuery({
		queryKey: [reportConfig.reportsActorsIds, params],
		queryFn: () => ReportRepository.getActorsIds(id, params),
		placeholderData: keepPreviousData,
		enabled: !!id,
	})
}

export const useProducerReportActors = (
	public_id: ReportPublicID,
	params?: Partial<UseProducerReportActors>,
) => {
	return useQuery({
		queryKey: [reportConfig.producerReports, params],
		queryFn: () => ProducerReportRepository.getActors(public_id, params),
		placeholderData: keepPreviousData,
		enabled: !!public_id,
	})
}

export const useProducerReportActor = (id: ActorID) => {
	return useQuery({
		queryKey: [reportConfig.producerActors, id],
		queryFn: () => ProducerReportRepository.getActor(id),
		placeholderData: keepPreviousData,
		enabled: !!id,
	})
}

export const useProducerReportStore = () => useUnit($producerReport)
