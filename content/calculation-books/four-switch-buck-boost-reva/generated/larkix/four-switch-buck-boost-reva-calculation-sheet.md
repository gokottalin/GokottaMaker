> 我将本计算书用于设计评审；尚未闭合的适用边界在结论中统一说明。

## 1. 设计输入、符号与假设

我先冻结输入、输出、功率、频率和保护边界，再进入模式与器件计算。

| 符号 | 含义 | 数值 |
|---|---|---:|
| $V_{inmin}$ | 最小工作输入电压 | 6 V |
| $V_{inmax}$ | 最大工作输入电压 | 36 V |
| $V_{outmin}$ | 最小目标输出电压 | 1 V |
| $V_{outmax}$ | 最大目标输出电压 | 36 V |
| $P_{max}$ | 连续功率上限 | 150 W |
| $k_{derate}$ | 低输入功率降额系数；本册取 0.8。 | 0.8 |
| $I_{cont}$ | 主电感连续电流的设计中心值。 | 10 A |
| $I_{cbc}$ | 逐周期电流限制（cycle-by-cycle limit）的标称阈值。 | 12.5 A |
| $I_{hard}$ | 独立硬件过流保护的标称动作电流。 | 14 A |
| $I_{faultmax}$ | 计入阈值与关断延迟后允许的故障峰值上限。 | 16 A |
| $I_{bring}$ | 首次上电调试阶段采用的低电流限制。 | 3 A |
| $f_{sw}$ | 默认开关频率 | 200 kHz |
| $L_{nom}$ | 主电感初选标称值 | 15 μH |
| $V_{inbuck}$ | Buck 纹波校核工况的输入电压，本册取 36 V。 | 36 V |
| $V_{outbuck}$ | Buck 纹波校核工况的输出电压，本册取 18 V。 | 18 V |
| $V_{inboost}$ | Boost 纹波校核工况的输入电压，本册取 12 V。 | 12 V |
| $V_{outboost}$ | Boost 纹波校核工况的输出电压，本册取 36 V。 | 36 V |
| $V_{intrans}$ | 过渡区调制纹波校核电压；本册令 VIN=VOUT=36 V，只用于比较两种调制，不是新增额定输入。 | 36 V |
| $r_{trans}$ | 过渡区电压比 VOUT/VIN；中心点等于 1。 | 1 |
| $r_{low}$ | Buck 侧进入过渡区的电压比下边界。 | 0.95 |
| $mu_{max}$ | 过渡中心单个修正状态允许的最大周期占比。 | 0.05 |
| $N_{total}$ | 现有控制周期的总计数。 | 940 |
| $N_{refresh}$ | 现有控制每周期强制自举刷新的计数。 | 40 |
| $V_{innear}$ | 近直通能力审计工况的输入电压，本册取 25 V。 | 25 V |
| $V_{outnear}$ | 近直通能力审计工况的输出电压，本册取 24 V。 | 24 V |
| $t_{off}$ | 电流越阈到实际门极关断的总延迟目标。 | 0.5 μs |
| $t_{blank}$ | 开通后暂时屏蔽尖峰的 blanking 时间。 | 0.1 μs |
| $R_{shunt}$ | 主电感电流检测用四端分流电阻。 | 0.002 Ω |
| $G_{fast}$ | 快速电流检测放大链路的电压增益。 | 20 |
| $V_{ref}$ | 双向电流检测输出的零电流中点电压。 | 1.65 V |
| $V_{dsrated}$ | MOSFET 额定漏源耐压。 | 100 V |
| $V_{dspeak}$ | MOSFET 预期漏源峰值。 | 80 V |
| $t_{dead}$ | 同一桥臂上下管互补切换的死区时间。 | 0.15 μs |
| $V_{bias}$ | 高边隔离/浮动驱动使用的偏置电压。 | 12 V |

我采用以下暂定假设：

- 我按“首轮采用理想稳态伏秒模型”计算；占空比和纹波结果未计入导通压降、死区、延时、磁芯非线性与寄生参数。
- 我按“过渡区对比场景取 VIN=VOUT=36 V”计算；得到 6 A 对角半周期纹波与 0.6 A 的 5% 修正脉冲纹波。
- 我按“器件按标称值计算”计算；当前 OCP 阈值、损耗和纹波不是最坏公差结果。
- 我按“500 ns 是关断目标而非测量值”计算；1.2 A 延迟上冲和 15.2 A 故障峰值仅是目标闭合值。

