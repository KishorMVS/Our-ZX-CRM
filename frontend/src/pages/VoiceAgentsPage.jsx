import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
    Mic, Phone, MessageSquare, Settings, Users, ArrowRight,
    CheckCircle2, Star, Shield, Zap, ChevronLeft, Loader2, X,
    PhoneCall, UserCheck, ArrowLeftRight
} from "lucide-react";

/* ──────────────────────────────── Plan Data ──────────────────────────────── */
const PLANS = [
    {
        key: "junior",
        title: "Junior",
        subtitle: "Sales Agent",
        price: 25000,
        avatar: "/junior-agent.png",
        gradient: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
        ringColor: "#c4b5fd",
        accentColor: "#7c3aed",
        badgeBg: "rgba(16,185,129,0.08)",
        badgeBorder: "rgba(16,185,129,0.25)",
        badgeColor: "#059669",
        badgeIcon: Star,
        badgeText: "Must have for all sales teams",
        description: "What it does",
        workflow: [
            { icon: PhoneCall, label: "Fresh\nlead", color: "#3b82f6" },
            { icon: Users, label: "Missed by\nteam", color: "#3b82f6" },
            { icon: UserCheck, label: "Jr. Agent\nCalls", color: "#16a34a" },
        ],
        features: [
            "Acts as a backup sales person",
            "Handles leads missed by team",
        ],
        featureBold: ["backup sales person", "missed by team"],
        ctaGradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    },
    {
        key: "senior",
        title: "Senior",
        subtitle: "Sales Agent",
        price: 40000,
        avatar: "/senior-agent.png",
        gradient: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
        ringColor: "#93c5fd",
        accentColor: "#2563eb",
        badgeBg: "rgba(37,99,235,0.08)",
        badgeBorder: "rgba(37,99,235,0.25)",
        badgeColor: "#2563eb",
        badgeIcon: Shield,
        badgeText: "Best for growing sales teams",
        description: "What it does",
        workflow: [
            { icon: PhoneCall, label: "Fresh\nlead", color: "#3b82f6" },
            { icon: Mic, label: "Sr. Agent\nCalls &\nqualifies", color: "#2563eb" },
            { icon: Users, label: "Assigns\nto team", color: "#16a34a" },
        ],
        features: [
            "Acts as the first sales person",
            "Calls all fresh leads and assigns to the team",
        ],
        featureBold: ["first sales person", "fresh leads and assigns to the team"],
        ctaGradient: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
    },
];

/* ───────────────────────────── Floating Icons ───────────────────────────── */
const FLOAT_ICONS = [
    { Icon: Phone, angle: -40, dist: 64 },
    { Icon: MessageSquare, angle: -90, dist: 60 },
    { Icon: Settings, angle: -140, dist: 64 },
    { Icon: Mic, angle: 30, dist: 60 },
    { Icon: Zap, angle: 160, dist: 62 },
];

