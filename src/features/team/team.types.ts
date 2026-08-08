export type TeamRoleCode = 'COMPANY_OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN'

export type TeamMember = {
  id: string
  name: string
  email: string
  active: boolean
  role: TeamRoleCode
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED'
  establishments: Array<{ id: string; name: string; code: string }>
  createdAt: string
}

export type TeamRole = {
  id: string
  code: TeamRoleCode
  name: string
  description: string | null
  system: boolean
  permissions: string[]
}

export type TeamEstablishment = {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  address: { city?: string; state?: string } | null
}

export type InviteMemberInput = {
  name: string
  email: string
  role: TeamRoleCode
  establishmentIds: string[]
}