## 2. 设计规格与功率边界

我先冻结 VIN、VOUT、IOUT、Pout 与 fsw，并用低输入功率降额划定可计算边界。

### 6 V 低线首轮功率上限

$$
P_{low} = k_{derate}·V_{inmin}·I_{cont}
$$

其中，$P_{low}$ 表示6 V 低线首轮功率上限；$k_{derate}$ 表示低输入功率降额系数，本册取 0.8；$I_{cont}$ 表示主电感连续电流的设计中心值。

我代入 $k_{derate}$ = 0.8，$V_{inmin}$ = 6 V，$I_{cont}$ = 10 A，得到 $P_{low}$ ≈ **48 W**。

> 我将该结果用于6 V 输入、10 A 连续电感电流的首轮验证边界；边界：仅为项目降额规则；同时不得超过 $P_{max}$。

### 达到 150 W 限值的输入电压分界

$$
V_{full} = P_{max}/(k_{derate}·I_{cont})
$$

其中，$V_{full}$ 表示达到 150 W 限值的输入电压分界；$k_{derate}$ 表示低输入功率降额系数，本册取 0.8；$I_{cont}$ 表示主电感连续电流的设计中心值。

我代入 $P_{max}$ = 150 W，$k_{derate}$ = 0.8，$I_{cont}$ = 10 A，得到 $V_{full}$ ≈ **18.75 V**。


## 3. 工作模式与占空比

我按 TI LM5176 的详细设计顺序，分别建立 Buck 与 Boost 工作状态和占空比；过渡区控制留到功率级之后专项校核。

### 36 V→18 V Buck 理想占空比

$$
D_{buck} = V_{outbuck}/V_{inbuck}
$$
{{derive:inductor-volt-second-ripple-foundation|伏秒与纹波基础|blue}}

其中，$D_{buck}$ 表示36 V→18 V Buck 理想占空比；$V_{outbuck}$ 表示Buck 纹波校核工况的输出电压，本册取 18 V；$V_{inbuck}$ 表示Buck 纹波校核工况的输入电压，本册取 36 V。

我代入 $V_{outbuck}$ = 18 V，$V_{inbuck}$ = 36 V，得到 $D_{buck}$ ≈ **0.5**。

### 12 V→36 V Boost 理想占空比

$$
D_{boost} = 1-V_{inboost}/V_{outboost}
$$
{{derive:inductor-volt-second-ripple-foundation|Boost 占空推导|green}}

其中，$D_{boost}$ 表示12 V→36 V Boost 理想占空比；$V_{inboost}$ 表示Boost 纹波校核工况的输入电压，本册取 12 V；$V_{outboost}$ 表示Boost 纹波校核工况的输出电压，本册取 36 V。

我代入 $V_{inboost}$ = 12 V，$V_{outboost}$ = 36 V，得到 $D_{boost}$ ≈ **0.6667**。


## 4. 主电感与电流应力

我按 TI LM5176 与 ADI LTC3789 的做法，在 Buck、Boost 两种模式下比较电感纹波、峰值和限流裕量，并以更严边界选择磁件。

### 36 V→18 V Buck 电感峰峰纹波

$$
dI_{buck} = (V_{inbuck}-V_{outbuck})·D_{buck}/(L_{nom}·f_{sw})
$$
{{derive:inductor-volt-second-ripple-foundation|Buck 纹波推导|blue}}

其中，$dI_{buck}$ 表示Buck 校核工况的电感峰峰纹波；$V_{inbuck}$ 表示Buck 纹波校核工况的输入电压，本册取 36 V；$V_{outbuck}$ 表示Buck 纹波校核工况的输出电压，本册取 18 V。

我代入 $V_{inbuck}$ = 36 V，$V_{outbuck}$ = 18 V，$D_{buck}$ = 0.5，$L_{nom}$ = 15 μH，$f_{sw}$ = 200 kHz，得到 $dI_{buck}$ ≈ **3 A**。

### Buck 连续目标下峰值电流

$$
I_{pkbuck} = I_{cont}+dI_{buck}/2
$$

其中，$I_{pkbuck}$ 表示Buck 连续目标下峰值电流；$I_{cont}$ 表示主电感连续电流的设计中心值；$dI_{buck}$ 表示Buck 校核工况的电感峰峰纹波。

