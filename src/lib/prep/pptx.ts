// Phase 11.E3 — .pptx text extraction with no new dependencies.
//
// A .pptx is a zip; slide text lives in ppt/slides/slideN.xml as
// <a:t>…</a:t> runs (speaker notes in ppt/notesSlides/notesSlideN.xml).
// We parse the zip's central directory by hand and inflate entries with
// node:zlib — enough for well-formed Office files, and a failed parse
// just degrades to "context not personalized" upstream (PRD §7.4:
// parsing is best-effort and never blocks the flow).

import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50; // End of Central Directory
const CEN_SIG = 0x02014b50; // Central directory file header
const LOC_SIG = 0x04034b50; // Local file header

type ZipEntry = {
  name: string;
  method: number; // 0 = stored, 8 = deflate
  compressedSize: number;
  localOffset: number;
};

function readCentralDirectory(buf: Buffer): ZipEntry[] {
  // EOCD is at the end, possibly preceded by a zip comment (≤64KB).
  const scanFrom = Math.max(0, buf.length - 22 - 65_536);
  let eocd = -1;
  for (let i = buf.length - 22; i >= scanFrom; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("EOCD not found");
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16); // central directory offset

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== CEN_SIG) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf-8", ptr + 46, ptr + 46 + nameLen);
    entries.push({ name, method, compressedSize, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntryData(buf: Buffer, entry: ZipEntry): Buffer {
  const p = entry.localOffset;
  if (buf.readUInt32LE(p) !== LOC_SIG) throw new Error("bad local header");
  // The LOCAL header's name/extra lengths can differ from the central
  // directory's — read them from the local record.
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`unsupported compression method ${entry.method}`);
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Pull the visible text runs out of one slide's XML, paragraph-aware:
 *  runs within one <a:p> join with spaces; paragraphs become lines. */
function slideXmlToText(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs = [...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map(
      (m) => decodeXmlEntities(m[1] ?? ""),
    );
    const line = runs.join(" ").replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

function slideNumber(name: string): number {
  const m = /(\d+)\.xml$/.exec(name);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/** Extract slide text (+ speaker notes) from a .pptx buffer. Throws on
 *  malformed zips — the caller maps that to a "failed" parse. */
export function extractPptxText(buffer: Buffer): string {
  const entries = readCentralDirectory(buffer);
  const slides = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
    .sort((a, b) => slideNumber(a.name) - slideNumber(b.name));
  const notes = entries
    .filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.name))
    .sort((a, b) => slideNumber(a.name) - slideNumber(b.name));

  const parts: string[] = [];
  slides.forEach((entry, i) => {
    const text = slideXmlToText(readEntryData(buffer, entry).toString("utf-8"));
    if (text) parts.push(`Slide ${i + 1}:\n${text}`);
  });
  // Speaker notes often carry the talk track — high prep value. The
  // notes XML also contains the slide-number placeholder; slideXmlToText
  // keeps it as a lone digit line, harmless in a coaching context.
  notes.forEach((entry) => {
    const text = slideXmlToText(readEntryData(buffer, entry).toString("utf-8"));
    if (text) parts.push(`Speaker notes (${slideNumber(entry.name)}):\n${text}`);
  });
  return parts.join("\n\n");
}
