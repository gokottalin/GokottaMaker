# Larkix 分层计算书编写与管理指南

本指南面向电力电子计算书专家与内容管理员。目标是让一个可追溯的 JSON 母版同时生成 Mathcad 15 工作表和 Larkix L1/L2/L3 内容，避免三套手工计算链漂移。

## 1. 唯一事实来源

每册计算书只维护一个规范母版：

```text
content/calculation-books/<book-slug>/calculation-book.json
```

Schema 位于 `schemas/calculation-book-master.schema.json`。Mathcad 和 Larkix 产物都必须由该 JSON 生成；不得在生成后的 `.xmcd` 或 Markdown 中单独修改公式、数值、来源或跳转关系。

现有参考实现：

- 通用母版：`content/calculation-books/template/calculation-book.json`
- CCM 反激实例：`content/calculation-books/ccm-flyback-reference/calculation-book.json`
- BBG474 RevA 四开关 BUCK-BOOST 实例：`content/calculation-books/four-switch-buck-boost-reva/calculation-book.json`
- 生成器与校验器：`tools/calculation-book/`

## 2. 计算前必须收集的输入

管理员在交给计算专家前，至少应收集并标明来源：

1. 拓扑、工作模式、隔离要求和全部工作状态。
2. 输入电压最小/标称/最大、启动/瞬态条件和源阻抗。
3. 每路输出电压、电流、功率、动态要求、优先级及总功率定义。
4. 目标效率、开关频率范围、允许占空比、纹波和模式边界。
5. 环境温度、最高结温/磁件温度、冷却与寿命目标。
6. 磁件材料、尺寸、`Ae/le/Ve`、匝数、气隙、`AL`、DCR、漏感、公差和损耗曲线。
7. 功率器件、整流器、电容、采样、驱动与控制器的准确型号和数据手册版本。
8. 电压/电流/功率/温度降额规则及其公司规范或标准来源。
9. 实测波形、功率、效率、温升、Bode、保护动作和仪器不确定度。

缺少必填输入时，使用 `status: "unresolved"`，不得代填典型值。对应项必须出现在 `unresolvedItems`，并加入 `design.signoff.blockedBy`。

## 3. 来源、假设与数值状态

### 3.1 来源注册

`sources` 中每个来源使用稳定 ASCII `id`，并同时保存：

- `type`：`user_input`、`datasheet`、`standard`、`application_note`、`measurement` 等。
- `locator`：页码、章节、表格、图、方程、测试记录或交接字段；这是内部精确定位。
- `publicLabel`：可以安全出现在 Larkix 访客内容中的标签，不含本机路径、用户名或内部交接细节。
- `confidence`：确认、用户确认、暂定或未验证。

确认数值的 `trace.kind` 必须为 `source`，并引用已注册来源。生成器只把 `publicLabel` 写入 Larkix Markdown，详细 `locator` 保留在私有 JSON。

### 3.2 假设

暂定工程值先写入 `assumptions`，必须说明：

- 为什么必须使用该假设；
- 它影响哪些结果或签核结论；
- 哪个测量或文档将替换它。

对应输入使用 `status: "assumption"` 或 `"scenario"`，且 `trace.kind: "assumption"`。一致性演算、敏感性场景和面试示例不得标为生产事实。

### 3.3 派生值

派生值不作为第二份输入保存。它由 `equations[].expression` 的白名单 AST 计算，并在 `results` 中记录预期 SI 值、依赖、单位与哨兵标志。工具不使用 JavaScript `eval`，只支持显式的 `literal/ref/add/subtract/multiply/divide/power/sqrt/negate/min/max`。

## 4. 公式 ID 与 L1/L2/L3

### L1_design

L1 是工程计算主线。每条 `equations` 必须包含：

- 稳定公式 `id`、符号、章节和中文标题；
- 结构化 `expression` 与可读 `displayExpression`；
- 直接依赖、单位、适用范围、有效性边界；
- 来源/推导/数学定义路径；
- 显示取整规则；
- Mathcad region key 与 Larkix 跳转映射。

L1 应展示输入、代入、结果、标准值或工程选择、裕量和结论。一个公式只有在目标推导节点存在时才填写 `derivationSlug`。

### 呈现与叙述规则

新建或修订的工程计算书应在 `presentation` 中明确叙述与排版策略。默认采用：

