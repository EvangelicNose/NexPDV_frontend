import { apiRequest } from '../../lib/api'
import type { ReportExport, ReportFilters, ReportOverview } from './reports.types'

const queryOf = (input: ReportFilters) => new URLSearchParams({
  establishmentId: input.establishmentId,
  from: input.from,
  to: input.to,
  topProductsLimit: String(input.topProductsLimit ?? 10),
})

export const getReportOverview = (input: ReportFilters) =>
  apiRequest<ReportOverview>(`/v1/reports/overview?${queryOf(input)}`)

export const createReportExport = (input: ReportFilters) =>
  apiRequest<{ jobId: string; status: string }>('/v1/reports/exports', {
    method: 'POST',
    body: JSON.stringify(input),
  })

export const getReportExport = (jobId: string) =>
  apiRequest<ReportExport>(`/v1/reports/exports/${encodeURIComponent(jobId)}`)
