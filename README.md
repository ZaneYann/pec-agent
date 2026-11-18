# pec-agent

采购异常处置 Agent（PEC）：一个跑在 DeepSeek Harness（DSH）上的插件、一份可复现的演示数据集，以及配套的标准作业技能与文档模板。

面向的场景是采购履约环节的异常处置——交期延迟、缺货、价格异常、运费争议、供应商风险。Agent 通过插件里的工具读写本地演示库，按技能约定的流程复算、检索、比对，最后给出带出处（provenance）的结论或升级人工。

> 库中数据全部为虚构，生成器 seed = 42。

## 当前状态

| 部分 | 状态 |
|---|---|
| 插件骨架（工具注册、租户护栏、错误码、数据访问） | 可用 |
| `pec_data_catalog`、`order_lookup` | 已实现 |
| `supplier_profile`、`pricing_quote`、`freight_calc`、`contract_search`、`ticket_similar` | 骨架，`execute` 未实现 |
| 演示数据库、项目技能、文档模板 | 就绪 |

未实现的 5 个工具当前会被 `src/policy/guard.ts` 先行拦截，调用方看到的是 `POLICY_DENIED: business tools require tenant and role policy configuration`，而不是 `NOT_IMPLEMENTED`。

## 目录结构

```
pec-agent/
├── plugins/pec-tools/          DSH 插件 @pec/pec-tools
│   ├── src/index.ts            注册 7 个工具并安装 guard
│   ├── src/tools/catalog.ts    完整示例工具 pec_data_catalog
│   ├── src/tools/business.ts   6 个业务工具（5 个待实现）
│   ├── src/policy/guard.ts     租户 / 角色护栏
│   ├── src/db.ts               只读打开 ../../db/pec.db
│   ├── src/errors.ts           工具错误码
│   └── package.json            构建脚本（esbuild）
├── db/                         SQLite 演示库：schema.sql / seed.sql / pec.db
├── .dsh/skills/                项目内 Agent 技能
│   └── freight-anomaly-standard/SKILL.md
├── docs/skill-template.md      技能编写模板
├── pec.local.patch.yml         把插件挂到 DSH profile 的 patch 层
├── PEC-实例数据包-v1.0/        上游数据包（CSV / JSON / SQLite / 生成与自检脚本）
└── PEC-预装环境-v1.0/          上游预装环境快照（插件骨架、技能、profile patch）
```

## 快速开始

要求：Node ≥ 22.5（`node:sqlite` 的 `DatabaseSync` 从该版本可用），以及 npm 或 pnpm。

```bash
cd plugins/pec-tools
npm install
npm run build          # esbuild 打包 src/index.ts → lib/index.js
```

`lib/` 是构建产物，不入库，首次使用前必须构建一次。

挂载到 DSH profile：`pec.local.patch.yml` 用 patch 层 insert 插件，路径是本机绝对路径，换机器需改成自己的路径。

```yaml
- insert:
    - id: pec-tools
      name: 'D:/workspace/pec-agent/plugins/pec-tools/lib/index.js'
```

## 工具清单

| 工具 | 用途 | 状态 |
|---|---|---|
| `pec_data_catalog` | 列出表、行数与字段名，用于开工自检 | 已实现 |
| `order_lookup` | 按订单号查订单与履约状态（仅演示租户 T-001） | 已实现 |
| `supplier_profile` | 供应商等级、黑名单、近 12 月延迟天数 | 待实现 |
| `pricing_quote` | 按 SKU 与数量算阶梯价、金额、税额 | 待实现 |
| `freight_calc` | 算计费体积、总运费、计件运费 | 待实现 |
| `contract_search` | 按供应商与关键词检索合同条款 | 待实现 |
| `ticket_similar` | 召回相似历史工单及其处置动作 | 待实现 |

`order_lookup` 需要运行在 Agent 会话内，无 session 的调用会被 guard 拒绝。

## 数据模型

`db/pec.db` 共 6 张表：

| 表 | 行数 | 主键 | 关键字段 |
|---|---|---|---|
| `suppliers` | 32 | `id` | `tenant_id`、`risk_level`(A–D)、`blacklisted`(0/1)、`delay_days_12m`、`contacts` |
| `skus` | 86 | `id` | `tenant_id`、`safety_stock`、`on_hand`、`in_transit`、`moq`、`volume`、`price_tiers` |
| `orders` | 120 | `id` | `tenant_id`、`supplier_id`、`sku_id`、`qty`、`unit_price`、`promised_at`、`delivered_at`、`status`、`freight_rate`、`volume` |
| `contracts` | 46 | `clause_no` | `supplier_id`、`type`、`text`、`effective_from` |
| `tickets` | 28 | `id` | `order_id`、`tenant_id`、`exception_type`、`action`、`outcome`、`minutes`、`overridden` |
| `users` | 8 | `id` | `tenant_id`、`name`、`role`、`focus_categories` |