我代入 $I_{cont}$ = 10 A，$dI_{buck}$ = 3 A，得到 $I_{pkbuck}$ ≈ **11.5 A**。

### Buck 连续目标下谷值电流

$$
I_{valbuck} = I_{cont}-dI_{buck}/2
$$

其中，$I_{valbuck}$ 表示Buck 连续目标下谷值电流；$I_{cont}$ 表示主电感连续电流的设计中心值；$dI_{buck}$ 表示Buck 校核工况的电感峰峰纹波。

我代入 $I_{cont}$ = 10 A，$dI_{buck}$ = 3 A，得到 $I_{valbuck}$ ≈ **8.5 A**。

### Buck 峰值到 12.5 A CBC 的名义裕量

$$
M_{cbuck} = I_{cbc}-I_{pkbuck}
$$

其中，$M_{cbuck}$ 表示Buck 峰值电流到逐周期限流阈值的名义裕量；$I_{cbc}$ 表示逐周期电流限制（cycle-by-cycle limit）的标称阈值。

我代入 $I_{cbc}$ = 12.5 A，$I_{pkbuck}$ = 11.5 A，得到 $M_{cbuck}$ ≈ **1 A**。

> 我将该结果用于标称 15 μH 与额定 CBC 初值；边界：未计入电感、公差、采样误差、瞬态和延迟。

### 12 V→36 V Boost 电感峰峰纹波

$$
dI_{boost} = V_{inboost}·D_{boost}/(L_{nom}·f_{sw})
$$
{{derive:inductor-volt-second-ripple-foundation|Boost 纹波推导|green}}

其中，$dI_{boost}$ 表示Boost 校核工况的电感峰峰纹波；$V_{inboost}$ 表示Boost 纹波校核工况的输入电压，本册取 12 V。

我代入 $V_{inboost}$ = 12 V，$D_{boost}$ = 0.6667，$L_{nom}$ = 15 μH，$f_{sw}$ = 200 kHz，得到 $dI_{boost}$ ≈ **2.667 A**。

### Boost 连续目标下峰值电流

$$
I_{pkboost} = I_{cont}+dI_{boost}/2
$$

其中，$I_{pkboost}$ 表示Boost 连续目标下峰值电流；$I_{cont}$ 表示主电感连续电流的设计中心值；$dI_{boost}$ 表示Boost 校核工况的电感峰峰纹波。

我代入 $I_{cont}$ = 10 A，$dI_{boost}$ = 2.667 A，得到 $I_{pkboost}$ ≈ **11.333 A**。

### Boost 连续目标下谷值电流

$$
I_{valboost} = I_{cont}-dI_{boost}/2
$$

其中，$I_{valboost}$ 表示Boost 连续目标下谷值电流；$I_{cont}$ 表示主电感连续电流的设计中心值；$dI_{boost}$ 表示Boost 校核工况的电感峰峰纹波。

我代入 $I_{cont}$ = 10 A，$dI_{boost}$ = 2.667 A，得到 $I_{valboost}$ ≈ **8.667 A**。

### Boost 峰值到 12.5 A CBC 的名义裕量

$$
M_{cboost} = I_{cbc}-I_{pkboost}
$$

其中，$M_{cboost}$ 表示Boost 峰值电流到逐周期限流阈值的名义裕量；$I_{cbc}$ 表示逐周期电流限制（cycle-by-cycle limit）的标称阈值。

我代入 $I_{cbc}$ = 12.5 A，$I_{pkboost}$ = 11.333 A，得到 $M_{cboost}$ ≈ **1.167 A**。

> 我将该结果用于标称 15 μH 与额定 CBC 初值；边界：未计入电感、公差、采样误差、瞬态和延迟。

### 15 μH/10 A 电感储能

$$
E_{L10} = 0.5·L_{nom}·I_{cont²}
$$

其中，$E_{L10}$ 表示15 μH/10 A 电感储能；$I_{cont}$ 表示主电感连续电流的设计中心值。

我代入 $L_{nom}$ = 15 μH，$I_{cont}$ = 10 A，得到 $E_{L10}$ ≈ **750 μJ**。

> 我将该结果用于标称电感与连续电流目标；边界：不代表磁芯损耗；需 Isat、B-H 与热模型。


## 5. 功率器件与驱动

