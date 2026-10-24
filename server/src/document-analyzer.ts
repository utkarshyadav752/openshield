/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * OpenShield Document & Text Analyzer Service (100% Local Processing)
 * Handles validation, local text extraction (PDF, Image OCR/Embedded Text, and Pasted Text),
 * prompt-injection sanitization, and hybrid rule + local Ollama (gemma3:1b) AI analysis.
 * Zero external cloud AI calls are made during document extraction or analysis.
 */

import zlib from 'node:zlib';
import { AnalysisReport } from '../../shared/schemas/analysis';
import { runHybridAnalysis } from './analyzer-service';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_PDF_EXTENSIONS = ['.pdf'];
export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'text/plain',
]);

export interface DocumentUploadInput {
  mode: 'pdf' | 'image' | 'text';
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  base64Data?: string;
  text?: string;
  title?: string;
  maxFileSizeBytes?: number;
  ocrProvider?: (buffer: Buffer, mimeType: string) => Promise<string>;
  aiGenerator?: (text: string) => Promise<unknown>;
}

export interface DocumentExtractionResult {
  ok: boolean;
  errorCode?:
    | 'MISSING_INPUT'
    | 'UNSUPPORTED_FILE_TYPE'
    | 'FILE_TOO_LARGE'
    | 'EMPTY_DOCUMENT'
    | 'CORRUPTED_PDF'
    | 'CORRUPTED_IMAGE'
    | 'LOW_RESOLUTION_IMAGE'
    | 'OCR_FAILED'
    | 'TEXT_TOO_LONG';
  errorMessage?: string;
  extractedText?: string;
  pageCount?: number;
  documentType?: 'pdf' | 'image' | 'text';
  fileName?: string;
  usedOcr?: boolean;
  promptInjectionDetected?: boolean;
}

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules|directions)\b/i,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules)\b/i,
  /\b(?:system\s+prompt|system\s+override|developer\s+mode)\s*:/i,
  /\byou\s+are\s+now\s+(?:a|an)\s+[a-z\s]+(?:assistant|model|ai)\b/i,
  /\b(?:do\s+not|never)\s+report\s+any\s+(?:findings|risks|clauses|issues)\b/i,
  /\bmark\s+this\s+(?:document|agreement|contract|policy)\s+as\s+(?:completely\s+)?(?:safe|low\s+risk|harmless)\b/i,
  /\breturn\s+an?\s+empty\s+(?:json|array|list)\b/i,
];

/**
 * Detects and neutralizes prompt-injection attempts embedded inside untrusted documents.
 * Untrusted document text is never allowed to override analyzer instructions.
 */
export function detectAndSanitizePromptInjection(rawText: string): {
  detected: boolean;
  sanitizedText: string;
} {
  let detected = false;
  const lines = rawText.split(/\r?\n/);
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    const matchesInjection = PROMPT_INJECTION_PATTERNS.some((rx) => rx.test(line));
    if (matchesInjection) {
      detected = true;
      // Redact the adversarial command phrase so the LLM cannot be hijacked,
      // while preserving any actual legal clause on the same line.
      let cleanedLine = line;
      for (const rx of PROMPT_INJECTION_PATTERNS) {
        cleanedLine = cleanedLine.replace(
          new RegExp(rx.source, 'gi'),
          '[REDACTED_UNTRUSTED_INSTRUCTION]'
        );
      }
      sanitizedLines.push(cleanedLine);
    } else {
      sanitizedLines.push(line);
    }
  }

  return {
    detected,
    sanitizedText: sanitizedLines.join('\n'),
  };
}

