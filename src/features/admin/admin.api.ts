import { apiRequest, createCompanyRequest } from '../../lib/api'
import type { AdminCompany, AdminEstablishment, CreateAdminCompanyInput, CreateAdminMemberInput, TeamMember } from './admin.types'

const PLATFORM_CONTEXT_ID = '00000000-0000-4000-8000-000000000000'
const companyHeader = (companyId = PLATFORM_CONTEXT_ID) => ({ companyId })

export function listAdminCompanies(filters: { search?: string; status?: string } = {}) {
  const query = new URLSearchParams({ limit: '100' })
  if (filters.search) query.set('search', filters.search)
  if (filters.status) query.set('status', filters.status)
  return apiRequest<AdminCompany[]>(`/v1/companies?${query}`, { headers: companyHeader() })
}

export function getAdminCompany(companyId: string) {
  return apiRequest<AdminCompany>(`/v1/companies/${companyId}`, { headers: companyHeader(companyId) })
}

export function createAdminCompany(input: CreateAdminCompanyInput) {
  return createCompanyRequest(input)
}

export function listAdminEstablishments(companyId: string) {
  return apiRequest<AdminEstablishment[]>(`/v1/establishments?limit=100&companyId=${companyId}`, { headers: companyHeader(companyId) })
}

export function createAdminEstablishment(companyId: string, input: { name: string; code: string; email?: string; phone?: string }) {
  return apiRequest<AdminEstablishment>('/v1/establishments', { method: 'POST', headers: companyHeader(companyId), body: JSON.stringify({ ...input, companyId }) })
}

export function listAdminMembers(companyId: string) {
  return apiRequest<TeamMember[]>(`/v1/users?limit=100&companyId=${companyId}`, { headers: companyHeader(companyId) })
}

export function createAdminMember(companyId: string, input: CreateAdminMemberInput) {
  return apiRequest<TeamMember>('/v1/users', { method: 'POST', headers: companyHeader(companyId), body: JSON.stringify(input) })
}