我在电流应力之后检查 MOSFET 耐压降额、死区与驱动边界；最终选型仍需补齐 RDS(on)、Qg、Coss、Qrr、SOA 和热数据。

### VDS 峰值项目目标占耐压比例

$$
k_{vds} = V_{dspeak}/V_{dsrated}
$$

其中，$k_{vds}$ 表示预期 VDS 峰值占 MOSFET 额定耐压的比例；$V_{dspeak}$ 表示MOSFET 预期漏源峰值；$V_{dsrated}$ 表示MOSFET 额定漏源耐压。

我代入 $V_{dspeak}$ = 80 V，$V_{dsrated}$ = 100 V，得到 $k_{vds}$ ≈ **0.8**。

> 我将该结果用于100 V MOS 候选与 <80 V 样板目标；边界：$V_{dspeak}$ 尚未实测，当前只是项目目标比例。

### 150 ns 死区占一个周期的比例

$$
k_{dead} = t_{dead}·f_{sw}
$$

其中，$k_{dead}$ 表示死区时间占一个开关周期的比例；$t_{dead}$ 表示同一桥臂上下管互补切换的死区时间。

我代入 $t_{dead}$ = 0.15 μs，$f_{sw}$ = 200 kHz，得到 $k_{dead}$ ≈ **0.03**。


## 6. 输入输出电容

我将按 Buck 输入电容 RMS、Boost 输出电容 RMS、偏压降额、ESR/ESL、纹波与瞬态选择电容阵列；当前网络未冻结，因此本节保留为签核阻断。


## 7. 电流采样与保护

我先计算 shunt 压降与损耗，再闭合逐周期限流、硬件 OCP 阈值、blanking 和越阈至 VGS 关断的总延迟。

### 500 ns 目标延迟对应最大电流上冲

$$
dI_{delay} = V_{inmax}·t_{off}/L_{nom}
$$

其中，$dI_{delay}$ 表示500 ns 目标延迟对应最大电流上冲；$t_{off}$ 表示电流越阈到实际门极关断的总延迟目标。

我代入 $V_{inmax}$ = 36 V，$t_{off}$ = 0.5 μs，$L_{nom}$ = 15 μH，得到 $dI_{delay}$ ≈ **1.2 A**。

### 目标延迟下故障峰值

$$
I_{faultpk} = I_{hard}+dI_{delay}
$$

其中，$I_{faultpk}$ 表示硬件阈值与关断延迟上冲相加得到的故障峰值；$I_{hard}$ 表示独立硬件过流保护的标称动作电流。

我代入 $I_{hard}$ = 14 A，$dI_{delay}$ = 1.2 A，得到 $I_{faultpk}$ ≈ **15.2 A**。

> 我将该结果用于14 A typ 越阈后按 500 ns 目标延迟继续上升；边界：仅是目标闭合值；真实峰值取决于阈值公差、滤波、延迟和 Lmin。

### 故障峰值到 16 A 项目上限的目标裕量

$$
M_{fault} = I_{faultmax}-I_{faultpk}
$$

其中，$M_{fault}$ 表示故障峰值到 16 A 项目上限的目标裕量；$I_{faultmax}$ 表示计入阈值与关断延迟后允许的故障峰值上限；$I_{faultpk}$ 表示硬件阈值与关断延迟上冲相加得到的故障峰值。

我代入 $I_{faultmax}$ = 16 A，$I_{faultpk}$ = 15.2 A，得到 $M_{fault}$ ≈ **0.8 A**。

### 100 ns blanking 内最大理想电流增量

$$
dI_{blank} = V_{inmax}·t_{blank}/L_{nom}
$$

其中，$dI_{blank}$ 表示100 ns blanking 内最大理想电流增量；$t_{blank}$ 表示开通后暂时屏蔽尖峰的 blanking 时间。

我代入 $V_{inmax}$ = 36 V，$t_{blank}$ = 0.1 μs，$L_{nom}$ = 15 μH，得到 $dI_{blank}$ ≈ **0.24 A**。

### 10 A 连续电流的 shunt 压降

$$
V_{shunt10} = I_{cont}·R_{shunt}
$$

其中，$V_{shunt10}$ 表示10 A 连续电流的 shunt 压降；$I_{cont}$ 表示主电感连续电流的设计中心值；$R_{shunt}$ 表示主电感电流检测用四端分流电阻。

