import { ArrowLeft, Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ModulePage({ title, description }: { title: string; description: string }) {
  return <div className="module-page page-enter"><span className="eyebrow">Próximo módulo</span><h1>{title}</h1><p>{description}</p><div className="module-placeholder"><span><Construction size={28} /></span><h2>Estrutura preparada</h2><p>A navegação e o shell já estão prontos para receber esta experiência.</p><Link to="/"><ArrowLeft size={16} /> Voltar para visão geral</Link></div></div>
}
