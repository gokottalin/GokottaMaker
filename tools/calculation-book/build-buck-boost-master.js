#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = path.join(ROOT, "content/calculation-books/four-switch-buck-boost-reva/calculation-book.json");

const lit = (value, unit = "1") => ({ op: "literal", value, unit });
const ref = (symbol) => ({ op: "ref", symbol });
const add = (...args) => ({ op: "add", args });
const sub = (...args) => ({ op: "subtract", args });
const mul = (...args) => ({ op: "multiply", args });
const div = (left, right) => ({ op: "divide", args: [left, right] });
const pow = (base, exponent) => ({ op: "power", args: [base, lit(exponent)] });

function expressionRefs(node, output = []) {
  if (node?.op === "ref") output.push(node.symbol);
  for (const child of node?.args || []) expressionRefs(child, output);
  return [...new Set(output)];
}

function sourceTrace(refs, note) {
  return { kind: "source", refs, note };
}

function assumptionTrace(refs, note) {
  return { kind: "assumption", refs, note };
}

function identityTrace(note) {
  return { kind: "identity", refs: [], note };
}

function derivationTrace(refs, note) {
  return { kind: "derivation", refs, note };
}

function resolvedInput({ id, symbol, title, value, unit, sourceRefs, applicability, status = "confirmed", note = "Agent18 设计输入中的冻结目标或明确场景。" }) {
  return {
    id,
    symbol,
    title,
    status,
    value,
    unit,
    requiredForSignoff: true,
    applicability,
    trace: sourceTrace(sourceRefs, note)
  };
}

function scenarioInput({ id, symbol, title, value, unit, assumptionRefs, applicability, note }) {
  return {
    id,
    symbol,
    title,
    status: "scenario",
    value,
    unit,
    requiredForSignoff: false,
    applicability,
    trace: assumptionTrace(assumptionRefs, note)
  };
}

function unresolvedInput(id, symbol, title, unit, applicability, note) {
  return {
    id,
    symbol,
    title,
    status: "unresolved",
    unit,
    requiredForSignoff: true,
    applicability,
    trace: { kind: "unresolved", refs: [], note }
  };
}

function equation({ id, symbol, title, section, expression, displayExpression, unit, expected, applicability, validity, trace, digits = 3, displayUnit = unit, sentinel = false, derivationSlug = "", jumpLabel = "", color = "blue" }) {
  const dependencies = expressionRefs(expression);
  return {
    equation: {
      id,
      symbol,
      title,
      depth: "L1_design",
      section,
      expression,
      displayExpression,
      unit,
      dependencies,
      applicability,
      validity,
      trace,
      rounding: { digits, mode: "decimal_places", displayUnit },
      outputMappings: {
        mathcad: { regionKey: id.slice(3), include: true },
        larkix: { include: true, derivationSlug, jumpLabel, color }
      }
    },
    result: {
      id: `result.${id.slice(3)}`,
      symbol,
      equationId: id,
      expectedValue: expected,
      unit,
      dependencies,
      status: "derived",
      sentinel
    }
  };
}

const sources = [
  {
    id: "src.agent18-design-spec",
    type: "handoff",
    title: "BBG474 RevA 机器可读设计规格 v0.1",
    publicLabel: "BBG474 RevA 设计规格 v0.1（2026-07-21）",
    locator: "E:/Project/2605_个人/03_TECH_LEARNING/自研四开关BuckBoost_G474_20260715/design_spec_v0.1.json",
    accessedAt: "2026-07-21",
    confidence: "provisional"
  },
  {
    id: "src.agent18-control-protection",
    type: "handoff",
    title: "BBG474 RevA 四管控制、自举替代、OCP 与验证证据设计输入",
    publicLabel: "BBG474 RevA 四管控制与保护设计输入（2026-07-21）",
    locator: "E:/Project/2605_个人/03_TECH_LEARNING/自研四开关BuckBoost_G474_20260715/06_RevA设计输入_四管控制自举OCP与验证证据_v0.1.md",
    accessedAt: "2026-07-21",
    confidence: "provisional"
  },
  {
    id: "src.agent18-frozen-spec",
    type: "project_fact",
    title: "BBG474 RevA 设计规格冻结 v0.1",
    publicLabel: "BBG474 RevA 冻结规格 v0.1",
    locator: "E:/Project/2605_个人/03_TECH_LEARNING/自研四开关BuckBoost_G474_20260715/00_设计规格冻结_v0.1.md",
    accessedAt: "2026-07-21",
    confidence: "provisional"
  },
  {
    id: "src.agent18-existing-board",
    type: "measurement",
    title: "现有板 P1A-P3A 测试矩阵与近直通边界",
    publicLabel: "现有板 P1A-P3A 测试证据",
    locator: "E:/Project/2605_个人/03_TECH_LEARNING/BUCK_BOOST_STM32_数字电源复刻_20260712/05_test_plan/12_P1A_P1B_P2_P3A_测试矩阵_20260716.md；25 V→22 V/1.738 A 已通过，25 V→24 V 未执行",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  },
  {
    id: "src.ti-lm5176",
    type: "datasheet",
    title: "TI LM5176 Four-Switch Buck-Boost Controller Datasheet",
    publicLabel: "TI LM5176 数据手册",
    locator: "TI LM5176 datasheet, Section 8.2.2 Detailed Design Procedure；Buck/Boost 模式、功率级选型与环路补偿",
    url: "https://www.ti.com/lit/ds/symlink/lm5176.pdf",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  },
  {
    id: "src.adi-ltc3789",
    type: "datasheet",
    title: "ADI LTC3789 High Efficiency Synchronous 4-Switch Buck-Boost Controller Datasheet",
    publicLabel: "ADI LTC3789 数据手册",
    locator: "LTC3789 Applications Information；从电流检测与电感开始，再选 MOSFET、CIN 与 COUT",
    url: "https://www.analog.com/media/en/technical-documentation/data-sheets/3789fc.pdf",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  },
  {
    id: "src.st-an4539",
    type: "application_note",
    title: "ST AN4539 HRTIM Cookbook Rev.5",
    publicLabel: "ST AN4539 HRTIM Cookbook",
    locator: "ST AN4539；四开关非反相 Buck-Boost、FAULT 与 EEV 实现",
    url: "https://www.st.com/resource/en/application_note/DM00121475-.pdf",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  },
  {
    id: "src.st-g474",
    type: "datasheet",
    title: "ST STM32G474 Datasheet DS12288 Rev.6",
    publicLabel: "STM32G474 数据手册",
    locator: "Agent18 references/pdf/ST_STM32G474_datasheet_DS12288_Rev6.pdf；COMP/HRTIM 低延迟保护资源",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  },
  {
    id: "src.ti-ucc21530",
    type: "datasheet",
    title: "TI UCC21530 Isolated Gate Driver Datasheet",
    publicLabel: "TI UCC21530 数据手册",
    locator: "Agent18 references/pdf/TI_UCC21530_datasheet_SLUSDC0D.pdf；UVLO、EN、死区、传播延迟与最小脉宽",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  },
  {
    id: "src.ti-ina240",
    type: "datasheet",
    title: "TI INA240 Current-Sense Amplifier Datasheet",
    publicLabel: "TI INA240 数据手册",
    locator: "Agent18 references/pdf/TI_INA240_datasheet_SBOS662C.pdf；PWM 抑制与双向精密电流采样",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  },
  {
    id: "src.ti-snoa987",
    type: "application_note",
    title: "TI SNOA987B High-Speed Overcurrent Protection Circuit",
    publicLabel: "TI 高速硬件 OCP 参考",
    locator: "Agent18 references/pdf/TI_SNOA987B_high_speed_OCP_circuit.pdf；高速放大器与比较器保护链",
    accessedAt: "2026-07-21",
    confidence: "confirmed"
  }
];

const assumptions = [
  {
    id: "assumption.ideal-steady-state",
    title: "首轮采用理想稳态伏秒模型",
    reason: "Agent18 尚未冻结 MOSFET、驱动、磁件和铜排损耗参数，先建立可审计的拓扑基线。",
    effect: "占空比和纹波结果未计入导通压降、死区、延时、磁芯非线性与寄生参数。",
    replacement: "器件 MPN、实测波形和损耗模型冻结后回填非理想参数并重算。",
    status: "active"
  },
  {
    id: "assumption.transition-worst-case",
    title: "过渡区对比场景取 VIN=VOUT=36 V",
    reason: "Agent18 用该点比较简单对角调制与三状态修正调制的最大纹波压力。",
    effect: "得到 6 A 对角半周期纹波与 0.6 A 的 5% 修正脉冲纹波。",
    replacement: "Agent15 复核调制律并用离散时域仿真和样机波形替换。",
    status: "active"
  },
  {
    id: "assumption.nominal-components",
    title: "器件按标称值计算",
    reason: "电感、shunt、CSA、DAC、比较器与偏置器件公差尚未冻结。",
    effect: "当前 OCP 阈值、损耗和纹波不是最坏公差结果。",
    replacement: "取得最终器件 MPN、温漂和误差分布后执行统计或边界角计算。",
    status: "active"
  },
  {
    id: "assumption.latency-is-target",
    title: "500 ns 是关断目标而非测量值",
    reason: "RevA OCP 注入台架尚未完成。",
    effect: "1.2 A 延迟上冲和 15.2 A 故障峰值仅是目标闭合值。",
    replacement: "用 shunt 等效输入越阈至实际 VGS 低于 Miller 平台的实测总时间替换。",
    status: "active"
  }
];

