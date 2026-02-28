import { useMutation } from '@tanstack/react-query'

import {
	ProducerReportRepository,
	ReportRepository,
} from '~models/report/report.repository'

import {
	ICreateReport,
	IProducerReportFavorite,
	IUpdateReport,
	IWriteableReportActor,
	reportConfig,
	ReportID,
	ReportPublicID,
} from '@prostoprobuy/models'
import { optimisticInvalidateQueries } from '@prostoprobuy/toolkit'

export const useCreateReport = () => {
	return useMutation({
		mutationFn: (data: ICreateReport) => ReportRepository.create(data),
		onSettled: async () => {
			await optimisticInvalidateQueries([[reportConfig.reports]])
		},
	})
}

export const useUpdateReport = (id: ReportID) => {
	return useMutation({
		mutationFn: (data: IUpdateReport) => ReportRepository.update(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.reports],
				[reportConfig.reportsActors],
				[reportConfig.reportsActorsIds],
				[reportConfig.report, id],
			])
		},
	})
}

export const useDeleteReport = () => {
	return useMutation({
		mutationFn: (id: ReportID) => ReportRepository.delete(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.reports],
				[reportConfig.reportsActors],
				[reportConfig.reportsActorsIds],
			])
		},
	})
}

export const useGenerateReport = (id: ReportID) => {
	return useMutation({
		mutationFn: () => ReportRepository.generate(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.reports],
				[reportConfig.reportsActors],
				[reportConfig.reportsActorsIds],
				[reportConfig.report, id],
			])
		},
	})
}

export const useUpdateReportActors = (id: ReportID) => {
	return useMutation({
		mutationFn: (data: IWriteableReportActor) =>
			ReportRepository.editActors(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.reports],
				[reportConfig.reportsActors],
				[reportConfig.reportsActorsIds],
				[reportConfig.report, id],
			])
		},
	})
}

export const useDeleteReportActors = (id: ReportID) => {
	return useMutation({
		mutationFn: (data: IWriteableReportActor) =>
			ReportRepository.deleteActors(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.reports],
				[reportConfig.reportsActors],
				[reportConfig.reportsActorsIds],
				[reportConfig.report, id],
			])
		},
	})
}

export const useDeleteReportFullActors = (id: ReportID) => {
	return useMutation({
		mutationFn: () => ReportRepository.deleteFullActors(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.reports],
				[reportConfig.reportsActors],
				[reportConfig.reportsActorsIds],
				[reportConfig.report, id],
			])
		},
	})
}

export const useCreateReportActorFavorite = (id: ReportPublicID) => {
	return useMutation({
		mutationFn: (data: IProducerReportFavorite) =>
			ProducerReportRepository.createFavorite(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.producerReports],
				[reportConfig.producerActors],
			])
		},
	})
}

export const useDeleteReportActorFavorite = (id: ReportPublicID) => {
	return useMutation({
		mutationFn: (data: IProducerReportFavorite) =>
			ProducerReportRepository.deleteFavorite(id, data),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.producerReports],
				[reportConfig.producerActors],
			])
		},
	})
}

export const useClearReportActorFavorites = (id: ReportPublicID) => {
	return useMutation({
		mutationFn: () => ProducerReportRepository.clearFavorites(id),
		onSettled: async () => {
			await optimisticInvalidateQueries([
				[reportConfig.producerReports],
				[reportConfig.producerActors],
			])
		},
	})
}
