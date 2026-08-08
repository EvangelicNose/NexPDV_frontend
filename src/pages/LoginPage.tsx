import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/brand/Logo'
import { useAuth } from '../features/auth/auth-context'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  if (session) return <Navigate to="/" replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      const authenticated = await login({ email, password })
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      if (authenticated.role === 'PLATFORM_ADMIN') navigate('/admin', { replace: true })
      else if (authenticated.activeEstablishmentId) navigate(from ?? '/', { replace: true })
      else navigate('/selecionar-unidade', { replace: true, state: { from } })
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Não foi possível conectar ao servidor.')
    } finally { setLoading(false) }
  }
  return <div className="login-page">
    <section className="login-showcase">
      <div className="showcase-orb orb-one" /><div className="showcase-orb orb-two" />
      <Logo />
      <div className="showcase-copy"><span className="eyebrow light">Operação em sintonia</span><h1>Seu negócio inteiro,<br />no mesmo ritmo.</h1><p>Do primeiro pedido ao fechamento do caixa, decisões mais rápidas e uma operação que flui.</p><div className="showcase-points"><span><CheckCircle2 size={17} /> Visão em tempo real</span><span><CheckCircle2 size={17} /> Controle por unidade</span><span><ShieldCheck size={17} /> Dados protegidos</span></div></div>
      <div className="showcase-card"><div><span className="pulse-dot" /> Operação ao vivo</div><strong>+18,4%</strong><small>em vendas neste período</small><div className="mini-chart">{[38,52,45,68,62,81,76,92,88,100].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
      <p className="showcase-foot">NexPDV · Gestão inteligente para quem faz acontecer.</p>
    </section>
    <section className="login-panel"><div className="login-form-wrap"><div className="mobile-brand"><Logo /></div><span className="eyebrow">Bem-vindo de volta</span><h2>Acesse sua operação</h2><p className="form-intro">Entre com as credenciais cadastradas no NexPDV.</p><form onSubmit={submit}>
      <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" autoComplete="email" required /></label>
      <label>Senha<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" autoComplete="current-password" required minLength={8} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
      <div className="form-options"><label className="checkbox-label"><input type="checkbox" /> <span>Lembrar e-mail</span></label><a href="#recuperar">Esqueci minha senha</a></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-button" disabled={loading}>{loading ? <LoaderCircle className="spin" size={20} /> : <>Entrar no NexPDV <ArrowRight size={19} /></>}</button>
    </form><p className="register-invite">Ainda não usa o NexPDV? <Link to="/cadastro">Crie sua empresa</Link></p><p className="form-support">Precisa de ajuda? <a href="mailto:suporte@nexpdv.com.br">Fale com o suporte</a></p></div></section>
  </div>
}
