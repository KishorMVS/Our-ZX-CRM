import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    FileCheck2, Send, RefreshCw, CheckCircle,
    Mail, FileText, X, Search, IndianRupee, Plus, Building2, Trash2,
    Minus, Upload, FileUp, ChevronDown, LayoutTemplate, Download, Pencil,
    PenLine, Copy, ShieldCheck, Users, Link2,
} from "lucide-react";
import api from "../api/axios";
import CompanySettingsModal from "../components/CompanySettingsModal";

const fmt = (n) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const EMPTY_SERVICE = { description: "", amount: "" };

// ─── Atoms ───────────────────────────────────────────────────────────────────
const Field = ({ label, children, className = "" }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
        {children}
    </div>
);
const Input = ({ className = "", ...props }) => (
    <input
        className={`w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-300
            focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition ${className}`}
        {...props}
    />
);

// ─── Provider Signature Panel ─────────────────────────────────────────────────
const ProviderSignaturePanel = ({ company }) => {
    const qc        = useQueryClient();
    const canvasRef = useRef(null);
    const drawing   = useRef(false);
    const lastPos   = useRef({ x: 0, y: 0 });
    const fileRef   = useRef(null);

    const [mode, setMode]         = useState("draw");
    const [hasDrawn, setHasDrawn] = useState(false);
    const [uploaded, setUploaded] = useState(null);
    const [saving, setSaving]     = useState(false);
    const [saved, setSaved]       = useState(false);

    const currentSig = company?.providerSignature || null;

    // ── Size canvas to its CSS display size (fixes coordinate mismatch) ───────
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = window.devicePixelRatio || 1;
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        if (!w || !h) return;
        canvas.width  = w * ratio;
        canvas.height = h * ratio;
        const ctx = canvas.getContext("2d");
        // We draw directly in buffer pixels; getPos() maps pointer coords into
        // buffer space, so we must NOT also scale the context (double-mapping
        // would shift every stroke away from the cursor).
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth   = 2.5 * ratio;
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";
    }, []);

    useEffect(() => {
        if (mode !== "draw") return;
        initCanvas();
        window.addEventListener("resize", initCanvas);
        return () => window.removeEventListener("resize", initCanvas);
    }, [initCanvas, mode]);

    // ── Coordinate helper — always correct because we scale canvas to CSS size ─
    const getPos = (e) => {
        const canvas = canvasRef.current;
        const r      = canvas.getBoundingClientRect();
        const src    = e.touches?.[0] ?? e;
        // Convert display coords -> canvas buffer coords using the live element
        // size, so the stroke lands under the cursor even if the buffer and the
        // on-screen size differ (retina, layout shifts, tab re-mount, etc.).
        const scaleX = canvas.width  / r.width;
        const scaleY = canvas.height / r.height;
        return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
    };

    const onDown = useCallback((e) => {
        e.preventDefault();
        drawing.current = true;
        lastPos.current = getPos(e);
    }, []); // eslint-disable-line

    const onMove = useCallback((e) => {
        e.preventDefault();
        if (!drawing.current) return;
        const canvas = canvasRef.current;
        const ctx    = canvas.getContext("2d");
        const pos    = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
        setHasDrawn(true);
    }, []); // eslint-disable-line

    const onUp = useCallback(() => { drawing.current = false; }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.addEventListener("mousedown",  onDown);
        canvas.addEventListener("mousemove",  onMove);
        canvas.addEventListener("mouseup",    onUp);
        canvas.addEventListener("mouseleave", onUp);
        canvas.addEventListener("touchstart", onDown, { passive: false });
        canvas.addEventListener("touchmove",  onMove, { passive: false });
        canvas.addEventListener("touchend",   onUp);
        return () => {
            canvas.removeEventListener("mousedown",  onDown);
            canvas.removeEventListener("mousemove",  onMove);
            canvas.removeEventListener("mouseup",    onUp);
            canvas.removeEventListener("mouseleave", onUp);
            canvas.removeEventListener("touchstart", onDown);
            canvas.removeEventListener("touchmove",  onMove);
            canvas.removeEventListener("touchend",   onUp);
        };
    }, [onDown, onMove, onUp, mode]);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setUploaded(ev.target.result);
        reader.readAsDataURL(file);
    };

    const save = async () => {
        let dataUrl;
        if (mode === "draw") {
            if (!hasDrawn) return;
            dataUrl = canvasRef.current.toDataURL("image/png");
        } else {
            if (!uploaded) return;
            dataUrl = uploaded;
        }
        setSaving(true);
        try {
            await api.patch("/company-settings", { providerSignature: dataUrl });
            qc.invalidateQueries({ queryKey: ["company-settings"] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch { /* silent */ }
        finally { setSaving(false); }
    };

    const remove = async () => {
        if (!confirm("Remove provider signature?")) return;
        await api.patch("/company-settings", { providerSignature: null });
        qc.invalidateQueries({ queryKey: ["company-settings"] });
        clearCanvas();
        setUploaded(null);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <PenLine className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-700">Provider Signature</span>
                <span className="ml-2 text-xs text-gray-400">Appears on all signed SLA PDFs</span>
                {currentSig && (
                    <button onClick={remove}
                        className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition">
                        <Trash2 className="h-3 w-3" /> Remove
                    </button>
                )}
            </div>

            <div className="p-4 flex flex-wrap gap-6">
                {/* Current saved signature */}
                {currentSig && (
                    <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Current Signature</p>
                        <div className="border border-emerald-200 rounded-lg bg-emerald-50 px-4 py-2 flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <img src={currentSig} alt="Provider signature" className="h-12 object-contain" />
                        </div>
                    </div>
                )}

                {/* New signature */}
                <div className="flex-1 min-w-[260px]">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        {currentSig ? "Update Signature" : "Add Your Signature"}
                    </p>

                    {/* Mode tabs */}
                    <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-3 w-fit">
                        {[["draw", "✍️ Draw"], ["upload", "📷 Upload Image"]].map(([m, label]) => (
                            <button key={m} onClick={() => setMode(m)}
                                className={`px-3 py-1.5 text-xs font-semibold transition ${mode === m ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {mode === "draw" ? (
                        <div>
                            <canvas ref={canvasRef}
                                className="w-full h-24 border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50/30 cursor-crosshair block touch-none" />
                            <div className="flex gap-2 mt-2">
                                <button onClick={clearCanvas}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition">
                                    Clear
                                </button>
                                <button onClick={save} disabled={!hasDrawn || saving}
                                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5">
                                    {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                    {saved ? "Saved!" : "Save Signature"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50/30 h-24 flex items-center justify-center cursor-pointer hover:bg-indigo-50 transition">
                                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleFile} />
                                {uploaded
                                    ? <img src={uploaded} alt="preview" className="h-16 object-contain" />
                                    : <p className="text-xs text-indigo-300">Click to upload signature image</p>}
                            </div>
                            <div className="flex gap-2 mt-2">
                                {uploaded && (
                                    <button onClick={() => { setUploaded(null); fileRef.current.value = ""; }}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition">
                                        Clear
                                    </button>
                                )}
                                <button onClick={save} disabled={!uploaded || saving}
                                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5">
                                    {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                    {saved ? "Saved!" : "Save Signature"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Template Upload Modal ────────────────────────────────────────────────────
const TemplateUploadModal = ({ onClose }) => {
    const qc = useQueryClient();
    const fileRef = useRef(null);
    const [name, setName] = useState("");
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");

    const mutation = useMutation({
        mutationFn: async () => {
            const fd = new FormData();
            fd.append("name", name.trim());
            fd.append("file", file);
            return api.post("/sla/templates/upload", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["sla-templates"] }); onClose(); },
        onError:   (e) => setError(e.response?.data?.message || "Upload failed"),
    });

    const handleFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith(".docx")) return setError("Only .docx files are allowed");
        setError("");
        setFile(f);
        if (!name) setName(f.name.replace(/\.docx$/i, ""));
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 rounded-lg"><LayoutTemplate className="h-4 w-4 text-violet-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">Upload SLA Template</h2>
                            <p className="text-xs text-gray-400">Word document (.docx) with placeholders</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
                            ${file ? "border-violet-300 bg-violet-50" : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/40"}`}
                    >
                        <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={handleFile} />
                        {file ? (
                            <>
                                <FileUp className="h-8 w-8 text-violet-500 mx-auto mb-2" />
                                <p className="text-sm font-semibold text-violet-700">{file.name}</p>
                                <p className="text-xs text-violet-400 mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                            </>
                        ) : (
                            <>
                                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-500">Click to select your .docx template</p>
                                <p className="text-xs text-gray-300 mt-1">Maximum 10 MB</p>
                            </>
                        )}
                    </div>

                    <Field label="Template Name *">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard SLA, Enterprise SLA" />
                    </Field>

                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Available Placeholders</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {[
                                ["{slaNumber}", "SLA-1, SLA-2…"],
                                ["{effectiveDate}", "Start date"],
                                ["{expiryDate}", "End date"],
                                ["{totalAmount}", "₹1,00,000.00"],
                                ["{advanceAmount}", "50% advance"],
                                ["{balanceAmount}", "50% balance"],
                                ["{notes}", "Additional notes"],
                                ["{coName}", "Your company"],
                                ["{coAddress}", "Company address"],
                                ["{coPhone}", "Company phone"],
                                ["{coEmail}", "Company email"],
                            ].map(([ph, desc]) => (
                                <div key={ph} className="flex items-center gap-1.5">
                                    <code className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono">{ph}</code>
                                    <span className="text-[10px] text-gray-400 truncate">{desc}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-200">
                            Services loop: <code className="bg-gray-100 px-1 rounded text-gray-600">{"{#services}"}</code>…<code className="bg-gray-100 px-1 rounded text-gray-600">{"{/services}"}</code>
                            {" "}— use <code className="bg-gray-100 px-1 rounded text-gray-600">{"{description}"}</code>, <code className="bg-gray-100 px-1 rounded text-gray-600">{"{amount}"}</code> inside
                        </p>
                    </div>

                    {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                    <button onClick={() => { setError(""); if (!name.trim()) return setError("Name required"); if (!file) return setError("Select a file"); mutation.mutate(); }}
                        disabled={mutation.isPending}
                        className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                        {mutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {mutation.isPending ? "Uploading…" : "Upload Template"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Create SLA Modal ─────────────────────────────────────────────────────────
const CreateSLAModal = ({ onClose, templates }) => {
    const qc = useQueryClient();
    const [services, setServices]           = useState([{ ...EMPTY_SERVICE }]);
    const [notes, setNotes]                 = useState("");
    const [templateId, setTemplateId]       = useState("");
    const [recipientEmail, setEmail]        = useState("");
    const [showTplDrop, setShowTplDrop]     = useState(false);
    const [formError, setFormError]         = useState("");
    const [createdSLA, setCreatedSLA]       = useState(null);  // success state
    const [copied, setCopied]               = useState(false);
    const [previewing, setPreviewing]       = useState(false);

    const addService    = () => setServices((p) => [...p, { ...EMPTY_SERVICE }]);
    const removeService = (i) => setServices((p) => p.filter((_, x) => x !== i));
    const setService    = (i, k, v) => setServices((p) => { const n = [...p]; n[i] = { ...n[i], [k]: v }; return n; });
    const total         = services.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const advance       = parseFloat((total * 0.5).toFixed(2));
    const selectedTpl   = templates.find((t) => t.id === templateId);

    const mutation = useMutation({
        mutationFn: () => api.post("/sla", {
            services,
            notes             : notes.trim() || undefined,
            templateId        : templateId || undefined,
            recipientEmail    : recipientEmail.trim() || undefined,
        }),
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ["slas"] });
            setCreatedSLA(res.data);
        },
        onError: (e) => setFormError(e.response?.data?.message || "Failed to create SLA"),
    });

    const submit = () => {
        setFormError("");
        if (services.some((s) => !s.description.trim() || !s.amount))
            return setFormError("All services need a description and amount.");
        mutation.mutate();
    };

    const previewPdf = async () => {
        setPreviewing(true);
        try {
            const res = await api.post("/sla/preview", {
                services,
                notes: notes.trim() || undefined,
                templateId: templateId || undefined,
            }, { responseType: "blob" });
            const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
            setFormError("Could not generate preview.");
        } finally {
            setPreviewing(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(createdSLA.signingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ── Success state ────────────────────────────────────────────────────────
    if (createdSLA) return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg"><ShieldCheck className="h-4 w-4 text-emerald-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">SLA Created — {createdSLA.slaNumber}</h2>
                            <p className="text-xs text-gray-400">Signing link is ready to share</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {createdSLA.emailSentTo && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-emerald-700">
                                Signing link sent to <strong>{createdSLA.emailSentTo}</strong>
                            </p>
                        </div>
                    )}

                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-indigo-500" />
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                Client signs · up to 4 signatories
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-indigo-600">
                            <span>₹{fmt(createdSLA.totalAmount)}</span>
                            <span className="text-indigo-300">·</span>
                            <span>{fmtDate(createdSLA.effectiveDate)} – {fmtDate(createdSLA.expiryDate)}</span>
                        </div>
                    </div>

                    <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Signing Link (valid 7 days)</p>
                        <div className="flex items-center gap-2">
                            <input readOnly value={createdSLA.signingUrl}
                                className="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-mono truncate" />
                            <button onClick={copyLink}
                                className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition shrink-0
                                    ${copied ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                <Copy className="h-3.5 w-3.5" />
                                {copied ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>

                    <a href={createdSLA.signingUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 border border-indigo-200 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition">
                        <PenLine className="h-4 w-4" /> Open Signing Page
                    </a>

                    <p className="text-xs text-gray-400 text-center">
                        Clients fill their name, designation &amp; company on the signing page, then sign and auto-download.
                    </p>
                </div>

                <div className="px-5 py-4 border-t border-gray-100">
                    <button onClick={onClose}
                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Creation form ────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg"><FileCheck2 className="h-4 w-4 text-indigo-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">New SLA</h2>
                            <p className="text-xs text-gray-400">Clients fill their details themselves on the signing page</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                    {/* Template picker */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <LayoutTemplate className="h-3.5 w-3.5 text-violet-500" />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">PDF Template</span>
                        </div>
                        <div className="p-4">
                            <button onClick={() => setShowTplDrop((v) => !v)}
                                className={`w-full h-10 px-3 text-sm rounded-lg bg-white flex items-center justify-between transition border-2
                                    ${selectedTpl ? "border-violet-300 text-gray-800" : "border-gray-200 hover:border-violet-300 text-gray-400"}`}>
                                <span className="flex items-center gap-2 truncate">
                                    {selectedTpl
                                        ? <><LayoutTemplate className="h-4 w-4 text-violet-500 shrink-0" /><span className="truncate">{selectedTpl.name}</span></>
                                        : <><FileCheck2 className="h-4 w-4 text-gray-300 shrink-0" />Built-in template</>}
                                </span>
                                <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 ml-1 transition-transform ${showTplDrop ? "rotate-180" : ""}`} />
                            </button>

                            {/* Inline options — not absolute, avoids overflow-y clipping */}
                            {showTplDrop && (
                                <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden">
                                    <button onClick={() => { setTemplateId(""); setShowTplDrop(false); }}
                                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition flex items-center gap-2
                                            ${!templateId ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-700"}`}>
                                        <FileCheck2 className="h-4 w-4 shrink-0 text-indigo-400" />
                                        <div><p className="font-medium">Built-in template</p><p className="text-[10px] text-gray-400">Default ZENVOICE styled PDF</p></div>
                                        {!templateId && <CheckCircle className="h-3.5 w-3.5 text-indigo-500 ml-auto shrink-0" />}
                                    </button>
                                    {templates.map((t) => (
                                        <button key={t.id} onClick={() => { setTemplateId(t.id); setShowTplDrop(false); }}
                                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-violet-50 transition flex items-center gap-2 border-t border-gray-100
                                                ${templateId === t.id ? "bg-violet-50 text-violet-700" : "text-gray-700"}`}>
                                            <LayoutTemplate className="h-4 w-4 shrink-0 text-violet-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{t.name}</p>
                                                <p className="text-[10px] text-gray-400 truncate">{t.fileName}</p>
                                            </div>
                                            {templateId === t.id && <CheckCircle className="h-3.5 w-3.5 text-violet-500 ml-auto shrink-0" />}
                                        </button>
                                    ))}
                                    {templates.length === 0 && (
                                        <p className="px-3 py-2.5 text-xs text-gray-400 border-t border-gray-100 italic">
                                            No custom templates uploaded yet
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Services */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Services / Deliverables</span>
                            </div>
                            <button onClick={addService} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                                <Plus className="h-3.5 w-3.5" /> Add Service
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex gap-3 px-1">
                                <span className="flex-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</span>
                                <span className="w-32 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount (₹)</span>
                                <span className="w-8" />
                            </div>
                            {services.map((svc, idx) => (
                                <div key={idx} className="flex gap-3 items-center">
                                    <input className="flex-1 h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                        value={svc.description} onChange={(e) => setService(idx, "description", e.target.value)}
                                        placeholder="e.g. ZENVOICE Platform Deployment" />
                                    <input type="number" min="0" className="w-32 h-9 px-3 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                                        value={svc.amount} onChange={(e) => setService(idx, "amount", e.target.value)} placeholder="0" />
                                    <button onClick={() => removeService(idx)} disabled={services.length === 1}
                                        className="w-8 flex justify-center items-center text-gray-300 hover:text-red-400 disabled:opacity-20 transition">
                                        <Minus className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex justify-end items-center gap-3 pt-3 mt-1 border-t border-gray-100">
                                <span className="text-sm text-gray-400 font-medium">Total Contract Value</span>
                                <span className="font-bold text-indigo-700 text-base">₹{fmt(total)}</span>
                            </div>
                            <div className="flex justify-end gap-4 text-xs text-gray-400">
                                <span>Advance (50%): <strong className="text-gray-600">₹{fmt(advance)}</strong></span>
                                <span>Balance (50%): <strong className="text-gray-600">₹{fmt(total - advance)}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Signatures: defaults to 1; the client can add more (up to 4) on the signing page */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <Users className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Signatures</span>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-gray-500">
                                One signature is required by default. If more signatories are needed, the client can add them
                                on the signing page (up to a maximum of <strong>4</strong>).
                            </p>
                        </div>
                    </div>

                    {/* Notes */}
                    <Field label="Notes (optional)">
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                            placeholder="Any additional terms or remarks…"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                    </Field>

                    {/* Recipient email */}
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <Mail className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Send Link Via Email</span>
                            <span className="ml-auto text-[10px] text-gray-400 font-normal normal-case">Optional</span>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-gray-500 mb-2">Enter the first signer's email to send the signing link automatically. You can also copy and share the link manually after creation.</p>
                            <Input type="email" value={recipientEmail} onChange={(e) => setEmail(e.target.value)}
                                placeholder="signatory@company.com" />
                        </div>
                    </div>

                    {formError && <p className="text-xs text-red-500">{formError}</p>}
                </div>

                <div className="flex gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
                    <button onClick={onClose} className="py-2 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                    <button onClick={previewPdf} disabled={previewing}
                        className="py-2 px-4 border border-indigo-200 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 disabled:opacity-50 transition flex items-center gap-2">
                        {previewing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        {previewing ? "Loading…" : "Preview PDF"}
                    </button>
                    <button onClick={submit} disabled={mutation.isPending}
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                        {mutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        {mutation.isPending ? "Creating…" : "Create & Get Signing Link"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Resend Link Modal ────────────────────────────────────────────────────────
const ResendModal = ({ sla, onClose }) => {
    const qc = useQueryClient();
    const [email, setEmail]       = useState(sla.emailSentTo || "");
    const [copied, setCopied]     = useState(false);
    const [newUrl, setNewUrl]     = useState(null);

    const mutation = useMutation({
        mutationFn: () => api.post(`/sla/${sla.id}/resend-link`, { recipientEmail: email.trim() || undefined }),
        onSuccess : (res) => { setNewUrl(res.data.signingUrl); qc.invalidateQueries({ queryKey: ["slas"] }); },
    });

    const copyUrl = (url) => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg"><Send className="h-4 w-4 text-indigo-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">Resend Signing Link</h2>
                            <p className="text-xs text-gray-400">{sla.slaNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><X className="h-4 w-4 text-gray-400" /></button>
                </div>

                <div className="p-5 space-y-4">
                    {newUrl ? (
                        <>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                                <CheckCircle className="inline h-4 w-4 mr-1.5" />
                                New signing link generated{email ? ` and sent to ${email}` : ""}.
                            </div>
                            <div className="flex items-center gap-2">
                                <input readOnly value={newUrl}
                                    className="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 font-mono truncate" />
                                <button onClick={() => copyUrl(newUrl)}
                                    className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition shrink-0
                                        ${copied ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                    <Copy className="h-3.5 w-3.5" />{copied ? "Copied!" : "Copy"}
                                </button>
                            </div>
                            <button onClick={onClose} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">Done</button>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600">A new 7-day signing link will be generated. Optionally send it via email.</p>
                            <Field label="Send to email (optional)">
                                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="signatory@company.com" />
                            </Field>
                            {mutation.isError && (
                                <p className="text-xs text-red-500">{mutation.error?.response?.data?.message || "Failed."}</p>
                            )}
                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                                <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
                                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    {mutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {mutation.isPending ? "Generating…" : "Generate New Link"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, accent }) => {
    const accents = {
        indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-500",  val: "text-indigo-700",  border: "border-indigo-100" },
        emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", val: "text-emerald-700", border: "border-emerald-100" },
        amber:   { bg: "bg-amber-50",   icon: "text-amber-500",   val: "text-amber-700",   border: "border-amber-100" },
        violet:  { bg: "bg-violet-50",  icon: "text-violet-500",  val: "text-violet-700",  border: "border-violet-100" },
    };
    const a = accents[accent] || accents.indigo;
    return (
        <div className={`bg-white rounded-xl border ${a.border} p-4 flex items-start gap-3 shadow-sm`}>
            <div className={`${a.bg} p-2.5 rounded-lg shrink-0`}><Icon className={`h-[18px] w-[18px] ${a.icon}`} /></div>
            <div>
                <p className="text-xs font-medium text-gray-400">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${a.val}`}>{value}</p>
            </div>
        </div>
    );
};

// ─── Templates Section ────────────────────────────────────────────────────────
const TemplatesSection = ({ templates, isLoading, onUpload }) => {
    const qc = useQueryClient();
    const [downloading, setDownloading] = useState(null);

    const deleteMut = useMutation({
        mutationFn: (id) => api.delete(`/sla/templates/${id}`),
        onSuccess : () => qc.invalidateQueries({ queryKey: ["sla-templates"] }),
    });

    const handleDownload = async (t) => {
        setDownloading(t.id);
        try {
            const res = await api.get(`/sla/templates/${t.id}/download`, { responseType: "blob" });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a   = document.createElement("a");
            a.href     = url;
            a.download = `${t.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.docx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { alert("Download failed"); }
        finally   { setDownloading(null); }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold text-gray-700">SLA Templates</span>
                <button onClick={onUpload}
                    className="ml-auto flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition shadow-sm">
                    <Upload className="h-3.5 w-3.5" /> Upload Template
                </button>
            </div>

            <div className="mx-4 mt-3 mb-1 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 flex items-start gap-3">
                <Pencil className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700 leading-relaxed">
                    <span className="font-bold">To edit a template:</span>
                    {" "}Download → edit in Word → re-upload → delete old version.
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading…
                </div>
            ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <LayoutTemplate className="h-8 w-8 mb-2 text-gray-200" />
                    <p className="text-sm font-medium">No templates yet</p>
                    <p className="text-xs mt-1 text-gray-300">Upload a .docx with placeholder variables</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50 mb-1">
                    {templates.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition">
                            <div className="p-2 bg-violet-50 rounded-lg shrink-0"><FileUp className="h-4 w-4 text-violet-500" /></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{t.name}</p>
                                <p className="text-xs text-gray-400 truncate">{t.fileName} · {fmtDate(t.createdAt)}</p>
                            </div>
                            <button onClick={() => handleDownload(t)} disabled={downloading === t.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition shrink-0 disabled:opacity-50">
                                {downloading === t.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                Download
                            </button>
                            <button onClick={() => { if (confirm(`Delete template "${t.name}"?`)) deleteMut.mutate(t.id); }}
                                className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const SLA = () => {
    const qc = useQueryClient();
    const [search, setSearch]         = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [showUploadTpl, setShowUploadTpl] = useState(false);
    const [resendModal, setResendModal]     = useState(null);
    const [copiedId, setCopiedId]           = useState(null);
    const [showSettings, setShowSettings]   = useState(false);

    const { data: company, isLoading: companyLoading } = useQuery({
        queryKey: ["company-settings"],
        queryFn : () => api.get("/company-settings").then((r) => r.data),
    });

    const { data: slas = [], isLoading } = useQuery({
        queryKey: ["slas"],
        queryFn : () => api.get("/sla").then((r) => r.data),
    });

    const { data: templates = [], isLoading: tplLoading } = useQuery({
        queryKey: ["sla-templates"],
        queryFn : () => api.get("/sla/templates/list").then((r) => r.data),
    });

    const deleteMut = useMutation({
        mutationFn: (id) => api.delete(`/sla/${id}`),
        onSuccess : () => qc.invalidateQueries({ queryKey: ["slas"] }),
    });

    const pendingSignature = slas.filter((s) => s.status === "PENDING_SIGNATURE");
    const signed           = slas.filter((s) => s.status === "SIGNED");
    const totalValue       = slas.reduce((s, i) => s + i.totalAmount, 0);

    const handleDownloadSigned = async (sla) => {
        const res = await api.get(`/sla/${sla.id}/download-signed`, { responseType: "blob" });
        const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        const a   = document.createElement("a");
        a.href     = url;
        a.download = `${sla.slaNumber}_signed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyLink = (sla) => {
        if (!sla.signingUrl) return;
        navigator.clipboard.writeText(sla.signingUrl);
        setCopiedId(sla.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filtered = slas.filter((s) =>
        [s.slaNumber, s.clientName, s.emailSentTo].some((v) =>
            v?.toLowerCase().includes(search.toLowerCase())
        )
    );

    return (
        <div className="p-6 space-y-5 min-h-full bg-gray-50/40">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Service Level Agreements</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Create · share · collect e-signatures</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowSettings(true)}
                        className="flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm">
                        <Building2 className="h-3.5 w-3.5 text-violet-500" /> My Company
                    </button>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm">
                        <Plus className="h-3.5 w-3.5" /> New SLA
                    </button>
                </div>
            </div>

            {/* Company Banner */}
            {!companyLoading && company && (
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
                    <div className="p-2 bg-violet-50 rounded-lg"><Building2 className="h-4 w-4 text-violet-500" /></div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">{company.companyName}</p>
                        <p className="text-[11px] text-gray-400">
                            GSTIN: {company.gstin} · {company.address}, {company.city} · {company.phone}
                        </p>
                    </div>
                    <button onClick={() => setShowSettings(true)} className="text-[11px] text-indigo-500 hover:underline shrink-0 font-medium">Edit</button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <StatCard icon={FileCheck2}  label="Total SLAs"           value={slas.length}            accent="indigo" />
                <StatCard icon={PenLine}     label="Awaiting Signature"   value={pendingSignature.length} accent="amber" />
                <StatCard icon={ShieldCheck} label="Fully Signed"         value={signed.length}           accent="violet" />
                <StatCard icon={IndianRupee} label="Total Contract Value" value={`₹${fmt(totalValue)}`}  accent="emerald" />
            </div>

            {/* Provider Signature */}
            <ProviderSignaturePanel company={company} />

            {/* Templates section */}
            <TemplatesSection templates={templates} isLoading={tplLoading} onUpload={() => setShowUploadTpl(true)} />

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search SLA number or client…"
                    className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition shadow-sm" />
            </div>

            {/* SLA Records Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">SLA Records</span>
                    <span className="ml-auto text-xs text-gray-400">{filtered.length} records</span>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <FileCheck2 className="h-10 w-10 mb-3 text-gray-200" />
                        <p className="text-sm font-medium">No SLAs yet.</p>
                        <p className="text-xs mt-1 text-gray-300">Click "New SLA" to create your first one.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                <th className="px-5 py-3 text-left">SLA #</th>
                                <th className="px-5 py-3 text-left">Signers</th>
                                <th className="px-5 py-3 text-left">Created</th>
                                <th className="px-5 py-3 text-right">Amount</th>
                                <th className="px-5 py-3 text-center">Status</th>
                                <th className="px-5 py-3 text-left">Sent To</th>
                                <th className="px-5 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((sla) => {
                                const collected = sla.SLASignature?.length || 0;
                                const firstSigner = sla.SLASignature?.[0];

                                return (
                                    <tr key={sla.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition">
                                        <td className="px-5 py-3.5 font-mono text-xs text-indigo-600 font-semibold">{sla.slaNumber}</td>
                                        <td className="px-5 py-3.5">
                                            {firstSigner ? (
                                                <div>
                                                    <p className="font-semibold text-gray-800 text-sm">{firstSigner.signerName}</p>
                                                    {firstSigner.signerCompany && <p className="text-xs text-gray-400">{firstSigner.signerCompany}</p>}
                                                    {collected > 1 && (
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {collected} signatories signed
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-xs text-gray-400 italic">Awaiting first signature</p>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-500 text-xs">{fmtDate(sla.createdAt)}</td>
                                        <td className="px-5 py-3.5 text-right font-semibold text-gray-800">₹{fmt(sla.totalAmount)}</td>
                                        <td className="px-5 py-3.5 text-center">
                                            {sla.status === "SIGNED" ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700">
                                                    <ShieldCheck className="h-3 w-3" /> Signed
                                                </span>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-600">
                                                        <PenLine className="h-3 w-3" /> Awaiting
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {sla.emailSentTo ? (
                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Mail className="h-3 w-3 text-gray-400" />{sla.emailSentTo}
                                                </span>
                                            ) : <span className="text-xs text-gray-300">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {sla.status === "SIGNED" ? (
                                                    <button onClick={() => handleDownloadSigned(sla)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-semibold hover:bg-violet-100 transition">
                                                        <Download className="h-3 w-3" /> Download Signed
                                                    </button>
                                                ) : (
                                                    <>
                                                        {/* Copy signing link */}
                                                        <button onClick={() => copyLink(sla)} title="Copy signing link"
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                                                                ${copiedId === sla.id ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}>
                                                            <Copy className="h-3 w-3" />
                                                            {copiedId === sla.id ? "Copied!" : "Copy Link"}
                                                        </button>
                                                        {/* Resend link */}
                                                        <button onClick={() => setResendModal(sla)} title="Resend signing link"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100 transition">
                                                            <Send className="h-3 w-3" /> Resend
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => { if (confirm("Delete this SLA?")) deleteMut.mutate(sla.id); }}
                                                    className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showCreate    && <CreateSLAModal onClose={() => setShowCreate(false)} templates={templates} />}
            {showUploadTpl && <TemplateUploadModal onClose={() => setShowUploadTpl(false)} />}
            {resendModal   && <ResendModal sla={resendModal} onClose={() => setResendModal(null)} />}
            {showSettings  && <CompanySettingsModal initialData={company} onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default SLA;
