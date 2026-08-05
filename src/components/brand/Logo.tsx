import { PanelsTopLeft } from 'lucide-react'

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-mark"><PanelsTopLeft size={20} /></span>{!compact && <span>Nex<strong>PDV</strong></span>}</div>
}
