import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, LoaderCircle, QrCode, Save } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '../../features/auth/auth-context'
import { getPaymentSettings, updatePaymentSettings, type PaymentSettings, type PixKeyType } from '../../features/payment-settings/payment-settings.api'
import { ApiError } from '../../lib/api'
import { SettingsTabs } from './SettingsTabs'
import './settings.css'

const normalizeReceiver = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const receiver = (limit: number) => z.string().refine(value => normalizeReceiver(value).length <= limit, `Use no máximo ${limit} caracteres.`)
  .refine(value => !value.trim() || (/^[\x20-\x7E]+$/.test(normalizeReceiver(value)) && /[A-Z0-9]/.test(normalizeReceiver(value))), 'Use letras, números e pontuação simples.')
const formSchema = z.object({
  pixKeyType: z.enum(['', 'CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
  pixKey: z.string().max(100, 'Chave muito longa.'),
  pixReceiverName: receiver(25),
  pixReceiverCity: receiver(15),
  pixEnabled: z.boolean(),
}).superRefine((input, ctx) => {
  if (input.pixEnabled) {
    for (const field of ['pixKeyType', 'pixKey', 'pixReceiverName', 'pixReceiverCity'] as const) {
      if (!input[field].trim()) ctx.addIssue({ code: 'custom', path: [field], message: 'Campo obrigatório para habilitar o Pix.' })
    }
  }
  const key = input.pixKey.trim()
  if (!key) return
  const normalized = key.replace(/[.\-/\s]/g, '')
  const formats: Record<PixKeyType, boolean> = {
    CPF: /^\d{11}$/.test(normalized), CNPJ: /^[a-z0-9]{12}\d{2}$/i.test(normalized),
    EMAIL: z.email().safeParse(key).success && key.length <= 77,
    PHONE: /^\+[1-9]\d{1,14}$/.test(key.replace(/[()\s-]/g, '')),
    RANDOM: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key),
  }
  if (!input.pixKeyType || !formats[input.pixKeyType]) ctx.addIssue({ code: 'custom', path: ['pixKey'], message: 'Chave Pix inválida para o tipo selecionado.' })
})
type PixFormValues = z.infer<typeof formSchema>
const keyHints: Record<PixFormValues['pixKeyType'], string> = {
  '': 'Selecione o tipo de chave.', CPF: 'CPF com 11 dígitos.', CNPJ: 'CNPJ com 14 caracteres, numérico ou alfanumérico.',
  EMAIL: 'E-mail cadastrado no banco, com até 77 caracteres.', PHONE: 'Formato internacional, por exemplo: +5511999999999.',
  RANDOM: 'Cole a chave aleatória fornecida pelo banco.',
}

function PixSettingsForm({ settings, canEdit }: { settings: PaymentSettings; canEdit: boolean }) {
  const client = useQueryClient()
  const [saved, setSaved] = useState(false)
  const form = useForm<PixFormValues>({ resolver: zodResolver(formSchema), defaultValues: {
    pixKeyType: settings.pixKeyType ?? '', pixKey: settings.pixKey ?? '', pixReceiverName: settings.pixReceiverName ?? '',
    pixReceiverCity: settings.pixReceiverCity ?? '', pixEnabled: settings.pixEnabled,
  } })
  const save = useMutation({
    mutationFn: (values: PixFormValues) => updatePaymentSettings(settings.establishmentId, {
      pixKeyType: values.pixKeyType || null, pixKey: values.pixKey.trim() || null,
      pixReceiverName: values.pixReceiverName.trim() || null, pixReceiverCity: values.pixReceiverCity.trim() || null, pixEnabled: values.pixEnabled,
    }),
    onSuccess: data => {
      client.setQueryData(['payment-settings', data.companyId, data.establishmentId], data)
      form.reset({ pixKeyType: data.pixKeyType ?? '', pixKey: data.pixKey ?? '', pixReceiverName: data.pixReceiverName ?? '', pixReceiverCity: data.pixReceiverCity ?? '', pixEnabled: data.pixEnabled })
      setSaved(true)
    },
  })
  const keyType = form.watch('pixKeyType')
  return <form className="pix-settings-form" onSubmit={form.handleSubmit(values => { setSaved(false); if (canEdit && !save.isPending) save.mutate(values) })} onChange={() => { setSaved(false); save.reset() }}>
    <fieldset disabled={!canEdit || save.isPending}>
      <div className="pix-settings-fields">
        <label htmlFor="pix-key-type">Tipo de chave Pix<select id="pix-key-type" {...form.register('pixKeyType')} aria-invalid={Boolean(form.formState.errors.pixKeyType)} aria-describedby="pix-key-type-error"><option value="">Selecione o tipo</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option><option value="EMAIL">E-mail</option><option value="PHONE">Telefone</option><option value="RANDOM">Chave aleatória</option></select><small id="pix-key-type-error" className="pix-field-error">{form.formState.errors.pixKeyType?.message}</small></label>
        <label htmlFor="pix-key">Chave Pix<input id="pix-key" autoComplete="off" maxLength={100} {...form.register('pixKey')} aria-invalid={Boolean(form.formState.errors.pixKey)} aria-describedby="pix-key-hint pix-key-error"/><small id="pix-key-hint">{keyHints[keyType]}</small><small id="pix-key-error" className="pix-field-error">{form.formState.errors.pixKey?.message}</small></label>
        <label htmlFor="pix-receiver-name">Nome do recebedor<input id="pix-receiver-name" maxLength={25} {...form.register('pixReceiverName')} aria-invalid={Boolean(form.formState.errors.pixReceiverName)} aria-describedby="pix-name-hint pix-name-error"/><small id="pix-name-hint">Até 25 caracteres. Acentos serão removidos ao salvar.</small><small id="pix-name-error" className="pix-field-error">{form.formState.errors.pixReceiverName?.message}</small></label>
        <label htmlFor="pix-receiver-city">Cidade do recebedor<input id="pix-receiver-city" maxLength={15} {...form.register('pixReceiverCity')} aria-invalid={Boolean(form.formState.errors.pixReceiverCity)} aria-describedby="pix-city-hint pix-city-error"/><small id="pix-city-hint">Até 15 caracteres.</small><small id="pix-city-error" className="pix-field-error">{form.formState.errors.pixReceiverCity?.message}</small></label>
      </div>
      <label className="pix-enabled-toggle" htmlFor="pix-enabled"><input id="pix-enabled" type="checkbox" {...form.register('pixEnabled')}/><span>Habilitar Pix neste estabelecimento</span></label>
    </fieldset>
    {!canEdit && <p className="settings-info">Você pode consultar estas configurações. A alteração exige permissão para editar o estabelecimento.</p>}
    {save.isError && <div className="form-error" role="alert">{save.error instanceof ApiError ? save.error.code === 'VALIDATION_ERROR' ? 'Configurações inválidas. Confira a chave Pix, os dígitos verificadores de CPF/CNPJ e os dados do recebedor.' : save.error.message : 'Não foi possível salvar. Tente novamente.'}</div>}
    {saved && <div className="settings-feedback" role="status">Configurações Pix salvas com sucesso.</div>}
    {canEdit && <footer><button className="primary-button" type="submit" disabled={save.isPending || !form.formState.isDirty}>{save.isPending ? <LoaderCircle size={17} className="spin"/> : <Save size={17}/>} {save.isPending ? 'Salvando...' : 'Salvar configurações'}</button></footer>}
  </form>
}

export function PixSettingsPage() {
  const { session, currentEstablishment } = useAuth()
  const companyId = session?.company?.id
  const id = currentEstablishment?.id
  const canRead = session?.role === 'PLATFORM_ADMIN' || Boolean(session?.permissions?.includes('establishment.read'))
  const canEdit = session?.role === 'PLATFORM_ADMIN' || Boolean(session?.permissions?.includes('establishment.update'))
  const query = useQuery({ queryKey: ['payment-settings', companyId, id], queryFn: () => getPaymentSettings(id!), enabled: Boolean(companyId && id && canRead) })
  return <div className="settings-page page-enter">
    <div className="catalog-heading"><div><span className="eyebrow">Preferências e operação</span><h1>Configurações</h1><p>Gerencie as configurações do seu estabelecimento.</p></div></div>
    <SettingsTabs/>
    <section className="settings-local-panel">
      <header className="settings-local-heading"><span className="settings-icon"><QrCode size={24}/></span><div><h2>Pix</h2><p>Configure os dados de recebimento do estabelecimento.</p></div></header>
      <div className="settings-scope"><strong>{session?.company?.tradeName}</strong><span>{currentEstablishment?.name}</span></div>
      <div className="settings-info"><Info size={18}/><div><p>Confira no aplicativo do banco se a chave está cadastrada e pertence ao recebedor correto. O NexPDV valida o formato, mas não verifica a titularidade da chave.</p></div></div>
      {!canRead ? <div className="form-error" role="alert">Você não tem permissão para consultar as configurações deste estabelecimento.</div> : !id ? <p>Selecione um estabelecimento para configurar o Pix.</p> : query.isLoading ? <p role="status"><LoaderCircle size={17} className="spin"/> Carregando configurações...</p> : query.isError ? <div className="form-error" role="alert">{query.error instanceof ApiError ? query.error.message : 'Não foi possível carregar as configurações.'} <button type="button" onClick={() => void query.refetch()}>Tentar novamente</button></div> : query.data && <PixSettingsForm key={`${companyId}:${id}`} settings={query.data} canEdit={canEdit}/>}
    </section>
  </div>
}
