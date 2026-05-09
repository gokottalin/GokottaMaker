function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createSeo({ siteUrl, allPosts, allProjects, text }) {
  function absoluteUrl(pathname) {
    return `${siteUrl}${pathname}`;
  }

  function publicPages() {
    return [
      { loc: absoluteUrl("/"), priority: "1.0" },
      { loc: absoluteUrl("/category.html?category=analog"), priority: "0.8" },
      { loc: absoluteUrl("/category.html?category=stm32"), priority: "0.8" },
      { loc: absoluteUrl("/category.html?category=esp32"), priority: "0.8" },
      { loc: absoluteUrl("/projects.html"), priority: "0.8" },
      { loc: absoluteUrl("/miniapps.html"), priority: "0.7" },
      { loc: absoluteUrl("/tools/gokotta-elec.html"), priority: "0.6" },
      ...allPosts(false).map((post) => ({ loc: absoluteUrl(`/post.html?id=${encodeURIComponent(post.id)}`), priority: "0.7", lastmod: post.publishedAt || post.date })),
      ...allProjects(false).map((project) => ({ loc: absoluteUrl(`/project.html?id=${encodeURIComponent(project.id)}`), priority: "0.7", lastmod: project.publishedAt || project.date }))
    ];
  }

  function sitemap(res) {
    const urls = publicPages()
      .map(
        (page) => `  <url>
    <loc>${xmlEscape(page.loc)}</loc>
    ${page.lastmod ? `<lastmod>${xmlEscape(String(page.lastmod).slice(0, 10))}</lastmod>` : ""}
    <priority>${page.priority}</priority>
  </url>`
      )
      .join("\n");
    return text(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "application/xml; charset=utf-8");
  }

  function robots(res) {
    return text(
      res,
      200,
      `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${absoluteUrl("/sitemap.xml")}
`,
      "text/plain; charset=utf-8"
    );
  }

  function rss(res) {
    const items = allPosts(false)
      .slice(0, 20)
      .map(
        (post) => `<item>
  <title>${xmlEscape(post.title)}</title>
  <link>${xmlEscape(absoluteUrl(`/post.html?id=${encodeURIComponent(post.id)}`))}</link>
  <guid>${xmlEscape(absoluteUrl(`/post.html?id=${encodeURIComponent(post.id)}`))}</guid>
  <description>${xmlEscape(post.excerpt || "")}</description>
  <pubDate>${new Date(post.publishedAt || post.date || Date.now()).toUTCString()}</pubDate>
</item>`
      )
      .join("\n");
    return text(
      res,
      200,
      `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>GokottaMaker</title>
<link>${xmlEscape(siteUrl)}</link>
<description>Embedded electronics notes, STM32, ESP32, and open hardware projects.</description>
${items}
</channel>
</rss>
`,
      "application/rss+xml; charset=utf-8"
    );
  }

  return {
    absoluteUrl,
    publicPages,
    sitemap,
    robots,
    rss
  };
}

module.exports = {
  createSeo,
  xmlEscape
};