`orders` 里的 `amount`、`billed_volume`、`freight`、`unit_freight` 是**派生列，仅供核对**，工具实现必须自己重算，不能当输入用。

### 数据口径

| 约束 | 含义 |
|---|---|
| 单价 | 每张订单的 `unit_price` 等于该数量落入的阶梯价，`price_tiers` 为闭区间，`null` 表示无上限 |
| 金额 | `amount = qty × unit_price`，ROUND_HALF_UP 保留两位 |
| 计费体积 | `billed_volume = ceil(volume)`，向上取整而非四舍五入 |
| 运费 | 总运费 = 计费体积 × `freight_rate`；计件运费 = 总运费 ÷ `qty`，保留两位 |
| 除零 | `qty = 0` 时计件运费必须返回 `E_DIV_ZERO`，不得返回 0 |
| 租户 | 订单的 `tenant_id` 与其供应商、SKU 的 `tenant_id` 必然一致；跨租户查询返回 `POLICY_DENIED`，不是空结果 |
| 条款引用 | 条款号形如 `CL-01`..`CL-46`，全部可在 `contracts` 中命中 |

### 锚点样例

| 订单 | 关键值 | 期望 |
|---|---|---|
| `PO-20261013-0042` | SUP-1042 恒远轴承(B) / SKU-88213 / 600 件 | 金额 57,600.00；计费体积 4；运费 340.00；计件 0.57；承诺 10-20、实际 11-02，延迟 13 天 |
| `PO-20261014-0055` | SKU-88215 / 500 件 × 100.00 | 金额恰好 50,000.00（审批临界，应走主管） |
| `PO-20261015-0066` | SKU-88214 / 体积 0.40 | 计费体积 1，运费 85.00（不是 34.00） |
| `PO-20261010-0099` | `qty = 0`，`status = DRAFT` | 计件运费应报 `E_DIV_ZERO` |

租户分布：T-001 集团本部（24 供应商 / 60 SKU / 80 订单）、T-002 海外事业部（6 / 14 / 订单若干，含 12 个 IMP- 进口件）、T-003 经销伙伴（2 / 12 / 15）。黑名单 3 家：SUP-1007（泰嘉液压，D 级）、SUP-1062、SUP-1065。

## 项目技能

`.dsh/skills/freight-anomaly-standard/SKILL.md` 是运费异常的标准核对流程：先复算计费体积与运费，再检索该供应商的运费条款，差额超过 5% 升级人工。技能里写明了护栏（`qty = 0` 不心算成 0、条款没命中就写未检索到、不编造条款号）和两个踩过的反例。

`docs/skill-template.md` 是新增技能时套用的模板：frontmatter 里的 `name` / `description` / `whenToUse` 必填，正文按「调哪个工具 → 算什么 → 输出什么」三段写。

## 重建数据

`PEC-实例数据包-v1.0/实例数据包/` 里带可复现的生成与校验脚本（Python 3）：

```bash
cd PEC-实例数据包-v1.0/实例数据包
python scripts/gen_data.py     # 生成 data/（seed = 42）
python scripts/build_db.py     # 从 data/ 建 db/pec.db
python scripts/verify.py       # 16 项数据自检
```

改数据后要同步更新 `verify.py` 里的期望值。

## 开发约定

1. 每个工具的 `description` 补全「适用 / 不适用」各一句，让模型能选对工具。
2. 返回值统一 `{ data, provenance }`，`provenance` 精确到表 + 行 id。
3. 错误码只用 `NOT_FOUND` / `INVALID_ARGUMENT` / `POLICY_DENIED` / `UPSTREAM_TIMEOUT`，不抛裸 `Error`。
4. 金额与体积一律用十进制库计算，禁止浮点累加。
5. 空实现会抛 `NOT_IMPLEMENTED`，按未完成计。

## 已知限制

- 5 个业务工具的 `execute` 仍是骨架；guard 使它们当前一律返回 `POLICY_DENIED`。
- 技能文本里用点号工具名（`order.lookup`、`freight.calc`、`contract.search`），与代码里注册的下划线名（`order_lookup`、`freight_calc`、`contract_search`）不一致，接入时要统一。
- 演示库里有刻意保留的边界数据：`qty = 0` 的 DRAFT 单、`delivered_at` 为 NULL 的未交付单、恰好 50,000.00 的审批临界金额、`volume = 0.40` 与 `3.20` 的向上取整用例。
