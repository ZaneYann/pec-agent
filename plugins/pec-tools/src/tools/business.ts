import { defineTool } from '@deepseek-ai/dsh-tools'
import { ToolError } from '../errors.js'
import { one } from '../db.js'

const notImplemented = (name: string) => {
  throw new ToolError('NOT_IMPLEMENTED', `${name} 尚未实现，请补全 execute`)
}

/**
 * 六个业务工具：schema 已给出，execute 待实现。
 * 交付要求：
 *  1. 补全 description（适用 / 不适用场景各一句）
 *  2. 返回 { data, provenance }，provenance 精确到表 + 行 id
 *  3. 错误码只用 NOT_FOUND / INVALID_ARGUMENT / POLICY_DENIED / UPSTREAM_TIMEOUT
 *  4. 金额与体积一律用十进制库计算，禁止浮点
 */

export const orderLookup = defineTool({
  name: 'order_lookup',
  description: '根据订单号查询本地演示租户的订单和履约状态。不适用于按供应商汇总或查询成本。',
  parameters: {
    orderId: { type: 'string', required: true, description: '采购订单号，例如 PO-20261013-0042' },
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render: (_args, value: any) => [{ type: 'text', text: JSON.stringify(value) }],
  },
  async execute(args) {
    const id = args.orderId.trim()
    if (!id) throw new ToolError('INVALID_ARGUMENT', '订单号不能为空')
    const order = one<any>(`select id, tenant_id, supplier_id, sku_id, qty, ordered_at, promised_at, delivered_at, status from orders where id = ?`, [id])
    if (!order) throw new ToolError('NOT_FOUND', '订单不存在')
    if (order.tenant_id !== 'T-001') throw new ToolError('POLICY_DENIED', '订单不属于当前演示租户')
    return { data: order, provenance: [{ table: 'orders', rowId: order.id }] }
  },
})

export const supplierProfile = defineTool({
  name: 'supplier_profile',
  description: '查询供应商画像：等级、黑名单、近 12 月延迟天数。',
  parameters: {
    supplierId: { type: 'string', required: true, description: '供应商编码，如 SUP-1042' },
    tenantId: { type: 'string', required: true, description: '运行时注入' },
  },
  output: { schema: { type: 'object', additionalProperties: true }, render: () => [{ type: 'text', text: '' }] },
  async execute(_args, _exec) { return notImplemented('supplier.profile') as never },
})

export const pricingQuote = defineTool({
  name: 'pricing_quote',
  description: '按 SKU 与数量计算阶梯价、金额与税额。',
  parameters: {
    skuId: { type: 'string', required: true, description: 'SKU 编码' },
    qty: { type: 'integer', required: true, description: '采购数量，必须 > 0' },
  },
  output: { schema: { type: 'object', additionalProperties: true }, render: () => [{ type: 'text', text: '' }] },
  async execute(_args, _exec) { return notImplemented('pricing.quote') as never },
})

export const freightCalc = defineTool({
  name: 'freight_calc',
  description: '按体积与物流费单价计算计费体积、总运费与计件运费。',
  parameters: {
    orderId: { type: 'string', required: true, description: '订单号' },
    qty: { type: 'integer', required: true, description: '数量，为 0 时返回 E_DIV_ZERO' },
  },
  output: { schema: { type: 'object', additionalProperties: true }, render: () => [{ type: 'text', text: '' }] },
  async execute(_args, _exec) { return notImplemented('freight.calc') as never },
})

export const contractSearch = defineTool({
  name: 'contract_search',
  description: '检索合同条款，返回条款号、正文与出处。',
  parameters: {
    supplierId: { type: 'string', required: true, description: '供应商编码' },
    keyword: { type: 'string', required: true, description: '检索词，如「违约金」' },
  },
  output: { schema: { type: 'object', additionalProperties: true }, render: () => [{ type: 'text', text: '' }] },
  async execute(_args, _exec) { return notImplemented('contract.search') as never },
})

export const ticketSimilar = defineTool({
  name: 'ticket_similar',
  description: '召回相似历史工单，返回处置动作与相似度。',
  parameters: {
    exceptionType: { type: 'string', required: true, description: 'DELAY / STOCK / PRICE / FREIGHT / RISK' },
    supplierId: { type: 'string', description: '可选的供应商过滤' },
    amountMax: { type: 'number', description: '可选：金额上限（元）' },
  },
  output: { schema: { type: 'object', additionalProperties: true }, render: () => [{ type: 'text', text: '' }] },
  async execute(_args, _exec) { return notImplemented('ticket.similar') as never },
})