const inputs = [
  resolvedInput({ id: "input.vin-min", symbol: "V.inmin", title: "最小工作输入电压", value: 6, unit: "V", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "RevA 直流输入工作范围下限" }),
  resolvedInput({ id: "input.vin-max", symbol: "V.inmax", title: "最大工作输入电压", value: 36, unit: "V", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "RevA 直流输入工作范围上限" }),
  resolvedInput({ id: "input.vout-min", symbol: "V.outmin", title: "最小目标输出电压", value: 1, unit: "V", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "RevA 输出范围下限；不承诺主动放电至 0 V" }),
  resolvedInput({ id: "input.vout-max", symbol: "V.outmax", title: "最大目标输出电压", value: 36, unit: "V", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "RevA 输出范围上限" }),
  resolvedInput({ id: "input.power-max", symbol: "P.max", title: "连续功率上限", value: 150, unit: "W", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "同时受低输入功率降额规则约束" }),
  resolvedInput({ id: "input.derating-factor", symbol: "k.derate", title: "低输入功率降额系数", value: 0.8, unit: "1", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "Pout≤0.8·VIN·10 A 的首轮验证边界" }),
  resolvedInput({ id: "input.current-continuous", symbol: "I.cont", title: "连续电感电流目标", value: 10, unit: "A", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "额定连续电流目标；低 VIN 功率降额" }),
  resolvedInput({ id: "input.current-cbc", symbol: "I.cbc", title: "额定逐周期限流初值", value: 12.5, unit: "A", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], applicability: "8–12.5 A 可编程范围的额定初值；首板先设 3 A" }),
  resolvedInput({ id: "input.current-hard", symbol: "I.hard", title: "硬件 OCP 标称阈值", value: 14, unit: "A", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], applicability: "固定硬件窗口比较器与锁存关断目标" }),
  resolvedInput({ id: "input.current-fault-max", symbol: "I.faultmax", title: "故障实际峰值目标上限", value: 16, unit: "A", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], applicability: "含阈值误差、滤波和关断延时后的项目目标" }),
  resolvedInput({ id: "input.current-bringup", symbol: "I.bring", title: "首板 bring-up 限流", value: 3, unit: "A", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], applicability: "VIN≤24 V、Pout≤50 W 的首轮低压台架" }),
  resolvedInput({ id: "input.frequency", symbol: "f.sw", title: "默认开关频率", value: 200, unit: "kHz", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "RevA 默认开关频率；100–300 kHz 调试范围" }),
  resolvedInput({ id: "input.inductance", symbol: "L.nom", title: "主电感初选标称值", value: 15, unit: "μH", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "首轮拓扑、电流纹波与保护斜率计算" }),
  resolvedInput({ id: "input.vin-buck", symbol: "V.inbuck", title: "Buck 纹波校核输入电压", value: 36, unit: "V", sourceRefs: ["src.agent18-frozen-spec"], applicability: "Agent18 指定的 36 V→18 V Buck 校核点" }),
  resolvedInput({ id: "input.vout-buck", symbol: "V.outbuck", title: "Buck 纹波校核输出电压", value: 18, unit: "V", sourceRefs: ["src.agent18-frozen-spec"], applicability: "Agent18 指定的 36 V→18 V Buck 校核点" }),
  resolvedInput({ id: "input.vin-boost", symbol: "V.inboost", title: "Boost 纹波校核输入电压", value: 12, unit: "V", sourceRefs: ["src.agent18-frozen-spec"], applicability: "Agent18 指定的 12 V→36 V Boost 校核点" }),
  resolvedInput({ id: "input.vout-boost", symbol: "V.outboost", title: "Boost 纹波校核输出电压", value: 36, unit: "V", sourceRefs: ["src.agent18-frozen-spec"], applicability: "Agent18 指定的 12 V→36 V Boost 校核点" }),
  scenarioInput({ id: "input.vin-transition", symbol: "V.intrans", title: "过渡区纹波校核电压", value: 36, unit: "V", assumptionRefs: ["assumption.transition-worst-case"], applicability: "VIN=VOUT=36 V 的调制纹波对比工况；不是新增额定输入电压", note: "用于比较三状态修正与简单对角调制的纹波，不是独立实测工作点。" }),
  scenarioInput({ id: "input.transition-ratio", symbol: "r.trans", title: "过渡区电压比", value: 1, unit: "1", assumptionRefs: ["assumption.transition-worst-case"], applicability: "VIN=VOUT 时 VOUT/VIN=1", note: "三状态调制中心点。" }),
  resolvedInput({ id: "input.transition-low", symbol: "r.low", title: "Buck/过渡区初始比值边界", value: 0.95, unit: "1", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], applicability: "初始模式边界，待最小可靠脉宽实测修订" }),
  resolvedInput({ id: "input.transition-correction", symbol: "mu.max", title: "过渡中心最大修正脉冲比例", value: 0.05, unit: "1", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], applicability: "r=1 中心点初值；边界平滑降至 0" }),
  resolvedInput({ id: "input.timer-total", symbol: "N.total", title: "现有板 PWM 周期 tick", value: 940, unit: "1", sourceRefs: ["src.agent18-control-protection", "src.agent18-existing-board"], applicability: "现有板近直通能力审计" }),
  resolvedInput({ id: "input.timer-refresh", symbol: "N.refresh", title: "现有板自举刷新 tick", value: 40, unit: "1", sourceRefs: ["src.agent18-control-protection", "src.agent18-existing-board"], applicability: "现有板每周期强制低边刷新" }),
  resolvedInput({ id: "input.near-vin", symbol: "V.innear", title: "现有板近直通输入场景", value: 25, unit: "V", sourceRefs: ["src.agent18-control-protection", "src.agent18-existing-board"], applicability: "尚未执行的 25 V→24 V P3B 场景" }),
  resolvedInput({ id: "input.near-vout", symbol: "V.outnear", title: "现有板近直通输出目标", value: 24, unit: "V", sourceRefs: ["src.agent18-control-protection", "src.agent18-existing-board"], applicability: "尚未执行的 25 V→24 V P3B 场景" }),
  resolvedInput({ id: "input.turnoff-latency", symbol: "t.off", title: "总关断延迟目标", value: 0.5, unit: "μs", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], applicability: "目标值，不是样机测量值", note: "Agent18 冻结的 ≤500 ns 设计目标；必须由注入台架验证。" }),
  resolvedInput({ id: "input.blanking", symbol: "t.blank", title: "HRTIM 开通尖峰 blanking 初值", value: 0.1, unit: "μs", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection", "src.st-an4539"], applicability: "初值 100 ns；实测前上限 200 ns" }),
  resolvedInput({ id: "input.shunt", symbol: "R.shunt", title: "电感电流采样分流电阻", value: 0.002, unit: "Ω", sourceRefs: ["src.agent18-control-protection"], applicability: "0.002 Ω 四端 Kelvin 初选" }),
  resolvedInput({ id: "input.fast-gain", symbol: "G.fast", title: "快速电流放大路径标称增益", value: 20, unit: "1", sourceRefs: ["src.agent18-control-protection", "src.ti-snoa987"], applicability: "AD8410A-20-class 候选路径；最终 MPN 未冻结" }),
  resolvedInput({ id: "input.current-reference", symbol: "V.ref", title: "双向电流放大器中点参考", value: 1.65, unit: "V", sourceRefs: ["src.agent18-control-protection"], applicability: "3.3 V 模拟供电的标称中点" }),
  resolvedInput({ id: "input.vds-rating", symbol: "V.dsrated", title: "MOSFET 最低耐压等级", value: 100, unit: "V", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], applicability: "RevA MOSFET 候选最低 VDS 等级" }),
  resolvedInput({ id: "input.vds-target", symbol: "V.dspeak", title: "样板后 VDS 峰值项目目标", value: 80, unit: "V", sourceRefs: ["src.agent18-control-protection"], applicability: "VIN=36 V、CBC 附近的项目目标；尚无实测" }),
  resolvedInput({ id: "input.deadtime", symbol: "t.dead", title: "初始互补死区", value: 0.15, unit: "μs", sourceRefs: ["src.agent18-control-protection", "src.ti-ucc21530"], applicability: "初始 150 ns；最终在 80–250 ns 双脉冲范围冻结" }),
  resolvedInput({ id: "input.bias-voltage", symbol: "V.bias", title: "独立浮动高边偏置标称电压", value: 12, unit: "V", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection", "src.ti-ucc21530"], applicability: "需匹配 8 V UVLO 系列驱动后缀" }),
  unresolvedInput("input.mosfet-loss-data", "X.mos", "MOSFET 最终 MPN 与损耗参数", "1", "导通、开关、反向恢复、过冲与热计算", "需冻结 RDS(on)、Qg、Coss、Qrr、温度曲线、封装与采购状态。"),
  unresolvedInput("input.inductor-loss-data", "X.ind", "主电感最终磁芯、匝数与损耗数据", "1", "饱和、铜损、磁芯损耗与热计算", "需冻结 MPN/磁芯、Isat≥20 A、DCR≤0.008 Ω、损耗曲线和温升。"),
  unresolvedInput("input.capacitor-network", "X.cap", "输入输出电容阵列、ESR 与纹波额定", "1", "输入/输出纹波、RMS 电流和瞬态", "需完成电容类型、偏压降额、ESR/ESL、纹波电流与寿命设计。"),
  unresolvedInput("input.fast-ocp-tolerance", "X.ocp", "FAST_CSA/比较器最终 MPN、公差与实测延迟", "1", "逐周期和固定硬件 OCP", "需完成 shunt、增益、DAC、比较器、滤波、温漂与全链路延迟预算/实测。"),
  unresolvedInput("input.gate-bias-selection", "X.bias", "8 V UVLO 驱动后缀与两路隔离偏置模块", "1", "100% 高边保持、UVLO、CMTI、EMI 与偏置功耗", "需由 Agent7 冻结驱动器订货后缀、隔离 DC/DC、去耦和互斥装配。"),
  unresolvedInput("input.hrtim-resource", "X.hrtim", "G474 COMP/DAC/EEV/FLT/ADC 引脚资源表", "1", "四路 PWM、逐周期截断、锁存故障与同步采样", "需完成 CubeMX/RCT6 引脚和外设冲突审计及开发板波形。"),
  unresolvedInput("input.loop-model", "X.loop", "Buck/Transition/Boost 内外环模型与补偿", "1", "稳定性、跨区切换与负载/输入瞬态", "需 Agent15 复核三状态调制并给出全角落环路模型、相位/增益裕量。"),
  unresolvedInput("input.thermal-stackup", "X.thermal", "最终铜厚、散热、环境与热模型", "1", "150 W 连续功率降额与器件结温", "需冻结 PCB stackup、散热器/风扇、环境温度和器件热阻。"),
  unresolvedInput("input.prepcb-evidence", "X.evidence", "投板前 E1–E10 波形与评审证据", "1", "RevA 制板准入", "需完成四路 PWM、OCP、偏置、现有板基线、仿真、ERC 和关键回路评审。")
];

const equationPairs = [
  equation({ id: "eq.power-low-line", symbol: "P.low", title: "6 V 低线首轮功率上限", section: "系统功率与降额边界", expression: mul(ref("k.derate"), ref("V.inmin"), ref("I.cont")), displayExpression: "P.low = k.derate·V.inmin·I.cont", unit: "W", expected: 48, applicability: "6 V 输入、10 A 连续电感电流的首轮验证边界", validity: "仅为项目降额规则；同时不得超过 P.max", trace: sourceTrace(["src.agent18-design-spec", "src.agent18-frozen-spec"], "Agent18 明确给出 Pout≤min(150 W,0.8·VIN·10 A)。"), sentinel: true, color: "amber" }),
  equation({ id: "eq.full-power-vin", symbol: "V.full", title: "达到 150 W 限值的输入电压分界", section: "系统功率与降额边界", expression: div(ref("P.max"), mul(ref("k.derate"), ref("I.cont"))), displayExpression: "V.full = P.max/(k.derate·I.cont)", unit: "V", expected: 18.75, applicability: "连续电流目标为 10 A 的功率降额分界", validity: "忽略效率，仅表达 Agent18 的首轮安全边界", trace: identityTrace("将低输入功率降额式反解 VIN。"), digits: 2, color: "amber" }),

  equation({ id: "eq.duty-buck", symbol: "D.buck", title: "36 V→18 V Buck 理想占空比", section: "Buck 模式校核", expression: div(ref("V.outbuck"), ref("V.inbuck")), displayExpression: "D.buck = V.outbuck/V.inbuck", unit: "1", expected: 0.5, applicability: "Q1H/Q1L 互补 PWM，Q2H 常导通", validity: "理想稳态 CCM，忽略器件压降与死区", trace: derivationTrace(["derivation.volt-second-foundation"], "由 Buck 两状态电感伏秒平衡得到。"), digits: 4, derivationSlug: "inductor-volt-second-ripple-foundation", jumpLabel: "伏秒与纹波基础", color: "blue" }),
  equation({ id: "eq.delta-buck", symbol: "dI.buck", title: "36 V→18 V Buck 电感峰峰纹波", section: "Buck 模式校核", expression: div(mul(sub(ref("V.inbuck"), ref("V.outbuck")), ref("D.buck")), mul(ref("L.nom"), ref("f.sw"))), displayExpression: "dI.buck = (V.inbuck-V.outbuck)·D.buck/(L.nom·f.sw)", unit: "A", expected: 3, applicability: "15 μH、200 kHz、36 V→18 V", validity: "线性电感、稳态 CCM、导通区电压恒定近似", trace: derivationTrace(["derivation.volt-second-foundation"], "由 V=L·di/dt 对 Buck 充能区间积分。"), sentinel: true, derivationSlug: "inductor-volt-second-ripple-foundation", jumpLabel: "Buck 纹波推导", color: "blue" }),
  equation({ id: "eq.peak-buck", symbol: "I.pkbuck", title: "Buck 连续目标下峰值电流", section: "Buck 模式校核", expression: add(ref("I.cont"), div(ref("dI.buck"), lit(2))), displayExpression: "I.pkbuck = I.cont+dI.buck/2", unit: "A", expected: 11.5, applicability: "将 10 A 视为三角纹波中心值", validity: "电感纹波关于平均值近似对称", trace: identityTrace("三角纹波峰值等于平均值加半峰峰值。"), color: "blue" }),
  equation({ id: "eq.valley-buck", symbol: "I.valbuck", title: "Buck 连续目标下谷值电流", section: "Buck 模式校核", expression: sub(ref("I.cont"), div(ref("dI.buck"), lit(2))), displayExpression: "I.valbuck = I.cont-dI.buck/2", unit: "A", expected: 8.5, applicability: "将 10 A 视为三角纹波中心值", validity: "I.valbuck>0 时该点属于 CCM", trace: identityTrace("三角纹波谷值等于平均值减半峰峰值。"), color: "blue" }),
  equation({ id: "eq.cbc-margin-buck", symbol: "M.cbuck", title: "Buck 峰值到 12.5 A CBC 的名义裕量", section: "Buck 模式校核", expression: sub(ref("I.cbc"), ref("I.pkbuck")), displayExpression: "M.cbuck = I.cbc-I.pkbuck", unit: "A", expected: 1, applicability: "标称 15 μH 与额定 CBC 初值", validity: "未计入电感、公差、采样误差、瞬态和延迟", trace: identityTrace("逐周期阈值与理想峰值的差。"), sentinel: true, color: "amber" }),

  equation({ id: "eq.duty-boost", symbol: "D.boost", title: "12 V→36 V Boost 理想占空比", section: "Boost 模式校核", expression: sub(lit(1), div(ref("V.inboost"), ref("V.outboost"))), displayExpression: "D.boost = 1-V.inboost/V.outboost", unit: "1", expected: 0.6666666666666667, applicability: "Q1H 常导通，Q2L/Q2H 同步互补 PWM", validity: "理想稳态 CCM，忽略器件压降与死区", trace: derivationTrace(["derivation.volt-second-foundation"], "由 Boost 两状态电感伏秒平衡得到。"), digits: 4, derivationSlug: "inductor-volt-second-ripple-foundation", jumpLabel: "Boost 占空推导", color: "green" }),
  equation({ id: "eq.delta-boost", symbol: "dI.boost", title: "12 V→36 V Boost 电感峰峰纹波", section: "Boost 模式校核", expression: div(mul(ref("V.inboost"), ref("D.boost")), mul(ref("L.nom"), ref("f.sw"))), displayExpression: "dI.boost = V.inboost·D.boost/(L.nom·f.sw)", unit: "A", expected: 2.6666666666666665, applicability: "15 μH、200 kHz、12 V→36 V", validity: "线性电感、稳态 CCM、充能区电压恒定近似", trace: derivationTrace(["derivation.volt-second-foundation"], "由 V=L·di/dt 对 Boost 充能区间积分。"), sentinel: true, derivationSlug: "inductor-volt-second-ripple-foundation", jumpLabel: "Boost 纹波推导", color: "green" }),
  equation({ id: "eq.peak-boost", symbol: "I.pkboost", title: "Boost 连续目标下峰值电流", section: "Boost 模式校核", expression: add(ref("I.cont"), div(ref("dI.boost"), lit(2))), displayExpression: "I.pkboost = I.cont+dI.boost/2", unit: "A", expected: 11.333333333333334, applicability: "将 10 A 视为三角纹波中心值", validity: "电感纹波关于平均值近似对称", trace: identityTrace("三角纹波峰值等于平均值加半峰峰值。"), color: "green" }),
  equation({ id: "eq.valley-boost", symbol: "I.valboost", title: "Boost 连续目标下谷值电流", section: "Boost 模式校核", expression: sub(ref("I.cont"), div(ref("dI.boost"), lit(2))), displayExpression: "I.valboost = I.cont-dI.boost/2", unit: "A", expected: 8.666666666666666, applicability: "将 10 A 视为三角纹波中心值", validity: "I.valboost>0 时该点属于 CCM", trace: identityTrace("三角纹波谷值等于平均值减半峰峰值。"), color: "green" }),
  equation({ id: "eq.cbc-margin-boost", symbol: "M.cboost", title: "Boost 峰值到 12.5 A CBC 的名义裕量", section: "Boost 模式校核", expression: sub(ref("I.cbc"), ref("I.pkboost")), displayExpression: "M.cboost = I.cbc-I.pkboost", unit: "A", expected: 1.166666666666666, applicability: "标称 15 μH 与额定 CBC 初值", validity: "未计入电感、公差、采样误差、瞬态和延迟", trace: identityTrace("逐周期阈值与理想峰值的差。"), sentinel: true, color: "amber" }),

  equation({ id: "eq.transition-high", symbol: "r.high", title: "过渡区上边界", section: "过渡区三状态调制", expression: div(lit(1), ref("r.low")), displayExpression: "r.high = 1/r.low", unit: "1", expected: 1.0526315789473684, applicability: "与 r.low=0.95 对称的初始 Boost 边界", validity: "边界最终必须按最小脉宽与控制复核修订", trace: sourceTrace(["src.agent18-design-spec", "src.agent18-control-protection"], "Agent18 定义上边界为 1/0.95。"), digits: 4, color: "purple" }),
  equation({ id: "eq.transition-da", symbol: "dA.trans", title: "r=1 时输入桥高边占空", section: "过渡区三状态调制", expression: sub(lit(1), ref("mu.max")), displayExpression: "dA.trans = 1-mu.max", unit: "1", expected: 0.95, applicability: "VIN=VOUT 且两个修正脉冲各为 5%", validity: "修正脉冲错开，边界平滑降至 0", trace: derivationTrace(["derivation.transition-three-state"], "由三状态占用率定义得到。"), digits: 4, derivationSlug: "four-switch-buck-boost-transition-derivation", jumpLabel: "三状态调制推导", color: "purple" }),
  equation({ id: "eq.transition-db", symbol: "dB.trans", title: "r=1 时输出桥高边占空", section: "过渡区三状态调制", expression: div(ref("dA.trans"), ref("r.trans")), displayExpression: "dB.trans = dA.trans/r.trans", unit: "1", expected: 0.95, applicability: "满足 dA·VIN=dB·VOUT 的中心点", validity: "理想稳态伏秒平衡", trace: derivationTrace(["derivation.transition-three-state"], "由 dA·VIN=dB·VOUT 及 r=VOUT/VIN 得到。"), digits: 4, derivationSlug: "four-switch-buck-boost-transition-derivation", jumpLabel: "伏秒约束", color: "purple" }),
  equation({ id: "eq.transition-pass", symbol: "dP.trans", title: "r=1 时双高边近直通状态占比", section: "过渡区三状态调制", expression: sub(add(ref("dA.trans"), ref("dB.trans")), lit(1)), displayExpression: "dP.trans = dA.trans+dB.trans-1", unit: "1", expected: 0.9, applicability: "两个 5% 低边修正脉冲互不重叠", validity: "若脉冲重叠或调制顺序改变，该占用率表达式失效", trace: derivationTrace(["derivation.transition-three-state"], "由两个高边导通区间的交集长度得到。"), digits: 4, sentinel: true, derivationSlug: "four-switch-buck-boost-transition-derivation", jumpLabel: "状态占用率", color: "purple" }),
  equation({ id: "eq.transition-pulse", symbol: "t.corr", title: "5% 修正脉冲时间", section: "过渡区三状态调制", expression: div(ref("mu.max"), ref("f.sw")), displayExpression: "t.corr = mu.max/f.sw", unit: "s", expected: 2.5e-7, applicability: "200 kHz、5% 初始修正脉冲", validity: "250 ns 必须由实桥最小可靠脉宽验证", trace: derivationTrace(["derivation.transition-three-state"], "占空比例除以频率得到时间。"), digits: 3, displayUnit: "μs", sentinel: true, derivationSlug: "four-switch-buck-boost-transition-derivation", jumpLabel: "修正脉冲时间", color: "purple" }),
  equation({ id: "eq.delta-transition", symbol: "dI.trans", title: "三状态 5% 修正段纹波量级", section: "过渡区三状态调制", expression: div(mul(ref("V.intrans"), ref("mu.max")), mul(ref("L.nom"), ref("f.sw"))), displayExpression: "dI.trans = V.intrans·mu.max/(L.nom·f.sw)", unit: "A", expected: 0.6, applicability: "VIN=VOUT=36 V、15 μH、200 kHz、5% 修正段", validity: "把单次修正段视为恒压电感斜坡；不替代完整离散仿真", trace: derivationTrace(["derivation.transition-three-state"], "由修正状态电感电压与 V=L·di/dt 积分。"), sentinel: true, derivationSlug: "four-switch-buck-boost-transition-derivation", jumpLabel: "过渡区纹波推导", color: "purple" }),
  equation({ id: "eq.delta-diagonal", symbol: "dI.diag", title: "简单对角半周期方案纹波量级", section: "过渡区三状态调制", expression: div(mul(ref("V.intrans"), lit(0.5)), mul(ref("L.nom"), ref("f.sw"))), displayExpression: "dI.diag = V.intrans·0.5/(L.nom·f.sw)", unit: "A", expected: 6, applicability: "VIN=VOUT=36 V、两个对角状态各约半周期的对比方案", validity: "只用于说明 Agent18 拒绝该调制的纹波压力", trace: sourceTrace(["src.agent18-control-protection"], "Agent18 明确给出该方案约 6 App。"), sentinel: true, color: "red" }),
  equation({ id: "eq.transition-ripple-ratio", symbol: "k.ripple", title: "三状态修正段相对对角方案纹波比例", section: "过渡区三状态调制", expression: div(ref("dI.trans"), ref("dI.diag")), displayExpression: "k.ripple = dI.trans/dI.diag", unit: "1", expected: 0.1, applicability: "同一 36 V/15 μH/200 kHz 对比基准", validity: "只比较单段理想纹波量级，不等于总 RMS 损耗比", trace: identityTrace("相同基准下两个纹波结果的比值。"), digits: 3, color: "purple" }),
  equation({ id: "eq.peak-transition", symbol: "I.pktrans", title: "三状态修正段名义峰值", section: "过渡区三状态调制", expression: add(ref("I.cont"), div(ref("dI.trans"), lit(2))), displayExpression: "I.pktrans = I.cont+dI.trans/2", unit: "A", expected: 10.3, applicability: "以 10 A 为纹波中心值的理想对比", validity: "未计入模式切换瞬态、反向电流和控制误差", trace: identityTrace("三角纹波峰值关系。"), color: "purple" }),
  equation({ id: "eq.cbc-margin-transition", symbol: "M.ctrans", title: "过渡区峰值到 CBC 的名义裕量", section: "过渡区三状态调制", expression: sub(ref("I.cbc"), ref("I.pktrans")), displayExpression: "M.ctrans = I.cbc-I.pktrans", unit: "A", expected: 2.2, applicability: "5% 修正脉冲的理想中心点", validity: "必须由全角落仿真和 OCP 波形确认", trace: identityTrace("逐周期阈值与理想峰值的差。"), color: "amber" }),

  equation({ id: "eq.legacy-duty-max", symbol: "D.maxlegacy", title: "现有板自举刷新后的最大高边占空", section: "现有板近直通能力审计", expression: div(sub(ref("N.total"), ref("N.refresh")), ref("N.total")), displayExpression: "D.maxlegacy = (N.total-N.refresh)/N.total", unit: "1", expected: 0.9574468085106383, applicability: "现有板 940 tick 周期、40 tick 强制刷新", validity: "仅描述现有固件，不代表 RevA 独立偏置方案", trace: sourceTrace(["src.agent18-control-protection", "src.agent18-existing-board"], "Agent18 复核现有固件得到 900/940。"), digits: 5, sentinel: true, color: "amber" }),
  equation({ id: "eq.near-duty-required", symbol: "D.reqnear", title: "25 V→24 V 理想 Buck 占空需求", section: "现有板近直通能力审计", expression: div(ref("V.outnear"), ref("V.innear")), displayExpression: "D.reqnear = V.outnear/V.innear", unit: "1", expected: 0.96, applicability: "尚未执行的 P3B 近直通目标", validity: "尚未计入 MOSFET、电感、shunt 与连接器压降", trace: identityTrace("理想 Buck 变换比。"), digits: 5, sentinel: true, color: "amber" }),
  equation({ id: "eq.near-duty-deficit", symbol: "dD.near", title: "现有板近直通占空缺口", section: "现有板近直通能力审计", expression: sub(ref("D.reqnear"), ref("D.maxlegacy")), displayExpression: "dD.near = D.reqnear-D.maxlegacy", unit: "1", expected: 0.002553191489361617, applicability: "25 V→24 V 与现有每周期刷新上限的理想比较", validity: "正值已表明理想占空超限；非理想压降只会扩大缺口", trace: identityTrace("需求占空减现有上限。"), digits: 6, sentinel: true, color: "red" }),

  equation({ id: "eq.delay-current-rise", symbol: "dI.delay", title: "500 ns 目标延迟对应最大电流上冲", section: "逐周期与硬件 OCP 时序", expression: div(mul(ref("V.inmax"), ref("t.off")), ref("L.nom")), displayExpression: "dI.delay = V.inmax·t.off/L.nom", unit: "A", expected: 1.2, applicability: "36 V、15 μH、目标总关断延迟 500 ns", validity: "最坏斜率目标值；未计入电感下降、公差和寄生振铃", trace: derivationTrace(["derivation.volt-second-foundation"], "由 V=L·di/dt 在关断延迟区间积分。"), sentinel: true, color: "red" }),
  equation({ id: "eq.fault-peak", symbol: "I.faultpk", title: "目标延迟下故障峰值", section: "逐周期与硬件 OCP 时序", expression: add(ref("I.hard"), ref("dI.delay")), displayExpression: "I.faultpk = I.hard+dI.delay", unit: "A", expected: 15.2, applicability: "14 A typ 越阈后按 500 ns 目标延迟继续上升", validity: "仅是目标闭合值；真实峰值取决于阈值公差、滤波、延迟和 Lmin", trace: identityTrace("硬阈值与延迟上冲相加。"), sentinel: true, color: "red" }),
  equation({ id: "eq.fault-margin", symbol: "M.fault", title: "故障峰值到 16 A 项目上限的目标裕量", section: "逐周期与硬件 OCP 时序", expression: sub(ref("I.faultmax"), ref("I.faultpk")), displayExpression: "M.fault = I.faultmax-I.faultpk", unit: "A", expected: 0.8, applicability: "标称 L=15 μH 与 500 ns 目标延迟", validity: "未完成公差与 Lmin=10 μH 校核前不得视为签核裕量", trace: identityTrace("项目峰值目标减目标闭合峰值。"), sentinel: true, color: "red" }),
  equation({ id: "eq.blanking-current-rise", symbol: "dI.blank", title: "100 ns blanking 内最大理想电流增量", section: "逐周期与硬件 OCP 时序", expression: div(mul(ref("V.inmax"), ref("t.blank")), ref("L.nom")), displayExpression: "dI.blank = V.inmax·t.blank/L.nom", unit: "A", expected: 0.24, applicability: "36 V、15 μH、100 ns 初值", validity: "blanking 只能覆盖开通尖峰，不能掩盖真实短路", trace: derivationTrace(["derivation.volt-second-foundation"], "由最大电感电流斜率乘 blanking 时间。"), color: "red" }),

  equation({ id: "eq.shunt-voltage-continuous", symbol: "V.shunt10", title: "10 A 连续电流的 shunt 压降", section: "电流采样与阈值窗口", expression: mul(ref("I.cont"), ref("R.shunt")), displayExpression: "V.shunt10 = I.cont·R.shunt", unit: "V", expected: 0.02, applicability: "0.002 Ω Kelvin shunt 标称值", validity: "未计入 shunt 公差、温漂和铜箔压降", trace: identityTrace("欧姆定律。"), digits: 3, color: "green" }),
  equation({ id: "eq.shunt-loss-continuous", symbol: "P.shunt10", title: "10 A 连续电流的 shunt 损耗", section: "电流采样与阈值窗口", expression: mul(pow(ref("I.cont"), 2), ref("R.shunt")), displayExpression: "P.shunt10 = I.cont²·R.shunt", unit: "W", expected: 0.2, applicability: "直流/低纹波近似；实际 RMS 电流略高", validity: "未计入温升导致的阻值变化", trace: identityTrace("焦耳损耗定义。"), digits: 3, sentinel: true, color: "green" }),
  equation({ id: "eq.shunt-voltage-hard", symbol: "V.shunt14", title: "14 A 硬 OCP 点的 shunt 压降", section: "电流采样与阈值窗口", expression: mul(ref("I.hard"), ref("R.shunt")), displayExpression: "V.shunt14 = I.hard·R.shunt", unit: "V", expected: 0.028, applicability: "0.002 Ω shunt 与 14 A typ 标称点", validity: "硬 OCP 最终必须做全公差窗口", trace: identityTrace("欧姆定律。"), digits: 3, color: "green" }),
  equation({ id: "eq.shunt-loss-hard", symbol: "P.shunt14", title: "14 A 等效连续下的 shunt 损耗量级", section: "电流采样与阈值窗口", expression: mul(pow(ref("I.hard"), 2), ref("R.shunt")), displayExpression: "P.shunt14 = I.hard²·R.shunt", unit: "W", expected: 0.392, applicability: "用于脉冲/热能力量级校核，不代表长期运行点", validity: "实际故障持续时间由锁存关断决定", trace: identityTrace("焦耳损耗定义。"), digits: 3, color: "green" }),
  equation({ id: "eq.csa-shift-hard", symbol: "V.csaShift", title: "14 A 时快速 CSA 相对中点偏移", section: "电流采样与阈值窗口", expression: mul(ref("I.hard"), ref("R.shunt"), ref("G.fast")), displayExpression: "V.csaShift = I.hard·R.shunt·G.fast", unit: "V", expected: 0.56, applicability: "0.002 Ω、Gain=20 的标称候选路径", validity: "最终需核对输入范围、输出摆幅、PWM 恢复和全公差", trace: identityTrace("shunt 电压乘电流放大器增益。"), digits: 3, color: "green" }),
  equation({ id: "eq.csa-positive-hard", symbol: "V.csaPos", title: "正向 14 A 窗口比较器标称电平", section: "电流采样与阈值窗口", expression: add(ref("V.ref"), ref("V.csaShift")), displayExpression: "V.csaPos = V.ref+V.csaShift", unit: "V", expected: 2.21, applicability: "3.3 V 供电、1.65 V 中点的正向路径", validity: "仅为标称电平；不得直接代替最终 DAC/电阻阈值", trace: identityTrace("双向电流放大器正向输出。"), digits: 3, sentinel: true, color: "green" }),
  equation({ id: "eq.csa-negative-hard", symbol: "V.csaNeg", title: "反向 -14 A 窗口比较器标称电平", section: "电流采样与阈值窗口", expression: sub(ref("V.ref"), ref("V.csaShift")), displayExpression: "V.csaNeg = V.ref-V.csaShift", unit: "V", expected: 1.09, applicability: "RevA 实装反向快速比较器的对称标称点", validity: "负向动作策略与阈值需控制/硬件共同复核", trace: identityTrace("双向电流放大器反向输出。"), digits: 3, color: "green" }),

  equation({ id: "eq.inductor-energy-continuous", symbol: "E.L10", title: "15 μH/10 A 电感储能", section: "磁件、器件与驱动边界", expression: mul(lit(0.5), ref("L.nom"), pow(ref("I.cont"), 2)), displayExpression: "E.L10 = 0.5·L.nom·I.cont²", unit: "J", expected: 0.00075, applicability: "标称电感与连续电流目标", validity: "不代表磁芯损耗；需 Isat、B-H 与热模型", trace: identityTrace("线性电感储能定义。"), digits: 1, displayUnit: "μJ", sentinel: true, color: "amber" }),
  equation({ id: "eq.vds-derating", symbol: "k.vds", title: "VDS 峰值项目目标占耐压比例", section: "磁件、器件与驱动边界", expression: div(ref("V.dspeak"), ref("V.dsrated")), displayExpression: "k.vds = V.dspeak/V.dsrated", unit: "1", expected: 0.8, applicability: "100 V MOS 候选与 <80 V 样板目标", validity: "V.dspeak 尚未实测，当前只是项目目标比例", trace: sourceTrace(["src.agent18-design-spec", "src.agent18-control-protection"], "Agent18 规定 100 V MOS 与样板后 VDS_peak<80 V 目标。"), digits: 3, color: "amber" }),
  equation({ id: "eq.deadtime-fraction", symbol: "k.dead", title: "150 ns 死区占一个周期的比例", section: "磁件、器件与驱动边界", expression: mul(ref("t.dead"), ref("f.sw")), displayExpression: "k.dead = t.dead·f.sw", unit: "1", expected: 0.03, applicability: "200 kHz、初始 150 ns 死区", validity: "最终死区按双脉冲测试在 80–250 ns 冻结", trace: sourceTrace(["src.agent18-control-protection", "src.ti-ucc21530"], "Agent18 初值与 UCC21530-class 硬件死区边界。"), digits: 4, color: "amber" })
];

const sectionByEquationId = new Map([
  ...["eq.power-low-line", "eq.full-power-vin"].map((id) => [id, "设计规格与功率边界"]),
  ...["eq.duty-buck", "eq.duty-boost"].map((id) => [id, "工作模式与占空比"]),
  ...[
    "eq.delta-buck", "eq.peak-buck", "eq.valley-buck", "eq.cbc-margin-buck",
    "eq.delta-boost", "eq.peak-boost", "eq.valley-boost", "eq.cbc-margin-boost",
    "eq.inductor-energy-continuous"
  ].map((id) => [id, "主电感与电流应力"]),
  ...["eq.vds-derating", "eq.deadtime-fraction"].map((id) => [id, "功率器件与驱动"]),
  ...[
    "eq.delay-current-rise", "eq.fault-peak", "eq.fault-margin", "eq.blanking-current-rise",
    "eq.shunt-voltage-continuous", "eq.shunt-loss-continuous", "eq.shunt-voltage-hard",
    "eq.shunt-loss-hard", "eq.csa-shift-hard", "eq.csa-positive-hard", "eq.csa-negative-hard"
  ].map((id) => [id, "电流采样与保护"]),
  ...[
    "eq.transition-high", "eq.transition-da", "eq.transition-db", "eq.transition-pass",
    "eq.transition-pulse", "eq.delta-transition", "eq.delta-diagonal", "eq.transition-ripple-ratio",
    "eq.peak-transition", "eq.cbc-margin-transition", "eq.legacy-duty-max",
    "eq.near-duty-required", "eq.near-duty-deficit"
  ].map((id) => [id, "控制与过渡区专项校核"])
]);
for (const pair of equationPairs) pair.equation.section = sectionByEquationId.get(pair.equation.id) || pair.equation.section;

const equations = equationPairs.map((entry) => entry.equation);
const results = equationPairs.map((entry) => entry.result);

const unresolvedItems = [
  ["input.mosfet-loss-data", "MOSFET 最终 MPN 与损耗/过冲数据", ["power_devices", "thermal", "derating", "signoff"], "Agent7 冻结器件并完成全角落导通/开关损耗、SOA、过冲和热计算。"],
  ["input.inductor-loss-data", "主电感磁芯、绕组、饱和与损耗数据", ["magnetics", "thermal", "derating", "signoff"], "冻结磁件并完成 Lmin、Isat、DCR、磁芯损耗和温升校核。"],
  ["input.capacitor-network", "输入输出电容网络与纹波设计", ["capacitors", "power_closure", "thermal", "signoff"], "完成容量、偏压降额、ESR/ESL、RMS 电流、寿命和瞬态设计。"],
  ["input.fast-ocp-tolerance", "快速 OCP 全公差与小于 500 ns 实测", ["sensing", "tolerances", "validation", "signoff"], "冻结 FAST_CSA/比较器/锁存器并完成阈值窗口和越阈至 VGS 关断实测。"],
  ["input.gate-bias-selection", "独立浮动偏置与 8 V UVLO 驱动后缀", ["gate_drive", "thermal", "validation", "signoff"], "冻结驱动和隔离 DC/DC，验证 100% 高边保持、UVLO、EN 时序、CMTI 与偏置功耗。"],
  ["input.hrtim-resource", "G474 HRTIM/COMP/DAC/ADC 资源与硬件互锁", ["operating_states", "sensing", "control", "validation", "signoff"], "完成引脚资源表、四路原子更新、EEV 截断和 FLT 锁存开发板波形。"],
  ["input.loop-model", "三模式内外环与过渡区控制复核", ["control", "power_closure", "validation", "signoff"], "Agent15 完成 Buck/Transition/Boost 全角落模型与相位/增益裕量。"],
  ["input.thermal-stackup", "150 W 热路径、铜厚与散热边界", ["thermal", "derating", "power_devices", "signoff"], "冻结 stackup、环境、热阻、散热器/风扇并完成器件结温验证。"],
  ["input.prepcb-evidence", "投板前 E1–E10 波形、仿真和评审证据", ["validation", "operating_states", "gate_drive", "control", "signoff"], "按 Agent18 Gate 取得开发板/现有板证据、仿真、ERC 0 和关键布局评审。"]
].map(([id, title, blocks, resolution]) => ({ id, title, mandatory: true, blocks, resolution, status: "open" }));

const book = {
  schemaVersion: "1.0.0",
  bookKind: "instance",
  bookId: "larkix-four-switch-buck-boost-reva-20260721",
  slug: "four-switch-buck-boost-reva",
  title: "BBG474 RevA 四开关非反相 BUCK-BOOST 计算书",
  revision: "2026-07-21-r4",
  design: {
    topology: "four-switch-non-inverting-synchronous-buck-boost",
    operatingMode: "Buck、双高边近直通主状态加 C+/C- 修正脉冲的过渡区，以及同步 Boost；单向供能 RevA",
    status: "blocked",
    confidentiality: "internal",
    authors: ["Larkix Engineering"],
    reviewers: ["功率级设计评审", "硬件评审", "控制评审"],
    signoff: { status: "blocked", blockedBy: unresolvedItems.map((item) => item.id) }
  },
  presentation: {
    voice: "first_person_singular",
    style: "ieee_concise",
    formulaNarration: "section_level",
    formulaGapPt: 32,
    sectionOrder: [
      "设计规格与功率边界",
      "工作模式与占空比",
      "主电感与电流应力",
      "功率器件与驱动",
      "输入输出电容",
      "电流采样与保护",
      "控制与过渡区专项校核",
      "损耗与热设计"
    ],
    sectionIntroductions: [
      { section: "设计规格与功率边界", text: "我先冻结 VIN、VOUT、IOUT、Pout 与 fsw，并用低输入功率降额划定可计算边界。" },
      { section: "工作模式与占空比", text: "我按 TI LM5176 的详细设计顺序，分别建立 Buck 与 Boost 工作状态和占空比；过渡区控制留到功率级之后专项校核。" },
      { section: "主电感与电流应力", text: "我按 TI LM5176 与 ADI LTC3789 的做法，在 Buck、Boost 两种模式下比较电感纹波、峰值和限流裕量，并以更严边界选择磁件。" },
      { section: "功率器件与驱动", text: "我在电流应力之后检查 MOSFET 耐压降额、死区与驱动边界；最终选型仍需补齐 RDS(on)、Qg、Coss、Qrr、SOA 和热数据。" },
      { section: "输入输出电容", text: "我将按 Buck 输入电容 RMS、Boost 输出电容 RMS、偏压降额、ESR/ESL、纹波与瞬态选择电容阵列；当前网络未冻结，因此本节保留为签核阻断。" },
      { section: "电流采样与保护", text: "我先计算 shunt 压降与损耗，再闭合逐周期限流、硬件 OCP 阈值、blanking 和越阈至 VGS 关断的总延迟。" },
      { section: "控制与过渡区专项校核", text: "我把 P/C+/C− 三状态调制放在功率级选型之后，因为它属于 STM32G474 的控制实现专项，不是常规 BUCK-BOOST 元件选型的起点；我再用 ST AN4539 的四开关工作模态检查状态互锁与过渡纹波。" },
      { section: "损耗与热设计", text: "我将在器件、磁件、电容和 PCB 热路径冻结后，逐项汇总导通、开关、磁芯、铜损、偏置与散热，并建立全输入输出范围的结温和降额曲线。" }
    ],
    highlightEquationIds: [
      "eq.power-low-line",
      "eq.cbc-margin-buck",
      "eq.cbc-margin-boost",
      "eq.inductor-energy-continuous",
      "eq.vds-derating",
      "eq.fault-peak",
      "eq.near-duty-deficit",
      "eq.transition-pulse"
    ],
    symbolGlossary: [
      { symbol: "k.derate", meaning: "低输入功率降额系数；本册取 0.8。" },
      { symbol: "I.cont", meaning: "主电感连续电流的设计中心值。" },
      { symbol: "I.cbc", meaning: "逐周期电流限制（cycle-by-cycle limit）的标称阈值。" },
      { symbol: "I.hard", meaning: "独立硬件过流保护的标称动作电流。" },
      { symbol: "I.faultmax", meaning: "计入阈值与关断延迟后允许的故障峰值上限。" },
      { symbol: "I.bring", meaning: "首次上电调试阶段采用的低电流限制。" },
      { symbol: "V.inbuck", meaning: "Buck 纹波校核工况的输入电压，本册取 36 V。" },
      { symbol: "V.outbuck", meaning: "Buck 纹波校核工况的输出电压，本册取 18 V。" },
      { symbol: "V.inboost", meaning: "Boost 纹波校核工况的输入电压，本册取 12 V。" },
      { symbol: "V.outboost", meaning: "Boost 纹波校核工况的输出电压，本册取 36 V。" },
      { symbol: "V.intrans", meaning: "过渡区调制纹波校核电压；本册令 VIN=VOUT=36 V，只用于比较两种调制，不是新增额定输入。" },
      { symbol: "r.trans", meaning: "过渡区电压比 VOUT/VIN；中心点等于 1。" },
      { symbol: "r.low", meaning: "Buck 侧进入过渡区的电压比下边界。" },
      { symbol: "r.high", meaning: "Boost 侧离开过渡区的电压比上边界。" },
      { symbol: "mu.max", meaning: "过渡中心单个修正状态允许的最大周期占比。" },
      { symbol: "N.total", meaning: "现有控制周期的总计数。" },
      { symbol: "N.refresh", meaning: "现有控制每周期强制自举刷新的计数。" },
      { symbol: "V.innear", meaning: "近直通能力审计工况的输入电压，本册取 25 V。" },
      { symbol: "V.outnear", meaning: "近直通能力审计工况的输出电压，本册取 24 V。" },
      { symbol: "t.off", meaning: "电流越阈到实际门极关断的总延迟目标。" },
      { symbol: "t.blank", meaning: "开通后暂时屏蔽尖峰的 blanking 时间。" },
      { symbol: "R.shunt", meaning: "主电感电流检测用四端分流电阻。" },
      { symbol: "G.fast", meaning: "快速电流检测放大链路的电压增益。" },
      { symbol: "V.ref", meaning: "双向电流检测输出的零电流中点电压。" },
      { symbol: "V.dspeak", meaning: "MOSFET 预期漏源峰值。" },
      { symbol: "V.dsrated", meaning: "MOSFET 额定漏源耐压。" },
      { symbol: "t.dead", meaning: "同一桥臂上下管互补切换的死区时间。" },
      { symbol: "V.bias", meaning: "高边隔离/浮动驱动使用的偏置电压。" },
      { symbol: "dI.buck", meaning: "Buck 校核工况的电感峰峰纹波。" },
      { symbol: "dI.boost", meaning: "Boost 校核工况的电感峰峰纹波。" },
      { symbol: "M.cbuck", meaning: "Buck 峰值电流到逐周期限流阈值的名义裕量。" },
      { symbol: "M.cboost", meaning: "Boost 峰值电流到逐周期限流阈值的名义裕量。" },
      { symbol: "dA.trans", meaning: "过渡中心输入桥高边的占空比。" },
      { symbol: "dB.trans", meaning: "过渡中心输出桥高边的占空比。" },
      { symbol: "dP.trans", meaning: "过渡中心两个高边同时导通的主状态占比。" },
      { symbol: "t.corr", meaning: "每个过渡区修正状态在一个周期内的持续时间。" },
      { symbol: "dI.trans", meaning: "三状态修正方案单个修正段的电流变化量。" },
      { symbol: "dI.diag", meaning: "简单对角方案半周期内的电流变化量。" },
      { symbol: "k.ripple", meaning: "两种过渡调制电流变化量的比值。" },
      { symbol: "I.faultpk", meaning: "硬件阈值与关断延迟上冲相加得到的故障峰值。" },
      { symbol: "dD.near", meaning: "近直通所需占空比超出现有控制上限的差值。" },
      { symbol: "V.csaShift", meaning: "快速电流放大器相对中点的输出偏移量。" },
      { symbol: "V.csaPos", meaning: "正向过流比较器的标称电平。" },
      { symbol: "V.csaNeg", meaning: "反向过流比较器的标称电平。" },
      { symbol: "k.vds", meaning: "预期 VDS 峰值占 MOSFET 额定耐压的比例。" },
      { symbol: "k.dead", meaning: "死区时间占一个开关周期的比例。" }
    ],
    symbolPlacement: "formula_local",
    unresolvedNarration: "summary_only",
    unresolvedSummary: "我尚未闭合最终 MOSFET、磁件与电容选型，保护链全公差和实测延迟，控制环路以及 150 W 热设计；这些条件不改变本册标称公式，但限制结论仅用于设计评审。"
  },
  publication: {
    canonical: { publishStatus: "draft", visibilityStatus: "private" },
    previewOverride: { publishStatus: "published", visibilityStatus: "unlisted", isolatedDataDirOnly: true }
  },
  outputs: {
    mathcad: {
      filename: "Larkix_BBG474_RevA_BuckBoost_20260721.xmcd",
      template: "E:/User/AUX20260708.xmcd",
      worksheetTitle: "BBG474 RevA 四开关非反相 BUCK-BOOST 计算书"
    },
    larkix: {
      packageFilename: "generated/larkix-package.json",
      l1Slug: "four-switch-buck-boost-reva-calculation-sheet",
      routeBase: "derive.html?slug="
    }
  },
  sources,
  assumptions,
  inputs,
  constants: [],
  equations,
  results,
  derivations: [
    {
      id: "derivation.transition-three-state",
      level: "L2_engineering_derivation",
      slug: "four-switch-buck-boost-transition-derivation",
      title: "四开关 BUCK-BOOST 过渡区三状态调制与纹波推导",
      symbol: "dA.trans / dB.trans / dI.trans",
      parentFormulaId: "eq.delta-transition",
      prerequisites: ["四开关非反相功率级状态", "稳态电感伏秒平衡", "V=L·di/dt", "互补 PWM 与死区"],
      assumptions: ["assumption.ideal-steady-state", "assumption.transition-worst-case", "assumption.nominal-components"],
      validity: "单向供能、稳态 CCM、修正脉冲不重叠、VIN≈VOUT；最终调制律和轻载策略待 Agent15 复核。",
      steps: [
        { id: "step.transition-states", statement: "定义近直通 P、Boost 修正 C+ 和 Buck 修正 C- 三个有效状态。", expression: "P:(Q1H,Q2H)；C+:(Q1H,Q2L)；C-:(Q1L,Q2H)", justification: "每个状态都避免同一半桥上下管重叠，并分别提供 VIN-VOUT、VIN、-VOUT 的电感电压。", trace: sourceTrace(["src.agent18-control-protection", "src.ti-lm5176", "src.st-an4539"], "Agent18 状态表与原厂四开关工作模态。") },
        { id: "step.transition-balance", statement: "以两个高边占空 dA、dB 表达稳态伏秒约束。", expression: "dA·VIN=dB·VOUT", justification: "SW1 平均电位为 dA·VIN，SW2 平均电位为 dB·VOUT；稳态电感平均电压为零。", trace: identityTrace("电感周期伏秒平衡。") },
        { id: "step.transition-center", statement: "在 r=VOUT/VIN=1 中心点令两个修正脉冲各占 mu.max。", expression: "dA=dB=1-mu.max=0.95", justification: "两桥高边各让出一个 5% 低边修正段，同时保持 dA=dB。", trace: sourceTrace(["src.agent18-control-protection"], "Agent18 暂定中心点最大修正脉冲 5%。") },
        { id: "step.transition-pass", statement: "两个修正段错开时，双高边 P 状态占用率为两个高边区间交集。", expression: "dP=dA+dB-1=1-2·mu.max=0.90", justification: "两个 5% 低边区间互不重叠，总共占 10%，剩余 90% 为 P。", trace: identityTrace("区间交集与占用率代数。") },
        { id: "step.transition-pulse", statement: "把 5% 占空换算为实际修正脉冲时间。", expression: "t.corr=mu.max/f.sw=0.25 us", justification: "200 kHz 周期为 5 us，5% 为 0.25 us。", trace: identityTrace("占空与周期定义。") },
        { id: "step.transition-ripple", statement: "修正段内由电感本构关系得到单段电流变化量。", expression: "dI.trans=V.intrans·mu.max/(L.nom·f.sw)=0.6 A", justification: "在 C+ 或 C- 段把电感电压近似为 36 V，积分 0.25 us。", trace: identityTrace("V=L·di/dt 的定电压积分。") },
        { id: "step.transition-contrast", statement: "对角状态各半周期会显著放大纹波。", expression: "dI.diag=36 V·0.5/(15 uH·200 kHz)=6 A", justification: "半周期恒定施加 36 V，电流变化量为三状态 5% 修正段的十倍。", trace: sourceTrace(["src.agent18-control-protection"], "Agent18 拒绝简单对角半周期调制的定量依据。") }
      ],
      dimensionalCheck: "dA、dB、dP、mu.max 为无量纲；mu.max/f.sw 的量纲为 s；V·s/H=A，因此两种纹波结果均为 A。",
      returnTarget: "four-switch-buck-boost-reva-calculation-sheet",
      summary: "从四管状态、双桥平均电位与伏秒平衡推出过渡中心占空、近直通状态比例、250 ns 修正脉冲和 0.6 A 纹波，并与 6 A 简单对角方案对比。",
      color: "purple"
    },
    {
      id: "derivation.volt-second-foundation",
      level: "L3_foundation_derivation",
      slug: "inductor-volt-second-ripple-foundation",
      title: "电感伏秒平衡与 Buck/Boost 纹波基础",
      symbol: "D / dI",
      parentFormulaId: "eq.delta-buck",
      prerequisites: ["电感本构关系", "周期稳态", "分段常值开关状态"],
      assumptions: ["assumption.ideal-steady-state", "assumption.nominal-components"],
      validity: "周期稳态、线性电感、CCM、每一开关子区间电感电压近似恒定。",
      steps: [
        { id: "step.foundation-inductor", statement: "电感电压决定电流斜率。", expression: "vL=L·di/dt", justification: "线性电感的本构关系。", trace: identityTrace("电磁学基础定义。") },
        { id: "step.foundation-periodic", statement: "周期稳态要求一周期电流净变化为零。", expression: "integral(0,T) vL dt=0", justification: "每周期末电感电流回到相同初值。", trace: identityTrace("周期稳态定义。") },
        { id: "step.foundation-buck", statement: "Buck 两状态伏秒平衡给出占空比。", expression: "(VIN-VOUT)·D+(-VOUT)·(1-D)=0 => D=VOUT/VIN", justification: "输入桥 PWM、输出高边常导通。", trace: sourceTrace(["src.agent18-control-protection", "src.ti-lm5176"], "Agent18 Buck 状态表与原厂模式。") },
        { id: "step.foundation-buck-ripple", statement: "在 Buck 充能段积分得到峰峰纹波。", expression: "dI=(VIN-VOUT)·D/(L·fs)", justification: "充能时间 D/fs，段内电压近似恒定。", trace: identityTrace("V=L·di/dt 积分。") },
        { id: "step.foundation-boost", statement: "Boost 两状态伏秒平衡给出占空比。", expression: "VIN·D+(VIN-VOUT)·(1-D)=0 => D=1-VIN/VOUT", justification: "输入高边常导通、输出桥同步 PWM。", trace: sourceTrace(["src.agent18-control-protection", "src.ti-lm5176"], "Agent18 Boost 状态表与原厂模式。") },
        { id: "step.foundation-boost-ripple", statement: "在 Boost 充能段积分得到峰峰纹波。", expression: "dI=VIN·D/(L·fs)", justification: "Q2L 导通期间电感两端约为 VIN。", trace: identityTrace("V=L·di/dt 积分。") }
      ],
      dimensionalCheck: "D 为无量纲；V/(H·Hz)=V·s/H=A，因此 Buck、Boost 和延迟电流增量公式均闭合为 A。",
      returnTarget: "four-switch-buck-boost-reva-calculation-sheet",
      summary: "从 vL=L·di/dt 和周期伏秒为零统一推出 Buck/Boost 理想占空及纹波，作为 L1 模式校核与 OCP 电流斜率的基础。",
      color: "blue"
    }
  ],
  coverage: [
    { category: "operating_states", status: "unresolved", reason: "模式表与理想占空已计算，但四路原子更新和跨区波形未取得。", formulaRefs: ["eq.duty-buck", "eq.duty-boost", "eq.transition-pass"], unresolvedRefs: ["input.hrtim-resource", "input.prepcb-evidence"], validationRefs: ["validation.pwm-states"] },
    { category: "power_closure", status: "unresolved", reason: "已建立 150 W 与低线降额边界，效率和全范围损耗模型未闭合。", formulaRefs: ["eq.power-low-line", "eq.full-power-vin"], unresolvedRefs: ["input.loop-model", "input.capacitor-network"], validationRefs: ["validation.power"] },
    { category: "magnetics", status: "unresolved", reason: "15 μH 标称纹波与储能已计算，磁芯、Lmin、饱和、损耗和温升未冻结。", formulaRefs: ["eq.delta-buck", "eq.delta-boost", "eq.inductor-energy-continuous"], unresolvedRefs: ["input.inductor-loss-data"], validationRefs: ["validation.thermal"] },
    { category: "capacitors", status: "unresolved", reason: "Agent18 尚未给出输入输出电容阵列及纹波/瞬态闭合。", formulaRefs: [], unresolvedRefs: ["input.capacitor-network"], validationRefs: ["validation.power", "validation.thermal"] },
    { category: "power_devices", status: "unresolved", reason: "100 V 等级和 <80 V 目标已记录，最终 MOSFET 损耗、SOA 和过冲未闭环。", formulaRefs: ["eq.vds-derating"], unresolvedRefs: ["input.mosfet-loss-data"], validationRefs: ["validation.thermal", "validation.pcb"] },
    { category: "sensing", status: "unresolved", reason: "0.002 Ω/Gain=20 标称窗口已计算，最终器件、阈值公差和延迟未验证。", formulaRefs: ["eq.shunt-voltage-hard", "eq.csa-positive-hard", "eq.csa-negative-hard"], unresolvedRefs: ["input.fast-ocp-tolerance", "input.hrtim-resource"], validationRefs: ["validation.ocp-latency"] },
    { category: "gate_drive", status: "unresolved", reason: "独立浮动偏置和 8 V UVLO 路线已选，具体器件与 100% 高边保持未验证。", formulaRefs: ["eq.deadtime-fraction", "eq.legacy-duty-max"], unresolvedRefs: ["input.gate-bias-selection", "input.prepcb-evidence"], validationRefs: ["validation.bias"] },
    { category: "control", status: "unresolved", reason: "三状态中心点和边界连续输入已记录，内外环及轻载/反向电流策略待 Agent15。", formulaRefs: ["eq.transition-da", "eq.transition-db", "eq.transition-ripple-ratio"], unresolvedRefs: ["input.loop-model", "input.hrtim-resource"], validationRefs: ["validation.loop", "validation.pwm-states"] },
    { category: "tolerances", status: "unresolved", reason: "当前结果按标称值，尚未引入 L、shunt、CSA、DAC、比较器、死区和温漂公差。", formulaRefs: ["eq.cbc-margin-buck", "eq.cbc-margin-boost", "eq.fault-margin"], unresolvedRefs: ["input.fast-ocp-tolerance", "input.inductor-loss-data"], validationRefs: ["validation.ocp-latency"] },
    { category: "thermal", status: "unresolved", reason: "只计算 shunt 损耗和电感储能量级，150 W 热模型未建立。", formulaRefs: ["eq.shunt-loss-continuous", "eq.shunt-loss-hard", "eq.inductor-energy-continuous"], unresolvedRefs: ["input.thermal-stackup", "input.mosfet-loss-data", "input.inductor-loss-data"], validationRefs: ["validation.thermal"] },
    { category: "derating", status: "unresolved", reason: "低线功率规则和 VDS 目标比例已表达，热、电容、磁件和器件全角落降额未完成。", formulaRefs: ["eq.power-low-line", "eq.full-power-vin", "eq.vds-derating"], unresolvedRefs: ["input.thermal-stackup", "input.capacitor-network"], validationRefs: ["validation.thermal", "validation.power"] },
    { category: "validation", status: "unresolved", reason: "JSON/MathCAD/Larkix 自动门禁可通过，但 Agent18 E1–E10 实物证据仍为空。", formulaRefs: ["eq.delta-transition", "eq.fault-peak", "eq.near-duty-deficit"], unresolvedRefs: ["input.prepcb-evidence", "input.fast-ocp-tolerance"], validationRefs: ["validation.schema", "validation.mathcad", "validation.larkix", "validation.consistency", "validation.pwm-states", "validation.ocp-latency"] }
  ],
  corners: [
    { id: "corner.inductance-min", title: "主电感 10 μH 下限", overrides: { "input.inductance": { value: 10, unit: "μH" } }, purpose: "检查最大 Buck/Boost/过渡纹波、CBC 与延迟上冲。" },
    { id: "corner.inductance-max", title: "主电感 22 μH 上限", overrides: { "input.inductance": { value: 22, unit: "μH" } }, purpose: "检查动态响应、磁件体积和控制带宽。" },
    { id: "corner.frequency-min", title: "100 kHz 调试下限", overrides: { "input.frequency": { value: 100, unit: "kHz" } }, purpose: "检查最大电流纹波与磁通摆幅。" },
    { id: "corner.frequency-max", title: "300 kHz 调试上限", overrides: { "input.frequency": { value: 300, unit: "kHz" } }, purpose: "检查开关损耗、最小脉宽和数字控制分辨率。" },
    { id: "corner.low-line", title: "6 V 低线功率降额", overrides: { "input.vin-min": { value: 6, unit: "V" } }, purpose: "确认首轮输出功率不得超过 48 W。" },
    { id: "corner.transition-high-voltage", title: "36 V 过渡中心", overrides: { "input.vin-transition": { value: 36, unit: "V" }, "input.transition-ratio": { value: 1, unit: "1" } }, purpose: "对比三状态修正与简单对角方案纹波。" }
  ],
  componentRequirements: [
    { id: "requirement.inductor", category: "magnetics", requirement: "初选 15 μH、允许 10–22 μH、Isat≥20 A、DCR≤0.008 Ω；需最终 MPN、损耗和热校核。", status: "unresolved", sourceRefs: ["src.agent18-design-spec", "src.agent18-frozen-spec"], resultRefs: ["result.delta-buck", "result.delta-boost", "result.inductor-energy-continuous"] },
    { id: "requirement.mosfet", category: "power_devices", requirement: "100 V N-MOSFET，样板目标 VDS_peak<80 V；最终按损耗、SOA、过冲、热与采购锁件。", status: "unresolved", sourceRefs: ["src.agent18-design-spec", "src.agent18-control-protection"], resultRefs: ["result.vds-derating", "result.fault-peak"] },
    { id: "requirement.shunt", category: "sensing", requirement: "0.002 Ω 四端 Kelvin shunt；需按 10 A 连续、14 A 故障量级、公差和温升选型。", status: "provisional", sourceRefs: ["src.agent18-control-protection"], resultRefs: ["result.shunt-voltage-continuous", "result.shunt-loss-continuous", "result.shunt-loss-hard"] },
    { id: "requirement.fast-ocp", category: "sensing", requirement: "3.3 V FAST_CSA + 双向窗口比较器 + SR latch，越阈至实际 VGS 关断总时间≤500 ns。", status: "unresolved", sourceRefs: ["src.agent18-control-protection", "src.st-g474", "src.ti-snoa987"], resultRefs: ["result.csa-positive-hard", "result.csa-negative-hard", "result.fault-peak"] },
    { id: "requirement.driver-bias", category: "gate_drive", requirement: "两路独立 12 V 浮动高边偏置；驱动必须选 8 V UVLO 系列后缀并验证 100% 高边保持。", status: "unresolved", sourceRefs: ["src.agent18-control-protection", "src.ti-ucc21530"], resultRefs: ["result.legacy-duty-max", "result.deadtime-fraction"] },
    { id: "requirement.capacitors", category: "capacitors", requirement: "输入/输出电容阵列需按全范围纹波、RMS 电流、偏压降额、ESR/ESL、寿命和瞬态设计。", status: "unresolved", sourceRefs: ["src.agent18-design-spec"], resultRefs: [] },
    { id: "requirement.controller", category: "control", requirement: "STM32G474 HRTIM 四路互补 PWM、周期边界原子更新、COMP/EEV CBC、FLT 锁存与同步 ADC。", status: "unresolved", sourceRefs: ["src.agent18-control-protection", "src.st-an4539", "src.st-g474"], resultRefs: ["result.transition-pulse", "result.blanking-current-rise"] }
  ],
  decisions: [
    { id: "decision.mode-partition", statement: "Buck 仅输入桥 PWM；Boost 仅输出桥 PWM；过渡区采用 P/C+/C- 三状态调制。", basisRefs: ["src.agent18-control-protection", "result.transition-pass", "result.transition-ripple-ratio"], status: "accepted" },
    { id: "decision.reject-diagonal", statement: "拒绝两个对角状态各约半周期的过渡方案，因为 36 V/15 μH/200 kHz 下理想纹波约 6 A。", basisRefs: ["result.delta-diagonal", "result.delta-transition"], status: "accepted" },
    { id: "decision.independent-bias", statement: "RevA 额定路线采用两路独立浮动高边偏置；周期刷新仅 DNP 对照，交叉供电不采用。", basisRefs: ["src.agent18-control-protection", "result.near-duty-deficit"], status: "accepted" },
    { id: "decision.ocp-architecture", statement: "采用精密 ADC 与快速 OCP 双路径；外部窗口比较器/锁存器直接关闭两颗驱动 EN。", basisRefs: ["src.agent18-control-protection", "result.fault-peak", "result.csa-positive-hard"], status: "accepted" },
    { id: "decision.release-blocked", statement: "在 Agent7/Agent15 复核、E1–E10 证据和最终器件/热/环路闭环前，不生成生产 Gerber、不下单。", basisRefs: unresolvedItems.map((item) => item.id), status: "blocked" }
  ],
  margins: [
    { id: "margin.cbc-buck", title: "Buck 标称峰值到 CBC", actualResultRef: "result.cbc-margin-buck", requirement: "名义裕量>0 A；最终需在 Lmin、fsmin 与全公差下仍不误触发", status: "pass" },
    { id: "margin.cbc-boost", title: "Boost 标称峰值到 CBC", actualResultRef: "result.cbc-margin-boost", requirement: "名义裕量>0 A；最终需在 Lmin、fsmin 与全公差下仍不误触发", status: "pass" },
    { id: "margin.transition-cbc", title: "过渡中心标称峰值到 CBC", actualResultRef: "result.cbc-margin-transition", requirement: "名义裕量>0 A，且模式切换无额外峰值/反向电流", status: "unresolved" },
    { id: "margin.legacy-near-duty", title: "现有板 25 V→24 V 占空能力", actualResultRef: "result.near-duty-deficit", requirement: "D.reqnear≤D.maxlegacy；当前差值为正，且尚未计入压降", status: "fail" },
    { id: "margin.fault-peak", title: "目标延迟下故障峰值", actualResultRef: "result.fault-margin", requirement: "I.faultpk<16 A；必须用 Lmin、阈值公差和实测延迟重新验证", status: "unresolved" },
    { id: "margin.vds-target", title: "MOSFET 电压降额目标", actualResultRef: "result.vds-derating", requirement: "VDS_peak/VDS_rated<0.8；当前 0.8 是目标边界，不是实测结果", status: "unresolved" }
  ],
  risks: [
    { id: "risk.agent18-provisional", severity: "high", statement: "Agent18 RevA 文档是待 Agent7/Agent15 复核的设计输入，不是量产签核。", mitigation: "保留来源状态；所有未决项进入 signoff.blockedBy。", relatedRefs: ["src.agent18-design-spec", "input.prepcb-evidence"] },
    { id: "risk.near-passthrough", severity: "critical", statement: "现有板自举刷新上限低于 25 V→24 V 理想占空，不能直接进入高功率近直通。", mitigation: "保持 P3B 未执行；RevA 使用独立偏置并先完成四路 PWM、OCP 和偏置台架。", relatedRefs: ["result.legacy-duty-max", "result.near-duty-required", "result.near-duty-deficit"] },
    { id: "risk.ocp-target-not-measured", severity: "critical", statement: "500 ns 是目标；若真实延迟接近 1 μs，36 V/15 μH 下额外上冲可达约 2.4 A。", mitigation: "冻结更快器件并完成 shunt 等效输入到实际 VGS 的全链路注入测试。", relatedRefs: ["assumption.latency-is-target", "input.fast-ocp-tolerance", "result.fault-peak"] },
    { id: "risk.lmin", severity: "high", statement: "当前 OCP 上冲按 15 μH 标称值计算，允许的 10 μH 下限会显著增大斜率。", mitigation: "在 Lmin/fsmin/Vinmax 与全公差角重新计算并验证 CBC/硬 OCP。", relatedRefs: ["corner.inductance-min", "result.delay-current-rise", "input.inductor-loss-data"] },
    { id: "risk.minimum-pulse", severity: "high", statement: "200 kHz 下 5% 只有 250 ns，实际门极负载的可靠最小脉宽可能更大。", mitigation: "用双脉冲/实桥测试冻结最小脉宽；不足时使用整周期脉冲密度调制。", relatedRefs: ["result.transition-pulse", "src.ti-ucc21530", "input.prepcb-evidence"] },
    { id: "risk.reverse-current", severity: "high", statement: "轻载同步整流和跨模式切换可能产生无约束负电感电流或输出向输入反灌。", mitigation: "实装负向快速比较器，补齐零电流关断/去能量状态和 Agent15 控制复核。", relatedRefs: ["input.loop-model", "input.fast-ocp-tolerance", "input.prepcb-evidence"] },
    { id: "risk.loss-thermal-open", severity: "critical", statement: "150 W 额定目标尚无 MOSFET、磁件、电容、偏置和 PCB 热模型支撑。", mitigation: "器件与 stackup 冻结后完成全模式损耗、结温、热像与功率降额。", relatedRefs: ["input.mosfet-loss-data", "input.inductor-loss-data", "input.capacitor-network", "input.thermal-stackup"] },
    { id: "risk.loop-open", severity: "high", statement: "三状态调制只完成静态伏秒与纹波基线，尚未证明闭环稳定和跨区无跳变。", mitigation: "Agent15 建立内电流/外电压环，验证相位裕量≥50°、增益裕量≥10 dB 和输入/负载瞬态。", relatedRefs: ["input.loop-model", "derivation.transition-three-state"] }
  ],
  unresolvedItems,
  validations: [
    { id: "validation.schema", title: "JSON Schema、来源、依赖与量纲校验", method: "运行 calculation-book CLI validate 与专项回归。", acceptance: "Schema/semantic errors=0；依赖无环；公式量纲闭合；必填未决项阻断签核。", status: "passed", evidence: "node tools/calculation-book/cli.js validate --book content/calculation-books/four-switch-buck-boost-reva/calculation-book.json" },
    { id: "validation.mathcad", title: "Mathcad 15 结构与规则校验", method: "从同一 JSON 生成真实 math region，并解析 XML/Area/结果。", acceptance: "XML OK；Area lock/余量、二元节点、单位、中文、公式结果均通过。", status: "passed", evidence: "generated/validation-report.json.mathcad" },
    { id: "validation.larkix", title: "Larkix L1/L2/L3 包与路由校验", method: "生成 canonical draft/private 包并在临时 DATA_DIR 中导入预览。", acceptance: "3 个 slug 无冲突/悬空跳转，API 与 derive 页面均返回 200。", status: "passed", evidence: "generated/larkix-package.json 与 isolated-preview-report.json" },
    { id: "validation.consistency", title: "JSON/MathCAD/Larkix 哨兵一致性", method: "逐个比较 sentinel 的 SI 值与显示舍入。", acceptance: "至少 3 个哨兵；MathCAD 数值误差和 Larkix 显示舍入均在记录容差内。", status: "passed", evidence: "generated/validation-report.json.consistency" },
    { id: "validation.pwm-states", title: "G474 四路 PWM 与模式原子切换", method: "NUCLEO-G474 + 逻辑分析仪验证 Buck/Transition/Boost/去能量/FAULT。", acceptance: "状态表一致、同桥无重叠、更新只在周期边界、故障进入 inactive。", status: "planned", evidence: "" },
    { id: "validation.ocp-latency", title: "逐周期截断与硬 OCP 全链路延迟", method: "等效 shunt 脉冲注入 FAST_CSA/比较器/锁存/驱动/真实 gate 负载。", acceptance: "越阈至 VGS 低于 Miller 平台≤500 ns；阈值全公差满足；blanking 不掩盖真实短路。", status: "planned", evidence: "" },
    { id: "validation.bias", title: "独立浮动偏置与 100% 高边保持", method: "隔离偏置 + UCC21530-class + 等效门极/半桥样机。", acceptance: "VDD_HS-SW 全程高于 UVLO 最大值至少 1 V，上下电无误导通，EN/FAULT 不被 MCU 覆盖。", status: "planned", evidence: "" },
    { id: "validation.power", title: "全范围输入输出功率、纹波与效率闭合", method: "同步外部仪表测量 Buck/Transition/Boost 典型与角落点。", acceptance: "功率守恒在仪表不确定度内闭合；不得采用异步 ADC 算出的大于 100% 表观效率。", status: "planned", evidence: "" },
    { id: "validation.loop", title: "三模式内外环与跨区瞬态", method: "平均/离散模型、环路注入和输入/负载阶跃。", acceptance: "全角落相位裕量≥50°、增益裕量≥10 dB，跨区无持续振荡、失控反灌或过流。", status: "planned", evidence: "" },
    { id: "validation.thermal", title: "150 W 损耗、温升与降额", method: "器件损耗模型、热仿真、热像与热电偶交叉测量。", acceptance: "所有结温、磁件温升、电容纹波/寿命和 shunt 温升满足明确环境与降额。", status: "planned", evidence: "" },
    { id: "validation.pcb", title: "原理图与 PCB Gate", method: "ERC、关键回路布局评审、DRC 和制造文件独立复核。", acceptance: "投板前 ERC 0、关键功率/门极/采样回路评审通过；生产前 DRC 0 与制造包复核。", status: "planned", evidence: "" }
  ]
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
function sanitizeCalculationBook(value) {
  if (Array.isArray(value)) return value.map(sanitizeCalculationBook);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeCalculationBook(entry)]));
  }
  if (typeof value !== "string") return value;
  return value
    .replaceAll("src.agent18-", "src.project-")
    .replaceAll("risk.agent18-", "risk.project-")
    .replaceAll("Agent18-BUCK-BOOST开发专家", "功率级设计评审")
    .replaceAll("Agent18", "RevA 设计资料")
    .replaceAll("Agent15", "控制评审")
    .replaceAll("Agent7", "硬件评审")
    .replaceAll("A13_CalculationBookEngineering", "Larkix Engineering")
    .replaceAll("用户", "工程输入");
}

const publicBook = sanitizeCalculationBook(book);
fs.writeFileSync(OUTPUT, `${JSON.stringify(publicBook, null, 2)}\n`, "utf8");
console.log(OUTPUT);
