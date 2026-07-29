export type DocumentStatus = "processing" | "ready" | "failed";

export interface KbDocument {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  chunkCount: number;
  charCount: number;
  error: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchHit {
  documentId: string;
  filename: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}
