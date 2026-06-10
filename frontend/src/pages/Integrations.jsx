import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Copy, CheckCircle2, ExternalLink, X, AlertCircle,
    Zap, Globe, BarChart2, Link2, RefreshCw, Loader2, Eye, EyeOff,
    Webhook, FileSpreadsheet, MousePointerClick, Activity,
    Mail, ShieldCheck, Send, Info, Check, Plus
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import { Modal } from "../components/Modal";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

// ── Copy helper ───────────────────────────────────────────────────────────────
const useCopy = () => {
    const [copied, setCopied] = useState("");
    const copy = (text, id) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(id);
            setTimeout(() => setCopied(""), 2000);
        });
    };
    return { copy, copied };
};

const CopyButton = ({ text, id, copied, onCopy }) => (
    <button
        onClick={() => onCopy(text, id)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0"
    >
        {copied === id
            ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Copied!</>
            : <><Copy className="h-3.5 w-3.5" /> Copy</>}
    </button>
);


const CodeBlock = ({ code, id, copied, onCopy }) => (
    <div className="relative">
        <pre className="bg-gray-900 text-green-400 text-xs font-mono p-4 rounded-xl overflow-x-auto leading-relaxed whitespace-pre-wrap">
            {code}
        </pre>
        <div className="absolute top-2 right-2">
            <CopyButton text={code} id={id} copied={copied} onCopy={onCopy} />
        </div>
    </div>
);

// ── Integration definitions ───────────────────────────────────────────────────
const MetaIcon = () => (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
        <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
    </svg>
);
const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);
const GmailIcon = () => (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
);

const INTEGRATIONS = [
    {
        id: "META_ADS",
        name: "Meta Lead Ads",
        subtitle: "Facebook & Instagram",
        description: "Auto-capture leads from Facebook and Instagram ad lead forms. When someone submits, it lands directly in your CRM.",
        color: "from-blue-600 to-indigo-600",
        Icon: MetaIcon,
        requiresConfig: true,
        webhookKey: "metaReceive",
        steps: [
            "Go to Meta Business Suite → Ads Manager and open your Lead Form ad",
            "In your Facebook Developer App, go to Webhooks → Subscribe to leadgen events",
            "Set the Callback URL to the webhook URL shown below",
            "Set the Verify Token to: zx_crm_meta_verify",
            "Paste your Page Access Token below and save — leads will flow in automatically",
        ],
    },
    {
        id: "GOOGLE_ADS",
        name: "Google Ads",
        subtitle: "Lead Form Extensions",
        description: "Capture leads from Google Ads Lead Form Extensions. Google POSTs lead data directly to your CRM the moment someone submits.",
        color: "from-yellow-500 to-orange-500",
        Icon: GoogleIcon,
        requiresConfig: false,
        webhookKey: "googleAds",
        steps: [
            "In Google Ads, open your campaign → Assets → Lead Form",
            "Under 'Webhook integration', paste the webhook URL below",
            'Set the Google Ads key to: zx-crm-lead',
            "Save and publish your lead form",
            "Submit a test lead — it should appear in your CRM within seconds",
        ],
    },
    {
        id: "GOOGLE_SHEETS",
        name: "Google Sheets",
        subtitle: "Form Responses & Spreadsheets",
        description: "Connect any Google Sheet or Google Form. Paste our Apps Script to auto-push every new row into your CRM as a lead.",
        color: "from-green-500 to-emerald-600",
        Icon: () => <FileSpreadsheet className="h-6 w-6 text-white" />,
        requiresConfig: true,
        webhookKey: "googleSheets",
        steps: [
            "Open your Google Sheet (or form response sheet)",
            "Click Extensions → Apps Script",
            "Delete any existing code and paste the Apps Script below",
            "Save (Ctrl+S), then click Run → setup() to install the trigger",
            "Submit a test form row — the lead will appear in your CRM automatically",
        ],
    },
    {
        id: "WEB_FORM",
        name: "Web Form / Landing Page",
        subtitle: "Any HTML Form",
        description: "Embed a form on any website or landing page. Just set the form's action to your webhook URL — no backend code needed.",
        color: "from-purple-600 to-violet-600",
        Icon: () => <MousePointerClick className="h-6 w-6 text-white" />,
        requiresConfig: false,
        webhookKey: "webForm",
        steps: [
            "Copy the webhook URL below",
            'Set it as the action attribute on your HTML <form> element',
            "Ensure fields are named: name, email, phone (message is optional)",
            "Add ?redirect=https://yoursite.com/thank-you to send users to a success page",
            "Test by submitting the form — the lead appears in your CRM instantly",
        ],
    },
    {
        id: "WEBHOOK",
        name: "Generic Webhook",
        subtitle: "Zapier · Make · n8n · Any Source",
        description: "Universal webhook for any tool that can send HTTP POST requests. Works with Zapier, Make, n8n, Typeform, Tally, JotForm, or custom code.",
        color: "from-gray-700 to-gray-900",
        Icon: () => <Webhook className="h-6 w-6 text-white" />,
        requiresConfig: false,
        webhookKey: "universal",
        steps: [
            "Copy the Universal Webhook URL from the top of this page",
            "In Zapier/Make/n8n, create a new action: HTTP POST to that URL",
            "Map your fields: name, email, phone (and optional: source, notes)",
            "Send a test request with sample data",
            "The lead will appear in your Leads section within seconds",
        ],
    },
];

