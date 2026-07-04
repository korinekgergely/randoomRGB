import type { WallColor } from './db'

function escapeXml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function rssPubDate(colorDate: string) {
  return new Date(`${colorDate}T04:00:00.000Z`).toUTCString()
}

function buildItem(siteUrl: string, color: WallColor) {
  const link = `${siteUrl}/`
  const likeCount = color.likes.length
  const title = `${color.hex} — ${color.colorDate}`
  const description = `${color.hex} on ${color.colorDate}. ${likeCount} like${likeCount === 1 ? '' : 's'}.`

  return `<item>
<title>${escapeXml(title)}</title>
<link>${escapeXml(link)}</link>
<guid isPermaLink="false">${escapeXml(`${siteUrl}/colors/${color.id}`)}</guid>
<pubDate>${rssPubDate(color.colorDate)}</pubDate>
<description>${escapeXml(description)}</description>
</item>`
}

export function buildRssFeed(siteUrl: string, colors: WallColor[]) {
  const base = siteUrl.replace(/\/$/, '')
  const feedUrl = `${base}/feed.xml`
  const latestDate = colors[0]?.colorDate
  const lastBuildDate = latestDate ? rssPubDate(latestDate) : new Date().toUTCString()
  const items = colors.map((color) => buildItem(base, color)).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>randoomRGB</title>
<link>${escapeXml(base)}/</link>
<description>Daily random colors from randoomRGB.</description>
<language>en</language>
<lastBuildDate>${lastBuildDate}</lastBuildDate>
<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom"/>
${items}
</channel>
</rss>`
}
