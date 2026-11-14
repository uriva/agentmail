const blockedTags = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "meta",
  "base",
  "link",
  "svg",
  "math",
  "noscript",
  "template",
]);

const urlAttributes = new Set([
  "href",
  "src",
  "xlink:href",
  "action",
  "formaction",
  "poster",
  "background",
]);

type DomAttrLike = {
  readonly name: string;
  readonly value: string;
};

type DomElementLike = {
  readonly tagName: string;
  readonly attributes: ArrayLike<DomAttrLike>;
  remove: () => void;
  removeAttribute: (name: string) => void;
  setAttribute: (name: string, value: string) => void;
};

type DomBodyLike = {
  readonly innerHTML: string;
  querySelectorAll: (selector: string) => ArrayLike<DomElementLike>;
};

type DomParserLike = {
  new (): {
    parseFromString: (html: string, mimeType: string) => { body: DomBodyLike };
  };
};

const isSafeUrlValue = (raw: string): boolean => {
  let cleaned = "";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code > 0x20 && code !== 0x7f) cleaned += raw[i];
  }
  const lower = cleaned.toLowerCase();
  if (!lower) return true;
  if (lower.startsWith("#") || lower.startsWith("/")) return true;
  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:")
  );
};

const escapeHtmlFallback = (raw: string): string =>
  raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const sanitizeEmailHtml = (rawHtml: string): string => {
  if (!rawHtml) return "";
  const ParserCtor = (globalThis as unknown as { DOMParser?: DomParserLike })
    .DOMParser;
  if (!ParserCtor) {
    return `<pre>${escapeHtmlFallback(rawHtml)}</pre>`;
  }

  const parser = new ParserCtor();
  const doc = parser.parseFromString(rawHtml, "text/html");

  const elements = Array.from(doc.body.querySelectorAll("*"));
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (blockedTags.has(tag)) {
      el.remove();
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || name === "style") {
        el.removeAttribute(attr.name);
        continue;
      }
      if (urlAttributes.has(name) && !isSafeUrlValue(attr.value)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "srcset") {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === "a") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }

  return doc.body.innerHTML;
};

export const buildEmailIframeSrcDoc = (rawHtml: string): string => {
  const safeBody = sanitizeEmailHtml(rawHtml);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http:; style-src 'unsafe-inline'"><style>:root{color-scheme:dark;}body{margin:0;padding:4px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#e2e8f0;background:transparent;word-break:break-word;}a{color:#60a5fa;}blockquote{border-left:2px solid #475569;margin:8px 0;padding-left:12px;color:#94a3b8;}pre,code{background:#0f172a;padding:2px 4px;border-radius:4px;overflow-x:auto;}img{max-width:100%;height:auto;}</style></head><body>${safeBody}</body></html>`;
};
