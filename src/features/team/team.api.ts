import { apiRequest } from '../../lib/api'
import type { InviteMemberInput, TeamEstablishment, TeamMember, TeamRole } from './team.types'

export function listTeamMembers(filters: { search?: string; status?: string } = {}) {
  const query = new URLSearchParams({ limit: '100' })
  if (filters.search) query.set('search', filters.search)
  if (filters.status) query.set('status', filters.status)
  return apiRequest<TeamMember[]>(`/v1/users?${query}`)
}

export function inviteTeamMember(input: InviteMemberInput) {
  return apiRequest<TeamMember>('/v1/users/invite', { method: 'POST', body: JSON.stringify(input) })
}

export function listTeamRoles() {
  return apiRequest<TeamRole[]>('/v1/roles')
}

export function listTeamEstablishments() {
  return apiRequest<TeamEstablishment[]>('/v1/establishments?limit=100')
}
