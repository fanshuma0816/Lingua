// Bundle with esbuild --bundle --platform=node --format=esm, then run node --test on the output.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_PDF_BYTES } from "../config/constants.js";
import { validatePdfFile } from "../lib/pdf-import-client.js";

test("PDF validation checks signature instead of trusting the extension",async()=>{
  const fake=new File(["not a pdf"],"lesson.pdf",{type:"application/pdf"});
  await assert.rejects(()=>validatePdfFile(fake),/invalid_pdf/);
});

test("PDF validation rejects files over the product limit before parsing",async()=>{
  const oversized={name:"large.pdf",size:MAX_PDF_BYTES+1,slice(){throw new Error("must not read oversized files");}};
  await assert.rejects(()=>validatePdfFile(oversized),/pdf_too_large/);
});
