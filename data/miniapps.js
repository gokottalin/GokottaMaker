window.LARKIX_MINIAPPS = [
  {
    id: "larkix-elec",
    name: "LarkixElec",
    title: "LarkixElec 在线预览",
    summary: "把 LLM 输出的 CNL 电路描述转换为 SVG 原理图、IR JSON 和 ERC 诊断。",
    category: "电路生成",
    status: "一期接入",
    version: "V1.3",
    href: "./tools/larkix-elec.html",
    icon: "./tools/assets/larkix-elec-icon.svg?v=20260519-003",
    capabilities: ["CNL 输入", "Sample 加载", "SVG 预览", "IR / ERC 诊断"]
  },
  {
    id: "md2file",
    name: "MD2File",
    title: "MD2File Markdown 转换器",
    summary: "把 Markdown 文档转换为可下载文件，当前支持 Word DOCX，并为 PDF 等格式预留扩展。",
    category: "文档转换",
    status: "新增设计",
    version: "V0.3",
    href: "./tools/md2doc.html",
    icon: "./assets/logo/md2file/md2file-miniapp-icon.svg?v=20260519-003",
    capabilities: ["Markdown 输入", "实时预览", "DOCX 导出", "PDF 预留"]
  }
];
