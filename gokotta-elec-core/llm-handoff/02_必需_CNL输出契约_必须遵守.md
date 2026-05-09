# LLM 对接契约 v0.1

本文件用于让 DeepSeek、ChatGPT、Claude、Qwen 等其他 LLM 准确输出 Circuit CNL。软件只接受受控自然语言 CNL，不接受解释性文章、Markdown 列表、自由段落或省略连接的描述。

## 输出目标

LLM 必须输出一个 UTF-8 文本文件，扩展名可以是 `.cnl` 或 `.txt`。文件内容必须是 CNL 语句集合。

允许：

```text
电路 EXAMPLE_001 版本 0.1.0。
网络 GND 是 ground。
器件 R1 是 RESISTOR，参数{resistance=10kΩ}。
连接 GND: R1.B。
```

禁止：

```text
下面是电路描述：
- R1 接地
```

## 强制输出规则

1. 只输出 CNL 语句，不输出解释、不输出标题、不输出分析过程。
2. 每条 CNL 语句必须以中文句号 `。` 或英文分号 `;` 结束。
3. 必须先声明电路，再声明网络，再声明器件，再声明连接，最后声明约束。
4. 所有连接必须通过 `连接 <net_id>: <refdes>.<terminal>, ...。` 表达。
5. 不允许写“R1 接 Q1 基极”这种没有网络名的连接。
6. 器件类型必须来自 `components/core-components.v0.1.json`。
7. 端子名必须来自对应器件类型的 `terminals` 或 `terminal_pattern`。
8. 物理引脚号必须通过 `引脚映射` 或型号封装库表达，不能直接代替逻辑端子。
9. 如果知道型号和封装，优先写 `型号=<model>`、`封装=<package>`，让软件自动补 pin map。
10. 不确定的连接不能猜测；必须输出明确网络，或不输出该电路并提示上游需要补充信息。

## 文件编码

- 编码：UTF-8。
- 可带 UTF-8 BOM，解析器会自动处理。
- 可以被 Markdown 代码块整体包裹，但推荐纯文本无代码块。
- Windows 路径支持带引号输入，例如：

```powershell
dist\GokottaElec.exe "C:\Users\10731\Downloads\deepseek_cnl_20260507_72c637.txt" output\deepseek-test
```

## 标准语句

### 电路

```text
电路 <circuit_id> 版本 <semver>。
```

示例：

```text
电路 NMOS_LED_SWITCH_001 版本 0.1.0。
```

### 网络

```text
网络 <net_id> 是 <net_type>，说明=<description>。
```

`net_type` 只能是：

- `ground`
- `power`
- `signal`
- `bias`
- `feedback`
- `input`
- `output`
- `internal`

### 器件

```text
器件 <refdes> 是 <component_type>，型号=<model>，封装=<package>，参数{<key>=<value>, ...}。
```

字段可省略，但 `refdes` 和 `component_type` 必须存在。

示例：

```text
器件 Q1 是 BJT_NPN，型号=2N3904，封装=TO-92。
器件 M1 是 MOS_NMOS_ENHANCEMENT，型号=2N7002，封装=SOT-23。
器件 U1 是 OPAMP_SINGLE，型号=OPA197，参数{supply_range=4.5V_to_36V}。
```

### 引脚映射

仅在型号封装库没有覆盖时使用：

```text
引脚映射 <refdes>{<pin_number>=<terminal>, ...}。
```

示例：

```text
引脚映射 Q1{1=E, 2=B, 3=C}。
```

### 连接

```text
连接 <net_id>: <refdes>.<terminal>, <refdes>.<terminal>, ...。
```

示例：

```text
连接 N_BASE: C1.B, R1.B, R2.A, Q1.B。
```

### 未连接

```text
未连接 <refdes>.<terminal>，原因=<reason>。
```

### 约束

```text
约束 <target> 必须 terminal_connected(<terminal>,...)。
约束 <target> 允许 same_net(<terminal>,<terminal>)。
约束 <target> 禁止 same_net(<terminal>,<terminal>)。
```

## 命名规则

### refdes

```text
^[A-Z][A-Z0-9_]*[0-9]+$
```

