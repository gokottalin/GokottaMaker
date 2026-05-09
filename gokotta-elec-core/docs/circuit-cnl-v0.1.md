# 电路受控自然语言 CNL v0.1

## 1. 定位

本规范定义一套用于“自然语言 <-> 电路图”的受控自然语言，简称 CNL。它不是自由聊天文本，而是面向 AI 与程序共同处理的严格表达层。

目标：

- 无歧义描述电路拓扑。
- 无歧义描述器件端子、物理引脚、参数和约束。
- 能被程序转为 JSON IR。
- 能从 JSON IR 反向生成同义且等价的 CNL。
- 能进一步生成 KiCad、SPICE、SVG、网表或其他电路图格式。

重要限制：

- “准确无误”不能依赖 AI 猜测，必须依赖受控语法、器件库、schema 校验和规则校验。
- 所有连接必须显式声明到网络，不能只写“R1 接到 Q1 的基极”而不声明网络名。
- 器件符号端子和物理封装引脚必须分层表达，不能混为一谈。

## 2. 基本对象

一个电路由以下对象组成：

- `Circuit`：电路整体。
- `Device`：器件实例，例如 `R1`、`Q1`、`U1`。
- `Terminal`：器件逻辑端子，例如 `Q1.C`、`M1.G`、`U1.IN+`。
- `Pin`：器件物理封装引脚编号，例如 `Q1[1]`。
- `Net`：电气网络，例如 `VIN`、`GND`、`N001`。
- `Connection`：网络与端子的归属关系。
- `Parameter`：器件参数，例如阻值、型号、阈值电压、运放供电电压。
- `Constraint`：边界条件，例如极性、端子数量、禁止悬空、允许短接。

## 3. 命名规则

### 3.1 电路 ID

格式：

```text
电路 <circuit_id> 版本 <semver>。
```

示例：

```text
电路 CE_AMP_001 版本 0.1.0。
```

### 3.2 器件编号 refdes

器件编号必须满足：

```text
^[A-Z][A-Z0-9_]*[0-9]+$
```

推荐前缀：

| 前缀 | 类型 |
|---|---|
| R | 电阻 |
| C | 电容 |
| L | 电感 |
| D | 二极管、LED、齐纳 |
| Q | BJT、JFET |
| M | MOSFET |
| U | IC、运放、比较器、逻辑芯片 |
| V | 电压源 |
| I | 电流源 |
| J | 连接器 |
| SW | 开关 |
| T | 变压器 |
| TP | 测试点 |

### 3.3 网络名

网络名必须满足：

```text
^[A-Z][A-Z0-9_+\\-]*$
```

保留网络：

- `GND`：默认参考地。
- `VCC`、`VDD`、`VSS`、`VEE`：供电网络。
- `VIN`、`VOUT`：输入输出网络。

自动网络可使用：

```text
N001, N002, N003
```

网络规则：

- 同一网络内所有端子电气相连。
- 不同网络默认不相连。
- 网络名大小写敏感，推荐全部大写。
- 一个端子在同一电路中只能连接到一个网络，除非该端子被标记为 `multi_connect`。
- 任何无连接端子必须声明为 `NC`，不能默认忽略。

### 3.4 逻辑端子名

逻辑端子名必须满足：

```text
^[A-Z][A-Z0-9_+\-]*$
```

说明：

- 简单器件使用短端子名，例如 `A`、`B`、`C`、`E`、`D`、`G`、`S`。
- 差分和供电端子允许 `+`、`-`，例如 `IN+`、`IN-`、`V+`、`V-`。
- 多单元封装和极性标记允许 `_`，例如 `A_IN+`、`B_OUT`、`P1_DOT`。
- 端子名必须来自器件库或器件库声明的 `terminal_pattern`。

## 4. CNL 句式

### 4.1 电路声明

```text
电路 <circuit_id> 版本 <semver>。
```

### 4.2 网络声明

```text
网络 <net_id> 是 <net_type>，别名=<alias?>，说明=<description?>。
```

`net_type` 可选：

- `ground`
- `power`
- `signal`
- `bias`
- `feedback`
- `input`
- `output`
- `internal`

示例：

```text
网络 GND 是 ground，说明=全局参考地。
网络 VCC 是 power，说明=正电源。
网络 N_BIAS 是 bias。
```