// ── URL Environment Tabs ─────────────────────────────────────────────────────
const UrlEnvTabs = ({ defn, config, copied, onCopy }) => {
    const hasProd = !!config?.prodWebhooks;
    const [env, setEnv] = useState(hasProd ? "prod" : "local");

    const prodUrl = config?.prodWebhooks?.[defn.webhookKey];
    const localUrl = config?.localWebhooks?.[defn.webhookKey];

    if (!prodUrl && !localUrl) return null;

    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Webhook URL — paste this in your platform
            </p>

            {hasProd && (
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
                    <button
                        onClick={() => setEnv("prod")}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${env === "prod" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        Production
                    </button>
                    <button
                        onClick={() => setEnv("local")}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${env === "local" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            }`}
                    >
                        Localhost
                    </button>
                </div>
            )}

            {env === "prod" && prodUrl && (
                <div className="flex items-center gap-2 p-2.5 bg-gray-900 rounded-xl">
                    <code className="flex-1 text-xs text-green-400 font-mono truncate">{prodUrl}</code>
                    <CopyButton text={prodUrl} id={`prod-${defn.id}`} copied={copied} onCopy={onCopy} />
                </div>
            )}
            {env === "local" && localUrl && (
                <div className="space-y-1">
                    <div className="flex items-center gap-2 p-2.5 bg-gray-900 rounded-xl">
                        <code className="flex-1 text-xs text-yellow-400 font-mono truncate">{localUrl}</code>
                        <CopyButton text={localUrl} id={`local-${defn.id}`} copied={copied} onCopy={onCopy} />
                    </div>
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                        ⚠ Localhost URLs only work for local testing. Meta Ads requires a public HTTPS URL.
                    </p>
                </div>
            )}
        </div>
    );
};

// ── Setup Modal ───────────────────────────────────────────────────────────────
const SetupModal = ({ defn, config, onClose }) => {
    const { copy, copied } = useCopy();
    const queryClient = useQueryClient();
    const [metaToken, setMetaToken] = useState("");
    const [metaPageId, setMetaPageId] = useState("");
    const [sheetLink, setSheetLink] = useState("");
    const [sheetName, setSheetName] = useState("");
    const [showToken, setShowToken] = useState(false);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const prodSheets = config?.prodWebhooks?.googleSheets;
    const prodForm = config?.prodWebhooks?.webForm;

    const saveMetaMutation = useMutation({
        mutationFn: () => api.post("/capture/meta-config", { pageAccessToken: metaToken, pageId: metaPageId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["capture-config"] });
            toast.success("Meta configuration saved");
            onClose();
        },
        onError: (err) => setError(err.response?.data?.message || "Failed to save"),
    });

    const handleSaveGoogleSheets = async () => {
        const sheetIdRegex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
        const isValidUrl = sheetIdRegex.test(sheetLink) || /^[a-zA-Z0-9-_]{15,}$/.test(sheetLink);
        if (!isValidUrl) {
            setError("Please enter a valid Google Sheet link or ID");
            return;
        }

        setIsSaving(true);
        try {
            await api.post("/integrations/google-sheets/config", { sheetLink, sheetName });
            toast.success("Google Sheet connected successfully!");
            setSheetLink("");
            setSheetName("");
            queryClient.invalidateQueries({ queryKey: ["capture-config"] });
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save configuration");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveSheet = async (sheetId) => {
        if (!confirm("Are you sure you want to disconnect this sheet?")) return;
        try {
            await api.delete(`/integrations/google-sheets/config/${sheetId}`);
            toast.success("Sheet removed");
            queryClient.invalidateQueries({ queryKey: ["capture-config"] });
        } catch (err) {
            toast.error("Failed to remove sheet");
        }
    };

    const connectedSheets = config?.integrations?.GOOGLE_SHEETS?.config?.sheets || [];
    // Handle legacy format
    const legacySheetId = config?.integrations?.GOOGLE_SHEETS?.config?.sheetId;
    if (!config?.integrations?.GOOGLE_SHEETS?.config?.sheets && legacySheetId) {
        connectedSheets.push({ id: legacySheetId, name: "Primary Sheet", link: config?.integrations?.GOOGLE_SHEETS?.config?.sheetLink });
    }

    const appsScript = `// ZX CRM — Google Sheets Lead Capture
// Paste in Extensions → Apps Script → Save → Run setup()

const CRM_WEBHOOK = "${prodSheets || config?.webhooks?.googleSheets || "YOUR_WEBHOOK_URL"}";

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(ss).onFormSubmit().create();
  Logger.log("Trigger installed ✓");
}

function onFormSubmit(e) {
  const row = e.namedValues;
  const payload = {
    name:  row["Full Name"]?.[0] || row["Name"]?.[0] || "",
    email: row["Email"]?.[0]     || row["Email Address"]?.[0] || "",
    phone: row["Phone"]?.[0]     || row["Phone Number"]?.[0] || "",
    notes: "Source: Google Sheet",
  };
  UrlFetchApp.fetch(CRM_WEBHOOK, {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}`;

    const htmlForm = `<form action="${prodForm || config?.webhooks?.webForm || "YOUR_WEBHOOK_URL"}" method="POST">
  <input type="text"  name="name"  placeholder="Your Name"  required />
  <input type="email" name="email" placeholder="Email"       required />
  <input type="tel"   name="phone" placeholder="Phone"       />
  <textarea name="message" placeholder="Message (optional)"></textarea>
  <button type="submit">Send Enquiry</button>
</form>`;

    const zapierBody = `{
  "name":  "{{First Name}} {{Last Name}}",
  "email": "{{Email}}",
  "phone": "{{Phone}}",
  "source": "WEBHOOK",
  "notes": "Via Zapier / Make"
}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className={`bg-gradient-to-r ${defn.color} px-6 py-5 flex items-center justify-between text-white`}>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl"><defn.Icon /></div>
                        <div>
                            <h3 className="text-lg font-bold">{defn.name}</h3>
                            <p className="text-white/70 text-xs">{defn.subtitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Webhook URL with env switcher */}
                    <UrlEnvTabs defn={defn} config={config} copied={copied} onCopy={copy} />

                    {/* Meta page access token */}
                    {defn.id === "META_ADS" && (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-800">Page Access Token</p>
                            <div className="relative">
                                <input
                                    type={showToken ? "text" : "password"}
                                    value={metaToken}
                                    onChange={e => { setMetaToken(e.target.value); setError(""); }}
                                    placeholder="EAAxxxxx..."
                                    className="w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button type="button" onClick={() => setShowToken(!showToken)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-800 mb-1">Page ID <span className="text-gray-400 font-normal">(optional)</span></p>
                                <input
                                    type="text"
                                    value={metaPageId}
                                    onChange={e => setMetaPageId(e.target.value)}
                                    placeholder="123456789"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            {error && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> {error}
                                </p>
                            )}
                            <button
                                onClick={() => saveMetaMutation.mutate()}
                                disabled={saveMetaMutation.isPending || !metaToken}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                            >
                                {saveMetaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Save & Activate
                            </button>
                        </div>
                    )}

                    {/* Google Sheets Direct Sync */}
                    {defn.id === "GOOGLE_SHEETS" && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3">
                                <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-700">
                                    <p className="font-semibold mb-1">How to connect:</p>
                                    <ol className="list-decimal ml-4 space-y-1">
                                        <li>Open your Google Sheet.</li>
                                        <li>Click <strong>Share</strong> and set access to <strong>"Anyone with the link can view"</strong>.</li>
                                        <li>Copy the URL from your browser address bar and paste it below.</li>
                                    </ol>
                                </div>
                            </div>

                            {/* Connected Sheets List */}
                            {connectedSheets.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Connected Sheets ({connectedSheets.length})</p>
                                    <div className="space-y-2">
                                        {connectedSheets.map((s) => (
                                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl group">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-100 rounded-lg">
                                                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{s.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-mono truncate max-w-[150px]">{s.id}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveSheet(s.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400 font-bold">Add New Sheet</span></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Sheet Name</label>
                                    <input
                                        type="text"
                                        value={sheetName}
                                        onChange={(e) => setSheetName(e.target.value)}
                                        placeholder="e.g. Website Leads"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Link or ID</label>
                                    <input
                                        type="text"
                                        value={sheetLink}
                                        onChange={(e) => { setSheetLink(e.target.value); setError(""); }}
                                        placeholder="Paste link here..."
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            {error && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> {error}
                                </p>
                            )}

                            <button
                                onClick={handleSaveGoogleSheets}
                                disabled={isSaving || !sheetLink}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Add Spreadsheet
                            </button>

                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Or use Apps Script (Advanced)</span></div>
                            </div>

                            <p className="text-sm font-semibold text-gray-800">Apps Script Code</p>
                            <CodeBlock code={appsScript} id="apps-script" copied={copied} onCopy={copy} />
                        </div>
                    )}

                    {/* Web Form HTML snippet */}
                    {defn.id === "WEB_FORM" && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-800">HTML Form Snippet</p>
                            <CodeBlock code={htmlForm} id="html-form" copied={copied} onCopy={copy} />
                            <p className="text-xs text-gray-400">Style the form to match your brand. All fields are customizable.</p>
                        </div>
                    )}

                    {/* Zapier/Generic payload */}
                    {defn.id === "WEBHOOK" && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-800">Expected JSON Payload</p>
                            <CodeBlock code={zapierBody} id="zapier-body" copied={copied} onCopy={copy} />
                            <p className="text-xs text-gray-400">Map your platform's fields to this structure in Zapier, Make, or n8n.</p>
                        </div>
                    )}

                    {/* Step-by-step */}
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-gray-800">Setup Steps</p>
                        <ol className="space-y-2.5">
                            {defn.steps.map((step, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                                    <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Integration Card ──────────────────────────────────────────────────────────
const IntegrationCard = ({ defn, stats, onSetup, handleSync, isSyncing }) => {
    const queryClient = useQueryClient();
    const isActive = stats?.isActive || false;
    const leadsCount = stats?.leadsCaptures || 0;
    const isConnected = stats?.isConnected || false;

    const toggleMutation = useMutation({
        mutationFn: () => api.post("/capture/toggle", { platform: defn.id }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capture-config"] }),
    });

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            <div className={`h-1.5 bg-gradient-to-r ${defn.color}`} />
            <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`bg-gradient-to-br ${defn.color} p-2.5 rounded-xl`}>
                            <defn.Icon />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-sm leading-tight">{defn.name}</h3>
                            <p className="text-xs text-gray-400">{defn.subtitle}</p>
                        </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                        {isActive ? "Active" : "Inactive"}
                    </span>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed mb-4 flex-1">{defn.description}</p>

                <div className="flex items-center gap-1.5 mb-4">
                    <Activity className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-sm font-bold text-gray-900">{leadsCount.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">leads captured</span>
                    {stats?.lastLeadAt && (
                        <span className="text-xs text-gray-300 ml-1">
                            · last {new Date(stats.lastLeadAt).toLocaleDateString()}
                        </span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    {isConnected && defn.id === "GOOGLE_SHEETS" && (
                        <button
                            onClick={() => handleSync(stats.id)}
                            disabled={isSyncing}
                            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onSetup(defn)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                        >
                            <Link2 className="h-3.5 w-3.5" /> {isConnected ? "Edit" : "Setup"}
                        </button>
                        <button
                            onClick={() => toggleMutation.mutate()}
                            disabled={toggleMutation.isPending}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-colors ${isActive
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                                }`}
                        >
                            {toggleMutation.isPending
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : isActive ? "Disable" : "Enable"
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Link Cards (existing integrations) ───────────────────────────────────────
const LinkCard = ({ to, color, Icon, name, subtitle, description, label, labelColor }) => (
    <a href={to} className="block group">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
            <div className={`h-1.5 bg-gradient-to-r ${color}`} />
            <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`bg-gradient-to-br ${color} p-2.5 rounded-xl`}><Icon /></div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-sm">{name}</h3>
                            <p className="text-xs text-gray-400">{subtitle}</p>
                        </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${labelColor}`}>{label}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">{description}</p>
                <div className={`flex items-center gap-1.5 text-xs font-semibold mt-4 ${labelColor.replace("bg-", "text-").replace("-100", "-700")}`}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open Dashboard
                </div>
            </div>
        </div>
    </a>
);

// ── Email Automation Card ─────────────────────────────────────────────────────
const EmailAutomationCard = ({ isAdmin }) => {
    const queryClient = useQueryClient();

    const { data: settings } = useQuery({
        queryKey: ["company-settings"],
        queryFn: () => api.get("/company-settings").then(r => r.data),
        retry: false,
    });

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fromName, setFromName] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [testMsg, setTestMsg] = useState(null); // { ok, text }

    const displayEmail = dirty ? email : (settings?.smtpEmail || "");
    const displayFromName = dirty ? fromName : (settings?.smtpFromName || "");
    const isConfigured = !!settings?.smtpEmail;

    const saveMutation = useMutation({
        mutationFn: (data) => api.put("/company-settings", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["company-settings"] });
            setDirty(false);
            setPassword("");
            setTestMsg({ ok: true, text: "Saved successfully." });
            setTimeout(() => setTestMsg(null), 3000);
        },
        onError: (err) => setTestMsg({ ok: false, text: err.response?.data?.message || "Save failed" }),
    });

    const testMutation = useMutation({
        mutationFn: () => api.post("/company-settings/test-smtp"),
        onSuccess: () => setTestMsg({ ok: true, text: "Connection verified! Emails will send correctly." }),
        onError: (err) => setTestMsg({ ok: false, text: err.response?.data?.message || "Connection failed. Check your credentials." }),
    });

    const handleSave = () => {
        const payload = { smtpEmail: displayEmail, smtpFromName: displayFromName };
        if (password) payload.smtpPassword = password;
        saveMutation.mutate(payload);
    };

    if (!isAdmin) return null;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />
            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl">
                            <Mail className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Email Automation</h3>
                            <p className="text-xs text-gray-400">Gmail · Outlook · Yahoo</p>
                        </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isConfigured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                        {isConfigured ? "Connected" : "Not configured"}
                    </span>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                    Connect your business email to auto-send invoices, SLAs, and lead welcome emails directly from your own address using a <strong>16-digit App Password</strong> (no real password stored).
                </p>

                {/* How to get App Password */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> How to get a Gmail App Password
                    </p>
                    <ol className="text-xs text-amber-700 space-y-1 pl-4 list-decimal">
                        <li>Go to <strong>myaccount.google.com → Security</strong></li>
                        <li>Enable <strong>2-Step Verification</strong> if not already on</li>
                        <li>Search for <strong>"App passwords"</strong> in the search bar</li>
                        <li>Select app: <strong>Mail</strong> → Generate</li>
                        <li>Copy the <strong>16-character password</strong> and paste below</li>
                    </ol>
                </div>

                {/* Form */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Gmail Address</label>
                        <input
                            type="email"
                            placeholder="yourname@gmail.com"
                            value={displayEmail}
                            onChange={e => { setEmail(e.target.value); setDirty(true); setTestMsg(null); }}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            App Password <span className="text-gray-400 font-normal">(16 digits, no spaces)</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                placeholder={isConfigured ? "••••••••••••••••  (leave blank to keep current)" : "abcd efgh ijkl mnop"}
                                value={password}
                                onChange={e => { setPassword(e.target.value); setTestMsg(null); }}
                                className="w-full pr-10 pl-3 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600">
                                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Sender Name <span className="text-gray-400 font-normal">(appears in inbox)</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Acme Corp"
                            value={displayFromName}
                            onChange={e => { setFromName(e.target.value); setDirty(true); setTestMsg(null); }}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Feedback message */}
                {testMsg && (
                    <div className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl ${testMsg.ok
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                        {testMsg.ok
                            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                        {testMsg.text}
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending || (!displayEmail)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saveMutation.isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <CheckCircle2 className="h-4 w-4" />}
                        Save Credentials
                    </button>
                    {isConfigured && (
                        <button
                            onClick={() => { setTestMsg(null); testMutation.mutate(); }}
                            disabled={testMutation.isPending}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-indigo-200 text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                        >
                            {testMutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Send className="h-4 w-4" />}
                            Test
                        </button>
                    )}
                </div>

                {/* What gets automated */}
                <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-indigo-800">What gets automated:</p>
                    <ul className="text-xs text-indigo-700 space-y-1">
                        {[
                            "Invoice emails — sent directly from your address with full details",
                            "SLA emails — PDF attachment from your domain",
                            "Lead welcome emails — auto-sent when a lead submits via webhook",
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                                <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-indigo-500" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

// ── Universal Webhook Banner ──────────────────────────────────────────────────
const UniversalWebhookBanner = ({ config, isAdmin, copied, onCopy, rotateMutation }) => {
    const isClientProd = !window.location.hostname.includes("localhost") && 
                         !window.location.hostname.includes("127.0.0.1") && 
                         !window.location.hostname.includes("::1");

    const hasProd = !!config?.prodWebhooks || isClientProd;
    const [env, setEnv] = useState(hasProd ? "prod" : "local");

    // Dynamically derive production URL if missing from backend config response
    let prodUrl = config?.prodWebhooks?.universal;
    if (!prodUrl && isClientProd) {
        const apiBase = api.defaults.baseURL || "";
        const base = apiBase.startsWith("http") 
            ? apiBase.replace(/\/api\/?$/, "") 
            : window.location.origin;
        prodUrl = `${base}/api/capture/leads/${config?.captureToken}`;
    }

    const localUrl = config?.localWebhooks?.universal;
    const activeUrl = env === "prod" ? prodUrl : localUrl;

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2.5 rounded-xl">
                        <Globe className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="font-bold">Universal Webhook</h2>
                        <p className="text-gray-400 text-xs">Send leads from any tool — Zapier, Make, n8n, or custom code</p>
                    </div>
                </div>

                {hasProd && (
                    <div className="flex gap-1 p-1 bg-white/10 rounded-lg">
                        <button
                            onClick={() => setEnv("prod")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${env === "prod" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Production
                        </button>
                        <button
                            onClick={() => setEnv("local")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${env === "local" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
                                }`}
                        >
                            Localhost
                        </button>
                    </div>
                )}
            </div>

            {activeUrl && (
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-3">
                        <code className={`flex-1 text-xs font-mono truncate ${env === "prod" ? "text-green-400" : "text-yellow-400"}`}>
                            {activeUrl}
                        </code>
                        <CopyButton text={activeUrl} id={`banner-${env}`} copied={copied} onCopy={onCopy} />
                    </div>
                    {env === "local" && (
                        <p className="text-xs text-amber-400">
                            ⚠ Localhost — for local testing only. Use Production URL for Meta Ads and Google Ads.
                        </p>
                    )}
                </div>
            )}

            {isAdmin && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        Token: <code className="text-gray-300 font-mono">{config?.captureToken?.slice(0, 16)}…</code>
                    </span>
                    <button
                        onClick={() => rotateMutation.mutate()}
                        disabled={rotateMutation.isPending}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${rotateMutation.isPending ? "animate-spin" : ""}`} />
                        Rotate token
                    </button>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
const Integrations = () => {
    const { user } = useAuth();
    const isAdmin = ADMIN_ROLES.includes(user?.role);
    const { copy, copied } = useCopy();
    const queryClient = useQueryClient();

    const [setupModal, setSetupModal] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResults, setSyncResults] = useState(null);

    const { data: config, isLoading } = useQuery({
        queryKey: ["capture-config"],
        queryFn: () => api.get("/capture/config").then(r => r.data),
        staleTime: 30_000,
    });

    const rotateMutation = useMutation({
        mutationFn: () => api.post("/capture/rotate"),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capture-config"] }),
    });

    const handleSync = async (integrationId) => {
        setIsSyncing(true);
        try {
            const res = await api.post(`/integrations/${integrationId}/google-sheets/sync`);
            toast.success("Sync finished!");
            setSyncResults(res.data.results);
            queryClient.invalidateQueries({ queryKey: ["capture-config"] });
        } catch (error) {
            toast.error(error.response?.data?.message || "Sync failed");
        } finally {
            setIsSyncing(false);
        }
    };

    const totalCaptured = config?.totalCaptured || 0;
    const integStats = config?.integrations || {};

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <>
            <div className="p-6 space-y-8 pb-16">

                {/* ── Header ── */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Lead Capture</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Auto-capture leads from any platform directly into your CRM
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                        <Zap className="h-4 w-4 text-indigo-600" />
                        {totalCaptured.toLocaleString()} leads auto-captured
                    </div>
                </div>

                {/* ── Universal Webhook Banner ── */}
                <UniversalWebhookBanner config={config} isAdmin={isAdmin} copied={copied} onCopy={copy} rotateMutation={rotateMutation} />

                {/* ── Source Stats ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {INTEGRATIONS.map(defn => {
                        const stats = integStats[defn.id];
                        return (
                            <div key={defn.id} className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center gap-3">
                                <div className={`bg-gradient-to-br ${defn.color} p-2 rounded-lg shrink-0`}>
                                    <defn.Icon />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-base font-bold text-gray-900">{(stats?.leadsCaptures || 0).toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 truncate leading-tight">{defn.name}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Lead Source Cards ── */}
                <div>
                    <h2 className="text-base font-bold text-gray-900 mb-4">Configure Lead Sources</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {INTEGRATIONS.map(defn => (
                            <IntegrationCard
                                key={defn.id}
                                defn={defn}
                                stats={integStats[defn.id]}
                                onSetup={() => setSetupModal(defn)}
                                handleSync={handleSync}
                                isSyncing={isSyncing}
                            />
                        ))}

                        <LinkCard
                            to="/integrations/meta-ads"
                            color="from-sky-500 to-cyan-500"
                            Icon={() => <BarChart2 className="h-6 w-6 text-white" />}
                            name="Meta Ads Dashboard"
                            subtitle="Campaigns & Analytics"
                            description="View your Meta ad campaigns, manage ad sets, and pull leads directly from your Facebook ad account."
                            label="Dashboard"
                            labelColor="bg-sky-100 text-sky-700"
                        />

                        <LinkCard
                            to="/integrations/gmail"
                            color="from-red-500 to-orange-500"
                            Icon={GmailIcon}
                            name="Gmail"
                            subtitle="Email Lead Capture"
                            description="Connect Gmail to auto-capture leads from inbound email enquiries. OAuth-based, no password stored."
                            label="Connect"
                            labelColor="bg-red-100 text-red-700"
                        />
                    </div>
                </div>

                {/* ── Email Automation ── */}
                <div>
                    <h2 className="text-base font-bold text-gray-900 mb-4">Email Automation</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        <EmailAutomationCard isAdmin={isAdmin} />
                    </div>
                </div>

                {/* ── How it works ── */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                    <h2 className="font-bold text-indigo-900 mb-5 flex items-center gap-2">
                        <Zap className="h-5 w-5" /> How Auto-Capture Works
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                        {[
                            { step: "1", title: "Lead fills a form", desc: "On your ad, landing page, Google form, or any connected source" },
                            { step: "2", title: "Webhook fires", desc: "Platform sends lead data to your unique CRM URL instantly" },
                            { step: "3", title: "Lead is created", desc: "Deduplicated by phone/email, tagged with source, and scored" },
                            { step: "4", title: "Auto-assigned", desc: "Routed to the least-busy sales rep — zero manual work" },
                        ].map(({ step, title, desc }) => (
                            <div key={step} className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-indigo-600 text-white text-sm font-bold rounded-full flex items-center justify-center shrink-0">
                                    {step}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-indigo-900">{title}</p>
                                    <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Setup Modal ── */}
            {setupModal && (
                <SetupModal
                    defn={setupModal}
                    config={config}
                    onClose={() => setSetupModal(null)}
                />
            )}

            {/* ── Sync Results Modal ── */}
            <Modal
                isOpen={!!syncResults}
                onClose={() => setSyncResults(null)}
                title="Sync Results"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{syncResults?.imported || 0}</div>
                            <div className="text-xs text-green-700 font-medium">Imported</div>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{syncResults?.skipped || 0}</div>
                            <div className="text-xs text-yellow-700 font-medium">Skipped</div>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{syncResults?.failed || 0}</div>
                            <div className="text-xs text-red-700 font-medium">Failed</div>
                        </div>
                    </div>

                    {syncResults?.sheetResults?.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Results by Sheet</h4>
                            <div className="space-y-1">
                                {syncResults.sheetResults.map((s, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                                        <span className="font-bold text-gray-700">{s.name}</span>
                                        <div className="flex items-center gap-2">
                                            {s.status === "Success" ? (
                                                <span className="text-green-600 font-black">{s.count} Leads</span>
                                            ) : (
                                                <span className="text-red-500 font-bold">{s.status}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {syncResults?.errors?.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">Errors (First 50):</h4>
                            <div className="bg-gray-50 rounded-lg border border-gray-200 p-2 max-h-48 overflow-y-auto">
                                <ul className="text-xs space-y-1 text-gray-600 font-mono">
                                    {syncResults.errors.map((error, idx) => (
                                        <li key={idx} className="border-b border-gray-100 last:border-0 pb-1">{error}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-700">
                            <p><strong>Note:</strong> If many rows failed, check if your Google Sheet headers match (e.g. "Name", "Phone", "Email"). Duplicate phone numbers are skipped automatically.</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setSyncResults(null)}
                        className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default Integrations;