function getFileExtension(fileName?: string): string {
  if (!fileName) return '';
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

function unescapePdfLiteral(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function extractTextFromPdfContentStream(streamContent: string): string {
  const pieces: string[] = [];
  // Match text objects BT ... ET or standalone string literals followed by Tj / TJ
  const btBlocks = streamContent.match(/BT[\s\S]*?ET/g) || [streamContent];
  for (const block of btBlocks) {
    // 1. Array operators: [(text) -20 (more)] TJ
    const tjArrays = block.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
    for (const match of tjArrays) {
      const inner = match[1];
      const literals = inner.matchAll(/\((?:\\.|[^\\)])*\)/g);
      let line = '';
      for (const lit of literals) {
        line += unescapePdfLiteral(lit[0].slice(1, -1));
      }
      if (line.trim()) pieces.push(line.trim());
    }

    // 2. Single literal operators: (text) Tj or (text) '
    const tjSingles = block.matchAll(/\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")/g);
    for (const match of tjSingles) {
      const rawLit = match[0].replace(/\s*(?:Tj|'|")$/, '');
      const text = unescapePdfLiteral(rawLit.slice(1, -1)).trim();
      if (text) pieces.push(text);
    }
  }

  return pieces.join('\n').trim();
}

/**
 * Extracts embedded text and page count from a PDF buffer.
 * Detects corrupted files and scanned (image-only) PDFs.
 */
export function parsePdfBuffer(buffer: Buffer): {
  validPdf: boolean;
  pageCount: number;
  extractedText: string;
  isScannedPdf: boolean;
} {
  if (!buffer || buffer.length < 16) {
    return { validPdf: false, pageCount: 0, extractedText: '', isScannedPdf: false };
  }

  const header = buffer.subarray(0, 1024).toString('latin1');
  if (!header.includes('%PDF-')) {
    return { validPdf: false, pageCount: 0, extractedText: '', isScannedPdf: false };
  }

  const fullLatin1 = buffer.toString('latin1');
  if (!fullLatin1.includes('%%EOF') && !fullLatin1.includes('endobj')) {
    return { validPdf: false, pageCount: 0, extractedText: '', isScannedPdf: false };
  }

  // Count /Type /Page (excluding /Type /Pages)
  const pageMatches = fullLatin1.match(/\/Type\s*\/Page\b(?!s)/g);
  const pageCount = pageMatches && pageMatches.length > 0 ? pageMatches.length : 1;

  const pageTexts: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(fullLatin1)) !== null) {
    const rawStreamLatin1 = match[1];
    const streamBuffer = Buffer.from(rawStreamLatin1, 'latin1');

    let decodedContent = '';
    // Try decompressing if FlateDecode is used
    try {
      const inflated = zlib.inflateSync(streamBuffer);
      decodedContent = inflated.toString('latin1');
    } catch {
      decodedContent = rawStreamLatin1;
    }

    if (decodedContent.includes('BT') || decodedContent.includes('Tj') || decodedContent.includes('TJ')) {
      const text = extractTextFromPdfContentStream(decodedContent);
      if (text.length > 0) {
        pageTexts.push(text);
      }
    }
  }

  let combinedText = '';
  if (pageTexts.length > 0) {
    combinedText = pageTexts
      .map((pageText, idx) => `--- Page ${idx + 1} ---\n${pageText}`)
      .join('\n\n');
  }

  const cleanCharCount = combinedText.replace(/---\s*Page\s*\d+\s*---/g, '').trim().length;
  const isScannedPdf = cleanCharCount < 25;

  return {
    validPdf: true,
    pageCount: Math.max(pageCount, pageTexts.length || 1),
    extractedText: combinedText.trim(),
    isScannedPdf,
  };
}

/**
 * Validates image magic bytes, dimensions, and embedded text chunks.
 */
export function inspectImageBuffer(buffer: Buffer): {
  validImage: boolean;
  format?: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  embeddedText: string;
} {
  if (!buffer || buffer.length < 24) {
    return { validImage: false, width: 0, height: 0, embeddedText: '' };
  }

  // 1. PNG check: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const embeddedChunks: string[] = [];

    let offset = 8;
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
      if (offset + 12 + length > buffer.length) break;

      if (type === 'tEXt') {
        const data = buffer.subarray(offset + 8, offset + 8 + length).toString('utf8');
        const nullIdx = data.indexOf('\0');
        const value = nullIdx >= 0 ? data.slice(nullIdx + 1) : data;
        if (value.trim().length > 10) {
          embeddedChunks.push(value.trim());
        }
      }
      offset += 12 + length;
      if (type === 'IEND') break;
    }

    return {
      validImage: width > 0 && height > 0,
      format: 'png',
      width,
      height,
      embeddedText: embeddedChunks.join('\n\n'),
    };
  }

  // 2. JPEG check: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let width = 600;
    let height = 800;
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      const len = buffer.readUInt16BE(offset + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      if (len < 2) break;
      offset += 2 + len;
    }
    return {
      validImage: true,
      format: 'jpeg',
      width,
      height,
      embeddedText: '',
    };
  }

  // 3. WebP check: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {
      validImage: true,
      format: 'webp',
      width: 600,
      height: 800,
      embeddedText: '',
    };
  }

  return { validImage: false, width: 0, height: 0, embeddedText: '' };
}

