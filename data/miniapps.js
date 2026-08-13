(() => {
  const publicMiniapps = [{
    id: "md2file",
    name: "MD2File",
    title: "MD2File Markdown 转换器",
    summary: "把 Markdown 文档转换为可下载文件，当前支持 Word DOCX，并为 PDF 等格式预留扩展。",
    category: "文档转换",
    version: "V0.4",
    href: "./tools/md2doc.html",
    icon: "./assets/logo/md2file/md2file-miniapp-icon.svg?v=20260814-0001"
  }];
  const md2filePublicIdentity = Object.freeze({
    id: "md2file",
    name: "MD2File",
    version: "V0.4",
    href: "./tools/md2doc.html"
  });

  function publicList(source = publicMiniapps) {
    const entries = Array.isArray(source) ? source : [];
    const md2file = entries.find((app) => app && app.id === md2filePublicIdentity.id);
    return md2file ? [{ ...md2file, ...md2filePublicIdentity }] : [];
  }

  window.LARKIX_MINIAPPS = publicMiniapps;
  window.LARKIX_PUBLIC_MINIAPPS = publicList(publicMiniapps);
  window.LarkixMiniapps = Object.freeze({
    canonicalHref: md2filePublicIdentity.href,
    publicList
  });
})();
