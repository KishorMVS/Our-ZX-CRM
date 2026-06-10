import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Info, CheckCircle, RefreshCw, Save } from "lucide-react";
import api from "../api/axios";

// ─── Atoms ──────────────────────────────────────────────────────────────────
const Input = ({ className = "", ...props }) => (
    <input
        className={`w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition ${className}`}
        {...props}
    />
);
const Select = ({ children, className = "", ...props }) => (
    <select
        className={`w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition ${className}`}
        {...props}
    >
        {children}
    </select>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY SETTINGS MODAL
// Shared editor for the workspace's company details. The same record powers
// both Invoice & Billing (header/bank) and SLA (provider banner & signed PDFs).
// ═══════════════════════════════════════════════════════════════════════════════
const CompanySettingsModal = ({ onClose, initialData }) => {
    const qc = useQueryClient();
    const [tab, setTab] = useState("business");
    const [form, setForm] = useState({
        companyName: initialData?.companyName || "",
        shortName: initialData?.shortName || "",
        gstin: initialData?.gstin || "",
        address: initialData?.address || "",
        city: initialData?.city || "",
        state: initialData?.state || "",
        pincode: initialData?.pincode || "",
        phone: initialData?.phone || "",
        email: initialData?.email || "",
        website: initialData?.website || "",
        placeOfSupply: initialData?.placeOfSupply || "",
        bankName: initialData?.bankName || "",
        accountNo: initialData?.accountNo || "",
        ifsc: initialData?.ifsc || "",
        branch: initialData?.branch || "",
        defaultTaxRate: initialData?.defaultTaxRate ?? 18,
        defaultNotes: initialData?.defaultNotes || "",
    });
    const [saved, setSaved] = useState(false);

    const mutation = useMutation({
        mutationFn: () => api.patch("/company-settings", form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["company-settings"] });
            setSaved(true);
            setTimeout(() => { setSaved(false); onClose(); }, 800);
        },
    });

    const sf = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const TABS = [
        { key: "business", label: "Business Info" },
        { key: "bank", label: "Bank Details" },
        { key: "invoice", label: "Invoice Settings" },
    ];

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 rounded-lg"><Building2 className="h-4 w-4 text-violet-600" /></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">My Company Details</h2>
                            <p className="text-xs text-gray-400">Appears on all invoices, SLAs & emails</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4 text-gray-400" /></button>
                </div>

                <div className="flex gap-1 px-5 pt-3 pb-0 shrink-0 border-b border-gray-100">
                    {TABS.map((t) => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={`px-3 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${tab === t.key ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {tab === "business" && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Company Name *</label>
                                <Input value={form.companyName} onChange={(e) => sf("companyName", e.target.value)} placeholder="Your company legal name" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Invoice Prefix</label>
                                <div className="flex items-center gap-2">
                                    <Input value={form.shortName} onChange={(e) => sf("shortName", e.target.value.toUpperCase())} placeholder="HXZ" className="uppercase" />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{form.shortName || "HXZ"}-1…</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">GSTIN</label>
                                <Input value={form.gstin} onChange={(e) => sf("gstin", e.target.value.toUpperCase())} placeholder="33AAHCH4159D1ZT" className="uppercase" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Address</label>
                                <Input value={form.address} onChange={(e) => sf("address", e.target.value)} placeholder="Street address" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">City</label>
                                <Input value={form.city} onChange={(e) => sf("city", e.target.value)} placeholder="Chennai" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">State</label>
                                <Input value={form.state} onChange={(e) => sf("state", e.target.value)} placeholder="Tamil Nadu" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pincode</label>
                                <Input value={form.pincode} onChange={(e) => sf("pincode", e.target.value)} placeholder="600019" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Place of Supply</label>
                                <Input value={form.placeOfSupply} onChange={(e) => sf("placeOfSupply", e.target.value)} placeholder="33-Tamil Nadu" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
                                <Input value={form.phone} onChange={(e) => sf("phone", e.target.value)} placeholder="+91 9994081905" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                                <Input type="email" value={form.email} onChange={(e) => sf("email", e.target.value)} placeholder="you@company.com" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Website</label>
                                <Input value={form.website} onChange={(e) => sf("website", e.target.value)} placeholder="https://yourcompany.com" />
                            </div>
                        </div>
                    )}
                    {tab === "bank" && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-3 flex items-start gap-2">
                                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    Bank details will be printed on every invoice and included in email.
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bank Name</label>
                                <Input value={form.bankName} onChange={(e) => sf("bankName", e.target.value)} placeholder="Axis Bank" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Number</label>
                                <Input value={form.accountNo} onChange={(e) => sf("accountNo", e.target.value)} placeholder="924020046598227" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">IFSC Code</label>
                                <Input value={form.ifsc} onChange={(e) => sf("ifsc", e.target.value.toUpperCase())} placeholder="UTIB0001619" className="uppercase" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Branch</label>
                                <Input value={form.branch} onChange={(e) => sf("branch", e.target.value)} placeholder="Thiruvottriyur" />
                            </div>
                        </div>
                    )}
                    {tab === "invoice" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Default GST Rate (%)</label>
                                <Select value={form.defaultTaxRate} onChange={(e) => sf("defaultTaxRate", +e.target.value)} className="w-32">
                                    {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Default Notes / Terms</label>
                                <textarea className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none text-gray-700 placeholder-gray-300"
                                    value={form.defaultNotes} onChange={(e) => sf("defaultNotes", e.target.value)}
                                    placeholder="e.g. Payment due within 15 days." />
                            </div>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700">
                                <p className="font-semibold mb-1">Invoice Numbering</p>
                                <p>Tax Invoices: <strong>{form.shortName || "HXZ"}-1</strong>, <strong>{form.shortName || "HXZ"}-2</strong>… · Proforma: <strong>{form.shortName || "HXZ"}-PRO-1</strong>…</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
                    <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                    <button onClick={() => mutation.mutate()} disabled={mutation.isPending || saved}
                        className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition ${saved ? "bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"} disabled:opacity-70`}>
                        {saved ? <><CheckCircle className="h-4 w-4" /> Saved!</> : mutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanySettingsModal;