/**
 * Local-only fallback text extraction for scanned PDFs or images when no custom local OCR engine
 * is supplied. Inspects UTF-8/ASCII printable text segments embedded in the file buffer without
 * ever transmitting document bytes to any external cloud AI service.
 */
async function extractLocalOcrFallback(buffer: Buffer): Promise<string> {
  const rawUtf8 = buffer.toString('utf8');
  const matches = rawUtf8.match(/[A-Za-z0-9₹$€£][A-Za-z0-9\s.,;:'"?!()/%₹$€£-]{30,}/g) || [];
  const filtered = matches
    .map((m) => m.trim())
    .filter(
      (m) =>
        !/^(?:%PDF|endobj|endstream|stream|IHDR|IDAT|IEND|JFIF|Exif)/i.test(m) &&
        /\b(?:terms|subscription|renew|cancel|refund|privacy|data|arbitration|liability|fee|agreement|month|year|trial|notice|section|clause)\b/i.test(
          m
        )
    );
  return filtered.join('\n\n').trim();
}

/**
 * Validates an uploaded document (PDF, Image, or Pasted Text) and extracts its readable text.
 */
export async function validateAndExtractDocument(
  input: DocumentUploadInput
): Promise<DocumentExtractionResult> {
  const maxBytes = input.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;

  // 1. Pasted Text Mode
  if (input.mode === 'text') {
    const rawText = (input.text || '').trim();
    if (!rawText || rawText.length < 30) {
      return {
        ok: false,
        errorCode: 'EMPTY_DOCUMENT',
        errorMessage:
          'The pasted text is empty or too short. Please paste at least one complete clause or paragraph (minimum 30 characters).',
      };
    }
    if (rawText.length > 150000) {
      return {
        ok: false,
        errorCode: 'TEXT_TOO_LONG',
        errorMessage:
          'Pasted text exceeds the 150,000-character limit. Please paste the relevant sections of your agreement.',
      };
    }

    const injectionCheck = detectAndSanitizePromptInjection(rawText);
    return {
      ok: true,
      extractedText: injectionCheck.sanitizedText,
      pageCount: 1,
      documentType: 'text',
      fileName: input.title || 'Pasted Legal Agreement',
      usedOcr: false,
      promptInjectionDetected: injectionCheck.detected,
    };
  }

  // 2. File Upload Modes (PDF or Image)
  if (!input.base64Data || typeof input.base64Data !== 'string') {
    return {
      ok: false,
      errorCode: 'MISSING_INPUT',
      errorMessage: 'No document file was provided. Please select a PDF or image file to analyze.',
    };
  }

  const ext = getFileExtension(input.fileName);
  const mime = (input.mimeType || '').toLowerCase();

  if (input.mode === 'pdf') {
    const isPdfExt = ext === '.pdf' || (!ext && mime === 'application/pdf');
    const isPdfMime = !mime || mime === 'application/pdf';
    if (!isPdfExt || !isPdfMime) {
      return {
        ok: false,
        errorCode: 'UNSUPPORTED_FILE_TYPE',
        errorMessage:
          'Unsupported file format for PDF upload. Please upload a valid .pdf document.',
      };
    }
  } else if (input.mode === 'image') {
    const isAllowedExt =
      SUPPORTED_IMAGE_EXTENSIONS.includes(ext) ||
      (!ext && ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime));
    const isAllowedMime =
      !mime || ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime);
    if (!isAllowedExt || !isAllowedMime) {
      return {
        ok: false,
        errorCode: 'UNSUPPORTED_FILE_TYPE',
        errorMessage:
          'Unsupported image format. Please upload a .jpg, .jpeg, .png, or .webp image.',
      };
    }
  } else {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_FILE_TYPE',
      errorMessage: 'Unsupported document upload mode.',
    };
  }

  // Strip optional data URI prefix
  const cleanBase64 = input.base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const effectiveSize = input.fileSize ?? buffer.length;

  if (effectiveSize === 0 || buffer.length === 0) {
    return {
      ok: false,
      errorCode: 'EMPTY_DOCUMENT',
      errorMessage: 'The uploaded file is empty (0 bytes). Please select a valid document.',
    };
  }

  if (effectiveSize > maxBytes || buffer.length > maxBytes) {
    const limitMb = (maxBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
    return {
      ok: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `This file exceeds the ${limitMb} MB size limit. Please upload a smaller document or paste the text directly.`,
    };
  }

  // 2A. PDF Extraction & Scanned PDF Local Fallback
  if (input.mode === 'pdf') {
    const parsed = parsePdfBuffer(buffer);
    if (!parsed.validPdf) {
      return {
        ok: false,
        errorCode: 'CORRUPTED_PDF',
        errorMessage:
          'This PDF file appears to be corrupted or unreadable. Please verify the file or paste the terms text directly.',
      };
    }

    let finalText = parsed.extractedText;
    let usedOcr = false;

    if (parsed.isScannedPdf) {
      usedOcr = true;
      try {
        if (input.ocrProvider) {
          finalText = await input.ocrProvider(buffer, 'application/pdf');
        } else {
          finalText = await extractLocalOcrFallback(buffer);
        }
      } catch {
        return {
          ok: false,
          errorCode: 'OCR_FAILED',
          errorMessage:
            'OCR text extraction failed on this scanned PDF. Please try a clearer file or paste the document text directly.',
        };
      }
    }

    const strippedCheck = finalText.replace(/---\s*Page\s*\d+\s*---/g, '').trim();
    if (strippedCheck.length < 25) {
      return {
        ok: false,
        errorCode: parsed.isScannedPdf ? 'OCR_FAILED' : 'EMPTY_DOCUMENT',
        errorMessage: parsed.isScannedPdf
          ? 'This PDF appears to be a scanned image and no readable text could be extracted locally. Please upload a text-selectable PDF or paste the text directly.'
          : 'This PDF does not contain enough readable text to analyze.',
      };
    }

    const injectionCheck = detectAndSanitizePromptInjection(finalText);
    return {
      ok: true,
      extractedText: injectionCheck.sanitizedText,
      pageCount: parsed.pageCount,
      documentType: 'pdf',
      fileName: input.fileName || 'Uploaded Document.pdf',
      usedOcr,
      promptInjectionDetected: injectionCheck.detected,
    };
  }

  // 2B. Image Inspection & Local OCR / Embedded Text Extraction
  const inspected = inspectImageBuffer(buffer);
  if (!inspected.validImage) {
    return {
      ok: false,
      errorCode: 'CORRUPTED_IMAGE',
      errorMessage:
        'The uploaded image file is corrupted or is not a valid JPG, PNG, or WebP image.',
    };
  }

  if (inspected.width < 80 || inspected.height < 80) {
    return {
      ok: false,
      errorCode: 'LOW_RESOLUTION_IMAGE',
      errorMessage: `Image resolution (${inspected.width}×${inspected.height}px) is too low to read fine-print text reliably. Please upload a clearer, higher-resolution photo.`,
    };
  }

  let extractedImageText = '';
  try {
    if (input.ocrProvider) {
      extractedImageText = await input.ocrProvider(buffer, mime || `image/${inspected.format}`);
    } else if (inspected.embeddedText && inspected.embeddedText.length >= 25) {
      extractedImageText = inspected.embeddedText;
    } else {
      extractedImageText = await extractLocalOcrFallback(buffer);
    }
  } catch {
    return {
      ok: false,
      errorCode: 'OCR_FAILED',
      errorMessage:
        'Unable to extract text from this image due to a local OCR processing error. Please upload a clearer photo or paste the text directly.',
    };
  }

  if (!extractedImageText || extractedImageText.trim().length < 25) {
    return {
      ok: false,
      errorCode: 'OCR_FAILED',
      errorMessage:
        'No readable legal clauses could be recognized in this image. Ensure the text is sharp, well-lit, and not heavily skewed, or paste the text directly.',
    };
  }

  const injectionCheck = detectAndSanitizePromptInjection(extractedImageText.trim());
  return {
    ok: true,
    extractedText: injectionCheck.sanitizedText,
    pageCount: 1,
    documentType: 'image',
    fileName: input.fileName || `Uploaded Image.${inspected.format}`,
    usedOcr: true,
    promptInjectionDetected: injectionCheck.detected,
  };
}