- `voice: "first_person_singular"`：正文使用“我采用、我计算、我校核、我选择”，不出现角色编号、内部协作称谓、请求方称谓或“参考某角色产出”等过程性文字。
- `style: "ieee_concise"` 与 `formulaNarration: "section_level"`：在章节开头集中说明方法、来源和边界；公式行仅保留表达式、紧凑代入和结果，只有关键裕量或风险公式追加一句边界说明。
- `formulaGapPt: 32`：Mathcad 公式到紧随说明的 top-to-top 距离采用 32 pt；允许范围为 24–39 pt，不得通过空白段落拉开公式与正文。
- `sectionOrder`：电源拓扑按“规格与边界 → 工作模式/占空比 → 功率/电流 → 磁件 → 功率器件/驱动 → 电容 → 采样/保护 → 控制环路 → 损耗/热 → 容差/验证”组织。具体拓扑可合并相邻项，但任何偏离必须在章节引言中说明原因。
- `symbolGlossary`：为所有不直观、缩写、项目专用或场景专用符号提供一句话定义。定义必须同时说明物理意义和使用工况；例如过渡区校核电压应明确“只用于指定调制对比，不是新增额定输入”。
- `symbolPlacement: "formula_local"`：符号定义放在对应主公式正下方，以一行“其中……”先解释左侧结果量，再解释该式实际引用的不直观变量；下一行紧接代入与结果。不在计算书前部堆放需要来回查找的长符号表。
- `unresolvedNarration: "summary_only"`：JSON 母版继续保存完整未决项、内部 ID、风险和验证证据；Mathcad 与 Larkix 正文不得逐条输出这些台账，只在结论用 `unresolvedSummary` 汇总适用边界。

四开关 BUCK-BOOST 的 P/C+/C− 三状态调制属于控制实现专项，应放在常规功率级元件选型之后；主流程按 TI LM5176 与 ADI LTC3789 的详细设计顺序展开，STM32G474 状态实现再按 ST AN4539 单独校核。

### L2_engineering_derivation

L2 解释拓扑公式怎样从开关状态和物理定律得到。它必须包含父公式、前置知识、工程假设、有效范围、逐步推导、量纲检查和返回目标。

CCM 反激参考书的 L2 从伏秒平衡、`V=L·di/dt`、输入功率和导通区间平均电流连续推出占空比、纹波、谷值与峰值，不是简单重述公式。

四开关 BUCK-BOOST 参考书的 L2 从 P/C+/C- 三个状态、双桥平均电位和伏秒约束推出过渡中心占空、近直通状态比例、修正脉宽与纹波，并定量对比被拒绝的简单对角调制。

### L3_foundation_derivation

L3 证明 L2 依赖的更底层数学或物理关系。CCM 反激实例从 RMS 定义和线性斜坡平方积分推出三角斜坡 RMS 式；四开关 BUCK-BOOST 实例从 `vL=L·di/dt` 和周期伏秒为零统一推出 Buck/Boost 占空与纹波。

Larkix 节点 slug 必须是稳定 ASCII。公式级跳转由 JSON 映射自动生成：

```text
{{derive:<slug>|<label>|<color>}}
```

不得在生成 Markdown 中手工增加另一套跳转。

## 5. 完整拓扑覆盖

`coverage` 必须恰好声明以下 12 类：

```text
operating_states  power_closure  magnetics  capacitors
power_devices     sensing        gate_drive control
tolerances        thermal        derating   validation
```

每类选择 `applicable`、`unresolved` 或 `not_applicable`。不适用时必须给出原因；未解决时必须关联阻断项。通用母版要求实例按拓扑条件覆盖：

- 波形、占空比、传输比和模式边界；
- 功率与电流闭合；
- 电感/变压器、磁通、气隙、铜损和磁芯损耗；
- 输入/输出/母线/谐振/钳位/吸收/bootstrap/保持电容；
- 功率器件应力、导通/开关损耗、恢复、SOA、雪崩或钳位；
- 采样、驱动、死区、软启动、保护、斜坡补偿、RHP 零点和环路限制；
- 最坏角点、公差传播、损耗预算、热闭合、降额和台架验证。

## 6. 校验与生成

先校验母版：

```powershell
node tools/calculation-book/cli.js validate --book content/calculation-books/<book-slug>/calculation-book.json
```

再用新的任务专属文件名生成：

```powershell
node tools/calculation-book/cli.js generate `
  --book content/calculation-books/<book-slug>/calculation-book.json `
  --mathcad E:/User/<new-task-output>.xmcd `
  --validation E:/User/<new-task-validation>.json
