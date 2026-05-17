window.GOKOTTA_POSTS = [
  {
    id: "analog-active-filter",
    slug: "analog-active-filter",
    type: "post",
    title: "有源低通滤波器设计与仿真分析",
    category: "模拟电子",
    categoryKey: "analog",
    recommendationPriority: 10,
    date: "2026-05-03",
    readTime: "12 分钟阅读",
    excerpt: "从指标拆解、拓扑选择、参数计算到示波器验证，整理一套可复用的模拟前端设计流程。",
    cover: "./assets/covers/analog-cover.png",
    tags: "模拟电子,滤波器,低通滤波,Sallen-Key,运放,仿真,调试,设计指南",
    markdown: `# 有源低通滤波器设计与仿真分析

在模拟前端里，低通滤波器通常承担两件事：限制信号带宽，以及在 ADC 采样前抑制高频噪声。本文以二阶 Sallen-Key 低通滤波器为例，整理从指标拆解到调试验证的完整流程。

## 设计目标

- 输入信号幅度：0.2 Vpp 到 2 Vpp
- 截止频率：1 kHz
- 供电：3.3 V 单电源
- 输出对象：MCU ADC 输入
- 设计关注点：截止频率、Q 值、运放带宽、输出摆幅和输入保护

## 电路拓扑

Sallen-Key 结构适合做低到中等阶数的主动滤波。它的优点是元件数量少、输入阻抗高、调试直观，适合嵌入式设备里的传感器前端。

\`\`\`text
Vin -> R1 -> R2 -> Vout
          |     |
          C1    C2
          |     |
         GND   GND
\`\`\`

如果需要改善 ADC 采样瞬间的电荷注入影响，可以在滤波器输出与 ADC 引脚之间串入 47R 到 220R 的小电阻，并在 ADC 引脚附近放置 1 nF 到 10 nF 的小电容。

## 参数计算

截止频率可以从下面的关系式开始估算：

\`\`\`text
fc = 1 / (2 * pi * sqrt(R1 * R2 * C1 * C2))
\`\`\`

当 R1 = R2 且 C1 = C2 时，计算会变得很直观：

\`\`\`text
R = 15.9 kOhm
C = 10 nF
fc ~= 1 kHz
\`\`\`

实际设计时不建议只追求公式值完全漂亮。更重要的是选择常见阻容值，并结合误差、温漂和运放 GBW 做裕量检查。

## 运放选择

低通滤波器并不意味着运放可以随便选。需要重点检查：

- GBW 至少高于截止频率几十倍。
- 输入共模范围覆盖传感器信号。
- 输出摆幅能接近 ADC 满量程。
- 单电源供电时是否需要虚拟中点。
- 输入偏置电流是否会在大电阻上产生明显误差。

## 仿真与验证

建议先做 AC Sweep，再做瞬态仿真。AC Sweep 看幅频曲线和相位变化，瞬态仿真看阶跃响应、过冲和稳定时间。

\`\`\`c
for (uint16_t i = 0; i < sample_count; i++) {
  adc_buffer[i] = read_adc_channel(0);
}
\`\`\`

## 常见问题

- **截止频率偏移**：优先检查电阻电容实际误差，再看运放 GBW 是否不足。
- **输出波形削顶**：检查单电源供电下输入共模范围和输出摆幅，必要时增加偏置中点。
- **ADC 读数抖动**：确认滤波器输出到 ADC 引脚之间是否有合适的串联电阻和就近小电容。

## 扩展阅读

- STM32 ADC 模拟采样从原理到精度优化
- ADC 前端 RC 滤波与输入保护电路设计
- 运放 GBW、压摆率和输出摆幅怎么影响滤波器

## 小结

一个可靠的模拟前端不是只靠公式算出来的。它需要在电路拓扑、元件误差、运放能力、PCB 布局和 MCU 采样策略之间取得平衡。`
  },
  {
    id: "stm32-adc-dma-precision",
    slug: "stm32-adc-dma-precision",
    type: "post",
    title: "STM32 ADC 模拟采样从原理到精度优化",
    category: "STM32",
    categoryKey: "stm32",
    recommendationPriority: 20,
    date: "2026-05-03",
    readTime: "15 分钟阅读",
    excerpt: "围绕采样时间、DMA 环形缓冲、参考电压和软件滤波，建立稳定可信的 ADC 采样链路。",
    cover: "./assets/covers/stm32-cover.png",
    tags: "STM32,ADC,DMA,采样时间,环形缓冲,校准,调试,设计指南",
    markdown: `# STM32 ADC 模拟采样从原理到精度优化

STM32 的 ADC 很容易跑起来，但要得到稳定、可信的采样结果，需要同时处理模拟前端、参考电压、采样时间、DMA 缓冲和软件滤波。

## 采样链路

一个典型采样链路包含：

- 传感器或模拟信号源
- RC 滤波与输入保护
- ADC 采样保持电容
- DMA 环形缓冲
- 数据校准与滤波

任何一个环节不稳定，最终数据都会漂移或抖动。

## ADC 时钟

ADC 时钟不宜一味追求最高。过高的 ADC 时钟会压缩采样窗口，让高阻信号源无法充分给采样电容充电。

\`\`\`c
hadc1.Init.ClockPrescaler = ADC_CLOCK_SYNC_PCLK_DIV4;
hadc1.Init.Resolution = ADC_RESOLUTION_12B;
hadc1.Init.ContinuousConvMode = ENABLE;
\`\`\`

## 采样时间

如果输入源阻抗较高，应选择更长采样时间。经验上，传感器输出后面如果串联了较大的保护电阻，采样时间需要适当加长。

\`\`\`c
sConfig.SamplingTime = ADC_SAMPLETIME_92CYCLES_5;
\`\`\`

## DMA 环形缓冲

连续采样建议使用 DMA circular mode。这样 CPU 不需要每次等待转换完成，只要在半满和全满回调中处理数据。

\`\`\`c
#define ADC_BUFFER_SIZE 256

uint16_t adc_buffer[ADC_BUFFER_SIZE];

HAL_ADC_Start_DMA(&hadc1, (uint32_t *)adc_buffer, ADC_BUFFER_SIZE);
\`\`\`

## 精度优化

提高采样质量可以从这些方向入手：

- 使用稳定参考电压。
- 减小模拟地回流干扰。
- ADC 引脚附近放置小电容。
- 做多点校准，而不是只做单点校准。
- 对周期性噪声使用同步采样或数字滤波。

## 常见问题

- **高阻信号源采样偏低**：通常是采样时间太短，采样保持电容没有充分充电。
- **DMA 数据偶发跳变**：检查缓冲区处理是否和 DMA 写入同时发生，优先使用半满和全满回调分段处理。
- **不同板子读数不一致**：确认参考电压、分压电阻误差和校准流程是否一致。

## 扩展阅读

- ADC 前端 RC 滤波与输入保护电路设计
- STM32 定时器触发 ADC 的稳定采样方案
- 模拟地、数字地与 ADC 噪声排查方法

## 小结

ADC 精度优化不是单一参数调优。真正有效的做法是把模拟电路、PCB、ADC 配置和软件滤波作为一个完整系统来设计。`
  },
  {
    id: "esp32-low-power-node",
    slug: "esp32-low-power-node",
    type: "post",
    title: "ESP32 低功耗智能家居节点设计指南",
    category: "ESP32",
    categoryKey: "esp32",
    recommendationPriority: 30,
    date: "2026-05-03",
    readTime: "14 分钟阅读",
    excerpt: "从硬件静态电流、Deep Sleep、MQTT 上报到 OTA 维护，设计一个真正省电的联网节点。",
    cover: "./assets/covers/esp32-cover.png",
    tags: "ESP32,低功耗,Deep Sleep,MQTT,传感器节点,电池供电,智能家居,设计指南",
    markdown: `# ESP32 低功耗智能家居节点设计指南

ESP32 适合做联网设备，但默认工作模式功耗较高。电池供电的智能家居节点需要围绕唤醒、采集、上报和休眠重新设计。

## 应用场景

本文假设设备是一个温湿度记录节点：

- 每 5 分钟唤醒一次。
- 读取传感器数据。
- 通过 Wi-Fi 上报 MQTT。
- 支持低电量告警。
- 大部分时间进入 Deep Sleep。

## 硬件设计

低功耗设计首先从硬件开始。需要关注稳压芯片静态电流、传感器断电控制、分压电阻长期耗电和 GPIO 上拉下拉漏电。

## 唤醒策略

ESP32 支持定时唤醒和外部 GPIO 唤醒。周期上报类设备通常使用定时唤醒。

\`\`\`c
esp_sleep_enable_timer_wakeup(5ULL * 60ULL * 1000000ULL);
esp_deep_sleep_start();
\`\`\`

## MQTT 上报

上报流程要尽量短。建议缓存 Wi-Fi 配置，连接成功后立即发布数据，然后断开并进入休眠。

\`\`\`c
client.publish("home/node01/temperature", temperature_payload);
client.publish("home/node01/humidity", humidity_payload);
\`\`\`

## 电池电压检测

电池电压检测不应使用常通分压。可以用 MOS 管或 GPIO 控制分压电路，只在采样前短时间打开。

## 常见问题

- **休眠电流仍然偏高**：检查稳压芯片静态电流、传感器供电和 GPIO 上拉下拉。
- **Wi-Fi 连接耗时过长**：固定信道、保存连接信息，并减少唤醒后的扫描时间。
- **电池电压读数不准**：确认分压电阻误差、ADC 校准和 MOS 管导通后的稳定时间。

## 扩展阅读

- ESP32 Deep Sleep 实测功耗与唤醒策略
- ESP32 MQTT 上报链路：主题设计、重连和离线缓存
- ESP32 电池电压检测：分压、MOS 控制与校准

## 小结

ESP32 低功耗项目的关键不是单独调用 Deep Sleep，而是把硬件供电、连接时间、传感器工作模式和维护策略一起压缩到最小能耗路径。`
  },
  {
    id: "opensource-power-amplifier",
    slug: "opensource-power-amplifier",
    type: "post",
    title: "开源桌面功率放大器项目规划",
    category: "开源项目",
    categoryKey: "projects",
    recommendationPriority: 80,
    date: "2026-05-03",
    readTime: "10 分钟阅读",
    excerpt: "一个适合长期沉淀的开源硬件项目：原理图、PCB、BOM、固件、外壳和调试记录都应可复现。",
    cover: "./assets/covers/project-cover.png",
    tags: "开源硬件,项目规划,功率放大器,音频,BOM,PCB,调试记录,复现指南",
    markdown: `# 开源桌面功率放大器项目规划

桌面功率放大器是一个适合长期沉淀的开源硬件项目。它同时涉及模拟电路、电源、热设计、PCB 布局、外壳结构和用户体验。

## 项目目标

这个项目的目标不是堆砌功率参数，而是做一个适合学习和日常使用的小型功放平台。

- 支持桌面无源音箱。
- 输入接口清晰。
- 保护电路完整。
- PCB 和外壳易于复刻。
- 文档足够详细，方便二次开发。

## 模块划分

建议把项目拆成前级输入、功率放大核心、电源保护、温度检测、静音控制和面板状态指示。

## 原理图关注点

功放项目容易踩坑的地方包括地线回流、输入噪声、电源纹波和扬声器保护。

\`\`\`text
Audio In -> Input Buffer -> Volume -> Power Stage -> Speaker Out
                         -> Mute Control
Power In -> Protection -> Amplifier Supply
\`\`\`

## PCB 布局

布局时应让大电流路径、输入小信号路径和控制信号路径分区明确。功率回路要短，输入地要干净，散热铜皮和安装孔也要提前考虑。

## 常见问题

- **底噪明显**：优先检查输入地回路、电源纹波和前级增益是否过高。
- **开关机有冲击声**：需要静音控制和扬声器保护，不应只依赖手动操作顺序。
- **复现难度高**：BOM、PCB 版本、关键器件替代料和调试记录必须同步维护。

## 扩展阅读

- 开源硬件项目如何组织 BOM、原理图和调试记录
- 桌面功率放大器项目：输入级与保护电路规划
- 如何用示波器验证电源纹波和瞬态响应

## 小结

一个好的开源硬件项目，不只是一块能工作的 PCB。它应该让别人能理解设计原因、复现制作过程，并在你的基础上继续改进。`
  }
];