我代入 $I_{cont}$ = 10 A，$R_{shunt}$ = 0.002 Ω，得到 $V_{shunt10}$ ≈ **0.02 V**。

### 10 A 连续电流的 shunt 损耗

$$
P_{shunt10} = I_{cont²}·R_{shunt}
$$

其中，$P_{shunt10}$ 表示10 A 连续电流的 shunt 损耗；$I_{cont}$ 表示主电感连续电流的设计中心值；$R_{shunt}$ 表示主电感电流检测用四端分流电阻。

我代入 $I_{cont}$ = 10 A，$R_{shunt}$ = 0.002 Ω，得到 $P_{shunt10}$ ≈ **0.2 W**。

### 14 A 硬 OCP 点的 shunt 压降

$$
V_{shunt14} = I_{hard}·R_{shunt}
$$

其中，$V_{shunt14}$ 表示14 A 硬 OCP 点的 shunt 压降；$I_{hard}$ 表示独立硬件过流保护的标称动作电流；$R_{shunt}$ 表示主电感电流检测用四端分流电阻。

我代入 $I_{hard}$ = 14 A，$R_{shunt}$ = 0.002 Ω，得到 $V_{shunt14}$ ≈ **0.028 V**。

### 14 A 等效连续下的 shunt 损耗量级

$$
P_{shunt14} = I_{hard²}·R_{shunt}
$$

其中，$P_{shunt14}$ 表示14 A 等效连续下的 shunt 损耗量级；$I_{hard}$ 表示独立硬件过流保护的标称动作电流；$R_{shunt}$ 表示主电感电流检测用四端分流电阻。

我代入 $I_{hard}$ = 14 A，$R_{shunt}$ = 0.002 Ω，得到 $P_{shunt14}$ ≈ **0.392 W**。

### 14 A 时快速 CSA 相对中点偏移

$$
V_{csaShift} = I_{hard}·R_{shunt}·G_{fast}
$$

其中，$V_{csaShift}$ 表示快速电流放大器相对中点的输出偏移量；$I_{hard}$ 表示独立硬件过流保护的标称动作电流；$R_{shunt}$ 表示主电感电流检测用四端分流电阻；$G_{fast}$ 表示快速电流检测放大链路的电压增益。

我代入 $I_{hard}$ = 14 A，$R_{shunt}$ = 0.002 Ω，$G_{fast}$ = 20，得到 $V_{csaShift}$ ≈ **0.56 V**。

### 正向 14 A 窗口比较器标称电平

$$
V_{csaPos} = V_{ref}+V_{csaShift}
$$

其中，$V_{csaPos}$ 表示正向过流比较器的标称电平；$V_{ref}$ 表示双向电流检测输出的零电流中点电压；$V_{csaShift}$ 表示快速电流放大器相对中点的输出偏移量。

我代入 $V_{ref}$ = 1.65 V，$V_{csaShift}$ = 0.56 V，得到 $V_{csaPos}$ ≈ **2.21 V**。

### 反向 -14 A 窗口比较器标称电平

$$
V_{csaNeg} = V_{ref}-V_{csaShift}
$$

其中，$V_{csaNeg}$ 表示反向过流比较器的标称电平；$V_{ref}$ 表示双向电流检测输出的零电流中点电压；$V_{csaShift}$ 表示快速电流放大器相对中点的输出偏移量。

我代入 $V_{ref}$ = 1.65 V，$V_{csaShift}$ = 0.56 V，得到 $V_{csaNeg}$ ≈ **1.09 V**。


## 8. 控制与过渡区专项校核

我把 P/C+/C− 三状态调制放在功率级选型之后，因为它属于 STM32G474 的控制实现专项，不是常规 BUCK-BOOST 元件选型的起点；我再用 ST AN4539 的四开关工作模态检查状态互锁与过渡纹波。

### 过渡区上边界

$$
r_{high} = 1/r_{low}
$$

其中，$r_{high}$ 表示Boost 侧离开过渡区的电压比上边界；$r_{low}$ 表示Buck 侧进入过渡区的电压比下边界。

我代入 $r_{low}$ = 0.95，得到 $r_{high}$ ≈ **1.0526**。

### r=1 时输入桥高边占空

$$
dA_{trans} = 1-mu_{max}
$$
{{derive:four-switch-buck-boost-transition-derivation|三状态调制推导|purple}}

