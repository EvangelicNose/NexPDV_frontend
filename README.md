# NexPDV Frontend

Aplicação web do NexPDV construída com React, TypeScript e Vite.

## Stack inicial

O módulo **Venda** (`/venda`) permite lançar produtos por SKU ou código de barras exato, inclusive de variações,
com quantidade padrão de 1 unidade. Enter adiciona o item, e SKUs repetidos somam as quantidades.
Selecione um caixa aberto e, ao concluir, um dos meios de pagamento configurados nesse terminal.
A confirmação usa `/v1/sales/quick`, com proteção contra repetição da mesma venda em falhas de conexão.
Produtos que exigem adicionais devem ser lançados pela tela de novo pedido.

- React 19 e React Router
- TanStack Query para estado assíncrono
- Vite e TypeScript
- Lucide para ícones
- Integração com autenticação, renovação de token e relatório consolidado do backend

## Executando localmente

Requisitos: Node.js compatível com Vite 8 e o backend do NexPDV em execução.

```bash
cp .env.example .env
npm install
npm run dev
```

No Windows PowerShell, copie o ambiente com:

```powershell
Copy-Item .env.example .env
```

Por padrão, o frontend abre em `http://localhost:3000` e acessa a API em `http://localhost:3333`.

## Variáveis de ambiente

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `VITE_API_URL` | URL base do backend | `http://localhost:3333` |

## Comandos

```bash
npm run dev      # servidor de desenvolvimento
npm run lint     # análise estática
npm run build    # checagem TypeScript e build de produção
npm run preview  # visualização local do build
```

## Estrutura

```text
src/
├── components/       # marca e layout compartilhado
├── features/auth/    # sessão e proteção de rotas
├── lib/              # cliente HTTP
├── pages/            # login, dashboard e módulos
├── App.tsx           # rotas
└── main.tsx          # providers da aplicação
```

O dashboard consulta dados reais de `/v1/reports/overview`. As demais áreas já possuem rotas e placeholders para as próximas etapas do frontend.