示例：`R1`、`C1`、`Q1`、`M1`、`U1`、`V1`。

### net_id

```text
^[A-Z][A-Z0-9_+\-]*$
```

示例：`GND`、`VCC`、`VIN`、`VOUT`、`N_BASE`。

### terminal

```text
^[A-Z][A-Z0-9_+\-]*$
```

示例：`A`、`B`、`C`、`E`、`D`、`G`、`S`、`IN+`、`IN-`、`V+`、`V-`、`A_IN+`、`P1_DOT`。

## 常用器件端子

| 类型 | 端子 |
|---|---|
| RESISTOR | A, B |
| CAPACITOR_NONPOLAR | A, B |
| CAPACITOR_POLAR | POS, NEG |
| DIODE / LED / ZENER_DIODE | A, K |
| BJT_NPN / BJT_PNP | C, B, E |
| MOS_NMOS_ENHANCEMENT / MOS_PMOS_ENHANCEMENT | D, G, S, B |
| OPAMP_SINGLE | IN+, IN-, OUT, V+, V- |
| COMPARATOR_SINGLE | IN+, IN-, OUT, V+, V- |
| VOLTAGE_SOURCE_DC | POS, NEG |
| SIGNAL_SOURCE | OUT, REF |
| CONNECTOR_N | P1, P2, ... |

## 输出前自检

LLM 在输出前必须逐项检查：

- 每个连接中的网络都已经被 `网络` 声明。
- 每个连接中的器件都已经被 `器件` 声明。
- 每个连接中的端子属于对应器件类型。
- 每个必需端子都连接到一个网络，或显式声明未连接原因。
- 同一端子没有连接到多个不同网络。
- MOS 的 `G` 不悬空，三端 MOS 必须通过型号封装库或 `internal_ties` 处理体端。
- 运放的 `V+` 和 `V-` 必须连接，且不能同网。

## 常见错误和修正

### 错误 1：refdes 不以数字结尾

错误：

```text
器件 R_GATE 是 RESISTOR，参数{resistance=1kΩ}。
```

正确：

```text
器件 R_GATE1 是 RESISTOR，参数{resistance=1kΩ}。
```

### 错误 2：把端子写在 `连接` 左侧

错误：

```text
连接 M1.G: R_GATE1.B。
```

`连接` 左侧必须是网络名，不能是端子名。

正确：

```text
网络 NGATE 是 input，说明=控制信号输入。
连接 NGATE: R_GATE1.B, M1.G。
```

### 错误 3：两个器件端子之间没有网络名

错误：

```text
连接 LED1.A: R_LED1.B。
```

正确：

```text
网络 N_LED_A 是 internal，说明=LED阳极限流节点。
连接 N_LED_A: LED1.A, R_LED1.B。
```

### 错误 4：MOS 三端封装未处理体端

推荐让型号封装库自动处理：

```text
器件 M1 是 MOS_NMOS_ENHANCEMENT，型号=2N7002，封装=SOT-23。
```

如果没有型号封装库，则需要在 IR 层声明 `internal_ties=[["B","S"]]`；CNL v0.1 暂不推荐 LLM 手写该字段。

## 最小合格示例

```text
电路 LLM_MINIMUM_EXAMPLE 版本 0.1.0。

网络 GND 是 ground，说明=全局参考地。
网络 VCC 是 power，说明=5V电源。
网络 CTRL 是 input，说明=控制输入。
网络 N_LED_A 是 internal，说明=LED阳极节点。
网络 N_LED_K 是 internal，说明=LED阴极节点。

器件 V1 是 VOLTAGE_SOURCE_DC，参数{voltage=5V}。
器件 R1 是 RESISTOR，参数{resistance=330Ω}。
器件 D1 是 LED，参数{color=red}。
器件 M1 是 MOS_NMOS_ENHANCEMENT，型号=2N7002，封装=SOT-23。

连接 VCC: V1.POS, R1.A。
连接 GND: V1.NEG, M1.S。
连接 CTRL: M1.G。
连接 N_LED_A: R1.B, D1.A。
连接 N_LED_K: D1.K, M1.D。

约束 M1 必须 terminal_connected(D,G,S)。
```