其中，$dA_{trans}$ 表示过渡中心输入桥高边的占空比；$mu_{max}$ 表示过渡中心单个修正状态允许的最大周期占比。

我代入 $mu_{max}$ = 0.05，得到 $dA_{trans}$ ≈ **0.95**。

### r=1 时输出桥高边占空

$$
dB_{trans} = dA_{trans}/r_{trans}
$$
{{derive:four-switch-buck-boost-transition-derivation|伏秒约束|purple}}

其中，$dB_{trans}$ 表示过渡中心输出桥高边的占空比；$dA_{trans}$ 表示过渡中心输入桥高边的占空比；$r_{trans}$ 表示过渡区电压比 VOUT/VIN，中心点等于 1。

我代入 $dA_{trans}$ = 0.95，$r_{trans}$ = 1，得到 $dB_{trans}$ ≈ **0.95**。

### r=1 时双高边近直通状态占比

$$
dP_{trans} = dA_{trans}+dB_{trans}-1
$$
{{derive:four-switch-buck-boost-transition-derivation|状态占用率|purple}}

其中，$dP_{trans}$ 表示过渡中心两个高边同时导通的主状态占比；$dA_{trans}$ 表示过渡中心输入桥高边的占空比；$dB_{trans}$ 表示过渡中心输出桥高边的占空比。

我代入 $dA_{trans}$ = 0.95，$dB_{trans}$ = 0.95，得到 $dP_{trans}$ ≈ **0.9**。

### 5% 修正脉冲时间

$$
t_{corr} = mu_{max}/f_{sw}
$$
{{derive:four-switch-buck-boost-transition-derivation|修正脉冲时间|purple}}

其中，$t_{corr}$ 表示每个过渡区修正状态在一个周期内的持续时间；$mu_{max}$ 表示过渡中心单个修正状态允许的最大周期占比。

我代入 $mu_{max}$ = 0.05，$f_{sw}$ = 200 kHz，得到 $t_{corr}$ ≈ **0.25 μs**。

> 我将该结果用于200 kHz、5% 初始修正脉冲；边界：250 ns 必须由实桥最小可靠脉宽验证。

### 三状态 5% 修正段纹波量级

$$
dI_{trans} = V_{intrans}·mu_{max}/(L_{nom}·f_{sw})
$$
{{derive:four-switch-buck-boost-transition-derivation|过渡区纹波推导|purple}}

其中，$dI_{trans}$ 表示三状态修正方案单个修正段的电流变化量；$V_{intrans}$ 表示过渡区调制纹波校核电压，本册令 VIN=VOUT=36 V，只用于比较两种调制，不是新增额定输入；$mu_{max}$ 表示过渡中心单个修正状态允许的最大周期占比。

我代入 $V_{intrans}$ = 36 V，$mu_{max}$ = 0.05，$L_{nom}$ = 15 μH，$f_{sw}$ = 200 kHz，得到 $dI_{trans}$ ≈ **0.6 A**。

### 简单对角半周期方案纹波量级

$$
dI_{diag} = V_{intrans}·0.5/(L_{nom}·f_{sw})
$$

其中，$dI_{diag}$ 表示简单对角方案半周期内的电流变化量；$V_{intrans}$ 表示过渡区调制纹波校核电压，本册令 VIN=VOUT=36 V，只用于比较两种调制，不是新增额定输入。

我代入 $V_{intrans}$ = 36 V，$L_{nom}$ = 15 μH，$f_{sw}$ = 200 kHz，得到 $dI_{diag}$ ≈ **6 A**。

### 三状态修正段相对对角方案纹波比例

$$
k_{ripple} = dI_{trans}/dI_{diag}
$$

其中，$k_{ripple}$ 表示两种过渡调制电流变化量的比值；$dI_{trans}$ 表示三状态修正方案单个修正段的电流变化量；$dI_{diag}$ 表示简单对角方案半周期内的电流变化量。

我代入 $dI_{trans}$ = 0.6 A，$dI_{diag}$ = 6 A，得到 $k_{ripple}$ ≈ **0.1**。

### 三状态修正段名义峰值

$$
I_{pktrans} = I_{cont}+dI_{trans}/2
$$

其中，$I_{pktrans}$ 表示三状态修正段名义峰值；$I_{cont}$ 表示主电感连续电流的设计中心值；$dI_{trans}$ 表示三状态修正方案单个修正段的电流变化量。