### 4.3 器件声明

```text
器件 <refdes> 是 <component_type>，型号=<model?>，参数{<key>=<value>, ...}。
```

示例：

```text
器件 R1 是 RESISTOR，参数{resistance=10kΩ, tolerance=1%}。
器件 Q1 是 BJT_NPN，型号=2N3904。
器件 M1 是 MOS_NMOS_ENHANCEMENT，型号=2N7002。
器件 U1 是 OPAMP_SINGLE，型号=OPA197。
```

### 4.4 物理引脚映射

逻辑端子和物理引脚分开描述。

```text
引脚映射 <refdes>{<pin_number>=<terminal>, ...}。
```

示例：

```text
引脚映射 Q1{1=E, 2=B, 3=C}。
引脚映射 M1{1=G, 2=S, 3=D}。
引脚映射 U1{1=OUT, 2=IN-, 3=IN+, 4=V-, 5=V+}。
```

规则：

- 端子名必须来自器件库。
- 物理引脚编号来自封装或数据手册。
- 同一物理引脚不能映射到多个逻辑端子，除非器件库允许 `shared_pin`。
- 若没有封装信息，可以省略引脚映射，但不能省略逻辑端子连接。

### 4.5 连接声明

推荐句式：

```text
连接 <net_id>: <refdes>.<terminal>, <refdes>.<terminal>, ...。
```

示例：

```text
连接 VIN: V1.POS, R1.A。
连接 N_BASE: R1.B, Q1.B, C1.A。
连接 GND: V1.NEG, Q1.E, R2.B。
```

物理引脚连接只允许在封装验证或 PCB 表达中使用：

```text
封装连接 <net_id>: <refdes>[<pin_number>], ...。
```

程序必须先通过引脚映射将它归一化为逻辑端子连接。

### 4.6 未连接声明

```text
未连接 <refdes>.<terminal>，原因=<reason>。
```

示例：

```text
未连接 U1.NC1，原因=数据手册规定悬空。
```

### 4.7 约束声明

```text
约束 <target> 必须 <constraint_expression>。
约束 <target> 允许 <constraint_expression>。
约束 <target> 禁止 <constraint_expression>。
```

示例：

```text
约束 Q1 必须 terminal_connected(C,B,E)。
约束 M1 允许 same_net(S,B)。
约束 U1 禁止 unpowered_use。
```

## 5. 标准端子命名

### 5.1 无源器件

| 器件 | 端子 |
|---|---|
| RESISTOR | A, B |
| CAPACITOR_NONPOLAR | A, B |
| CAPACITOR_POLAR | POS, NEG |
| INDUCTOR | A, B |

### 5.2 二极管

| 器件 | 端子 |
|---|---|
| DIODE | A, K |
| LED | A, K |
| ZENER_DIODE | A, K |
| TVS_DIODE | A, K |
| BRIDGE_RECTIFIER | AC1, AC2, POS, NEG |

### 5.3 BJT 三极管

| 器件 | 端子 | 说明 |
|---|---|---|
| BJT_NPN | C, B, E | 集电极、基极、发射极 |
| BJT_PNP | C, B, E | 集电极、基极、发射极 |

BJT 边界条件：

- 必须声明 `C`、`B`、`E` 三个逻辑端子。
- 每个逻辑端子最多连接一个网络。
- `C`、`B`、`E` 默认必须连接，除非器件被声明为测试结构或允许悬空。
- 允许 `C` 与 `B` 同网，用于二极管连接三极管。
- 允许 `B` 与 `E` 有偏置或保护网络，但直接同网会被标为强警告。
- 禁止把 NPN 与 PNP 只靠图形方向推断，必须显式写 `BJT_NPN` 或 `BJT_PNP`。
- 物理引脚编号不固定，必须由 `引脚映射` 或封装库确定。

### 5.4 MOSFET

| 器件 | 端子 | 说明 |
|---|---|---|
| MOS_NMOS_ENHANCEMENT | D, G, S, B | 漏极、栅极、源极、体端 |
| MOS_PMOS_ENHANCEMENT | D, G, S, B | 漏极、栅极、源极、体端 |
| MOS_NMOS_DEPLETION | D, G, S, B | 耗尽型 NMOS |
| MOS_PMOS_DEPLETION | D, G, S, B | 耗尽型 PMOS |

