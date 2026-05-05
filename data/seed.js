window.GOKOTTA_PROJECTS = [
  {
    id: "power-amp",
    slug: "power-amp",
    type: "project",
    title: "桌面功率放大器",
    status: "规划中",
    statusKey: "planned",
    license: "MIT License",
    stars: 256,
    date: "2026-05-03",
    version: "规划中",
    progress: 20,
    tags: "开源硬件,功率放大器,音频,BOM,PCB,项目规划,复现指南",
    cover: "./assets/covers/project-cover.png",
    summary: "面向音频实验和桌面音箱的小型功放项目，沉淀原理图、PCB、BOM 与调试记录。",
    markdown: `# 桌面功率放大器

这个项目目前处于规划中，访客暂时只能在首页和项目列表看到概述。正式上线后，这里会开放完整文档。

## 项目状态

- 当前阶段：需求拆解和模块规划
- 最新版本：规划中
- 已完成：应用场景、模块边界、资料清单
- 下一步：输入级和保护电路方案比较

## 设计目标

- 支持桌面无源音箱。
- 输入接口清晰。
- 保护电路完整。
- PCB 和外壳易于复刻。

## 系统结构

- 前级输入
- 音量控制
- 功率放大核心
- 电源与保护
- 面板状态指示

## BOM

第一版 BOM 将优先选择常见器件，并记录关键器件替代料，避免项目只能依赖单一采购渠道。

## 原理图

重点关注输入保护、静音控制、电源滤波和扬声器保护。正式发布时会提供原理图 PDF。

## PCB

布局阶段会分离大电流路径、输入小信号路径和控制信号路径，并保留关键测试点。

## 固件

如果加入温度检测、静音控制或状态指示，固件会单独维护版本记录。

## 调试记录

调试记录将覆盖底噪、开关机冲击声、温升和保护动作。`
  },
  {
    id: "logic-analyzer",
    slug: "logic-analyzer",
    type: "project",
    title: "GokottaLogic 逻辑分析仪",
    status: "已上线",
    statusKey: "online",
    license: "CC BY 4.0",
    stars: 189,
    date: "2026-05-03",
    version: "HW v0.1",
    progress: 65,
    tags: "开源硬件,逻辑分析仪,STM32,协议解码,固件,测量工具,复现指南",
    cover: "./assets/covers/stm32-cover.png",
    summary: "基于 STM32 的多通道逻辑分析仪，支持 100MHz 采样率和多种协议解码。",
    markdown: `# GokottaLogic 逻辑分析仪

GokottaLogic 是一个面向嵌入式调试的开源逻辑分析仪项目。

## 项目状态

- 当前阶段：已上线基础文档
- 最新版本：HW v0.1
- 已完成：采样架构、协议解码规划、数据导出接口规划
- 下一步：补充固件构建方式和上位机数据格式

## 设计目标

- 多通道数字采样。
- 最高 100MHz 采样率规划。
- 支持 UART、I2C、SPI 协议解析。
- 提供上位机数据导出接口。

## 系统结构

采样前端负责电平输入和保护，STM32 固件负责定时采样与缓冲，上位机负责数据展示和协议解析。

## BOM

关键器件包括 STM32 主控、输入保护器件、时钟源、USB 接口和电源稳压芯片。

## 原理图

原理图重点关注输入保护、采样时钟、USB 通信和电源完整性。

## PCB

高速数字采样需要控制输入走线长度、地回流和 USB 差分线阻抗。

## 固件

固件模块建议拆分为采样驱动、缓冲管理、USB 传输和协议数据封装。

## 调试记录

第一批调试重点是采样稳定性、边沿抖动、长时间采集丢包和协议解码正确性。`
  },
  {
    id: "smart-home-hub",
    slug: "smart-home-hub",
    type: "project",
    title: "ESP32 智能家居节点",
    status: "已上线",
    statusKey: "online",
    license: "MIT License",
    stars: 128,
    date: "2026-05-03",
    version: "HW v0.1",
    progress: 70,
    tags: "开源硬件,ESP32,低功耗,MQTT,传感器节点,智能家居,复现指南",
    cover: "./assets/covers/esp32-cover.png",
    summary: "基于 ESP32 的低功耗温湿度记录仪，支持 Wi-Fi 上报与本地存储。",
    markdown: `# ESP32 智能家居节点

这是一个基于 ESP32 的低功耗智能家居节点，用于传感器采集、MQTT 上报和本地状态记录。

## 项目状态

- 当前阶段：已上线基础文档
- 最新版本：HW v0.1
- 已完成：低功耗工作流、MQTT 上报、温湿度与电池状态采集
- 下一步：补充外壳、功耗实测和 OTA 维护窗口

## 设计目标

- 每 5 分钟周期唤醒。
- 采集温湿度与电池电压。
- 通过 Wi-Fi 上报 MQTT。
- 大部分时间进入 Deep Sleep。

## 系统结构

ESP32 负责联网和主控，传感器模块按需供电，电池检测电路只在采样前短时间打开。

## BOM

关键器件包括 ESP32 模组、温湿度传感器、低静态电流稳压芯片、电池座和受控分压电路。

## 原理图

原理图重点关注传感器断电控制、电池电压检测、下载接口和唤醒 GPIO。

## PCB

PCB 需要保留天线净空区，并降低休眠时可能漏电的外围路径。

## 固件

固件模块包含 Wi-Fi 连接、MQTT 发布、传感器读取、电池检测、Deep Sleep 和 OTA 维护窗口。

## 调试记录

调试重点包括休眠电流、联网耗时、上报成功率、电池读数稳定性和低电量告警。`
  },
  {
    id: "programmable-power",
    slug: "programmable-power",
    type: "project",
    title: "可编程电源 0-30V/3A",
    status: "开发中",
    statusKey: "development",
    license: "GPL-3.0",
    stars: 312,
    date: "2026-05-03",
    version: "规划中",
    progress: 45,
    tags: "开源硬件,可编程电源,电源,ADC,校准,保护,PCB,复现指南",
    cover: "./assets/hero/electronics-lab-hero.png",
    summary: "开源可编程直流电源设计，支持电压电流设置、显示和保护功能。",
    markdown: `# 可编程电源 0-30V/3A

这个项目正在开发中，当前开放设计目标和模块规划。

## 项目状态

- 当前阶段：开发中
- 最新版本：规划中
- 已完成：输出指标、控制模块、保护模块规划
- 下一步：采样校准和散热方案验证

## 设计目标

- 输出范围 0-30V。
- 最大输出电流 3A。
- 支持电压电流设置、显示和保护。
- 适合桌面电子实验。

## 系统结构

电源主回路负责输出调节，采样链路负责电压电流检测，控制器负责设定、显示和保护判断。

## BOM

关键器件包括功率器件、采样电阻、运放、ADC 或 MCU、显示模块、散热器和保护器件。

## 原理图

原理图重点关注电流采样、反馈稳定性、过流保护、过温保护和输出端防反接。

## PCB

PCB 需要处理大电流走线、采样 Kelvin 连接、散热铜皮和输入输出端子机械强度。

## 固件

固件模块包含设定值管理、ADC 采样校准、显示刷新、保护状态机和参数保存。

## 调试记录

调试重点包括输出纹波、负载瞬态、过流保护动作、温升和长时间稳定性。`
  }
];

window.GOKOTTA_SEED = {
  projects: window.GOKOTTA_PROJECTS
};
