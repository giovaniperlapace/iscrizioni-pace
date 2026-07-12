import sanitizeHtml from "sanitize-html";

import {
  campaignTextToHtml,
  renderCampaignHtmlTemplate,
  type CampaignTemplateData,
} from "./campaign-templates.ts";

export function renderSafeCampaignHtml(
  template: string,
  data: CampaignTemplateData
): string {
  const source = /<\/?[a-z][\s\S]*>/i.test(template)
    ? renderCampaignHtmlTemplate(template, data)
    : campaignTextToHtml(renderCampaignHtmlTemplate(template, data));

  return sanitizeHtml(source, {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "code",
      "em",
      "h2",
      "h3",
      "hr",
      "li",
      "ol",
      "p",
      "pre",
      "strong",
      "u",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });
}

export function campaignHtmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|li|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