我代入 $I_{cont}$ = 10 A，$dI_{trans}$ = 0.6 A，得到 $I_{pktrans}$ ≈ **10.3 A**。

### 过渡区峰值到 CBC 的名义裕量

$$
M_{ctrans} = I_{cbc}-I_{pktrans}
$$

其中，$M_{ctrans}$ 表示过渡区峰值到 CBC 的名义裕量；$I_{cbc}$ 表示逐周期电流限制（cycle-by-cycle limit）的标称阈值。

我代入 $I_{cbc}$ = 12.5 A，$I_{pktrans}$ = 10.3 A，得到 $M_{ctrans}$ ≈ **2.2 A**。

### 现有板自举刷新后的最大高边占空

$$
D_{maxlegacy} = (N_{total}-N_{refresh})/N_{total}
$$

其中，$D_{maxlegacy}$ 表示现有板自举刷新后的最大高边占空；$N_{total}$ 表示现有控制周期的总计数；$N_{refresh}$ 表示现有控制每周期强制自举刷新的计数。

我代入 $N_{total}$ = 940，$N_{refresh}$ = 40，得到 $D_{maxlegacy}$ ≈ **0.95745**。

### 25 V→24 V 理想 Buck 占空需求

$$
D_{reqnear} = V_{outnear}/V_{innear}
$$

其中，$D_{reqnear}$ 表示25 V→24 V 理想 Buck 占空需求；$V_{outnear}$ 表示近直通能力审计工况的输出电压，本册取 24 V；$V_{innear}$ 表示近直通能力审计工况的输入电压，本册取 25 V。

我代入 $V_{outnear}$ = 24 V，$V_{innear}$ = 25 V，得到 $D_{reqnear}$ ≈ **0.96**。

### 现有板近直通占空缺口

$$
dD_{near} = D_{reqnear}-D_{maxlegacy}
$$

其中，$dD_{near}$ 表示近直通所需占空比超出现有控制上限的差值。

我代入 $D_{reqnear}$ = 0.96，$D_{maxlegacy}$ = 0.95745，得到 $dD_{near}$ ≈ **0.002553**。

> 我将该结果用于25 V→24 V 与现有每周期刷新上限的理想比较；边界：正值已表明理想占空超限；非理想压降只会扩大缺口。


## 9. 损耗与热设计

我将在器件、磁件、电容和 PCB 热路径冻结后，逐项汇总导通、开关、磁芯、铜损、偏置与散热，并建立全输入输出范围的结温和降额曲线。

## 10. 容差、验证与结论

我依据当前标称计算给出以下工程判断和裕量结论。

- 我确认：Buck 仅输入桥 PWM；Boost 仅输出桥 PWM；过渡区采用 P/C+/C- 三状态调制。
- 我确认：拒绝两个对角状态各约半周期的过渡方案，因为 36 V/15 μH/200 kHz 下理想纹波约 6 A。
- 我确认：RevA 额定路线采用两路独立浮动高边偏置；周期刷新仅 DNP 对照，交叉供电不采用。
- 我确认：采用精密 ADC 与快速 OCP 双路径；外部窗口比较器/锁存器直接关闭两颗驱动 EN。

我检查的裕量：

- [满足] Buck 标称峰值到 CBC：名义裕量>0 A；最终需在 Lmin、fsmin 与全公差下仍不误触发
- [满足] Boost 标称峰值到 CBC：名义裕量>0 A；最终需在 Lmin、fsmin 与全公差下仍不误触发
- [待验证] 过渡中心标称峰值到 CBC：名义裕量>0 A，且模式切换无额外峰值/反向电流
- [不满足] 现有板 25 V→24 V 占空能力：$D_{reqnear}$≤$D_{maxlegacy}$；当前差值为正，且尚未计入压降
- [待验证] 目标延迟下故障峰值：$I_{faultpk}$<16 A；必须用 Lmin、阈值公差和实测延迟重新验证
- [待验证] MOSFET 电压降额目标：VDS_peak/VDS_rated<0.8；当前 0.8 是目标边界，不是实测结果

### 适用边界

我尚未闭合最终 MOSFET、磁件与电容选型，保护链全公差和实测延迟，控制环路以及 150 W 热设计；这些条件不改变本册标称公式，但限制结论仅用于设计评审。

> 我只在上述边界内使用本册结果。
