import fs from "fs";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getDejaVuFontPath } from "@/lib/pdfFont";

export async function createPdfDoc() {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = fs.readFileSync(getDejaVuFontPath());
  const font = await pdf.embedFont(fontBytes, { subset: true });
  return { pdf, font };
}

export function toPdfResponse(bytes, filename) {
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