/* ═══════════════════════════════ Component ═══════════════════════════════ */
export default function VoiceAgentsPage() {
    const navigate = useNavigate();
    const [buying, setBuying] = useState(null);          // "junior" | "senior" | null
    const [success, setSuccess] = useState(null);        // { plan, amount } | null
    const [countdown, setCountdown] = useState(5);
    const timerRef = useRef(null);

    /* ── Auto-redirect after success ──────────────────────────────────── */
    useEffect(() => {
        if (!success) return;
        setCountdown(5);
        timerRef.current = setInterval(() => {
            setCountdown((c) => {
                if (c <= 1) {
                    clearInterval(timerRef.current);
                    window.location.href = "https://voice.zenxai.io/login";
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [success]);

    /* ── Handle purchase ──────────────────────────────────────────────── */
    const handleBuy = async (planKey) => {
        setBuying(planKey);
        try {
            // 1. Create order on backend
            const { data } = await api.post("/payments/create-order", {
                plan: planKey,
                customerPhone: "9999999999",
            });

            // 2. Launch Cashfree checkout
            const cashfree = window.Cashfree({ mode: "sandbox" });

            cashfree.checkout({
                paymentSessionId: data.payment_session_id,
                redirectTarget: "_modal",
            }).then(async (result) => {
                if (result.error) {
                    console.error("Payment error:", result.error);
                    setBuying(null);
                    return;
                }
                if (result.paymentDetails) {
                    // 3. Verify on backend
                    try {
                        const verify = await api.post("/payments/verify", {
                            orderId: data.order_id,
                        });
                        if (verify.data.success) {
                            setSuccess({
                                plan: verify.data.plan,
                                amount: verify.data.amount,
                            });
                        }
                    } catch (e) {
                        console.error("Verification error:", e);
                    }
                }
                setBuying(null);
            });
        } catch (err) {
            console.error("Order creation failed:", err);
            setBuying(null);
        }
    };

    /* ═══════════════════════════════ Render ═══════════════════════════════ */
    return (
        <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 80 }}>

            {/* ── Back + Header ────────────────────────────────────────── */}
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 0" }}>
                <button
                    onClick={() => navigate("/dashboard")}
                    style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 12, fontWeight: 700, color: "#6366f1",
                        background: "none", border: "none", cursor: "pointer",
                        marginBottom: 16, padding: 0,
                    }}
                >
                    <ChevronLeft size={14} /> Back to Dashboard
                </button>

                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        color: "#fff", fontWeight: 800, fontSize: 10,
                        letterSpacing: 1.5, textTransform: "uppercase",
                        padding: "5px 12px", borderRadius: 16, marginBottom: 10,
                    }}>
                        <Mic size={12} /> AI Voice Agents
                    </div>
                    <h1 style={{
                        fontSize: 26, fontWeight: 900, color: "#0f172a",
                        lineHeight: 1.2, margin: 0,
                    }}>
                        Supercharge your sales with{" "}
                        <span style={{
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        }}>AI Voice Agents</span>
                    </h1>
                    <p style={{
                        fontSize: 13, color: "#64748b", marginTop: 8,
                        fontWeight: 500, maxWidth: 440, marginLeft: "auto", marginRight: "auto",
                    }}>
                        Choose the right agent for your team. Our AI makes calls, qualifies leads,
                        and never misses an opportunity.
                    </p>
                </div>
            </div>

            {/* ── Agent Cards ──────────────────────────────────────────── */}
            <div style={{
                maxWidth: 900, margin: "0 auto", padding: "0 24px",
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: 20,
            }}>
                {PLANS.map((plan) => (
                    <div
                        key={plan.key}
                        style={{
                            background: "#fff",
                            borderRadius: 18,
                            border: "1px solid #e2e8f0",
                            overflow: "hidden",
                            transition: "transform 0.25s, box-shadow 0.25s",
                            cursor: "default",
                            position: "relative",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px)";
                            e.currentTarget.style.boxShadow = "0 20px 60px rgba(99,102,241,0.12)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                        }}
                    >
                        {/* Avatar Hero Section */}
                        <div style={{
                            background: plan.gradient,
                            padding: "28px 20px 22px",
                            display: "flex", justifyContent: "center",
                            position: "relative", overflow: "hidden",
                        }}>
                            {/* Decorative circles */}
                            <div style={{
                                position: "absolute", top: -30, right: -30,
                                width: 120, height: 120, borderRadius: "50%",
                                background: "rgba(255,255,255,0.15)",
                            }} />
                            <div style={{
                                position: "absolute", bottom: -20, left: -20,
                                width: 80, height: 80, borderRadius: "50%",
                                background: "rgba(255,255,255,0.1)",
                            }} />

                            {/* Avatar ring + floating icons */}
                            <div style={{ position: "relative", width: 120, height: 120 }}>
                                {/* Outer ring */}
                                <div style={{
                                    width: 120, height: 120, borderRadius: "50%",
                                    border: `3px solid ${plan.ringColor}`,
                                    background: "rgba(255,255,255,0.5)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
                                }}>
                                    <img
                                        src={plan.avatar}
                                        alt={plan.title}
                                        style={{
                                            width: 104, height: 104, borderRadius: "50%",
                                            objectFit: "cover",
                                        }}
                                    />
                                </div>

                                {/* Floating icons */}
                                {FLOAT_ICONS.map(({ Icon, angle, dist }, i) => {
                                    const rad = (angle * Math.PI) / 180;
                                    const x = 60 + dist * Math.cos(rad) - 12;
                                    const y = 60 + dist * Math.sin(rad) - 12;
                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                position: "absolute",
                                                left: x, top: y,
                                                width: 24, height: 24,
                                                borderRadius: "50%",
                                                background: "#fff",
                                                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                animation: `floatBounce ${2 + i * 0.3}s ease-in-out infinite`,
                                            }}
                                        >
                                            <Icon size={11} color={plan.accentColor} />
                                        </div>
                                    );
                                })}

                                {/* Spark badge */}
                                <div style={{
                                    position: "absolute", bottom: -4, left: "50%",
                                    transform: "translateX(-50%)",
                                    width: 28, height: 28, borderRadius: "50%",
                                    background: "#fff",
                                    boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <Zap size={13} color={plan.accentColor} fill={plan.accentColor} />
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{ padding: "16px 20px 20px" }}>
                            {/* Title */}
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>
                                {plan.title}
                            </h2>
                            <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                                {plan.subtitle}
                            </p>

                            {/* "What it does" label */}
                            <p style={{
                                margin: "12px 0 8px", fontSize: 12, fontWeight: 800,
                                color: plan.accentColor, letterSpacing: 0.3,
                            }}>
                                {plan.description}
                            </p>

                            {/* Workflow row */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: 6,
                                background: "#f8fafc", borderRadius: 10,
                                padding: "10px 12px", marginBottom: 12,
                            }}>
                                {plan.workflow.map((step, idx) => (
                                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <div style={{
                                            display: "flex", flexDirection: "column", alignItems: "center",
                                            gap: 4, minWidth: 56,
                                        }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: "50%",
                                                background: step.color === "#16a34a"
                                                    ? "linear-gradient(135deg, #16a34a, #22c55e)"
                                                    : `linear-gradient(135deg, ${step.color}, ${step.color}dd)`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                boxShadow: `0 3px 8px ${step.color}33`,
                                            }}>
                                                <step.icon size={14} color="#fff" />
                                            </div>
                                            <span style={{
                                                fontSize: 9, fontWeight: 700, color: "#475569",
                                                textAlign: "center", lineHeight: 1.2,
                                                whiteSpace: "pre-line",
                                            }}>
                                                {step.label}
                                            </span>
                                        </div>
                                        {idx < plan.workflow.length - 1 && (
                                            <ArrowRight size={12} color="#94a3b8" style={{ flexShrink: 0, marginTop: -12 }} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Feature bullets */}
                            <ul style={{
                                margin: "0 0 14px", padding: 0, listStyle: "none",
                                display: "flex", flexDirection: "column", gap: 5,
                            }}>
                                {plan.features.map((feat, i) => (
                                    <li key={i} style={{
                                        display: "flex", alignItems: "flex-start", gap: 6,
                                        fontSize: 12, color: "#334155", fontWeight: 500,
                                        lineHeight: 1.4,
                                    }}>
                                        <CheckCircle2
                                            size={14}
                                            color="#16a34a"
                                            style={{ flexShrink: 0, marginTop: 1 }}
                                        />
                                        <span dangerouslySetInnerHTML={{
                                            __html: feat.replace(
                                                new RegExp(`(${plan.featureBold[i]})`, "i"),
                                                "<strong>$1</strong>"
                                            ),
                                        }} />
                                    </li>
                                ))}
                            </ul>

                            {/* Badge */}
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                background: plan.badgeBg,
                                border: `1px solid ${plan.badgeBorder}`,
                                borderRadius: 8, padding: "5px 10px",
                                marginBottom: 14,
                            }}>
                                <plan.badgeIcon size={12} color={plan.badgeColor} fill={plan.badgeColor} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: plan.badgeColor }}>
                                    {plan.badgeText}
                                </span>
                            </div>

                            {/* Price + CTA */}
                            <div style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between", gap: 16,
                            }}>
                                <div>
                                    <span style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                                        ₹{plan.price.toLocaleString("en-IN")}
                                    </span>
                                    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginLeft: 3 }}>
                                        /one-time
                                    </span>
                                </div>
                                <button
                                    id={`buy-${plan.key}-agent`}
                                    disabled={buying !== null}
                                    onClick={() => handleBuy(plan.key)}
                                    style={{
                                        background: plan.ctaGradient,
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 10,
                                        padding: "10px 18px",
                                        fontSize: 12,
                                        fontWeight: 800,
                                        cursor: buying ? "not-allowed" : "pointer",
                                        display: "flex", alignItems: "center", gap: 8,
                                        opacity: buying && buying !== plan.key ? 0.5 : 1,
                                        transition: "all 0.2s",
                                        boxShadow: "0 4px 16px rgba(99,102,241,0.25)",
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!buying) e.currentTarget.style.transform = "scale(1.04)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "scale(1)";
                                    }}
                                >
                                    {buying === plan.key ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Processing…
                                        </>
                                    ) : (
                                        <>
                                            Buy {plan.title} Agent
                                            <ArrowRight size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Success Overlay ───────────────────────────────────────── */}
            {success && (
                <div style={{
                    position: "fixed", inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(8px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 9999, padding: 24,
                    animation: "fadeInOverlay 0.3s ease",
                }}>
                    <div style={{
                        background: "#fff",
                        borderRadius: 24,
                        padding: "48px 40px 36px",
                        maxWidth: 440,
                        width: "100%",
                        textAlign: "center",
                        boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
                        animation: "scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                        position: "relative",
                    }}>
                        {/* Close */}
                        <button
                            onClick={() => {
                                clearInterval(timerRef.current);
                                setSuccess(null);
                            }}
                            style={{
                                position: "absolute", top: 16, right: 16,
                                background: "#f1f5f9", border: "none",
                                borderRadius: "50%", width: 32, height: 32,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer",
                            }}
                        >
                            <X size={16} color="#64748b" />
                        </button>

                        {/* Animated checkmark */}
                        <div style={{
                            width: 88, height: 88, borderRadius: "50%",
                            background: "linear-gradient(135deg, #10b981, #34d399)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 24px",
                            boxShadow: "0 8px 32px rgba(16,185,129,0.3)",
                            animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
                        }}>
                            <CheckCircle2 size={44} color="#fff" strokeWidth={2.5} />
                        </div>

                        <h2 style={{
                            fontSize: 24, fontWeight: 900, color: "#0f172a",
                            margin: "0 0 8px", lineHeight: 1.2,
                        }}>
                            Payment Successful!
                        </h2>
                        <p style={{
                            fontSize: 15, color: "#475569", fontWeight: 500,
                            margin: "0 0 6px", lineHeight: 1.6,
                        }}>
                            You have successfully purchased
                        </p>
                        <p style={{
                            fontSize: 20, fontWeight: 800,
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            margin: "0 0 24px",
                        }}>
                            {success.plan}
                        </p>

                        {/* Amount badge */}
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            background: "#f0fdf4", border: "1px solid #bbf7d0",
                            borderRadius: 10, padding: "8px 16px", marginBottom: 28,
                        }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#16a34a" }}>
                                ₹{success.amount?.toLocaleString("en-IN")} paid
                            </span>
                        </div>

                        {/* Redirect countdown */}
                        <p style={{
                            fontSize: 12, color: "#94a3b8", fontWeight: 600,
                            marginBottom: 16,
                        }}>
                            Redirecting to Voice Portal in <strong style={{ color: "#6366f1" }}>{countdown}s</strong>
                        </p>

                        {/* Manual CTA */}
                        <a
                            href="https://voice.zenxai.io/login"
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 8,
                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                color: "#fff", fontSize: 14, fontWeight: 800,
                                padding: "14px 32px", borderRadius: 14,
                                textDecoration: "none",
                                boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.04)"}
                            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        >
                            Go to Voice Portal
                            <ArrowRight size={16} />
                        </a>
                    </div>
                </div>
            )}

            {/* ── Animations (injected via style tag) ──────────────────── */}
            <style>{`
                @keyframes floatBounce {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-6px); }
                }
                @keyframes fadeInOverlay {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.85); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.5); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
