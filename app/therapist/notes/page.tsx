"use client";

import { useEffect, useState } from "react";
import { 
  FileText, Plus, Search, Lock, Globe, Pencil, 
  Trash2, ChevronRight, Layout, CheckCircle2, Loader2,
  Clock, User, AlertCircle
} from "lucide-react";
import { useUser } from "@/app/components/UserProvider";
import { 
  getTherapistByUserIdAction, 
  listClinicalNotesAction, 
  listProfilesAction,
  createClinicalNoteAction,
  updateClinicalNoteAction,
  deleteClinicalNoteAction
} from "@/app/actions/database";
import type { ClinicalNote, Profile } from "@/lib/appwrite/database";
import { appwriteConfig } from "@/lib/appwrite/config";

interface SoapContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export default function ClinicalNotesPage() {
  const user = useUser();
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);
  
  // Form State
  const [selectedClientId, setSelectedClientId] = useState("");
  const [noteType, setNoteType] = useState<"soap" | "freeform">("soap");
  const [isPrivate, setIsPrivate] = useState(true);
  const [freeformContent, setFreeformContent] = useState("");
  const [soapContent, setSoapContent] = useState<SoapContent>({
    subjective: "", objective: "", assessment: "", plan: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const therapist = await getTherapistByUserIdAction(user.$id);
        if (therapist) {
          setTherapistId(therapist.$id);
          const [notesRes, clientsRes] = await Promise.all([
            listClinicalNotesAction(therapist.$id),
            listProfilesAction()
          ]);
          setNotes(notesRes);
          setClients(clientsRes as unknown as Profile[]);
        }
      } catch (error) {
        console.error("Failed to load notes data:", error);
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleSave() {
    if (!therapistId || !selectedClientId || saving) return;
    setSaving(true);

    const content = noteType === "soap" ? JSON.stringify(soapContent) : freeformContent;
    const now = new Date().toISOString();

    try {
      if (editingNote) {
        const updated = await updateClinicalNoteAction(editingNote.$id, {
          content,
          isPrivate,
          updatedAt: now,
        });
        setNotes(prev => prev.map(n => n.$id === updated.$id ? updated : n));
      } else {
        const created = await createClinicalNoteAction({
          patientId: selectedClientId,
          therapistId,
          type: noteType,
          content,
          isPrivate,
          createdAt: now,
          updatedAt: now,
        });
        setNotes(prev => [created, ...prev]);
      }
      closeEditor();
    } catch (error) {
      console.error("Save note error:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this clinical note?")) return;
    try {
      await deleteClinicalNoteAction(id);
      setNotes(prev => prev.filter(n => n.$id !== id));
    } catch (error) {
      console.error("Delete note error:", error);
    }
  }

  function openNew() {
    setEditingNote(null);
    setSelectedClientId("");
    setNoteType("soap");
    setIsPrivate(true);
    setFreeformContent("");
    setSoapContent({ subjective: "", objective: "", assessment: "", plan: "" });
    setEditorOpen(true);
  }

  function openEdit(n: ClinicalNote) {
    setEditingNote(n);
    setSelectedClientId(n.patientId);
    setNoteType(n.type);
    setIsPrivate(n.isPrivate);
    if (n.type === "soap") {
      try { setSoapContent(JSON.parse(n.content)); } catch { /* fallback */ }
    } else {
      setFreeformContent(n.content);
    }
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingNote(null);
  }

  const filteredNotes = notes.filter(n => {
    const client = clients.find(c => c.userId === n.patientId);
    const clientName = client?.name.toLowerCase() ?? "";
    return clientName.includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Clinical Notes</h1>
          <p className="text-sm text-stone-500 mt-1">Document and manage clinical progress records.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:opacity-90 shadow-lg shadow-brand/20 transition-all active:scale-95">
          <Plus size={18} /> New Note
        </button>
      </div>

      {/* Filters */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Search by client name or note content…"
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 bg-white transition-all" 
        />
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <h2 className="text-lg font-bold text-stone-900">{editingNote ? "Edit Note" : "New Clinical Note"}</h2>
                <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mt-0.5">{noteType} format</p>
              </div>
              <button onClick={closeEditor} className="p-2 hover:bg-stone-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Select Client</label>
                  <select 
                    value={selectedClientId} 
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    disabled={!!editingNote}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-brand focus:ring-2 focus:ring-brand/15 outline-none transition-all"
                  >
                    <option value="">Choose a client...</option>
                    {clients.map(c => <option key={c.userId} value={c.userId}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Note Type</label>
                  <div className="flex p-1 bg-stone-100 rounded-xl">
                    <button 
                      onClick={() => setNoteType("soap")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${noteType === "soap" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                    >SOAP</button>
                    <button 
                      onClick={() => setNoteType("freeform")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${noteType === "freeform" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                    >Freeform</button>
                  </div>
                </div>
              </div>

              {/* Editor Content */}
              {noteType === "soap" ? (
                <div className="space-y-4">
                  {(['subjective', 'objective', 'assessment', 'plan'] as const).map((key) => (
                    <div key={key}>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">{key}</label>
                      <textarea 
                        value={soapContent[key]} 
                        onChange={(e) => setSoapContent(prev => ({ ...prev, [key]: e.target.value }))}
                        rows={3}
                        placeholder={`Enter ${key} details...`}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-brand focus:ring-2 focus:ring-brand/15 outline-none transition-all resize-none"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Content</label>
                  <textarea 
                    value={freeformContent} 
                    onChange={(e) => setFreeformContent(e.target.value)}
                    rows={12}
                    placeholder="Start writing clinical notes here..."
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-brand focus:ring-2 focus:ring-brand/15 outline-none transition-all resize-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-4">
                <input 
                  type="checkbox" 
                  id="private-toggle"
                  checked={isPrivate} 
                  onChange={(e) => setIsPrivate(e.target.checked)} 
                  className="w-4 h-4 accent-brand rounded border-stone-300"
                />
                <label htmlFor="private-toggle" className="text-sm text-stone-600 font-medium flex items-center gap-2 cursor-pointer">
                  <Lock size={14} className="text-stone-400" />
                  Keep this note private (hidden from client)
                </label>
              </div>
            </div>

            <div className="px-8 py-6 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
              <button 
                onClick={closeEditor} 
                className="px-6 py-2.5 rounded-xl border border-stone-200 text-sm font-bold text-stone-600 hover:bg-stone-100 transition-colors"
              >Cancel</button>
              <button 
                onClick={handleSave} 
                disabled={saving || !selectedClientId}
                className="px-8 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:opacity-90 shadow-lg shadow-brand/20 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingNote ? "Update Record" : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredNotes.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 border-dashed">
            <FileText size={48} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-500 font-medium">No clinical records found matching your search.</p>
            <button onClick={openNew} className="text-brand font-bold text-sm mt-2 hover:underline">Create your first record</button>
          </div>
        ) : (
          filteredNotes.map((n) => {
            const client = clients.find(c => c.userId === n.patientId);
            return (
              <div key={n.$id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 hover:border-brand/30 transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center shrink-0">
                      {n.type === "soap" ? <Layout size={20} className="text-brand" /> : <FileText size={20} className="text-stone-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-stone-900">{client?.name || "Unknown Client"}</p>
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-2 py-0.5 bg-stone-50 rounded-full">{n.type}</span>
                        {n.isPrivate && <Lock size={12} className="text-stone-300" />}
                      </div>
                      <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">
                        {n.type === "soap" ? (
                          (() => {
                            try {
                              const s = JSON.parse(n.content) as SoapContent;
                              return `S: ${s.subjective} ...`;
                            } catch { return n.content; }
                          })()
                        ) : n.content}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-stone-300" />
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-stone-300" />
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            ID: {n.patientId.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => openEdit(n)} className="p-2 rounded-lg hover:bg-stone-50 text-stone-400 transition-colors"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(n.$id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
