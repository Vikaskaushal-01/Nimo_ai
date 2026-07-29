import mammoth from "mammoth";
import { AppError } from "../../shared/AppError.js";

const ext = (filename: string): string => {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
};

// Extensions we treat as UTF-8 text (read directly).
const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "xml", "html", "htm",
  "log", "rtf",
  // common code files
  "js", "ts", "tsx", "jsx", "py", "java", "go", "rs", "rb", "php", "c", "h", "cpp",
  "cs", "swift", "kt", "scala", "sh", "sql", "css", "scss",
]);

/**
 * Extracts plain text from an uploaded file buffer. Supports text/code formats
 * directly, PDF via pdf-parse, and DOCX via mammoth. Throws a 422 for
 * unsupported binary formats so the caller can mark the document failed.
 */
export const extractText = async (
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> => {
  const e = ext(filename);

  if (e === "pdf" || mimeType === "application/pdf") {
    // Lazy-import keeps pdf-parse's heavy deps out of the startup path.
    const { default: pdfParse } = await import("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text ?? "";
  }

  if (
    e === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value ?? "";
  }

  if (TEXT_EXTS.has(e) || mimeType.startsWith("text/") || mimeType === "application/json") {
    return buffer.toString("utf8");
  }

  // Heuristic: treat as text when the leading bytes contain no NUL (a binary marker).
  const sample = buffer.subarray(0, 1024);
  if (sample.length > 0 && !sample.includes(0)) return buffer.toString("utf8");

  throw AppError.unprocessable(
    `Unsupported file type: ${e || mimeType || "unknown"}. Supported: txt, md, csv, json, code, pdf, docx.`,
  );
};