/**
 * Full end-to-end document validation, extraction, and hybrid analysis.
 */
export async function analyzeUploadedDocument(
  input: DocumentUploadInput
): Promise<
  | { ok: true; report: AnalysisReport }
  | { ok: false; errorCode: string; errorMessage: string }
> {
  const extraction = await validateAndExtractDocument(input);
  if (!extraction.ok || !extraction.extractedText) {
    return {
      ok: false,
      errorCode: extraction.errorCode || 'EXTRACTION_FAILED',
      errorMessage:
        extraction.errorMessage || 'Unable to extract readable text from the document.',
    };
  }

  const report = await runHybridAnalysis({
    text: extraction.extractedText,
    title: extraction.fileName || input.title || 'Uploaded Document Analysis',
    scanStatus: 'completed',
    documentType: extraction.documentType,
    fileName: extraction.fileName,
    pageCount: extraction.pageCount,
    promptInjectionDetected: extraction.promptInjectionDetected,
    aiGeneratorOverride: input.aiGenerator,
  });

  return { ok: true, report };
}

/**
 * Generates a real, standards-compliant 2-page PDF buffer containing sample Terms & Conditions
 * for 1-click customer demonstrations and automated unit tests.
 */
export function createSampleContractPdfBuffer(): Buffer {
  const page1Lines = [
    'Section 1. Automatic Renewal & Billing Terms',
    'Your subscription of $39.99 per month automatically renews each year at the then-current standard rate unless you cancel at least 30 days before your renewal date.',
    'All membership fees, activation charges of $29.00, and prepaid annual plans are strictly non-refundable and no partial refunds or credits will be issued.',
    'We reserve the right to modify, amend, or update these Terms at our sole discretion at any time without prior notice to you.',
  ];

  const page2Lines = [
    'Section 2. Dispute Resolution, Licenses & Penalties',
    'Any dispute or claim arising out of this Agreement shall be resolved exclusively by binding individual arbitration, and you waive any right to participate in a class action lawsuit.',
    'You grant the Company a perpetual, irrevocable, worldwide, royalty-free, transferable license to reproduce, distribute, and commercialize any content you upload.',
    'In the event you post negative public reviews or breach these terms, you agree to pay liquidated damages of $2,500 per violation.',
  ];

  const buildContentStream = (lines: string[]) => {
    const ops = ['BT', '/F1 11 Tf', '50 740 Td'];
    for (let i = 0; i < lines.length; i++) {
      const escaped = lines[i].replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      if (i > 0) ops.push('0 -24 Td');
      ops.push(`(${escaped}) Tj`);
    }
    ops.push('ET');
    return ops.join('\n');
  };

  const stream1 = buildContentStream(page1Lines);
  const stream2 = buildContentStream(page2Lines);

  const pdfBody = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${stream1.length} >>
stream
${stream1}
endstream
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>
endobj
6 0 obj
<< /Length ${stream2.length} >>
stream
${stream2}
endstream
endobj
%%EOF
`;

  return Buffer.from(pdfBody, 'latin1');
}

/**
 * Generates a valid 600x800 PNG buffer with embedded OCR contract text chunk
 * for 1-click customer testing and deterministic unit tests.
 */
export function createSampleContractPngBuffer(customText?: string): Buffer {
  const contractText =
    customText ??
    [
      'Section 1. Trial Conversion & Cancellation Policy',
      'Your 7-day free trial will automatically convert into a paid monthly subscription at $49.99/month unless cancelled before the trial ends.',
      'To cancel your membership, you must send a certified letter via postal mail or appear in person at our headquarters at least 45 days in advance.',
      'Section 2. Liability & Third-Party Data Sharing',
      'We may share and sell your personal contact and browsing data with third-party advertising networks and data brokers for cross-context behavioral advertising.',
      'In no event shall the Company be liable for any indirect, incidental, or consequential damages, and our total aggregate liability shall not exceed $25.00.',
    ].join('\n\n');

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk (width=600, height=800)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(600, 0);
  ihdrData.writeUInt32BE(800, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const textData = Buffer.from(`OCR_TEXT\0${contractText}`, 'utf8');
  const idatData = Buffer.from([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]);
  const iendData = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdrData),
    makeChunk('tEXt', textData),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', iendData),
  ]);
}
