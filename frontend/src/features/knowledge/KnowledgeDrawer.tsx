import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat.store";
import { useUiStore } from "@/stores/ui.store";
import type { KbDocument } from "@/types/knowledge";

/** Mirrors the backend multer limit. */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const fmtSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Slide-over knowledge base: drag-and-drop upload, document list, selection. */
export const KnowledgeDrawer = () => {
  const { knowledgeOpen, setKnowledgeOpen } = useUiStore();
  const {
    selectedDocumentIds,
    toggleDocument,
    removeDocument,
    useKnowledgeBase,
    setUseKnowledgeBase,
  } = useChatStore();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: api.listDocuments,
    enabled: knowledgeOpen,
    refetchInterval: (q) =>
      (q.state.data ?? []).some((d) => d.status === "processing") ? 1500 : false,
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDocument(file, setUploadPct),
    onMutate: () => {
      setError(null);
      setUploadPct(0);
    },
    onSuccess: (doc) => {
      setUploadPct(null);
      // The upload itself succeeds even when text extraction fails.
      if (doc.status === "failed") setError(`${doc.filename}: ${doc.error || "processing failed"}`);
      else setUseKnowledgeBase(true);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setUploadPct(null);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: (_d, id) => {
      removeDocument(id);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`${file.name} is larger than 15 MB.`);
      return;
    }
    upload.mutate(file);
    // Reset so selecting the same file again still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFiles(e.dataTransfer.files);
  };

  return (
    <AnimatePresence>
      {knowledgeOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setKnowledgeOpen(false)}
          />
          <motion.aside
            className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
          >
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Knowledge Base</h2>
                <p className="text-[11px] text-slate-500">Upload docs to ground AI answers (RAG)</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setKnowledgeOpen(false)}>
                <X size={16} />
              </Button>
            </header>

            {/* Global RAG toggle */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <span className="text-xs text-slate-300">Use knowledge base in chats</span>
              <button
                onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  useKnowledgeBase ? "bg-accent" : "bg-white/15",
                )}
                aria-pressed={useKnowledgeBase}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                    useKnowledgeBase ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            {/* Upload dropzone */}
            <div className="px-5 py-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                  dragging ? "border-accent bg-accent/10" : "border-white/15 hover:border-white/30",
                )}
              >
                {uploadPct !== null ? (
                  <>
                    <Loader2 size={22} className="animate-spin text-accent-soft" />
                    <span className="text-xs text-slate-400">Uploading & indexing… {uploadPct}%</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={22} className="text-slate-400" />
                    <span className="text-xs text-slate-300">
                      Drop a file or <span className="text-accent-soft">browse</span>
                    </span>
                    <span className="text-[10px] text-slate-600">
                      txt, md, csv, json, code, pdf, docx · max 15 MB
                    </span>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  onChange={(e) => onFiles(e.target.files)}
                  accept=".txt,.md,.markdown,.csv,.json,.pdf,.docx,.js,.ts,.tsx,.py,.java,.go,.rs,.sql,.yaml,.yml,.html,.css"
                />
              </div>
              {error && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-300">
                  <AlertTriangle size={12} /> {error}
                </p>
              )}
            </div>

            {/* Document list */}
            <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-5">
              {isLoading && <p className="text-xs text-slate-500">Loading…</p>}
              {!isLoading && documents.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-500">No documents yet</p>
              )}
              {documents.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  selected={selectedDocumentIds.includes(doc.id)}
                  onToggle={() => toggleDocument(doc.id)}
                  onDelete={() => del.mutate(doc.id)}
                />
              ))}
            </div>

            {selectedDocumentIds.length > 0 && (
              <footer className="border-t border-white/10 px-5 py-2.5 text-[11px] text-slate-400">
                {selectedDocumentIds.length} document(s) selected — queries will search only these.
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

const DocRow = ({
  doc,
  selected,
  onToggle,
  onDelete,
}: {
  doc: KbDocument;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) => (
  <div
    className={cn(
      "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
      selected ? "border-accent/50 bg-accent/10" : "border-white/10 hover:bg-white/[0.03]",
    )}
  >
    <button
      onClick={onToggle}
      disabled={doc.status !== "ready"}
      className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:opacity-60"
    >
      <FileText size={16} className="shrink-0 text-slate-400" />
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-200">{doc.filename}</div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <StatusBadge doc={doc} />
          <span>· {fmtSize(doc.sizeBytes)}</span>
          {doc.status === "ready" && <span>· {doc.chunkCount} chunks</span>}
        </div>
      </div>
    </button>
    <button
      onClick={onDelete}
      className="shrink-0 text-slate-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
      aria-label="Delete document"
    >
      <Trash2 size={14} />
    </button>
  </div>
);

const StatusBadge = ({ doc }: { doc: KbDocument }) => {
  if (doc.status === "processing")
    return (
      <span className="flex items-center gap-1 text-amber-400">
        <Loader2 size={10} className="animate-spin" /> indexing
      </span>
    );
  if (doc.status === "failed")
    return (
      <span className="flex items-center gap-1 text-red-400" title={doc.error}>
        <AlertTriangle size={10} /> failed
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-emerald-400">
      <CheckCircle2 size={10} /> ready
    </span>
  );
};