MOS 边界条件：

- 四端模型必须包含 `D`、`G`、`S`、`B`。
- 三端封装 MOS 必须通过 `internal_tie(B,S)` 或器件库声明体端内部连接。
- `G` 端不能悬空，除非显式声明为模拟采样保持、测试结构或高阻输入并附约束。
- `D` 与 `S` 是否可互换由器件库字段 `drain_source_swappable` 决定，功率 MOS 默认不可互换。
- `S` 与 `B` 同网是常见合法情况。
- `D` 与 `S` 同网默认警告，除非用于开关短接模型。
- 禁止只写 NMOS/PMOS 而不说明增强型、耗尽型或由型号库补全。

### 5.5 运算放大器

| 器件 | 端子 | 说明 |
|---|---|---|
| OPAMP_SINGLE | IN+, IN-, OUT, V+, V- | 单运放 |
| OPAMP_DUAL_UNIT | IN+, IN-, OUT, V+, V- | 双运放中的一个单元 |
| OPAMP_QUAD_UNIT | IN+, IN-, OUT, V+, V- | 四运放中的一个单元 |

运放边界条件：

- `IN+`、`IN-`、`OUT` 必须连接或显式声明未连接原因。
- 实体运放必须有 `V+` 与 `V-` 供电网络。
- 单电源运放可令 `V-=GND`。
- 双运放或四运放必须表达 `package_group`，共享电源引脚不能重复生成。
- 不允许把 `IN+` 与 `IN-` 通过自然语言“正端/负端”模糊表达，必须写标准端子。
- 若使用理想运放模型，可以声明 `model=IDEAL_OPAMP`，但仍推荐保留供电约束字段。
- 输出端 `OUT` 不能直接并联其他推挽输出，除非声明为开漏、三态或理想求和节点。

### 5.6 比较器

| 器件 | 端子 |
|---|---|
| COMPARATOR_SINGLE | IN+, IN-, OUT, V+, V- |

比较器边界条件：

- 若输出为开漏或开集，必须声明 `output_stage=open_drain` 或 `open_collector`。
- 开漏输出必须有上拉路径，规则校验器应检查 `OUT` 网络是否存在电阻、电流源或等效上拉。

### 5.7 连接器和 IC

| 器件 | 端子 |
|---|---|
| CONNECTOR_N | P1, P2, ... PN |
| IC_GENERIC | 按数据手册命名 |

规则：

- 连接器端子使用 `P1`、`P2`。
- 通用 IC 必须给出完整端子列表，不能只写“芯片 U1 接好电源”。
- 多单元器件必须用 `units` 表达单元和共享引脚。

## 6. 程序化解析流程

推荐流水线：

1. 自由文本输入。
2. AI 提取候选 CNL。
3. CNL 语法解析。
4. 转换为 JSON IR。
5. JSON Schema 校验。
6. 器件库端子校验。
7. 电气规则校验 ERC。
8. 生成电路图、网表、SPICE 或反向 CNL。

任何一步失败都必须输出结构化错误，不允许静默修正。

## 7. 错误等级

| 等级 | 含义 |
|---|---|
| ERROR | 无法生成准确电路，必须修复 |
| WARNING | 可以生成，但可能存在电气或语义风险 |
| INFO | 建议补充的信息 |

典型 ERROR：

- 器件类型未知。
- 标准端子不存在。
- 同一端子连接多个网络。
- 必需端子未连接且未声明 NC。
- 物理引脚映射冲突。

典型 WARNING：

- MOS 栅极悬空。
- BJT 基极悬空。
- 运放未声明供电范围。
- PNP/NPN 未给出具体型号。

## 8. Agent 分工建议

当前 Agent0 负责顶层规范、IR、器件库和示例封装。

后续复杂度上升时建议分工：

- Agent1：CNL parser，负责把受控中文解析为 AST 和 IR。
- Agent2：器件库维护，负责扩展 BJT、MOS、运放、连接器、IC 封装与 pin map。
- Agent3：ERC/DRC 规则引擎，负责网络合法性、电气风险和边界条件。
- Agent4：图形生成，负责从 IR 输出 KiCad/SVG/交互式电路图。
- Agent5：自由文本理解，负责把用户随意描述转为 CNL 候选，并生成置信度与待确认问题。
