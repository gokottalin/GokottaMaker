# 给其他 LLM 的文件说明

这个文件夹用于把 GokottaElec 的 CNL 规则交给 DeepSeek、ChatGPT、Claude、Qwen 等其他 LLM，让它们输出本软件可解析的电路自然语言。

## 最小必需文件

只给 LLM 下面两个文件也可以工作：

1. `01_必需_系统提示词_直接复制给LLM.txt`
   - 放到 LLM 的系统提示词或开发者提示词。
   - 作用：要求 LLM 只输出 CNL，不输出解释性文字。
2. `02_必需_CNL输出契约_必须遵守.md`
   - 放到 LLM 的上下文。
   - 作用：说明电路、网络、器件、端子、连接、约束的完整格式。

## 可选增强文件

上下文长度足够时，额外提供这些文件，LLM 输出会更稳定：

3. `03_可选增强_输出模板_让LLM套用.txt`
   - 让 LLM 按模板填空。
4. `11_可选增强_完整器件库_端子和边界条件.json`
   - 包含器件类型、标准端子和边界条件。
   - 对 NPN、PNP、NMOS、PMOS、运放、比较器、继电器、变压器等更准确。
5. `12_可选增强_型号封装引脚库_PinMap.json`
   - 包含型号、封装、引脚映射。

## Sample 文件

示例统一放在项目根目录的 `samples/` 文件夹：

- `samples/Sample-01-voltage-divider.txt`
- `samples/Sample-02-npn-low-side-switch.txt`
- `samples/Sample-03-pnp-high-side-switch.txt`
- `samples/Sample-04-cmos-inverter-nmos-pmos.txt`
- `samples/Sample-05-opamp-noninverting-amplifier.txt`

## 推荐投喂方式

普通版：

```text
01_必需_系统提示词_直接复制给LLM.txt
02_必需_CNL输出契约_必须遵守.md
03_可选增强_输出模板_让LLM套用.txt
```

完整版：

```text
01_必需_系统提示词_直接复制给LLM.txt
02_必需_CNL输出契约_必须遵守.md
03_可选增强_输出模板_让LLM套用.txt
11_可选增强_完整器件库_端子和边界条件.json
12_可选增强_型号封装引脚库_PinMap.json
```

## LLM 输出后的使用方式

把 LLM 输出保存为 `.txt`，或直接粘贴进 GokottaElec 窗口。

命令行：

```powershell
dist\GokottaElec.exe "C:\Users\10731\Downloads\deepseek_cnl_20260507_72c637.txt" output\deepseek-test
```

窗口：

1. 双击 `dist\GokottaElec.exe`
2. 把 LLM 输出粘贴到左侧文本框
3. 等待实时预览，或点击 `生成文件`
