import { useEffect, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Upload } from "lucide-react";
import { Button, Modal, Select, useToast } from "@windveal/ui";
import { formatBytes } from "@windveal/shared";
import { ApiError, api } from "../../lib/api";
import { LinkPicker, type LinkTarget } from "./LinkPicker";
import { ACCEPT, ALLOWED_EXT, CATEGORIES, MAX_BYTES, TypeBadge, folderOptions, folderPath, useDocsRefresh, type FolderNode } from "./shared";

type Item = {
  key: string; file: File;
  state: "uploading" | "done" | "duplicate" | "existing" | "error";
  message?: string; fileId?: string; duplicateOf?: { id: string; name: string; folderId: string | null };
};

let seq = 0;

export function UploadModal({ open, onClose, folderId, folders }: { open: boolean; onClose: () => void; folderId: string | null; folders: FolderNode[] }) {
  const navigate = useNavigate();
  const refresh = useDocsRefresh();
  const toast = useToast();
  const [target, setTarget] = useState<string>(folderId ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [link, setLink] = useState<LinkTarget | null>(null);
  const [category, setCategory] = useState("");
  const [over, setOver] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setTarget(folderId ?? ""); setItems([]); setLink(null); setCategory(""); }
  }, [open, folderId]);

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function send(item: Item, allowDuplicate = false) {
    update(item.key, { state: "uploading", message: undefined });
    try {
      const r = await api.upload<{ file: { id: string } | null; duplicateOf: Item["duplicateOf"] | null }>("/api/files", item.file, {
        kind: "document", folderId: target || undefined, allowDuplicate: allowDuplicate ? "1" : undefined,
      });
      if (r.duplicateOf) update(item.key, { state: "duplicate", duplicateOf: r.duplicateOf });
      else update(item.key, { state: "done", fileId: r.file!.id });
    } catch (e) {
      update(item.key, { state: "error", message: e instanceof ApiError ? e.message : "Couldn't upload this file. Try again." });
    }
  }

  function add(list: FileList | File[] | null) {
    if (!list) return;
    const fresh: Item[] = Array.from(list).map((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const key = `u${++seq}`;
      if (file.size > MAX_BYTES) return { key, file, state: "error", message: `Too large: ${formatBytes(file.size)}. The limit is 50 MB.` };
      if (!ALLOWED_EXT.includes(ext)) return { key, file, state: "error", message: "This file type isn't allowed." };
      if (file.size === 0) return { key, file, state: "error", message: "That file is empty." };
      return { key, file, state: "uploading" };
    });
    setItems((s) => [...s, ...fresh]);
    for (const it of fresh) if (it.state === "uploading") void send(it);
    if (input.current) input.current.value = "";
  }

  async function pickExisting(item: Item) {
    if (!item.duplicateOf) return;
    if (!link) {
      onClose();
      navigate(`/documents/file/${item.duplicateOf.id}`);
      return;
    }
    update(item.key, { state: "existing", fileId: item.duplicateOf.id });
  }

  async function done() {
    const ready = items.filter((i) => (i.state === "done" || i.state === "existing") && i.fileId);
    if (!ready.length) { onClose(); return; }
    setFinishing(true);
    let failed = 0;
    for (const i of ready) {
      try {
        if (category && i.state === "done") await api.patch(`/api/documents/files/${i.fileId}`, { category });
        if (link) await api.post(`/api/documents/files/${i.fileId}/links`, { linkType: link.type, linkId: link.id });
      } catch { failed++; }
    }
    setFinishing(false);
    refresh();
    const uploaded = items.filter((i) => i.state === "done").length;
    toast(failed ? `Uploaded, but ${failed} file${failed === 1 ? "" : "s"} couldn't be linked or labelled.` : `${uploaded} file${uploaded === 1 ? "" : "s"} uploaded`, failed ? "error" : "default");
    onClose();
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); };
  const busy = items.some((i) => i.state === "uploading");
  const blocked = items.filter((i) => i.state === "error").length;
  const path = folderPath(folders, target || null);
  const dest = path.length ? path.map((p) => p.name).join(" / ") : "All files";
  const access = path.length ? path[path.length - 1]!.access.label : "Everyone";
  const folderName = (id: string | null) => (id ? folders.find((f) => f.id === id)?.name ?? "another folder" : "All files");

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Upload files" subtitle={`To ${dest} · visible to ${access === "Everyone" ? "everyone" : access}`}
      footer={<>
        <span className="muted dc-small" style={{ marginRight: "auto" }}>{blocked ? `${blocked} of ${items.length} can't be uploaded` : busy ? "Uploading…" : ""}</span>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={finishing} disabled={busy} onClick={done}>Done</Button>
      </>}>
      <Select label="Folder" value={target} onChange={(e) => setTarget(e.target.value)} disabled={items.length > 0} wrapClassName="dc-up-folder">
        <option value="">All files (top level)</option>
        {folderOptions(folders).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      <div className={`dc-drop ${over ? "over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
        onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}>
        <span className="dc-drop-ic"><Upload size={20} /></span>
        <b>Drop files or browse</b>
        <small>PDF, Word, Excel, images · up to 50 MB each</small>
        <input ref={input} type="file" multiple hidden accept={ACCEPT} onChange={(e) => add(e.target.files)} />
      </div>
      {!!items.length && (
        <div className="dc-queue">
          {items.map((i) => (
            <div key={i.key} className="dc-q">
              <TypeBadge name={i.file.name} size={32} />
              <div className="dc-q-main">
                <b>{i.file.name}</b>
                {i.state === "uploading" && <><small>{formatBytes(i.file.size)} · uploading</small><div className="dc-indeterminate"><i /></div></>}
                {i.state === "done" && <small>{formatBytes(i.file.size)} · uploaded</small>}
                {i.state === "existing" && <small>Using the existing file{link ? `, linked to ${link.label} when you click Done` : ""}</small>}
                {i.state === "duplicate" && <small className="dc-warn">Already in {folderName(i.duplicateOf?.folderId ?? null)}. Use the existing file instead of a copy?</small>}
                {i.state === "error" && <small className="dc-err">{i.message}</small>}
              </div>
              <div className="dc-q-act">
                {(i.state === "done" || i.state === "existing") && <Check size={18} className="dc-ok" aria-label="Uploaded" />}
                {i.state === "duplicate" && (
                  <>
                    <button className="link" onClick={() => pickExisting(i)}>Use existing</button>
                    <button className="link dc-muted-link" onClick={() => send(i, true)}>Upload anyway</button>
                  </>
                )}
                {i.state === "error" && <button className="link" onClick={() => setItems((s) => s.filter((x) => x.key !== i.key))}>Remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="form-grid dc-up-extra">
        <div className="field">
          <span className="field-label"><span>Link to</span><span className="opt">Optional</span></span>
          <LinkPicker endpoint="/api/documents/link-targets" value={link} onChange={setLink} placeholder="Search clients, deals, people" />
        </div>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">No category</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>
    </Modal>
  );
}
