const defaultCourseMeta = {
  analog: {
    title: "模拟电子",
    english: "Analog Electronics",
    summary: "从器件指标、运放反馈和滤波器开始，逐步建立可测量、可调试、可复现的模拟电路设计能力。",
    cta: "进入模拟电子路线",
    href: "./category.html?category=analog",
    cover: "./assets/covers/analog-cover-800.webp",
    coverAlt: "模拟电子实验台、滤波与测量场景",
    stages: ["基础指标", "运放与反馈", "滤波器设计", "ADC 前端", "测量验证"],
    resourcesTitle: "模拟设计工具箱",
    resourcesSummary: "先确认指标，再进入仿真、搭建和测量，避免只看原理图却无法解释实测偏差。",
    resources: ["示波器", "信号源", "SPICE 仿真", "滤波器计算表", "ADC 精度检查清单"],
    keywords: ["运放", "反馈", "截止频率", "噪声", "ADC 前端", "电源完整性"],
    recommendedPosts: ["analog-active-filter", "stm32-adc-dma-precision", "opensource-power-amplifier"],
    relatedProjects: ["power-amp", "programmable-power"]
  },
  stm32: {
    title: "STM32",
    english: "STM32 Embedded Systems",
    summary: "围绕采样、定时、DMA、通信和调试，把 MCU 外设知识组织成可落地的嵌入式项目能力。",
    cta: "进入 STM32 路线",
    href: "./category.html?category=stm32",
    cover: "./assets/covers/stm32-cover-800.webp",
    coverAlt: "STM32 开发板、逻辑分析与调试场景",
    stages: ["开发环境", "GPIO 与定时器", "ADC 与 DMA", "通信接口", "综合调试"],
    resourcesTitle: "STM32 调试工作台",
    resourcesSummary: "把外设配置、触发链路和数据搬运拆开验证，先得到稳定采样，再进入系统集成。",
    resources: ["CubeMX", "ST-Link", "串口调试工具", "逻辑分析仪", "ADC/DMA 检查清单"],
    keywords: ["ADC", "DMA", "定时器触发", "环形缓冲", "UART", "I2C", "SPI"],
    recommendedPosts: ["stm32-adc-dma-precision", "logic-analyzer", "programmable-power"],
    relatedProjects: ["logic-analyzer", "programmable-power"]
  },
  esp32: {
    title: "ESP32",
    english: "ESP32 IoT Nodes",
    summary: "从联网、传感器节点、MQTT 和 OTA 入手，最终落到低功耗、可部署、可维护的 IoT 节点设计。",
    cta: "进入 ESP32 路线",
    href: "./category.html?category=esp32",
    cover: "./assets/covers/esp32-cover-800.webp",
    coverAlt: "ESP32 节点、传感器与联网部署场景",
    stages: ["联网基础", "传感器节点", "MQTT 通信", "OTA 升级", "低功耗部署"],
    resourcesTitle: "IoT 节点工具箱",
    resourcesSummary: "把联网稳定性、消息链路、OTA 和功耗作为同一条部署链路检查，减少上线后的维护成本。",
    resources: ["MQTT 调试工具", "OTA 检查清单", "功耗测量", "电池寿命估算", "传感器节点模板"],
    keywords: ["Wi-Fi", "MQTT", "Deep Sleep", "OTA", "传感器节点", "电池供电"],
    recommendedPosts: ["esp32-low-power-node", "smart-home-hub"],
    relatedProjects: ["smart-home-hub"]
  },
  all: {
    title: "全部教程",
    english: "All Lessons",
    summary: "从模拟输入、MCU 采样到 IoT 部署，按完整电子系统视角浏览全部教程与实践。",
    cta: "查看全部教程",
    href: "./category.html?category=all",
    resourcesTitle: "推荐学习路线",
    resourcesSummary: "如果还不确定方向，建议按“模拟输入 -> MCU 采样 -> IoT 部署”的顺序建立完整电子系统视角。",
    resources: ["模拟电子：器件、滤波、测量与 ADC 前端", "STM32：外设、采样链路、DMA 和调试", "ESP32：联网节点、MQTT、OTA 和低功耗"],
    keywords: ["全部", "模拟电子", "STM32", "ESP32"],
    routeFilters: [
      { key: "all", label: "全部", href: "./category.html?category=all" },
      { key: "analog", label: "模拟电子", href: "./category.html?category=analog" },
      { key: "stm32", label: "STM32", href: "./category.html?category=stm32" },
      { key: "esp32", label: "ESP32", href: "./category.html?category=esp32" }
    ]
  }
};

(function () {
  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function deepMerge(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) return structuredClone(base);
    const result = structuredClone(base);
    Object.entries(override).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        result[key] = value.slice();
        return;
      }
      if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = deepMerge(result[key], value);
        return;
      }
      result[key] = value;
    });
    return result;
  }

  let merged = structuredClone(defaultCourseMeta);
  window.LarkixDefaultCourseMeta = structuredClone(defaultCourseMeta);
  try {
    const raw = localStorage.getItem("larkixmaker_course_meta_v1");
    if (raw) {
      const override = JSON.parse(raw);
      if (isPlainObject(override)) merged = deepMerge(defaultCourseMeta, override);
    }
  } catch (error) {
    console.warn("Failed to load course meta override", error);
  }
  window.LarkixCourseMeta = merged;
})();
