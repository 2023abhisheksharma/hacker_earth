"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, FileType2, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiUpload } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";

interface Doc {
  id: string;
  filename: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
}

const TYPE_ICON = { image: ImageIcon, pdf: FileText, text: FileType2 };

export function DocumentUpload({ claimId }: { claimId: string }) {
  const { bumpRefresh } = useAppStore();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // no-op: parent remounts this component via key={claimId} so docs reset naturally
  }, [claimId]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await apiUpload(`/api/claims/${claimId}/documents`, fd);
        if (res.ok && res.data?.document) {
          setDocs((d) => [...d, res.data.document]);
        } else {
          toast({ title: "Upload failed", description: res.error, variant: "destructive" });
        }
      } catch (e) {
        toast({ title: "Upload failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
      }
    }
    setLoading(false);
    bumpRefresh();
    toast({ title: `${files.length} file(s) attached`, description: "Documents ready for submission." });
  }

  async function removeDoc(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    await fetch(`/api/claims/${id}/documents?docId=${id}`, { method: "DELETE", credentials: "include" });
    bumpRefresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Supporting documents</p>
        <span className="text-[10px] text-muted-foreground">image · pdf · text</span>
      </div>
      <div
        className="rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition p-4 text-center cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
        ) : (
          <>
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Drop files or click to upload</p>
          </>
        )}
      </div>
      {docs.length > 0 && (
        <div className="space-y-1.5">
          {docs.map((d) => {
            const Icon = TYPE_ICON[d.fileType as keyof typeof TYPE_ICON] ?? FileText;
            return (
              <Card key={d.id} className="p-2 flex items-center gap-2">
                <div className="h-7 w-7 rounded bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{d.filename}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{d.fileType} · {(d.fileSize / 1024).toFixed(0)} KB</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDoc(d.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-[11px] gap-1"
        onClick={() => inputRef.current?.click()}
      >
        <Trash2 className="h-3 w-3" /> Files are attached to this claim only — never to your bank account.
      </Button>
    </div>
  );
}
