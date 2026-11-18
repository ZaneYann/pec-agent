import type { Context } from '@deepseek-ai/cordis'

// Fail closed for unfinished business tools until tenant and role identity
// are connected to the desktop runtime. The catalog contains only metadata.
export function installGuard(ctx: Context) {
  const businessTools = new Set([
    'supplier_profile', 'pricing_quote',
    'freight_calc', 'contract_search', 'ticket_similar',
  ])
  ctx.tools.guard((execution) => {
    if (execution.name === 'order_lookup' && !execution.agent) return 'POLICY_DENIED: session required'
    if (businessTools.has(execution.name)) return 'POLICY_DENIED: business tools require tenant and role policy configuration'
    return undefined
  })
}
