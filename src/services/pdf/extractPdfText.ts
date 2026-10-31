import * as pdfjsLib from 'pdfjs-dist';
import { parseTokensToRow, parseRawLine, extractReportDate, isHeaderOrFooterLine } from './parsePolicyRows';
import type { RawExtractedRow } from '@/types';

// Configure worker to use local public worker script for offline guarantee
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export interface ExtractedPdfData {
  reportDate: string | null;
  totalPages: number;
  extractedRows: RawExtractedRow[];
  unparsedLines: { line: string; pageNumber: number }[];
  warnings: string[];
}

interface TextItemWithCoords {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function extractPoliciesFromPdf(
  fileOrBuffer: File | ArrayBuffer,
  onProgress?: (progress: { page: number; total: number; percentage: number }) => void
): Promise<ExtractedPdfData> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const extractedRows: RawExtractedRow[] = [];
  const unparsedLines: { line: string; pageNumber: number }[] = [];
  const warnings: string[] = [];
  let detectedReportDate: string | null = null;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const items: TextItemWithCoords[] = textContent.items
        .filter((item): item is any => 'str' in item && item.str.trim().length > 0)
        .map((item: any) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0,
          height: item.height || 0,
        }));

      // Check header for report date (usually on page 1)
      if (pageNum === 1 && !detectedReportDate) {
        const fullPageText = items.map((i) => i.str).join(' ');
        detectedReportDate = extractReportDate(fullPageText);
      }

      // Group text items into lines based on Y-coordinate clustering (vertical tolerance 4px)
      // Note: in PDF coordinate space, Y increases from bottom to top
      const Y_TOLERANCE = 4.0;
      const lines: { y: number; items: TextItemWithCoords[] }[] = [];

      // Sort items top-to-bottom first (descending Y)
      items.sort((a, b) => b.y - a.y);

      for (const item of items) {
        const existingLine = lines.find((l) => Math.abs(l.y - item.y) <= Y_TOLERANCE);
        if (existingLine) {
          existingLine.items.push(item);
        } else {
          lines.push({ y: item.y, items: [item] });
        }
      }

      // Now process each line: sort items left-to-right (ascending X)
      for (const line of lines) {
        line.items.sort((a, b) => a.x - b.x);
        
        // Build tokens
        const tokens = line.items.map((i) => i.str.trim()).filter(Boolean);
        const fullLineText = tokens.join(' ');

        if (isHeaderOrFooterLine(fullLineText)) {
          continue;
        }

        // Try coordinate/token parser
        const parsed = parseTokensToRow(tokens, pageNum, fullLineText);
        if (parsed) {
          extractedRows.push(parsed);
        } else {
          // Try fallback by splitting raw string in case tokens were grouped into single item
          const fallback = parseRawLine(fullLineText, pageNum);
          if (fallback) {
            extractedRows.push(fallback);
          } else {
            // Check if this line looks like policy row but failed
            if (/\d{6,12}/.test(fullLineText)) {
              unparsedLines.push({ line: fullLineText, pageNumber: pageNum });
            }
          }
        }
      }
    } catch (err) {
      warnings.push(`Error reading page ${pageNum}: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (onProgress) {
      onProgress({
        page: pageNum,
        total: totalPages,
        percentage: Math.round((pageNum / totalPages) * 100),
      });
    }
  }

  if (unparsedLines.length > 0) {
    warnings.push(`${unparsedLines.length} lines with potential policy numbers could not be cleanly parsed automatically.`);
  }

  return {
    reportDate: detectedReportDate,
    totalPages,
    extractedRows,
    unparsedLines,
    warnings,
  };
}
