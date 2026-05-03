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
    cover: "./assets/covers/project-cover.png",
    summary: "面向音频实验和桌面音箱的小型功放项目，沉淀原理图、PCB、BOM 与调试记录。",
    markdown: `# 桌面功率放大器

这个项目目前处于规划中，访客暂时只能在首页和项目列表看到概述。正式上线后，这里会开放完整文档。

## 规划内容

- 功率放大核心电路
- 电源与保护模块
- PCB 与散热设计
- BOM 与外壳资料`
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
    cover: "./assets/covers/stm32-cover.png",
    summary: "基于 STM32 的多通道逻辑分析仪，支持 100MHz 采样率和多种协议解码。",
    markdown: `# GokottaLogic 逻辑分析仪

GokottaLogic 是一个面向嵌入式调试的开源逻辑分析仪项目。

## 项目特性

- 多通道数字采样
- 最高 100MHz 采样率规划
- 支持 UART、I2C、SPI 协议解析
- 提供上位机数据导出接口`
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
    cover: "./assets/covers/esp32-cover.png",
    summary: "基于 ESP32 的低功耗温湿度记录仪，支持 Wi-Fi 上报与本地存储。",
    markdown: `# ESP32 智能家居节点

这是一个基于 ESP32 的低功耗智能家居节点，用于传感器采集、MQTT 上报和本地状态记录。

## 功能

- Wi-Fi 自动连接
- MQTT 数据上报
- Deep Sleep 周期唤醒
- 温湿度与电池状态采集`
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
    cover: "./assets/hero/electronics-lab-hero.png",
    summary: "开源可编程直流电源设计，支持电压电流设置、显示和保护功能。",
    markdown: `# 可编程电源 0-30V/3A

这个项目正在开发中，当前开放设计目标和模块规划。

## 模块

- 电压电流控制
- 采样校准
- 显示界面
- 过流与过温保护`
  }
];

window.GOKOTTA_SEED = {
  projects: window.GOKOTTA_PROJECTS
};