```

生成器拒绝覆盖输入模板或不属于同一 `bookId` 的现有工作表。重复生成同一计算书时，JSON、Larkix package 与 Mathcad regions 保持确定性。

需要运行完整回归：

```powershell
npm.cmd run test:calculation-book
npm.cmd run test:markdown
npm.cmd run codex:contract
```

## 7. Mathcad 15 检查

生成的 `.xmcd` 使用已有 Mathcad 兼容模板的 settings/binaryContent，并替换为新的 regions。自动检查包括：

- XML 可解析；
- 每个主要章节为展开、有边框、未锁定的独立 Area；
- Area 首尾 lock ID 正确且底部余量至少 16 pt；
- 真正的 math region、literal subscript 和公式实际使用的内建单位/符号；使用 `sqrt` 的公式必须生成真实根号节点；
- 工程默认公式间距为 32 pt；兼容旧册时 top-to-top 间距也不得超过 39 pt；章节级叙述允许仅对关键公式追加一句说明；
- 不存在 `K.sqrt2`、`1.414`、扁平变量名或禁止的 `m` 前缀单位；
- 每个结果保留 `unitedValue` 与对应公式 tag，供跨输出一致性核对。

有 Mathcad 15 的审核机还必须打开文件，检查窗口标题、中文、Area 展开、公式、单位和结果是否可见。自动 XML 通过不能替代最终 UI 打开检查。

## 8. Larkix 隔离预览

规范 package 固定为 `draft + private`。只有隔离预览可以临时覆盖为 `published + unlisted`，不能回写母版。

自动预览回归会新建操作系统临时目录作为 `DATA_DIR`，种入 L1/L2/L3，检查 API、`derive.html?slug=` 路由和公式上角标，然后关闭服务并删除临时数据：

```powershell
npm.cmd run test:calculation-book
```

需要人工浏览时运行：

```powershell
node tools/calculation-book/preview.js `
  --book content/calculation-books/<book-slug>/calculation-book.json `
  --port 1958
```

命令会打印三个隔离预览 URL。按 `Ctrl+C` 后服务退出并删除临时 `DATA_DIR`。不得把预览节点写入当前、生产或云端数据。

## 9. 公式库管理

公式库把每条 L1 设计公式保存为一张唯一公式卡。公式卡使用稳定 `formulaId` 与 ASCII 路由 `slug`；二者建立后不可修改。显示名称、模块、自定义分类路径、用途与 `namespace:value` 标签可以修订。LaTeX 发生变化时生成新的不可变修订，旧修订只读保留；仅修改元数据不会制造重复修订。

管理端“公式库”按“模块 / 自定义分类”加载，未选择分类时不返回整库列表。选定分类后可搜索名称、用途、标识或 LaTeX，并可按标签与归档状态筛选、分页浏览。归档会隐藏访客公式卡，但保留公式标识、标签和全部修订；恢复后原路由继续有效。访客单卡地址为：

```text
derive.html?formula=<formula-slug>
```

已验收的两册参考计算书可确定性映射为 60 张公式卡：CCM 反激 21 张、四开关 BUCK-BOOST 39 张。映射只读取 `equations`，不把输入、结果、推导页或占位内容当作公式卡。可先输出导入包进行审核：

```powershell
node --experimental-sqlite tools/calculation-book/formula-catalog.js package-books
```

向数据库导入前必须使用全新的隔离 `DATA_DIR`，并把导入前快照写到源码树外。命令拒绝已有数据库、源码树内数据目录和同名快照覆盖：

```powershell
node --experimental-sqlite tools/calculation-book/formula-catalog.js import-books `
  --data-dir E:/Temp/larkix-formula-catalog-data `
  --snapshot E:/Backups/formula-catalog-before-import.json
```

对既有隔离数据库只生成确定性快照时使用：

```powershell
node --experimental-sqlite tools/calculation-book/formula-catalog.js snapshot `
  --data-dir E:/Temp/larkix-formula-catalog-data `
  --output E:/Backups/formula-catalog-snapshot.json
