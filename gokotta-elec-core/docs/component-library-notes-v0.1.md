# Component Library Notes v0.1

本文件记录 Agent2 对 `components/core-components.v0.1.json` 的扩展约定。核心原则不变：连接必须指向逻辑端子，物理封装脚号必须通过 `pin_map` 映射，不能把封装编号直接当作器件语义。

## 命名策略

- 保留既有类型，不删除、不重命名，避免破坏其他 Agent 的 parser、schema 或示例。
- 新增 `JFET_N`、`JFET_P` 作为自然语言中更短、更稳定的标准键名，同时在边界条件中声明它们对应既有 `JFET_N_CHANNEL`、`JFET_P_CHANNEL`。
- 复杂多单元器件允许两种建模方式：
  - `OPAMP_DUAL_UNIT` / `OPAMP_QUAD_UNIT`：适合按单元拆分，依赖 `unit` 和共享电源规则。
  - `OPAMP_DUAL_PACKAGE` / `OPAMP_QUAD_PACKAGE`：适合一个封装整体描述，端子带 `A_`、`B_`、`C_`、`D_` 前缀。

## 新增重点类型

### 场效应和功率半导体

- `JFET_N`
- `JFET_P`
- `IGBT_N`
- `IGBT_P`
- `SCR`
- `TRIAC`

边界重点：

- JFET 的 `D/G/S` 均要求连接，`G` 不应隐式浮空，且正常工作中栅结通常反偏。
- IGBT 使用 `C/G/E`，不是 MOS 的 `D/G/S`，并标记绝缘栅、感性负载续流路径风险。
- SCR 使用 `A/K/G`，具有锁存行为，直到电流低于维持电流。
- TRIAC 使用 `MT1/MT2/G`，`G` 参考 `MT1`，所以主端子不能简单按任意封装脚互换。

### 隔离、继电器和磁性器件

- `OPTOCOUPLER_PHOTODARLINGTON`
- `OPTOCOUPLER_PHOTOTRIAC`
- `OPTOCOUPLER_PHOTOMOS`
- `RELAY_SPST_NO`
- `RELAY_SPDT`
- `TRANSFORMER_1P1S`
- `TRANSFORMER_MULTI_WINDING`

边界重点：

- 光耦显式声明 `isolation_barrier_between`，输入 LED 侧必须限流。
- 继电器区分线圈侧和触点侧，触点默认状态由 `NO/NC` 端子语义表达。
- 变压器使用点标端子，例如 `P1_DOT`、`S1_DOT`，相位由点标规则决定。
- 多绕组变压器使用 `Wn_DOT/Wn` 端子模式，并要求显式声明绕组列表。

### 运放和逻辑门

- `OPAMP_DUAL_PACKAGE`
- `OPAMP_QUAD_PACKAGE`
- `LOGIC_AND_2IN`
- `LOGIC_OR_2IN`
- `LOGIC_NAND_2IN`
- `LOGIC_NOR_2IN`
- `LOGIC_XOR_2IN`
- `LOGIC_XNOR_2IN`
- `LOGIC_NOT`
- `LOGIC_BUFFER`

边界重点：

- 运放封装级类型显式列出每个单元的输入和输出，同时共享 `V+`、`V-`。
- 逻辑门类型全部要求电源端连接，避免 AI 只描述信号端而漏掉供电。
- 二输入门的 `A/B` 可交换；反相器、缓冲器不可交换。
- `LOGIC_BUFFER` 的 `OE` 可选，但如果存在应由 datasheet 明确允许浮空，否则需要 ERC 警告。

### 连接器和电源管理

- `CONNECTOR_MULTI_PIN`
- `CONNECTOR_MULTI_PIN_SHIELDED`
- `REGULATOR_LDO_FIXED`
- `REGULATOR_LDO_ADJUSTABLE`
- `REGULATOR_BUCK`
- `REGULATOR_BOOST`

边界重点：

- 多引脚连接器端子使用 `P1`、`P2`、...，并要求 `pin_count` 与声明端子一致。
- 屏蔽连接器额外允许 `SHIELD`，该端子不是普通信号脚，应连接到机壳地或显式声明不连接。
- LDO 固定输出必须有 `output_voltage`，可调 LDO 必须连接 `FB`。
- Buck/Boost 均要求 `VIN/SW/GND/FB`，并声明外部储能器件需求，方便后续 ERC 检查电感、电容、反馈网络。

## 给其他 Agent 的对接建议

- Parser 遇到自然语言“光耦继电器/PhotoMOS/固态继电器”时优先映射到 `OPTOCOUPLER_PHOTOMOS`，不要直接映射为机械继电器。
- Parser 遇到“可控硅”时需要根据语境区分 `SCR` 与 `TRIAC`：直流单向控制通常为 `SCR`，交流双向调光/控制通常为 `TRIAC`。
- ERC 引擎应优先实现这些通用边界字段：`required_connected_terminals`、`floating_terminal_errors`、`warn_same_net`、`isolation_barrier_between`、`requires_external_energy_storage`、`terminal_swap_groups`。
- 原理图生成器应把 `*_DOT` 端子渲染为绕组点标，把隔离器件的隔离栅画出来。
## Model/package pin maps

`components/model-packages.v0.1.json` contains model-level, package-specific pin maps. It stays separate from `core-components.v0.1.json`: the core library defines logical device semantics, while the model package library defines physical package pin numbers.

Initial covered models:

- `2N3904`: TO-92 `1=E, 2=B, 3=C`; SOT-23/MMBT3904 `1=B, 2=E, 3=C`.
- `S8050` / `SS8050`: default TO-92 `1=E, 2=B, 3=C`; alternate vendor TO-92 `1=C, 2=B, 3=E`; SOT-23/J3Y `1=B, 2=E, 3=C`.
- `2N7002`: SOT-23 `1=G, 2=S, 3=D`, with `internal_ties=[["B","S"]]`.
- `IRLZ44N`: TO-220AB `1=G, 2=D, 3=S`, tab/case maps to `D`, with `internal_ties=[["B","S"]]`.
- `LM358`: DIP-8/SOIC-8 dual op-amp package `1=A_OUT, 2=A_IN-, 3=A_IN+, 4=V-, 5=B_IN+, 6=B_IN-, 7=B_OUT, 8=V+`; unit maps are provided for `OPAMP_DUAL_UNIT` A/B modeling.

Validation entry points:

- `npm.cmd run validate:models`
- `node scripts/validate-model-packages.mjs`

Runtime behavior:

- `scripts/model-packages.mjs` resolves `device.model` plus `device.package`.
- `validate-ir.mjs` and `erc-check.mjs` apply model/package defaults before ERC validation.
- Explicit `device.pin_map` entries override model defaults, so a user can handle known vendor/package exceptions without editing the shared library.
