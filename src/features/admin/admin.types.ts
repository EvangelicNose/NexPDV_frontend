import type { TeamMember, TeamRoleCode } from '../team/team.types'

export type AdminCompany = {
  id: string
  legalName: string
  tradeName: string
  document: string
  email: string
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  timezone: string
  currency: string
  createdAt: string
}

export type AdminEstablishment = {
  id: string
  companyId: string
  name: string
  code: string
  email: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  timezone: string
}

export type CreateAdminCompanyInput = {
  legalName: string
  tradeName: string
  document: string
  email: string
  phone?: string
  timezone: string
  currency: string
  establishment: { name: string; code: string }
  owner: { name: string; email: string; password: string }
}

export type CreateAdminMemberInput = {
  companyId: string
  name: string
  email: string
  password: string
  role: TeamRoleCode
  establishmentIds: string[]
}

export type { TeamMember }
