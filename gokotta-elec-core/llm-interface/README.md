# LLM Interface

这个目录是给其他 LLM 对接 GokottaElec 使用的精简入口。

推荐给 LLM 的文件：

- `system-prompt-zh.txt`：直接作为系统提示词或开发者提示词。
- `output-template.txt`：让 LLM 套用的 CNL 输出模板。
- `../docs/llm-cnl-contract-v0.1.md`：完整 CNL 输出契约。
- `../components/core-components.v0.1.json`：完整器件库、端子和边界条件。
- `../components/model-packages.v0.1.json`：型号、封装、引脚映射。

使用流程：

1. 把 `system-prompt-zh.txt` 放入 LLM 系统提示词。
2. 把用户电路需求作为用户消息输入。
3. 要求 LLM 只输出纯文本 CNL，不输出解释。
4. 保存为 `.txt`，或直接粘贴到 GokottaElec 窗口。
5. 运行：

```powershell
dist\GokottaElec.exe "C:\Users\10731\Downloads\deepseek_cnl_20260507_72c637.txt" output\deepseek-test
```
