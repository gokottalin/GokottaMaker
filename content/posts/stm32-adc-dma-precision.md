# STM32 ADC 模拟采样从原理到精度优化

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

```c
hadc1.Init.ClockPrescaler = ADC_CLOCK_SYNC_PCLK_DIV4;
hadc1.Init.Resolution = ADC_RESOLUTION_12B;
hadc1.Init.ContinuousConvMode = ENABLE;
```

## 采样时间

如果输入源阻抗较高，应选择更长采样时间。经验上，传感器输出后面如果串联了较大的保护电阻，采样时间需要适当加长。

```c
sConfig.SamplingTime = ADC_SAMPLETIME_92CYCLES_5;
```

## DMA 环形缓冲

连续采样建议使用 DMA circular mode。这样 CPU 不需要每次等待转换完成，只要在半满和全满回调中处理数据。

```c
#define ADC_BUFFER_SIZE 256

uint16_t adc_buffer[ADC_BUFFER_SIZE];

HAL_ADC_Start_DMA(&hadc1, (uint32_t *)adc_buffer, ADC_BUFFER_SIZE);
```

## 精度优化

提高采样质量可以从这些方向入手：

- 使用稳定参考电压。
- 减小模拟地回流干扰。
- ADC 引脚附近放置小电容。
- 做多点校准，而不是只做单点校准。
- 对周期性噪声使用同步采样或数字滤波。

## 数据处理

移动平均适合低频慢变信号，中值滤波适合抑制偶发尖峰。工程中常把两者组合使用。

```c
uint32_t sum = 0;
for (uint16_t i = 0; i < ADC_BUFFER_SIZE; i++) {
  sum += adc_buffer[i];
}
uint16_t average = sum / ADC_BUFFER_SIZE;
```

## 小结

ADC 精度优化不是单一参数调优。真正有效的做法是把模拟电路、PCB、ADC 配置和软件滤波作为一个完整系统来设计。
