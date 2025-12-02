import { useMemo } from "react";
import { API_BASE } from "../api";

interface Props {
  title: string;
  html?: string;
}

const DEFAULT_EMPTY = "<p><em>Nothing loaded.</em></p>";

function rewriteMediaSources(html: string, assetOrigin: string): string {
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html || DEFAULT_EMPTY;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const toAbsolute = (value: string | null) => {
    if (!value) return value;
    const normalized = value.trim();
    if (!normalized || /^https?:/i.test(normalized) || normalized.startsWith("data:")) {
      return normalized;
    }
    const trimmed = normalized.replace(/^\.?\//, "");
    return `${assetOrigin}/${trimmed}`;
  };
  doc.querySelectorAll("img, video, audio, source").forEach((node) => {
    const attr = node.getAttribute("src");
    const updated = toAbsolute(attr);
    if (updated && updated !== attr) {
      node.setAttribute("src", updated);
    }
  });
  doc.querySelectorAll("a").forEach((node) => {
    const attr = node.getAttribute("href");
    const updated = toAbsolute(attr);
    if (updated && updated !== attr) {
      node.setAttribute("href", updated);
    }
  });
  return doc.body.innerHTML || html;
}

export function HtmlPane({ title, html }: Props) {
  const assetOrigin = useMemo(() => {
    try {
      return new URL(API_BASE).origin;
    } catch {
      return window.location.origin;
    }
  }, []);
  const normalizedHtml = useMemo(
    () => rewriteMediaSources(html || DEFAULT_EMPTY, assetOrigin),
    [html, assetOrigin]
  );
  return (
    <div className="html-pane">
      <h3>{title}</h3>
      <div className="html-pane__body" dangerouslySetInnerHTML={{ __html: normalizedHtml }} />
    </div>
  );
}
