import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Building2, Check, Eye, EyeOff, LoaderCircle, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Logo } from '../components/brand/Logo'
import { useAuth } from '../features/auth/auth-context'
import { companyRegistrationSchema, type CompanyRegistrationForm } from '../features/companies/company-registration.schema'
import { ApiError, createCompanyRequest } from '../lib/api'

const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function CompanyRegistrationPage() {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CompanyRegistrationForm>({
    resolver: zodResolver(companyRegistrationSchema),
    defaultValues: {
      legalName: '', tradeName: '', document: '', email: '', phone: '',
      establishment: { name: 'Matriz', code: 'MATRIZ', document: '', email: '', phone: '' },
      owner: { name: '', email: '', password: '', passwordConfirmation: '' },
      acceptTerms: false,
    },
  })

  if (session) return <Navigate to="/" replace />

  const submit = handleSubmit(async (values) => {
    setServerError('')
    try {
      await createCompanyRequest({
        legalName: values.legalName.trim(),
        tradeName: values.tradeName.trim(),
        document: onlyDigits(values.document),
        email: values.email.trim().toLowerCase(),
        ...(values.phone.trim() && { phone: values.phone.trim() }),
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        establishment: {
          name: values.establishment.name.trim(),
          code: values.establishment.code.trim().toUpperCase(),
          ...(values.establishment.document && { document: onlyDigits(values.establishment.document) }),
          ...(values.establishment.email.trim() && { email: values.establishment.email.trim().toLowerCase() }),
          ...(values.establishment.phone.trim() && { phone: values.establishment.phone.trim() }),
        },
        owner: {
          name: values.owner.name.trim(),
          email: values.owner.email.trim().toLowerCase(),
          password: values.owner.password,
        },
      })
      await login({ email: values.owner.email.trim().toLowerCase(), password: values.owner.password })
      navigate('/', { replace: true })
    } catch (reason) {
      setServerError(reason instanceof ApiError ? reason.message : 'Não foi possível concluir o cadastro. Verifique a conexão e tente novamente.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  })

  return <main className="registration-page">
    <header className="registration-header"><Logo /><Link to="/login"><ArrowLeft size={16} /> Voltar para o login</Link></header>
    <div className="registration-layout">
      <aside className="registration-aside">
        <span className="eyebrow light">Comece agora</span>
        <h1>Seu negócio pronto para operar.</h1>
        <p>Cadastre a empresa, a primeira unidade e seu acesso de proprietário em poucos minutos.</p>
        <ol>
          <li><span><Building2 size={18} /></span><div><strong>Dados da empresa</strong><small>Informações fiscais e de contato</small></div></li>
          <li><span><MapPin size={18} /></span><div><strong>Primeira unidade</strong><small>O local onde sua operação começa</small></div></li>
          <li><span><UserRound size={18} /></span><div><strong>Seu acesso</strong><small>Conta com perfil de proprietário</small></div></li>
        </ol>
        <div className="registration-security"><ShieldCheck size={19} /><span><strong>Cadastro seguro</strong><small>Seus dados são enviados diretamente à API do NexPDV.</small></span></div>
      </aside>
      <section className="registration-card">
        <div className="registration-title"><span className="eyebrow">Nova conta</span><h2>Crie sua empresa</h2><p>Os campos marcados com * são obrigatórios.</p></div>
        {serverError && <div className="form-error registration-error" role="alert">{serverError}</div>}
        <form onSubmit={submit} noValidate>
          <fieldset><legend><span>1</span><div>Empresa<small>Dados principais do negócio</small></div></legend>
            <div className="form-grid">
              <Field label="Razão social" error={errors.legalName?.message} wide><input {...register('legalName')} autoComplete="organization" placeholder="Restaurante Exemplo Ltda." /></Field>
              <Field label="Nome fantasia" error={errors.tradeName?.message}><input {...register('tradeName')} placeholder="Restaurante Exemplo" /></Field>
              <Field label="CPF ou CNPJ" error={errors.document?.message}><input {...register('document')} inputMode="numeric" placeholder="00.000.000/0001-00" /></Field>
              <Field label="E-mail da empresa" error={errors.email?.message}><input {...register('email')} type="email" placeholder="contato@empresa.com.br" /></Field>
              <Field label="Telefone" optional error={errors.phone?.message}><input {...register('phone')} type="tel" placeholder="(11) 99999-9999" /></Field>
            </div>
          </fieldset>
          <fieldset><legend><span>2</span><div>Primeira unidade<small>Você poderá adicionar outras depois</small></div></legend>
            <div className="form-grid">
              <Field label="Nome da unidade" error={errors.establishment?.name?.message}><input {...register('establishment.name')} placeholder="Matriz" /></Field>
              <Field label="Código" error={errors.establishment?.code?.message}><input {...register('establishment.code')} placeholder="MATRIZ" /></Field>
              <Field label="CPF ou CNPJ" optional error={errors.establishment?.document?.message}><input {...register('establishment.document')} inputMode="numeric" placeholder="Se diferente da empresa" /></Field>
              <Field label="E-mail" optional error={errors.establishment?.email?.message}><input {...register('establishment.email')} type="email" placeholder="unidade@empresa.com.br" /></Field>
              <Field label="Telefone" optional error={errors.establishment?.phone?.message}><input {...register('establishment.phone')} type="tel" placeholder="(11) 99999-9999" /></Field>
            </div>
          </fieldset>
          <fieldset><legend><span>3</span><div>Proprietário<small>Use estes dados para entrar no NexPDV</small></div></legend>
            <div className="form-grid">
              <Field label="Nome completo" error={errors.owner?.name?.message} wide><input {...register('owner.name')} autoComplete="name" placeholder="Seu nome" /></Field>
              <Field label="E-mail de acesso" error={errors.owner?.email?.message} wide><input {...register('owner.email')} type="email" autoComplete="email" placeholder="voce@empresa.com.br" /></Field>
              <Field label="Senha" error={errors.owner?.password?.message}><div className="password-field"><input {...register('owner.password')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></Field>
              <Field label="Confirmar senha" error={errors.owner?.passwordConfirmation?.message}><input {...register('owner.passwordConfirmation')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repita sua senha" /></Field>
            </div>
          </fieldset>
          <label className={`terms-check ${errors.acceptTerms ? 'has-error' : ''}`}><input {...register('acceptTerms')} type="checkbox" /><span><Check size={13} /> </span><p>Li e aceito os <a href="#termos">Termos de Uso</a> e a <a href="#privacidade">Política de Privacidade</a>.</p></label>
          {errors.acceptTerms?.message && <small className="field-error terms-error">{errors.acceptTerms.message}</small>}
          <button className="primary-button registration-submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={20} /> Criando sua empresa...</> : <>Criar empresa e acessar <ArrowRight size={19} /></>}</button>
        </form>
        <p className="registration-login">Já possui uma empresa? <Link to="/login">Entrar no NexPDV</Link></p>
      </section>
    </div>
  </main>
}

function Field({ label, optional, error, wide, children }: { label: string; optional?: boolean; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`registration-field ${wide ? 'field-wide' : ''} ${error ? 'has-error' : ''}`}><span>{label} {optional ? <small>Opcional</small> : <b>*</b>}</span>{children}{error && <small className="field-error">{error}</small>}</label>
}
