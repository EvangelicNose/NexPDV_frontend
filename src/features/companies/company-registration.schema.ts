import { z } from 'zod'

const documentSchema = z.string()
  .trim()
  .min(1, 'Informe o CPF ou CNPJ')
  .refine((value) => /^\d{11}$|^\d{14}$/.test(value.replace(/\D/g, '')), 'Informe um CPF ou CNPJ com 11 ou 14 dígitos')

const optionalEmail = z.string().trim().refine(
  (value) => !value || z.email().safeParse(value).success,
  'Informe um e-mail válido',
)

export const companyRegistrationSchema = z.object({
  legalName: z.string().trim().min(2, 'Informe a razão social').max(160),
  tradeName: z.string().trim().min(2, 'Informe o nome fantasia').max(120),
  document: documentSchema,
  email: z.email('Informe um e-mail válido'),
  phone: z.string().trim().max(20, 'Use no máximo 20 caracteres'),
  establishment: z.object({
    name: z.string().trim().min(2, 'Informe o nome da unidade').max(120),
    code: z.string().trim().min(1, 'Informe o código da unidade').max(30),
    document: z.string().trim().refine(
      (value) => !value || /^\d{11}$|^\d{14}$/.test(value.replace(/\D/g, '')),
      'Informe 11 ou 14 dígitos',
    ),
    email: optionalEmail,
    phone: z.string().trim().max(20, 'Use no máximo 20 caracteres'),
  }),
  owner: z.object({
    name: z.string().trim().min(2, 'Informe seu nome').max(120),
    email: z.email('Informe um e-mail válido'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(128),
    passwordConfirmation: z.string().min(1, 'Confirme sua senha'),
  }),
  acceptTerms: z.boolean().refine((value) => value, 'Você precisa aceitar os termos'),
}).refine((data) => data.owner.password === data.owner.passwordConfirmation, {
  message: 'As senhas não coincidem',
  path: ['owner', 'passwordConfirmation'],
})

export type CompanyRegistrationForm = z.infer<typeof companyRegistrationSchema>
