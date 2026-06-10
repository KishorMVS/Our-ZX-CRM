import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Phone, Mail, Globe, MapPin, Star, Loader2, CheckSquare, Square, Users, ArrowRight, X, Rocket } from "lucide-react";
import api from "../api/axios";
import { useQueryClient } from "@tanstack/react-query";

const SearchLeads = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState("");
    const [importResult, setImportResult] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true); setError(""); setResults([]); setSelected(new Set()); setImportResult(null); setHasSearched(true);
        try {
            const res = await api.post("/search-leads", { query: query.trim() });
            setResults(res.data.leads || []);
        } catch (err) {
            setError(err.response?.data?.message || "Search failed.");
        } finally { setLoading(false); }
    };

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const validResults = results.filter((r) => r.phone);
        if (selected.size === validResults.length) setSelected(new Set());
        else setSelected(new Set(validResults.map((r) => r.id)));
    };

    const handleImport = async () => {
        if (selected.size === 0) return;
        const leads = results.filter(r => selected.has(r.id)).map(l => ({
            name: l.name,
            phone: l.phone,
            email: l.email,
            address: l.address,
            website: l.website,
            rating: l.rating,
            category: l.category,
            source: "WEBSITE"
        }));
        setImporting(true); setImportResult(null);
        try {
            const res = await api.post("/search-leads/import", { leads });
            setImportResult({ success: true, message: `Successfully imported ${res.data.created} leads!`, created: res.data.created });
            setSelected(new Set());
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        } catch (err) {
            setImportResult({ success: false, message: "Import failed." });
        } finally { setImporting(false); }
    };

    const validResults = results.filter((r) => r.phone);
    const allSelected = validResults.length > 0 && selected.size === validResults.length;

    return (
        <div className="p-10 max-w-7xl mx-auto font-sans">
            <header className="mb-8">
                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Search Leads</h1>
                <p className="text-sm text-gray-500">Find businesses online and launch instant campaigns.</p>
            </header>

            <form onSubmit={handleSearch} className="flex gap-4 mb-8">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder='e.g. "Real estate in Mumbai"' className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                </div>
                <button type="submit" disabled={loading} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "SEARCH"}
                </button>
            </form>

            {importResult && (
                <div className={`mb-6 p-4 rounded-2xl border flex items-center justify-between ${importResult.success ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-red-50 border-red-100 text-red-700"}`}>
                    <span className="text-sm font-bold">{importResult.message}</span>
                    {importResult.success && <button onClick={() => navigate("/leads")} className="text-xs font-black underline flex items-center gap-1">GO TO LEADS <ArrowRight className="h-3 w-3" /></button>}
                </div>
            )}

            {!loading && results.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                            {allSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4" />} {allSelected ? "Deselect All" : "Select All"}
                        </button>
                        {selected.size > 0 && (
                            <button onClick={() => navigate("/campaigns", { state: { leads: results.filter(r => selected.has(r.id)) } })} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl shadow-lg hover:shadow-indigo-200 uppercase tracking-widest">
                                <Rocket className="h-3.5 w-3.5" /> Launch Campaign
                            </button>
                        )}
                    </div>

                    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-xl shadow-black/5">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="w-12 px-6 py-4" />
                                    <th className="px-6 py-4 text-left font-black text-gray-500 uppercase text-[10px] tracking-widest">Company</th>
                                    <th className="px-6 py-4 text-left font-black text-gray-500 uppercase text-[10px] tracking-widest">Phone</th>
                                    <th className="px-6 py-4 text-left font-black text-gray-500 uppercase text-[10px] tracking-widest">Rating</th>
                                    <th className="px-6 py-4 text-left font-black text-gray-500 uppercase text-[10px] tracking-widest">Website</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {results.map((lead) => (
                                    <tr key={lead.id} onClick={() => lead.phone && toggleSelect(lead.id)} className={`transition-all hover:bg-gray-50/80 cursor-pointer ${selected.has(lead.id) ? "bg-indigo-50/30" : ""}`}>
                                        <td className="px-6 py-4">
                                            {lead.phone ? (selected.has(lead.id) ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-gray-200" />) : null}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center font-bold text-indigo-600">{lead.name[0]}</div>
                                                <div className="text-sm font-bold text-gray-900">{lead.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-600">{lead.phone || <span className="text-gray-300 italic">No number</span>}</td>
                                        <td className="px-6 py-4"><div className="flex items-center gap-1 text-xs font-bold text-amber-500"><Star className="h-3 w-3 fill-amber-500" /> {lead.rating || "N/A"}</div></td>
                                        <td className="px-6 py-4 text-[10px] font-bold text-indigo-500 uppercase truncate max-w-[150px]">{lead.website?.replace(/https?:\/\//, "") || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {selected.size > 0 && (
                        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-indigo-900 px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-10">
                            <span className="text-white text-sm font-black">{selected.size} LEADS SELECTED</span>
                            <div className="flex gap-4">
                                <button onClick={() => navigate("/campaigns", { state: { leads: results.filter(r => selected.has(r.id)) } })} className="bg-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-white/20 transition-all flex items-center gap-2"><Rocket className="h-3.5 w-3.5" /> Launch Campaign</button>
                                <button onClick={handleImport} disabled={importing} className="bg-white text-indigo-900 px-5 py-2.5 rounded-xl text-xs font-black uppercase shadow-lg hover:bg-indigo-50 transition-all">{importing ? "Importing..." : "Add to CRM"}</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchLeads;
