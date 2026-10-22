import { exportOutline, proposalMarkdown, proposalText, type ExportInput } from "@/lib/projects";

export type ExportFormat = "docx" | "md" | "txt";

/** Browser download that survives iframes: the link is attached and the URL kept alive briefly. */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

async function toDocx(p: ExportInput) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const children: InstanceType<typeof Paragraph>[] = [];
  for (const b of exportOutline(p)) {
    if (b.heading) children.push(new Paragraph({ text: b.heading, heading: b.level === 1 ? HeadingLevel.TITLE : HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }));
    b.lines.forEach((line, i) => {
      for (const para of (b.list || b.numbered ? [line] : line.split(/\n{2,}/))) {
        const text = b.numbered ? `[${i + 1}] ${para}` : para;
        children.push(new Paragraph({ children: [new TextRun(text)], ...(b.list ? { bullet: { level: 0 } } : {}), spacing: { after: 100 } }));
      }
    });
  }
  return Packer.toBlob(new Document({ creator: "Lattice Scout", title: p.title, sections: [{ children }] }));
}

export async function exportProposal(p: ExportInput, format: ExportFormat) {
  const base = p.title.slice(0, 60).replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "proposal";
  if (format === "md") return download(new Blob([proposalMarkdown(p)], { type: "text/markdown;charset=utf-8" }), `${base}.md`);
  if (format === "txt") return download(new Blob([proposalText(p)], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
  return download(await toDocx(p), `${base}.docx`);
}
