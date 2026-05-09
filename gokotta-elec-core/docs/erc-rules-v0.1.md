# ERC/DRC 规则引擎 v0.1

Agent3 负责从 JSON IR 和器件库生成结构化电气规则校验结果。当前实现位于 `scripts/erc-rules.mjs`，CLI 入口为 `scripts/validate-ir.mjs`。

## 输出结构

`runErc(ir, componentLibrary)` 返回：

```js
{
  ok: boolean,
  diagnostics: [
    {
      level: "ERROR" | "WARNING",
      code: "REQUIRED_TERMINAL",
      message: "...",
      target: "Q1.B"
    }
  ],
  errors: [],
  warnings: [],
  indexes: {}
}
```

CLI 输出格式：

```text
ERROR: REQUIRED_TERMINAL [Q1.B]: Q1.B is required but not connected
WARNING: UNUSED_NET [N_BASE]: Net N_BASE has no connected terminals
```

## 已实现规则

- IR 基础合法性：schema version、网络名、refdes、重复网络、重复器件。
- 器件库引用：未知 component type、refdes 前缀风险、必需参数缺失。
- 端子合法性：标准端子、`terminal_pattern`、连接器 `pin_count` 范围、`IC_GENERIC.parameters.terminal_list`。
- 引脚映射：物理 pin 到逻辑 terminal 的合法性，禁止多个物理 pin 映射到同一逻辑 terminal。
- 网络连接：未知 net、未知 device、未知 terminal、同一 terminal 连接多个 net。
- 必连端子：`boundary_conditions.required_connected_terminals`，允许 `internal_ties` 覆盖。
- MOS 体端策略：`body_terminal_policy=must_connect_or_internal_tie`。
- 多单元器件：`requires_package_group`、`requires_unit`。
- 主动器件供电：`forbid_unpowered_use` 检查供电端和回流端是否完整连接。
- 同网风险：`warn_same_net` 触发 WARNING，`allowed_same_net` 或 `allow same_net(...)` 约束可豁免。
- 约束表达式：支持 `terminal_connected(...)`、`same_net(a,b)`、`forbid unpowered_use`。
- 网络风险：无 GND、空网络、单端内部网络、多主动输出并联。
- 电流限制：`requires_current_limit` 会检查相邻网络是否存在电阻、保险丝或电流源。
- 开漏/开集输出：`if_output_stage_open_drain_requires_pullup` 检查输出网是否存在上拉电阻。
- 电压区间：从 GND、DC 电压源、网络说明中的电压文本推断网络电压，结果挂在 `indexes.voltageIntervals`。
- 电压源一致性：电源两端网络电压都已知时，检查声明电压是否与网络差值冲突。
- 极性规则：极性电容反接、二极管反偏风险、MOS body/source 极性、BJT 基本偏置方向。
- 额定电压：极性电容和二极管反向耐压会基于已知电压区间检查。
- 电流方向：DC 电流源按 `POS -> NEG` 为正方向，负电流或与已知电压方向冲突会告警。
- 功耗规则：电阻两端电压已知时估算 `P=V^2/R`，检查 `power_rating` 或提示补充功率额定值。

## 约束表达式

当前支持：

```text
terminal_connected(C,B,E)
same_net(S,B)
unpowered_use
```

约束等级语义：

- `must terminal_connected(...)`：列出的端子必须连接或被内部绑定。
- `forbid terminal_connected(...)`：列出的端子不得连接。
- `must same_net(a,b)`：两个端子必须同网。
- `allow same_net(a,b)`：允许同网，并抑制器件库里的同网风险警告。
- `forbid same_net(a,b)`：两个端子不得同网。
- `forbid unpowered_use`：主动器件不得缺失供电或回流端。

未知表达式会生成 `CONSTRAINT_UNSUPPORTED` 警告，不会静默通过。

## 电气模型

电压区间当前采用保守推断：

- `GND` 或 `type=ground` 固定为 `0V`。
- `VOLTAGE_SOURCE_DC.POS - NEG` 使用 `parameters.voltage`。
- 网络 `alias` 或 `description` 中出现 `12V`、`3.3V`、`0V..5V` 等文本时，可作为已知区间。
- 未知节点不做硬推断，因此不会因为缺少仿真器级别的偏置分析而误报。

## 后续扩展点

- 增加 JSON Schema 校验依赖，例如 Ajv，把结构错误和 ERC 错误分层输出。
- 把电压区间提升为正式 IR 字段，避免依赖描述文本提取。
- 为上拉、限流和短路检查增加图遍历深度，而不只看同一网络邻接。
- 增加受控电源、二极管压降、晶体管工作区和电源路径电流估算。
- 增加规则测试夹具，覆盖坏例子和边界器件。
