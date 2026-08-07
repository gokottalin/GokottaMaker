(() => {
  const miniapps = [
  {
    id: "larkix-elec",
    name: "LarkixElec",
    title: "LarkixElec 在线预览",
    summary: "把 LLM 输出的 CNL 电路描述转换为 SVG 原理图、IR JSON 和 ERC 诊断。",
    category: "电路生成",
    status: "一期接入",
    version: "V1.3",
    href: "./tools/larkix-elec.html",
    icon: "./tools/assets/larkix-elec-icon.png?v=refined-20260524",
    capabilities: ["CNL 输入", "Sample 加载", "SVG 预览", "IR / ERC 诊断"]
  },
  {
    id: "md2file",
    name: "MD2File",
    title: "MD2File Markdown 转换器",
    summary: "把 Markdown 文档转换为可下载文件，当前支持 Word DOCX，并为 PDF 等格式预留扩展。",
    category: "文档转换",
    status: "新增设计",
    version: "V0.4",
    href: "./tools/md2doc.html",
    icon: "./assets/logo/md2file/md2file-miniapp-icon.svg?v=20260807-0001",
    capabilities: ["Markdown 输入", "实时预览", "DOCX 导出", "PDF 预留"]
  }
  ];
  const md2filePublicIdentity = Object.freeze({
    id: "md2file",
    name: "MD2File",
    version: "V0.4",
    href: "./tools/md2doc.html"
  });

  function publicList(source = miniapps) {
    const entries = Array.isArray(source) ? source : [];
    const md2file = entries.find((app) => app && app.id === md2filePublicIdentity.id);
    return md2file ? [{ ...md2file, ...md2filePublicIdentity }] : [];
  }

  window.LARKIX_MINIAPPS = miniapps;
  window.LARKIX_PUBLIC_MINIAPPS = publicList();
  window.LarkixMiniapps = Object.freeze({
    canonicalHref: md2filePublicIdentity.href,
    publicList
  });
})();