```

管理端 JSON 导入同样先写本地非覆盖快照，再执行整包预检和事务导入。当前公式库基础不包含文章绑定、文章级版本选择或公式推导图；这些关系不得借用标签或用途字段编码。

公式库回归命令：

```powershell
npm.cmd run test:formula-catalog
```

## 10. 文章公式创作

文章 Markdown 中的普通 `$...$`、`$$...$$`、`\(...\)` 与 `\[...\]` LaTeX 可以保持未绑定状态，保存和访客渲染不会自动把它们转换为公式卡。

需要复用公式库时，在 Markdown 编辑区右键，或使用“文章公式卡”区域的“打开公式卡”键盘入口。弹窗可按模块、自定义分类、`namespace:value` 标签和关键词搜索，并以行内或块级方式插入。插入后正文保存稳定的公式卡身份与不可变修订身份；后续修改公式卡不会静默改变文章引用的修订。

需要把正文公式建立为新公式卡时，必须先精确选中一个完整的行内或块级 LaTeX 表达式。选区不能混入正文、缺少定界符或同时包含多个公式。建卡时必须人工填写公式名称、模块和自定义分类；用途与标签可选，系统不从上下文猜测这些字段。成功后，公式卡、初始修订、文章绑定和选区替换在同一事务内完成；失败时原 LaTeX 与本地草稿保持不变。

文章引用的内部表示为：

```text
{{formula:<bindingId>|<formulaId>|<revisionId>|inline}}
{{formula:<bindingId>|<formulaId>|<revisionId>|display}}
```

作者不应手工改写其中的标识。删除整段引用表示显式解除该文章绑定；复制引用时应通过公式弹窗重新插入，以获得新的文章内绑定标识。

文章公式创作回归命令：

```powershell
npm.cmd run test:article-formula-authoring
```

## 11. 文章公式版本决策

公式卡只修改名称、模块、自定义分类、用途或标签时，文章不产生版本待决事项。公式卡 LaTeX 生成新修订，或公式卡被归档时，每一篇仍绑定该公式卡的文章会各自产生一项黄色 CMS 待决事项；待决状态、处理人和处理时间均不进入访客 API 或公开正文。

待决期间，CMS 预览与访客文章继续按正文中保存的不可变 `revisionId` 渲染旧公式，不会自动跟随公式卡的当前修订。作者必须逐篇选择：

1. **保留旧修订**：正文和绑定均保持不变，只关闭该篇文章的待决事项。
2. **采用最新修订**：保留原 `bindingId`，把该篇文章的公式卡与 `revisionId` 显式更新到目标修订。
3. **另建公式卡**：以旧修订 LaTeX 为初值，人工填写新名称、模块和自定义分类，可选填写用途与标签；系统生成新的技术标识，并保留原 `bindingId` 重新绑定。

每项决定只作用于当前文章，不提供批量处理。若同一待决事项尚未处理时公式卡又产生新修订，旧待决记录保留为已取代历史，只把最新目标保留为待处理。归档是软状态：既有不可变修订和文章内渲染仍然保留，归档卡的独立访客页继续隐藏；重复归档不会重复创建待决事项。作者显式删除完整公式短码时，该绑定的待决事项随绑定解除而结束。

文章公式版本回归命令：

```powershell
npm.cmd run test:formula-reference-versioning
```

## 12. 公式卡线性推导关系

推导链的每一阶必须是独立公式卡，不能把多阶推导压进同一张卡。关系由作者手工维护，不根据名称、分类、标签或 LaTeX 自动推断。多张上一阶公式卡可以汇入同一张卡，但每张卡最多只有一个下一阶，因此推导网络允许汇聚、不允许分叉。

设置关系时，来源卡与目标卡必须存在且不能相同；系统拒绝悬空引用、自环和循环路径。来源卡已有下一阶时，普通保存会被拒绝，作者必须在 CMS 中查看旧目标、新目标及受影响的上游路径数量，再确认一次显式替换。替换采用单个事务完成，校验失败会保留原关系。

归档公式卡不会删除推导边或历史。CMS 继续显示上下阶、影响范围和归档断链告警；访客页把归档节点显示为不可点击的明确中断状态。恢复公式卡后，原链路自动重新可访问。

线性推导关系回归命令：

```powershell
npm.cmd run test:linear-derivation-graph
```

## 13. 修订规则

修订计算书时：

1. 保留 `bookId`、L1 slug、L2/L3 slug 与既有公式 ID。
2. 更新 `revision`，只在 JSON 母版中修改输入、来源、公式或决策。
3. 来源换版时更新 locator、accessedAt 与 confidence；不要删除旧证据语义。
4. 假设被实测替换后，将输入状态改为 confirmed/measurement 来源，并把假设标为 retired。
5. 必填缺口解决后更新 `unresolvedItems`、coverage、margin、validation 和 signoff；不得只删除警告文字。
6. 重新生成两类输出并比较哨兵结果。

## 14. 发布前审核清单

- JSON Schema 与语义校验为零错误。
- 确认值和公式的来源覆盖率为 100%，无未声明假设。
- 依赖图无环，所有符号已定义，量纲闭合。
- 12 类覆盖状态与拓扑相符，`not_applicable` 均有原因。
- 必填未解决项仍存在时，signoff 必须为 blocked。
- 至少三个哨兵值在 JSON、Mathcad、Larkix 间一致，仅允许记录明确的显示取整差异。
- Mathcad XML/规则通过，并在可用的 Mathcad 15 中完成打开检查。
- Larkix 包无本机绝对路径、用户名、私有 handoff 或乱码。
- 隔离 `DATA_DIR` 路由与公式跳转通过；当前/生产数据未被写入。
- 正式内容导入、云同步和发布必须经过总控验收；验证阶段不写当前/生产数据，不部署、不写云端，也不执行 Git staging、commit 或 push。
