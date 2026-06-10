import React, { useEffect, useMemo, useRef, useState } from "react";
import Iridescence from "./Iridescence";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  AnimatePresence,
} from "framer-motion";
import _CountUp from "react-countup";
const CountUp = (_CountUp).default || _CountUp;
import {
  Sparkles, PhoneCall, Users, Workflow, MessageSquare,
  Zap, ShieldCheck, BarChart3, ArrowRight, Check, X,
  Phone, Trophy, Award, Star, TrendingUp, Activity,
  Database, Brain, Mic, ClipboardList, Headphones,
  Target, Crown, Mail, MessageCircle, Building2, Eye,
  ChevronRight, Sigma, GitBranch, LineChart,
  ChevronDown, Wifi, BellRing, CircleDot,
  Link2, Store, Facebook, Chrome, Linkedin,
  CalendarCheck, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

/* Landing actions shared by all sections (demo modal + navigation) */
const LandingActions = React.createContext({
  openDemo: () => {},
  goLogin: () => {},
  goPlatform: () => {},
});
const useLanding = () => React.useContext(LandingActions);

/* ═══════════════════════════════════════════════
   Pricing — single source of truth (exactly as defined in the
   project; no extra/invented numbers). Used by both calculators.
═══════════════════════════════════════════════ */
const ZENXAI_PRICE = 1499; // ₹ per user / month
const CRM_COST = { Bigin: 550, Freshsales: 999, HubSpot: 1800, Salesforce: 2100 };
const WHATSAPP_COST = { AiSensy: 500, Interakt: 1000, Wati: 1500 };
const TELEPHONY_COST = { Exotel: 606, Knowlarity: 1500, MyOperator: 2500 };
const INTEGRATION_PER_USER = 500;

/* Compute monthly figures from team size + chosen providers */
function computePricing(team, crm, wa, tel) {
  const individual =
    team * (CRM_COST[crm] + WHATSAPP_COST[wa] + TELEPHONY_COST[tel] + INTEGRATION_PER_USER);
  const zen = ZENXAI_PRICE * team;
  const savings = Math.max(0, individual - zen);
  const perUser = team ? Math.round(savings / team) : 0;
  return { individual, zen, savings, perUser };
}

/* ═══════════════════════════════════════════════
   Book Demo modal (ported from the previous landing)
═══════════════════════════════════════════════ */
function BookDemoModal({ onClose }) {
  const [form, setForm] = useState({ companyName: "", email: "", phone: "", date: "", time: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API_BASE}/api/demo-booking`, form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-brand px-7 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-extrabold text-white">Book Your Free Demo</h2>
              <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
                <CalendarCheck size={13} /> 45-minute personalised walkthrough
              </p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors mt-0.5">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-7 py-6">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Demo Booked!</h3>
              <p className="text-gray-500 text-sm mb-1">A confirmation email with calendar invite has been sent.</p>
              <p className="text-gray-400 text-xs mb-6">Our team will confirm the details shortly.</p>
              <button onClick={onClose} className="bg-gradient-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm">
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle size={15} /> {error}
                </div>
              )}
              {[
                { label: "Company Name", name: "companyName", type: "text", placeholder: "Your Company Ltd." },
                { label: "Business Email", name: "email", type: "email", placeholder: "you@company.com" },
                { label: "Phone Number", name: "phone", type: "tel", placeholder: "+91 9XXXXXXXXX" },
              ].map(({ label, name, type, placeholder }) => (
                <div key={name}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label} *</label>
                  <input
                    type={type} name={name} value={form[name]} onChange={handleChange} required
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-purple bg-gray-50 placeholder:text-gray-400"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Preferred Date", name: "date", type: "date", extra: { min: today } },
                  { label: "Preferred Time", name: "time", type: "time" },
                ].map(({ label, name, type, extra = {} }) => (
                  <div key={name}>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label} *</label>
                    <input
                      type={type} name={name} value={form[name]} onChange={handleChange} required {...extra}
                      className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-purple bg-gray-50"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <CalendarCheck size={12} /> A calendar invite will be sent to your email automatically.
              </p>
              <button
                type="submit" disabled={loading}
                className="w-full bg-gradient-brand text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <><Loader2 size={15} className="animate-spin" /> Booking...</> : "Book My Free Demo"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Motion presets
═══════════════════════════════════════════════ */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] },
  }),
};
/* ═══════════════════════════════════════════════
   Scroll progress bar
═══════════════════════════════════════════════ */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2.5px] origin-left z-[200]"
      style={{
        scaleX,
        background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)",
      }}
    />
  );
}

/* ═══════════════════════════════════════════════
   Floating particles
═══════════════════════════════════════════════ */
function ParticleField({ count = 18 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        size: Math.random() * 3.5 + 1.5,
        x: Math.random() * 100,
        y: Math.random() * 100,
        dur: Math.random() * 14 + 8,
        delay: Math.random() * 8,
      })),
    [count],
  );

  if (!mounted) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            left: `${p.x}%`, top: `${p.y}%`,
            background: "linear-gradient(135deg,#8b5cf6,#3b82f6)",
          }}
          animate={{ y: [-18, 18, -18], x: [-8, 8, -8], opacity: [0.08, 0.35, 0.08] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   3-D tilt card
═══════════════════════════════════════════════ */
function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-80, 80], [8, -8]), { stiffness: 280, damping: 28 });
  const rotY = useSpring(useTransform(x, [-80, 80], [-8, 8]), { stiffness: 280, damping: 28 });
  const scale = useSpring(1, { stiffness: 280, damping: 28 });

  function move(e) {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set(e.clientX - r.left - r.width / 2);
    y.set(e.clientY - r.top - r.height / 2);
    scale.set(1.025);
  }
  function leave() { x.set(0); y.set(0); scale.set(1); }

  return (
    <motion.div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      style={{ rotateX: rotX, rotateY: rotY, scale, transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════
   Spotlight card (cursor-tracked glow)
═══════════════════════════════════════════════ */
function SpotlightCard({ children, className = "" }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mx.set(clientX - left);
    my.set(clientY - top);
  }

  return (
    <div
      className={`group relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(320px circle at ${mx}px ${my}px, rgba(139,92,246,0.12), transparent 80%)`,
        }}
      />
      <div className="relative z-10 size-full">
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Glow Icon with pulse ring
═══════════════════════════════════════════════ */
function GlowIcon({ icon: Icon, colorClass = "text-brand-purple", bgClass = "bg-gradient-brand-soft", glow = false }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {glow && (
        <span className="absolute inset-0 rounded-xl bg-gradient-brand opacity-30 blur-md animate-glow-breathe" />
      )}
      <div className={`relative size-12 rounded-xl ${bgClass} grid place-items-center group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`size-6 ${colorClass}`} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Shared section header
═══════════════════════════════════════════════ */
function SectionHeader({ eyebrow, title, subtitle, center = true }) {
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""} mb-14`}>
      {eyebrow && (
        <motion.span
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.45 }}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-ink-soft"
        >
          <Sparkles className="size-3.5 text-brand-purple animate-glow-breathe" /> {eyebrow}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.65, delay: 0.06 }}
        className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink leading-[1.1]"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-4 text-base md:text-lg text-ink-soft"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Aurora blobs
═══════════════════════════════════════════════ */
function AuroraBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
      <div className="absolute -top-40 -left-32 w-[540px] h-[540px] rounded-full opacity-45 blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle at 30% 30%, #93c5fd, transparent 62%)", animationDuration: "18s" }} />
      <div className="absolute top-1/3 -right-32 w-[620px] h-[620px] rounded-full opacity-38 blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle, #c4b5fd, transparent 62%)", animationDelay: "-6s", animationDuration: "22s" }} />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-35 blur-3xl animate-aurora"
        style={{ background: "radial-gradient(circle, #a5f3fc, transparent 62%)", animationDelay: "-12s", animationDuration: "20s" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Buttons
═══════════════════════════════════════════════ */
function GradientButton({ children, className = "", as: Tag = "button", pulse = false, ...rest }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function onMove(e) {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set(e.clientX - r.left - r.width / 2);
    y.set(e.clientY - r.top - r.height / 2);
  }
  function onLeave() { x.set(0); y.set(0); }

  const tx = useSpring(useTransform(x, [-80, 80], [-5, 5]), { stiffness: 350, damping: 25 });
  const ty = useSpring(useTransform(y, [-40, 40], [-3, 3]), { stiffness: 350, damping: 25 });

  return (
    <motion.div style={{ x: tx, y: ty }} className="inline-block" onMouseMove={onMove} onMouseLeave={onLeave}>
      <Tag
        ref={ref}
        {...rest}
        className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-glow-lg hover:scale-[1.04] active:scale-[0.97] ${pulse ? "animate-pulse-glow" : ""} ${className}`}
      >
        {children}
      </Tag>
    </motion.div>
  );
}

function GhostButton({ children, className = "", as: Tag = "button", ...rest }) {
  return (
    <Tag
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full glass px-6 py-3 text-sm font-semibold text-ink transition-all hover:bg-white/90 hover:shadow-card hover:scale-[1.03] active:scale-[0.97] ${className}`}
    >
      {children}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════
   Navbar
═══════════════════════════════════════════════ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { openDemo, goLogin } = useLanding();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Use Cases", href: "#use-cases" },
    { label: "Contact", href: "#contact" },
  ];
  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? "py-2.5" : "py-4"}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className={`flex items-center justify-between rounded-2xl px-4 sm:px-6 py-3 transition-all duration-300 ${scrolled ? "glass-strong shadow-card" : "glass"}`}>
          <a href="#" className="flex items-center gap-3.5 group">
            <motion.img
              src="/zenxai.png"
              alt="ZenXAI CRM Logo"
              className="h-11 sm:h-12 w-auto object-contain drop-shadow-sm"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            />
            <span className="font-extrabold text-2xl tracking-tight text-ink uppercase flex items-center">
              ZENXAI <span className="text-gradient ml-2">CRM</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a key={l.href} href={l.href}
                className="relative text-sm font-medium text-ink-soft hover:text-ink transition-colors
                  after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:rounded-full
                  after:bg-gradient-brand after:transition-all after:duration-300 hover:after:w-full">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <GhostButton onClick={goLogin} className="!py-2 !px-4">Sign In</GhostButton>
            <GradientButton onClick={openDemo} className="!py-2 !px-4">
              Book Demo <ArrowRight className="size-4" />
            </GradientButton>
          </div>

          <button onClick={() => setOpen(!open)} aria-label="Menu" className="md:hidden p-2 glass rounded-xl">
            <div className="space-y-1.5">
              <motion.span animate={{ rotate: open ? 45 : 0, y: open ? 7 : 0 }} className="block h-0.5 w-5 bg-ink rounded-full" />
              <motion.span animate={{ opacity: open ? 0 : 1 }} className="block h-0.5 w-5 bg-ink rounded-full" />
              <motion.span animate={{ rotate: open ? -45 : 0, y: open ? -7 : 0 }} className="block h-0.5 w-5 bg-ink rounded-full" />
            </div>
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden mt-2 glass-strong rounded-2xl p-4 flex flex-col gap-3"
            >
              {links.map((l, i) => (
                <motion.a
                  key={l.href} href={l.href} onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="py-1.5 px-2 text-ink font-medium rounded-xl hover:bg-white/50 transition-colors"
                >
                  {l.label}
                </motion.a>
              ))}
              <div className="flex gap-2 pt-2 border-t border-white/50">
                <GhostButton onClick={() => { setOpen(false); goLogin(); }} className="flex-1 !py-2">Sign In</GhostButton>
                <GradientButton onClick={() => { setOpen(false); openDemo(); }} className="flex-1 !py-2">Book Demo</GradientButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

/* ═══════════════════════════════════════════════
   Hero background — animated aurora mesh
═══════════════════════════════════════════════ */
function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
      <Iridescence
        color={[0.62, 0.65, 0.95]}
        speed={0.6}
        amplitude={0.08}
        mouseReact={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.72 }}
      />
      {/* white wash so text is always legible */}
      <div className="absolute inset-0" style={{ background: "rgba(238,242,255,0.42)" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F5F7FF]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Hero live notification widget
═══════════════════════════════════════════════ */
const liveNotifs = [
  { icon: PhoneCall, text: "AI called Rohan · qualified", color: "text-blue-500", bg: "bg-blue-100/70" },
  { icon: MessageCircle, text: "WhatsApp sent to 24 leads", color: "text-emerald-500", bg: "bg-emerald-100/70" },
  { icon: Star, text: "Deal closed · ₹1.2L · Priya", color: "text-amber-500", bg: "bg-amber-100/70" },
  { icon: BellRing, text: "Hot lead idle 10m — AI nudge sent", color: "text-purple-500", bg: "bg-purple-100/70" },
];

function LiveFeed() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % liveNotifs.length), 2800);
    return () => clearInterval(t);
  }, []);
  const n = liveNotifs[idx];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-2.5"
      >
        <div className={`size-8 rounded-xl ${n.bg} grid place-items-center shrink-0`}>
          <n.icon className={`size-4 ${n.color}`} />
        </div>
        <span className="text-[13px] text-ink-soft font-medium">{n.text}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-500">
          <Wifi className="size-3" /> LIVE
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════
   Hero stat card
═══════════════════════════════════════════════ */
function StatCard({ v, suffix, label }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <TiltCard>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="glass-ultra rounded-2xl p-4 glow-border"
      >
        <div className="text-2xl md:text-3xl font-bold text-ink">
          {inView ? <CountUp end={v} duration={2} /> : 0}
          <span className="text-gradient">{suffix}</span>
        </div>
        <div className="text-xs mt-1 text-ink-soft font-medium leading-snug">{label}</div>
      </motion.div>
    </TiltCard>
  );
}

/* ═══════════════════════════════════════════════
   Hero dashboard (3-D floating)
═══════════════════════════════════════════════ */
function HeroDashboard() {
  return (
    <TiltCard className="relative h-[520px] md:h-[580px]">
      {/* Aurora glow behind */}
      <div aria-hidden className="absolute inset-0 bg-gradient-brand opacity-15 blur-3xl rounded-[3rem]" />

      {/* Main panel */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-4 glass-ultra rounded-3xl p-5 overflow-hidden"
      >
        {/* Window chrome */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-red-400 shadow-sm" />
            <span className="size-3 rounded-full bg-yellow-400 shadow-sm" />
            <span className="size-3 rounded-full bg-green-400 shadow-sm" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
            <CircleDot className="size-3 text-emerald-400 animate-pulse" /> ZenXAI Command Center
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { v: "₹4.8M", l: "Pipeline", up: "+18%" },
            { v: "1,284", l: "Leads", up: "+42%" },
            { v: "23.4%", l: "Conv.", up: "+5.2pt" },
          ].map((k) => (
            <motion.div
              key={k.l}
              whileHover={{ scale: 1.04 }}
              className="rounded-xl bg-white/80 border border-white/90 p-2.5 shadow-sm"
            >
              <div className="text-base font-bold text-ink">{k.v}</div>
              <div className="text-[9px] text-ink-soft uppercase tracking-wider">{k.l}</div>
              <div className="text-[9px] text-emerald-500 font-bold mt-0.5">{k.up}</div>
            </motion.div>
          ))}
        </div>

        {/* Live pipeline chart */}
        <div className="rounded-xl bg-white/80 border border-white/90 p-4 mb-3 shadow-sm">
          <div className="text-xs font-semibold text-ink-soft mb-2">Live pipeline</div>
          <svg viewBox="0 0 300 72" className="w-full h-16">
            <defs>
              <linearGradient id="h-line" x1="0" x2="1">
                <stop offset="0" stopColor="#3b82f6" />
                <stop offset="0.5" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id="h-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.25" />
                <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
              d="M0,55 C40,45 60,16 100,26 C140,36 160,12 200,22 C240,32 260,8 300,15 L300,72 L0,72 Z"
              fill="url(#h-fill)"
            />
            <motion.path
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
              d="M0,55 C40,45 60,16 100,26 C140,36 160,12 200,22 C240,32 260,8 300,15"
              fill="none" stroke="url(#h-line)" strokeWidth="2.5" strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Live feed */}
        <div className="rounded-xl bg-white/80 border border-white/90 p-3 shadow-sm">
          <div className="text-[10px] text-ink-soft font-semibold uppercase tracking-wider mb-2">Live activity</div>
          <LiveFeed />
        </div>
      </motion.div>

      {/* Floating card — outbound call */}
      <motion.div
        animate={{ y: [0, 16, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute -left-3 top-16 glass-ultra rounded-2xl p-3 shadow-card w-48 hidden sm:block"
      >
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-xl bg-gradient-brand grid place-items-center text-white shadow-glow-sm">
            <PhoneCall className="size-4" />
          </div>
          <div>
            <div className="text-[12px] font-bold text-ink">AI outbound call</div>
            <div className="text-[10px] text-ink-soft flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live now
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating card — conversion bars */}
      <motion.div
        animate={{ y: [0, -14, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
        className="absolute -right-3 bottom-24 glass-ultra rounded-2xl p-3 shadow-card w-52 hidden sm:block"
      >
        <div className="text-[10px] text-ink-soft uppercase tracking-wider mb-1.5">Conversion rate</div>
        <div className="flex items-end gap-1 h-11">
          {[22, 46, 34, 62, 52, 80, 92].map((h, i) => (
            <motion.div key={i}
              initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }}
              transition={{ delay: 1.2 + i * 0.07, duration: 0.65 }}
              className="flex-1 rounded-t bg-gradient-brand opacity-80"
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-ink-soft">Mon</span>
          <span className="text-[9px] font-bold text-emerald-500">+92% ↑</span>
        </div>
      </motion.div>

      {/* Floating card — leads count */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
        className="absolute left-1/2 -translate-x-1/2 -bottom-2 glass-ultra rounded-2xl px-5 py-2.5 shadow-card hidden sm:flex items-center gap-3"
      >
        <Brain className="size-5 text-brand-purple animate-glow-breathe" />
        <div>
          <div className="text-[11px] font-bold text-ink">AI processed 284 leads today</div>
          <div className="text-[10px] text-ink-soft">18 hot leads queued for human rep</div>
        </div>
      </motion.div>
    </TiltCard>
  );
}

/* ═══════════════════════════════════════════════
   Hero
═══════════════════════════════════════════════ */
function Hero() {
  const { openDemo, goLogin } = useLanding();
  const stats = [
    { v: 3,  suffix: "×",  label: "Conversion Uplift" },
    { v: 70, suffix: "%",  label: "Less Manual Work"  },
    { v: 30, suffix: "s",  label: "Lead Response Time"},
    { v: 24, suffix: "/7", label: "Automated Engagement" },
  ];

  return (
    <section className="relative pt-36 pb-24 md:pt-44 md:pb-32 overflow-hidden">
      <HeroBackground />
      <ParticleField count={20} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          {/* Eyebrow badge */}
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-ink-soft">
            <span className="size-2 rounded-full bg-gradient-brand animate-pulse" />
            Enterprise-Grade AI Sales Engine
          </motion.div>

          {/* Headline */}
          <motion.h1 initial="hidden" whileInView="show" viewport={{ once: true }} custom={1} variants={fadeUp}
            className="mt-5 text-4xl sm:text-5xl md:text-6xl lg:text-[4.2rem] font-bold tracking-tight leading-[1.04] text-ink">
            From Leads to Revenue.<br />
            <span className="text-gradient-shimmer">Fully Automated with AI.</span>
          </motion.h1>

          {/* Sub */}
          <motion.p initial="hidden" whileInView="show" viewport={{ once: true }} custom={2} variants={fadeUp}
            className="mt-6 text-lg text-ink-soft max-w-xl leading-relaxed">
            The AI-Powered Sales Operating System built for businesses that refuse to leave growth to chance.
          </motion.p>

          {/* CTAs */}
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} custom={3} variants={fadeUp}
            className="mt-8 flex flex-wrap gap-3">
            <GradientButton pulse onClick={openDemo}>Book Free Demo <ArrowRight className="size-4" /></GradientButton>
            <GhostButton onClick={goLogin}>Sign In</GhostButton>
          </motion.div>

          {/* Stats */}
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} custom={4} variants={fadeUp}
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => <StatCard key={s.label} {...s} />)}
          </motion.div>
        </div>

        <HeroDashboard />
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 cursor-default"
        animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-[10px] font-semibold tracking-widest text-ink-soft uppercase">Scroll</span>
        <ChevronDown className="size-4 text-ink-soft opacity-60" />
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Flow section (pipeline steps)
═══════════════════════════════════════════════ */
function FlowSection() {
  const steps = [
    { num: "01", icon: Target, title: "Capture Leads", desc: "Capture leads instantly from multiple channels.", colorClass: "text-blue-600", bgClass: "bg-blue-100/70", glow: "shadow-blue-200" },
    { num: "02", icon: PhoneCall, title: "AI Calls Instantly", desc: "Our AI agent calls leads within seconds.", colorClass: "text-emerald-600", bgClass: "bg-emerald-100/70", glow: "shadow-emerald-200" },
    { num: "03", icon: Brain, title: "Lead Qualification", desc: "AI qualifies leads and understands their needs.", colorClass: "text-indigo-600", bgClass: "bg-indigo-100/70", glow: "shadow-indigo-200" },
    { num: "04", icon: Users, title: "Auto Assignment", desc: "Qualified leads are auto-assigned to the right team.", colorClass: "text-orange-500", bgClass: "bg-orange-100/70", glow: "shadow-orange-200" },
    { num: "05", icon: MessageSquare, title: "Automated Follow-ups", desc: "Auto follow-ups via calls, SMS, and WhatsApp.", colorClass: "text-pink-500", bgClass: "bg-pink-100/70", glow: "shadow-pink-200" },
    { num: "06", icon: Trophy, title: "Lead Converted", desc: "More conversations. More meetings. More sales.", colorClass: "text-green-600", bgClass: "bg-green-100/70", glow: "shadow-green-200" },
  ];

  return (
    <section className="relative py-28 z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-ink mb-4"
          >
            From lead to conversion —{" "}
            <span className="text-gradient">all inside one system</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.15 }} className="text-lg text-ink-soft">
            Our AI-powered CRM handles every step so you can focus on closing more deals.
          </motion.p>
        </div>

        <div className="relative">
          {/* Dashed connector line */}
          <div className="absolute top-[3rem] left-[8%] right-[8%] hidden lg:block -z-10">
            <div className="w-full border-t-[1.5px] border-dashed border-brand-purple/20" />
            {/* Animated progress line */}
            <motion.div
              className="absolute top-0 left-0 h-[1.5px] bg-gradient-brand rounded-full"
              initial={{ width: "0%" }} whileInView={{ width: "100%" }}
              viewport={{ once: true }} transition={{ duration: 2.4, ease: "easeOut", delay: 0.3 }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-10 lg:gap-4 relative">
            {steps.map((s, i) => (
              <motion.div key={s.title}
                initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.55, delay: i * 0.13 }}
                className="flex flex-col items-center text-center relative group"
              >
                {/* Connector arrow */}
                {i < steps.length - 1 && (
                  <div className="absolute top-[3rem] -right-[1.2rem] hidden lg:block text-brand-purple/40 -translate-y-1/2 z-0">
                    <ChevronRight className="size-5" />
                  </div>
                )}

                {/* Circle with pulse ring */}
                <div className="relative mb-6 z-10">
                  {/* Pulse ring */}
                  <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100">
                    <span className={`absolute inset-0 rounded-full ${s.bgClass} animate-pulse-ring`} />
                  </span>
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={`size-24 rounded-full glass-ultra grid place-items-center shadow-lg ${s.glow} transition-shadow duration-300`}
                  >
                    <div className={`size-14 rounded-full ${s.bgClass} grid place-items-center`}>
                      <s.icon className={`size-6 ${s.colorClass}`} />
                    </div>
                  </motion.div>
                </div>

                {/* Badge */}
                <div className={`rounded-full ${s.bgClass} ${s.colorClass} px-3 py-1 text-[11px] font-bold mb-3 tracking-wide`}>
                  {s.num}
                </div>

                <h3 className="text-sm font-bold text-ink mb-1.5">{s.title}</h3>
                <p className="text-xs text-ink-soft leading-relaxed px-1">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Ecosystem — 5 tools
═══════════════════════════════════════════════ */
function Ecosystem() {
  const items = [
    { icon: Mic,          title: "Voice AI Sales Agent", desc: "Human-like AI calls, 24/7." },
    { icon: Phone,        title: "Telephony",            desc: "Built-in cloud calling stack." },
    { icon: Database,     title: "CRM",                  desc: "Native AI-first pipeline." },
    { icon: Workflow,     title: "Automations",          desc: "Visual workflow builder." },
    { icon: MessageCircle,title: "WhatsApp API",         desc: "Official Business API." },
  ];
  return (
    <section id="features" className="relative py-24 mesh-bg">
      <div className="mx-auto max-w-[85rem] px-4 sm:px-6">
        <SectionHeader
          eyebrow="Product ecosystem"
          title={<>The Power of <span className="text-gradient">5 Tools</span> Stitched Into One Platform</>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mt-10">
          {items.map((it, i) => (
            <motion.div key={it.title}
              initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.55, delay: i * 0.09 }}
            >
              <TiltCard>
                <SpotlightCard className="h-full glass-ultra rounded-[1.5rem] p-6 glow-border transition-all duration-300 hover:shadow-glow">
                  <div>
                    <motion.div
                      whileHover={{ rotate: [0, -8, 8, 0], scale: 1.12 }}
                      transition={{ duration: 0.4 }}
                      className="size-14 rounded-2xl bg-gradient-brand-soft grid place-items-center mb-5"
                    >
                      <it.icon className="size-6 text-brand-purple" strokeWidth={1.5} />
                    </motion.div>
                    <div className="font-bold text-ink text-[15px] mb-1.5">{it.title}</div>
                    <div className="text-[13px] text-ink-soft leading-relaxed">{it.desc}</div>
                  </div>
                </SpotlightCard>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   AI Sales Agent
═══════════════════════════════════════════════ */
function AgentSection() {
  const features = [
    { i: PhoneCall,     t: "Makes outbound calls to fresh leads",              c: "text-blue-600",   bg: "bg-blue-100/70" },
    { i: MessageCircle, t: "Sends WhatsApp messages with information",          c: "text-emerald-600",bg: "bg-emerald-100/70" },
    { i: ClipboardList, t: "Shares info about business, products & services",   c: "text-purple-600", bg: "bg-purple-100/70" },
    { i: Brain,         t: "Qualifies leads based on the conversation",         c: "text-pink-600",   bg: "bg-pink-100/70" },
    { i: Database,      t: "Updates CRM with stages, tags and AI summary",      c: "text-indigo-600", bg: "bg-indigo-100/70" },
    { i: Users,         t: "Assigns leads to human team members",               c: "text-orange-500", bg: "bg-orange-100/70" },
    { i: Target,        t: "Auto capturing from all sources",                   c: "text-rose-500",   bg: "bg-rose-100/70" },
    { i: Star,          t: "Intelligent lead nurturing sequences",              c: "text-amber-500",  bg: "bg-amber-100/70" },
    { i: Zap,           t: "Automatic lead follow-up at the right time",        c: "text-cyan-600",   bg: "bg-cyan-100/70" },
    { i: ShieldCheck,   t: "Comprehensive team management",                     c: "text-teal-600",   bg: "bg-teal-100/70" },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      <AuroraBlobs />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="ZenVoice AI"
          title={<><span className="text-gradient">ZenVoice</span> AI Sales Agent</>}
          subtitle="A tireless rep that calls, qualifies, and closes — synced to your CRM in real time."
        />
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.93 }} whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative flex justify-center items-center w-full p-4"
          >
            <img
              src="/agent-diagram.png"
              alt="ZenVoice AI Agent Ecosystem"
              className="w-full max-w-md lg:max-w-[110%] h-auto object-contain mix-blend-multiply transition-transform duration-700 hover:scale-[1.03]"
            />
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.t}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className="glass-ultra rounded-xl p-4 flex items-center gap-3 h-full glow-border cursor-default transition-shadow hover:shadow-card"
              >
                <motion.div
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.35 }}
                  className={`size-10 rounded-xl ${f.bg} grid place-items-center shrink-0`}
                >
                  <f.i className={`size-5 ${f.c}`} />
                </motion.div>
                <div className="text-[15px] font-semibold text-ink leading-snug">{f.t}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Pain points — dark section
═══════════════════════════════════════════════ */
function PainPoints() {
  const items = [
    { i: GitBranch, t: "Lead Leakage",   d: "Up to 80% of leads never receive a timely follow-up.",   stat: "80%", statLabel: "leads lost" },
    { i: ClipboardList, t: "Manual Follow-Ups", d: "Sales reps waste hours on repetitive tasks instead of closing.", stat: "3h", statLabel: "wasted daily" },
    { i: Eye, t: "Zero Visibility",    d: "Managers operate blind — no real-time data on pipeline.", stat: "0%", statLabel: "real-time view" },
    { i: TrendingUp, t: "Poor Conversions", d: "Low conversion rates because there's no intelligence guiding sales.", stat: "5-8%", statLabel: "avg conv. rate" },
  ];
  return (
    <section className="relative py-28 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-slate-900 via-indigo-950 to-[#F5F7FF] -z-10" />
      {/* Animated aurora mesh on dark bg */}
      <div className="absolute inset-0 -z-10">
        <motion.div
          animate={{ scale: [1, 1.3, 1], x: [0, -40, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, #06b6d4, transparent 70%)" }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <motion.span
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-white/70"
          >
            The reality
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.08 }}
            className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight"
          >
            Your Sales Team Is Fighting a{" "}
            <span className="text-gradient-shimmer">Losing Battle</span>
          </motion.h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it, i) => (
            <motion.div key={it.t}
              initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="glass-dark rounded-2xl p-6 transition-all duration-300 hover:shadow-glow"
            >
              <div className="size-12 rounded-xl bg-gradient-brand grid place-items-center mb-4 shadow-glow-sm">
                <it.i className="size-6 text-white" />
              </div>
              <div className="font-bold text-white text-2xl mb-0.5">{it.stat}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2 font-semibold">{it.statLabel}</div>
              <div className="font-semibold text-white">{it.t}</div>
              <div className="mt-1.5 text-sm text-white/65 leading-relaxed">{it.d}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   ROI Calculator
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   Price Calculator — near the top. Shows YOUR ZenXAI price
   (₹1499 / user / month) + savings, using the project's pricing.
═══════════════════════════════════════════════ */
function PriceCalculator() {
  const { goLogin } = useLanding();
  const [team, setTeam] = useState(5);
  const [crm, setCrm] = useState("Salesforce");
  const [wa, setWa] = useState("Wati");
  const [tel, setTel] = useState("Exotel");
  const { individual, zen, savings } = computePricing(team, crm, wa, tel);

  const pickers = [
    { label: "CRM Provider", val: crm, set: setCrm, opts: Object.keys(CRM_COST) },
    { label: "WhatsApp Provider", val: wa, set: setWa, opts: Object.keys(WHATSAPP_COST) },
    { label: "Telephony Provider", val: tel, set: setTel, opts: Object.keys(TELEPHONY_COST) },
  ];

  return (
    <section id="price-calculator" className="relative py-24 mesh-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Price calculator"
          title={<>Your ZenXAI <span className="text-gradient">Price</span></>}
          subtitle="Pick your team size and current tools to see exactly what ZenXAI costs — and what you save."
        />
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="glass-ultra rounded-3xl p-6 md:p-8">
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-ink-soft">
                  Team Size: <span className="text-ink font-bold">{team}</span> {team === 1 ? "user" : "users"}
                </label>
                <input type="range" min={1} max={50} value={team}
                  onChange={(e) => setTeam(+e.target.value)}
                  className="w-full mt-2 accent-brand-purple" />
              </div>
              {pickers.map((f) => (
                <div key={f.label}>
                  <label className="text-sm font-medium text-ink-soft block mb-2">{f.label}</label>
                  <div className="flex gap-2 flex-wrap">
                    {f.opts.map((o) => (
                      <motion.button key={o}
                        onClick={() => f.set(o)}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          f.val === o
                            ? "bg-gradient-brand text-white shadow-glow-sm"
                            : "bg-white border border-border text-ink-soft hover:border-brand-purple"
                        }`}
                      >
                        {o}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="flex flex-col gap-4">
            <motion.div
              key={zen}
              initial={{ scale: 0.96 }} animate={{ scale: 1 }}
              className="rounded-3xl bg-gradient-brand p-8 text-white shadow-glow"
            >
              <div className="text-sm opacity-90 font-medium">Your ZenXAI cost</div>
              <div className="text-5xl font-bold mt-1">
                ₹<CountUp end={zen} duration={1} separator="," preserveValue redraw={false} />
                <span className="text-lg font-medium opacity-80"> /mo</span>
              </div>
              <div className="mt-1 text-sm opacity-80">
                ₹{ZENXAI_PRICE.toLocaleString("en-IN")} / user / month · {team} {team === 1 ? "user" : "users"}
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 text-sm opacity-90">
                Billed annually: <span className="font-bold">₹<CountUp end={zen * 12} duration={1.3} separator="," preserveValue redraw={false} /></span>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-4">
              <TiltCard>
                <div className="gradient-border p-6 h-full">
                  <div className="text-xs uppercase tracking-wider text-ink-soft font-semibold">Separate tools</div>
                  <div className="mt-2 text-2xl font-bold text-ink">
                    ₹<CountUp end={individual} duration={1} separator="," preserveValue redraw={false} /><span className="text-sm font-medium text-ink-soft"> /mo</span>
                  </div>
                </div>
              </TiltCard>
              <TiltCard>
                <div className="gradient-border p-6 h-full">
                  <div className="text-xs uppercase tracking-wider text-ink-soft font-semibold">You save</div>
                  <div className="mt-2 text-2xl font-bold text-gradient">
                    ₹<CountUp end={savings} duration={1} separator="," preserveValue redraw={false} /><span className="text-sm font-medium text-ink-soft"> /mo</span>
                  </div>
                </div>
              </TiltCard>
            </div>

            <GradientButton onClick={goLogin} className="self-start">
              Get Started <ArrowRight className="size-4" />
            </GradientButton>
          </div>
        </div>
      </div>
    </section>
  );
}

function ROICalc() {
  const [team, setTeam] = useState(5);
  const [crm, setCrm] = useState("Salesforce");
  const [wa, setWa] = useState("Wati");
  const [tel, setTel] = useState("Exotel");
  const crmCost = CRM_COST;
  const waCost = WHATSAPP_COST;
  const telCost = TELEPHONY_COST;
  const { individual, zen, savings, perUser } = computePricing(team, crm, wa, tel);

  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="ROI calculator"
          title={<>See How Much You <span className="text-gradient">Save</span></>}
          subtitle="Compare patchwork tools vs the unified ZenXAI platform."
        />
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="glass-ultra rounded-3xl p-6 md:p-8">
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-ink-soft">
                  Team Size: <span className="text-ink font-bold">{team}</span>
                </label>
                <input type="range" min={1} max={50} value={team}
                  onChange={(e) => setTeam(+e.target.value)}
                  className="w-full mt-2 accent-brand-purple" />
              </div>
              {[
                { label: "CRM Provider",       val: crm, set: setCrm, opts: Object.keys(crmCost) },
                { label: "WhatsApp Provider",  val: wa,  set: setWa,  opts: Object.keys(waCost)  },
                { label: "Telephony Provider", val: tel, set: setTel, opts: Object.keys(telCost) },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-sm font-medium text-ink-soft block mb-2">{f.label}</label>
                  <div className="flex gap-2 flex-wrap">
                    {f.opts.map((o) => (
                      <motion.button key={o}
                        onClick={() => f.set(o)}
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          f.val === o
                            ? "bg-gradient-brand text-white shadow-glow-sm"
                            : "bg-white border border-border text-ink-soft hover:border-brand-purple"
                        }`}
                      >
                        {o}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: "Individual Tool Cost", v: individual, c: "text-ink" },
              { l: "ZenXAI Cost",          v: zen,        c: "text-gradient" },
              { l: "Monthly Savings",      v: savings,    c: "text-gradient" },
              { l: "Per User Savings",     v: perUser,    c: "text-ink" },
            ].map((k) => (
              <TiltCard key={k.l}>
                <div className="gradient-border p-6 h-full">
                  <div className="text-xs uppercase tracking-wider text-ink-soft font-semibold">{k.l}</div>
                  <div className={`mt-2 text-3xl font-bold ${k.c}`}>
                    ₹<CountUp end={k.v} duration={1} separator="," preserveValue redraw={false} />
                  </div>
                </div>
              </TiltCard>
            ))}
            <motion.div
              key={savings}
              initial={{ scale: 0.95 }} animate={{ scale: 1 }}
              className="col-span-2 rounded-2xl bg-gradient-brand p-6 text-white shadow-glow"
            >
              <div className="text-sm opacity-90 font-medium">Annual Savings</div>
              <div className="text-4xl font-bold mt-1">
                ₹<CountUp end={savings * 12} duration={1.4} separator="," preserveValue redraw={false} />
              </div>
              <div className="mt-2 text-xs opacity-70">Switching to ZenXAI All-in-One CRM</div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Market Gap
═══════════════════════════════════════════════ */
function MarketGap() {
  const trad = ["Static data storage", "Manual data entry", "Reactive workflows", "No AI engagement", "Limited visibility"];
  const zen  = ["AI-driven revenue engine", "Auto-captured everything", "Predictive automation", "Native AI sales agent", "Real-time command center"];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="The market gap"
          title={<>Why Traditional CRMs Are <span className="text-gradient">Failing You</span></>}
        />
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl p-7 bg-slate-50/80 border border-slate-200 backdrop-blur-sm"
          >
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Traditional CRM</div>
            <div className="text-2xl font-bold mt-2 text-slate-600">Stores your data</div>
            <ul className="mt-5 space-y-3">
              {trad.map((t) => (
                <li key={t} className="flex items-center gap-3 text-slate-500">
                  <span className="size-5 rounded-full bg-slate-200 grid place-items-center shrink-0">
                    <X className="size-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 32 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="gradient-border p-7 shadow-glow"
          >
            <div className="text-xs font-bold text-gradient uppercase tracking-wider">ZenXAI</div>
            <div className="text-2xl font-bold mt-2 text-ink">Creates revenue</div>
            <ul className="mt-5 space-y-3">
              {zen.map((t, i) => (
                <motion.li key={t}
                  initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.09 }}
                  className="flex items-center gap-3 text-ink"
                >
                  <span className="size-5 rounded-full bg-gradient-brand grid place-items-center shrink-0 shadow-glow-sm">
                    <Check className="size-3 text-white" />
                  </span>
                  {t}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mt-10 text-xl md:text-2xl font-semibold text-ink-soft"
        >
          Traditional CRMs store data.{" "}
          <span className="text-gradient font-bold">ZenXAI creates revenue.</span>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Solution
═══════════════════════════════════════════════ */
function Solution() {
  const cards = [
    { i: Brain,    t: "AI-Driven Intelligence",  d: "Models that learn your funnel and predict next-best-actions." },
    { i: Workflow, t: "End-to-End Automation",   d: "Capture → call → qualify → close, all without manual lift." },
    { i: BarChart3,t: "Revenue Visibility",      d: "Live forecasts, pipeline health, and risk scoring." },
  ];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="The solution"
          title={<>Not Just a CRM. <span className="text-gradient">An AI Sales Engine.</span></>}
        />
        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((c, i) => (
            <TiltCard key={c.t}>
              <motion.div
                initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                className="gradient-border p-7 h-full glow-border transition-shadow hover:shadow-glow"
              >
                <div className="size-12 rounded-xl bg-gradient-brand grid place-items-center mb-4 shadow-glow-sm">
                  <c.i className="size-6 text-white" />
                </div>
                <div className="text-lg font-bold text-ink">{c.t}</div>
                <div className="mt-1.5 text-ink-soft leading-relaxed">{c.d}</div>
              </motion.div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Core Features
═══════════════════════════════════════════════ */
function CoreFeatures() {
  return (
    <section id="use-cases" className="relative py-24 bg-white mesh-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.45 }}
            className="inline-block"
          >
            <span className="inline-block rounded-full bg-cyan-50 border border-cyan-100 px-4 py-1.5 text-xs font-bold tracking-widest uppercase text-cyan-600">
              CORE FEATURES
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65, delay: 0.06 }}
            className="mt-6 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1e293b] leading-[1.1]"
          >
            Everything You Need to Win
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-5 text-base md:text-lg text-slate-500"
          >
            A complete suite of intelligent tools built to capture, qualify, engage, and convert every lead.
          </motion.p>
        </div>

        <div className="space-y-10">
          {/* Block 1: Lead Management */}
          <motion.div 
            initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-start"
          >
            <div>
              <span className="inline-block rounded-full bg-cyan-50 border border-cyan-100 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-cyan-600 mb-4">
                CORE FEATURE
              </span>
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Lead Management — Capture Every Opportunity</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Leads arrive from Facebook, Google, your website, landing pages, inbound calls, and more. ZenXAI captures every single one instantly into one centralized, prioritized dashboard. No spreadsheets. No manual entry. No leads slipping through.
              </p>
              <div className="bg-cyan-50/50 border border-cyan-200 rounded-xl p-4">
                <p className="text-sm text-slate-700">
                  <span className="font-bold text-cyan-700">Key Advantage:</span> Multi-source capture API connects to 50+ lead channels with deduplication and instant assignment built in.
                </p>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white border border-cyan-100 rounded-xl p-5 shadow-sm">
                <Database className="size-5 text-cyan-500 mb-3" />
                <h4 className="font-bold text-slate-800 text-sm mb-1.5">Multi-Source Capture</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Facebook, Google, portals, website forms — all unified</p>
              </div>
              <div className="bg-white border border-cyan-100 rounded-xl p-5 shadow-sm">
                <CircleDot className="size-5 text-cyan-500 mb-3" />
                <h4 className="font-bold text-slate-800 text-sm mb-1.5">Centralised Dashboard</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Single view of all leads, statuses, and history</p>
              </div>
              <div className="bg-white border border-cyan-100 rounded-xl p-5 shadow-sm">
                <Zap className="size-5 text-cyan-500 mb-3" />
                <h4 className="font-bold text-slate-800 text-sm mb-1.5">Real-Time Tracking</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Instant notifications and live lead status updates</p>
              </div>
              <div className="bg-white border border-cyan-100 rounded-xl p-5 shadow-sm">
                <GitBranch className="size-5 text-cyan-500 mb-3" />
                <h4 className="font-bold text-slate-800 text-sm mb-1.5">Auto-Assignment</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Smart round-robin or rule-based allocation to reps</p>
              </div>
            </div>
          </motion.div>

          {/* Block 2: AI Lead Engagement */}
          <motion.div 
            initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-white border border-teal-200 rounded-[2rem] p-8 md:p-10 shadow-sm"
          >
            <span className="inline-block rounded-full bg-teal-50 border border-teal-100 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-teal-600 mb-5">
              WOW FEATURE #1
            </span>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">AI Lead Engagement — Your Sales Engine That Never Sleeps</h3>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed mb-8">
              ZenXAI's AI Engagement Layer triggers intelligent, personalised outreach the moment a lead enters the system — day or night, weekday or weekend.
            </p>
            <div className="grid md:grid-cols-3 gap-5">
              <div className="bg-white border border-teal-100 rounded-xl p-6 shadow-sm">
                <PhoneCall className="size-5 text-teal-500 mb-4" />
                <h4 className="font-bold text-slate-800 text-sm mb-2">AI-Triggered Calls</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Instant automated call attempts within seconds of lead capture — before your competitor even knows the lead exists.</p>
              </div>
              <div className="bg-white border border-teal-100 rounded-xl p-6 shadow-sm">
                <MessageCircle className="size-5 text-teal-500 mb-4" />
                <h4 className="font-bold text-slate-800 text-sm mb-2">Automated Nurturing</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Multi-touch nurture sequences across calls, WhatsApp, and SMS — tailored to each lead's behaviour and stage.</p>
              </div>
              <div className="bg-white border border-teal-100 rounded-xl p-6 shadow-sm">
                <Sparkles className="size-5 text-teal-500 mb-4" />
                <h4 className="font-bold text-slate-800 text-sm mb-2">Smart Follow-Ups</h4>
                <p className="text-xs text-slate-500 leading-relaxed">AI determines the optimal time and channel for every follow-up based on past engagement patterns.</p>
              </div>
            </div>
          </motion.div>

          {/* Block 3: AI Transcriber */}
          <motion.div 
            initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-slate-50/50 border border-blue-200 rounded-[2rem] p-8 md:p-10 shadow-sm"
          >
            <span className="inline-block rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-blue-600 mb-5">
              WOW FEATURE #2
            </span>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">AI Transcriber — Every Word. Instantly Captured.</h3>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed mb-8">
              ZenXAI automatically converts every sales call into a searchable, structured text transcript in real time. No manual note-taking. Every conversation becomes a permanent, analysable asset.
            </p>
            <div className="grid md:grid-cols-3 gap-5">
              <div className="bg-white border border-blue-100 rounded-xl p-6 shadow-sm">
                <Mic className="size-5 text-blue-500 mb-4" />
                <h4 className="font-bold text-slate-800 text-sm mb-2">Instant Transcription</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Calls are transcribed automatically the moment they end — available for review within seconds.</p>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl p-6 shadow-sm">
                <ClipboardList className="size-5 text-blue-500 mb-4" />
                <h4 className="font-bold text-slate-800 text-sm mb-2">Searchable Archives</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Search across thousands of calls by keyword, lead name, or topic — find any conversation in under 3 seconds.</p>
              </div>
              <div className="bg-white border border-blue-100 rounded-xl p-6 shadow-sm">
                <Brain className="size-5 text-blue-500 mb-4" />
                <h4 className="font-bold text-slate-800 text-sm mb-2">Training Intelligence</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Use real transcripts to coach underperforming reps and replicate top-performer techniques.</p>
              </div>
            </div>
          </motion.div>

          {/* Block 4: AI Call Analysis */}
          <motion.div 
            initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-[#0f172a] border border-[#1e293b] rounded-[2rem] p-8 md:p-10 shadow-lg"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-indigo-300 mb-5">
              <Zap className="size-3" /> WOW FEATURE #3 — THE GAME CHANGER
            </span>
            <h3 className="text-2xl font-bold text-white mb-3">AI Call Analysis — Intelligence That Transforms Sales</h3>
            <p className="text-sm text-slate-400 max-w-3xl leading-relaxed mb-8">
              Our proprietary AI Call Analysis engine goes beyond transcription to deliver deep behavioural and intent-based intelligence from every single sales conversation.
            </p>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-xl p-6">
                <Target className="size-5 text-indigo-400 mb-4" />
                <h4 className="font-bold text-slate-200 text-sm mb-2">Customer Intent Detection</h4>
                <p className="text-xs text-slate-400 leading-relaxed">AI identifies buying signals, objections, and urgency levels within the conversation — flagging hot prospects automatically.</p>
              </div>
              <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-xl p-6">
                <Brain className="size-5 text-indigo-400 mb-4" />
                <h4 className="font-bold text-slate-200 text-sm mb-2">Behaviour Insights</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Understand sentiment, hesitation patterns, and emotional cues to adapt your sales approach for each lead type.</p>
              </div>
              <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-xl p-6">
                <LineChart className="size-5 text-indigo-400 mb-4" />
                <h4 className="font-bold text-slate-200 text-sm mb-2">Sales Improvement Recs</h4>
                <p className="text-xs text-slate-400 leading-relaxed">AI generates personalised coaching recommendations for each rep based on their call patterns and conversion data.</p>
              </div>
              <div className="bg-[#1e293b]/50 border border-slate-700/50 rounded-xl p-6">
                <Star className="size-5 text-indigo-400 mb-4" />
                <h4 className="font-bold text-slate-200 text-sm mb-2">Conversation Scoring</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Every call receives an AI quality score — enabling objective, data-driven performance management at scale.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Command Center
═══════════════════════════════════════════════ */
function CommandCenter() {
  return (
    <section className="relative py-24 overflow-hidden">
      <AuroraBlobs />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Command center"
          title={<>Total Visibility. <span className="text-gradient">Zero Blind Spots.</span></>}
        />
        <motion.div
          initial={{ opacity: 0, y: 42 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7 }}
          className="glass-ultra rounded-3xl p-6 md:p-8 shadow-glow"
        >
          {/* KPI row */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            {[
              { l: "Pipeline",    v: "₹12.4M", t: "+18%", color: "text-blue-500" },
              { l: "Leads Today", v: "287",    t: "+42%", color: "text-purple-500" },
              { l: "AI Calls",    v: "1,420",  t: "+61%", color: "text-cyan-500" },
              { l: "Win Rate",    v: "23.4%",  t: "+5.2pts", color: "text-emerald-500" },
            ].map((k, i) => (
              <TiltCard key={k.l}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="rounded-2xl bg-white border border-border p-4 shadow-sm"
                >
                  <div className="text-xs uppercase text-ink-soft tracking-wider">{k.l}</div>
                  <div className="text-2xl font-bold mt-1 text-ink">{k.v}</div>
                  <div className={`text-xs mt-1 font-bold ${k.color}`}>{k.t}</div>
                </motion.div>
              </TiltCard>
            ))}
          </div>

          {/* Chart + alerts */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 rounded-2xl bg-white border border-border p-5">
              <div className="text-sm font-semibold text-ink-soft mb-3 flex items-center gap-2">
                <CircleDot className="size-3 text-emerald-400 animate-pulse" /> Live pipeline
              </div>
              <svg viewBox="0 0 600 140" className="w-full h-36">
                <defs>
                  <linearGradient id="cc1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0"  stopColor="#8b5cf6" stopOpacity="0.35" />
                    <stop offset="1"  stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="cc2" x1="0" x2="1">
                    <stop offset="0"   stopColor="#3b82f6" />
                    <stop offset="0.5" stopColor="#8b5cf6" />
                    <stop offset="1"   stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <motion.path
                  initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                  viewport={{ once: true }} transition={{ delay: 0.4 }}
                  d="M0,110 C80,90 140,32 220,52 C300,72 360,22 440,42 C520,62 560,22 600,32 L600,140 L0,140 Z"
                  fill="url(#cc1)"
                />
                <motion.path
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }} transition={{ duration: 2.2, ease: "easeOut" }}
                  d="M0,110 C80,90 140,32 220,52 C300,72 360,22 440,42 C520,62 560,22 600,32"
                  fill="none" stroke="url(#cc2)" strokeWidth="3" strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="rounded-2xl bg-white border border-border p-5">
              <div className="text-sm font-semibold text-ink-soft mb-3">AI alerts</div>
              <div className="space-y-2.5 mb-5">
                {[
                  { t: "3 hot leads idle 2h",     c: "bg-red-400",     label: "Urgent" },
                  { t: "Inbound spike: +28%",     c: "bg-emerald-400", label: "Good" },
                  { t: "Rep Asha · 5 deals at risk", c: "bg-amber-400", label: "Watch" },
                ].map((a) => (
                  <motion.div key={a.t}
                    initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span className={`size-2 rounded-full ${a.c} animate-pulse shrink-0`} />
                    <span className="text-ink flex-1">{a.t}</span>
                    <span className="text-[9px] font-bold text-ink-soft">{a.label}</span>
                  </motion.div>
                ))}
              </div>
              <div className="text-sm font-semibold text-ink-soft mb-2">Activity feed</div>
              <div className="space-y-1.5 text-xs text-ink-soft">
                <div className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-blue-400 shrink-0" />
                  AI called 42 new leads
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-purple-400 shrink-0" />
                  Rohan moved 3 deals to negotiation
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-emerald-400 shrink-0" />
                  WhatsApp campaign sent to 312
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   HR & Performance
═══════════════════════════════════════════════ */
function HRSection() {
  const cards = [
    { i: Activity, t: "Activity Tracking",    d: "Every call, message, and meeting auto-logged.",    chart: <MiniBars /> },
    { i: Award,    t: "Performance Scorecards",d: "AI scoring on quality, velocity, conversion.",    chart: <MiniRing pct={82} /> },
    { i: Brain,    t: "Coaching Intelligence", d: "Actionable cues from every conversation.",         chart: <MiniLine /> },
  ];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="HR & performance"
          title={<>Manage People With <span className="text-gradient">The Same Precision As Data</span></>}
        />
        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((c, i) => (
            <TiltCard key={c.t}>
              <motion.div
                initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="glass-ultra rounded-2xl p-6 glow-border h-full transition-shadow hover:shadow-glow"
              >
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-gradient-brand-soft grid place-items-center">
                    <c.i className="size-5 text-brand-purple" />
                  </div>
                  <div className="font-semibold text-ink">{c.t}</div>
                </div>
                <div className="mt-3 text-sm text-ink-soft">{c.d}</div>
                <div className="mt-5">{c.chart}</div>
              </motion.div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniBars() {
  const data = [30, 55, 40, 70, 55, 85, 65];
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((h, i) => (
        <motion.div key={i}
          initial={{ height: 0 }} whileInView={{ height: `${h}%` }}
          viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.65 }}
          className="flex-1 rounded-t bg-gradient-brand opacity-80"
        />
      ))}
    </div>
  );
}

function MiniRing({ pct }) {
  const c = 2 * Math.PI * 40;
  return (
    <div className="grid place-items-center h-24 relative">
      <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
        <circle cx="50" cy="50" r="40" stroke="#e5e7eb" strokeWidth="10" fill="none" />
        <defs>
          <linearGradient id="ring1" x1="0" x2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <motion.circle cx="50" cy="50" r="40" stroke="url(#ring1)" strokeWidth="10" fill="none"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          whileInView={{ strokeDasharray: `${(pct / 100) * c} ${c}` }}
          viewport={{ once: true }} transition={{ duration: 1.6, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute font-bold text-ink text-base">{pct}%</div>
    </div>
  );
}

function MiniLine() {
  return (
    <svg viewBox="0 0 200 80" className="w-full h-24">
      <defs>
        <linearGradient id="ml1" x1="0" x2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <motion.path
        initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
        viewport={{ once: true }} transition={{ duration: 1.8 }}
        d="M0,60 C40,40 60,68 100,38 C140,12 160,52 200,18"
        fill="none" stroke="url(#ml1)" strokeWidth="3" strokeLinecap="round"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   Analytics
═══════════════════════════════════════════════ */
function Analytics() {
  const items = [
    { i: BarChart3,   t: "Real-Time Dashboards" },
    { i: LineChart,   t: "Conversion Analytics" },
    { i: TrendingUp,  t: "Revenue Forecasting"  },
    { i: ClipboardList,t: "Custom Reports"      },
  ];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Analytics"
          title={<>Reports That <span className="text-gradient">Drive Decisions</span></>}
        />
        <div className="grid md:grid-cols-4 gap-4">
          {items.map((a, i) => (
            <TiltCard key={a.t}>
              <motion.div
                initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.09 }}
                className="glass-ultra rounded-2xl p-6 glow-border transition-shadow hover:shadow-glow h-full"
              >
                <div className="size-11 rounded-xl bg-gradient-brand grid place-items-center mb-3 shadow-glow-sm">
                  <a.i className="size-5 text-white" />
                </div>
                <div className="font-semibold text-ink mb-4">{a.t}</div>
                <MiniBars />
              </motion.div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Gamification
═══════════════════════════════════════════════ */
function Gamification() {
  const board = [
    { n: "Aarav S.",  s: 9842, badge: "🥇", pct: 100 },
    { n: "Diya R.",   s: 8420, badge: "🥈", pct: 86  },
    { n: "Karan M.",  s: 7910, badge: "🥉", pct: 80  },
    { n: "Meera P.",  s: 7180, badge: "⭐", pct: 73  },
    { n: "Vikram T.", s: 6520, badge: "⭐", pct: 66  },
  ];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Gamification"
          title={<>Leaderboards & <span className="text-gradient">Gamification</span></>}
          subtitle="Drive your team with badges, points, and friendly competition."
        />
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 glass-ultra rounded-3xl p-6 shadow-glow">
            <div className="text-sm font-semibold text-ink-soft mb-4 flex items-center justify-between">
              <span>Q4 Leaderboard</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-bold">
                <CircleDot className="size-3 animate-pulse" /> Live
              </span>
            </div>
            <div className="space-y-2">
              {board.map((r, i) => (
                <motion.div key={r.n}
                  initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  whileHover={{ x: 4 }}
                  className={`flex items-center gap-4 p-3 rounded-2xl transition-colors ${
                    i === 0 ? "bg-gradient-brand-soft border border-brand-purple/20" : "bg-white/70 border border-border"
                  }`}
                >
                  <div className="text-2xl">{r.badge}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink text-sm">{r.n}</div>
                    <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} whileInView={{ width: `${r.pct}%` }}
                        viewport={{ once: true }} transition={{ duration: 1.4, delay: i * 0.1, ease: "easeOut" }}
                        className="h-full bg-gradient-brand"
                      />
                    </div>
                  </div>
                  <div className="font-bold text-ink tabular-nums text-sm">{r.s.toLocaleString()}</div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-2 gap-4 content-start">
            {[
              { i: Trophy, t: "Badges",     d: "Earn for milestones." },
              { i: Star,   t: "Rewards",    d: "Real prizes & perks." },
              { i: Crown,  t: "Ranks",      d: "Climb the ladder."    },
              { i: Target, t: "Challenges", d: "Weekly sprints."      },
            ].map((b, i) => (
              <TiltCard key={b.t}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.09 }}
                  className="glass-ultra rounded-2xl p-5 glow-border transition-shadow hover:shadow-glow"
                >
                  <b.i className="size-6 text-brand-purple animate-glow-breathe" />
                  <div className="mt-2 font-semibold text-ink">{b.t}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{b.d}</div>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Integrations
═══════════════════════════════════════════════ */
function Integrations() {
  const cards = [
    {
      i: Phone,
      color: "text-blue-600 bg-blue-50",
      t: "Telephony Integrations",
      d: "Connects with all major VoIP providers, IVR systems, and cloud telephony platforms.",
    },
    {
      i: MessageCircle,
      color: "text-emerald-600 bg-emerald-50",
      t: "WhatsApp Business API",
      d: "Official WhatsApp Business API integration — compliant, scalable, and ready for high-volume messaging.",
    },
    {
      i: Link2,
      color: "text-teal-600 bg-teal-50",
      t: "Open API & Webhooks",
      d: "Connect ZenXAI to your ERP, marketing automation, or any custom internal tool via robust REST APIs.",
    },
    {
      i: Store,
      color: "text-orange-600 bg-orange-50",
      t: "Lead Portals",
      d: "Native connectors for 99acres, MagicBricks, JustDial, Sulekha, Facebook Lead Ads, and Google Ads.",
    }
  ];

  const logos = [
    { name: "Facebook", i: Facebook, color: "text-blue-500" },
    { name: "Google Ads", i: Chrome, color: "text-red-500" },
    { name: "WhatsApp", i: MessageCircle, color: "text-emerald-500" },
    { name: "LinkedIn", i: Linkedin, color: "text-sky-500" },
    { name: "Telephony", i: Phone, color: "text-slate-400" },
  ];

  return (
    <section className="relative py-24 bg-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.45 }}
            className="inline-block"
          >
            <span className="inline-block rounded-full bg-cyan-50 border border-cyan-100 px-4 py-1.5 text-xs font-bold tracking-widest uppercase text-cyan-600">
              ECOSYSTEM
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65, delay: 0.06 }}
            className="mt-6 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1e293b] leading-[1.1]"
          >
            Plug ZenXAI Into Your Existing Stack — <span className="text-[#1e293b]">Seamlessly</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-5 text-base md:text-lg text-slate-500 max-w-2xl mx-auto"
          >
            ZenXAI is built to integrate, not replace. Our open API architecture connects with the tools your business already relies on.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((c, i) => (
            <motion.div key={c.t}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="bg-white rounded-3xl p-7 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`size-10 rounded-xl grid place-items-center mb-6 ${c.color}`}>
                <c.i className="size-5" />
              </div>
              <div className="font-bold text-[#1e293b] text-lg mb-3">{c.t}</div>
              <div className="text-sm text-slate-500 leading-relaxed">{c.d}</div>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ delay: 0.4 }}
          className="mt-16 flex flex-wrap justify-center items-center gap-8 sm:gap-12"
        >
          {logos.map((l) => (
            <div key={l.name} className="flex flex-col items-center gap-2 grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100">
              <l.i className={`size-6 ${l.color}`} />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{l.name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Before vs After
═══════════════════════════════════════════════ */
function BeforeAfter() {
  const before = ["Leads lost in spreadsheets", "Slow, manual calls", "No automated follow-up", "5–8% conversion rate"];
  const after  = ["Auto-captured leads instantly", "AI calls within 30 seconds", "Fully automated follow-ups", "18–25% conversion rate"];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Before vs After"
          title={<>The <span className="text-gradient">ZenXAI</span> Transformation</>}
        />
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl p-7 bg-slate-50/80 border border-slate-200"
          >
            <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Before ZenXAI</div>
            <div className="mt-2 text-2xl font-bold text-slate-600">Chaos & guesswork</div>
            <ul className="mt-5 space-y-3">
              {before.map((t) => (
                <li key={t} className="flex items-center gap-3 text-slate-500">
                  <X className="size-5 text-red-400 shrink-0" />{t}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 32 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="gradient-border p-7 shadow-glow"
          >
            <div className="text-xs uppercase tracking-wider text-gradient font-bold">After ZenXAI</div>
            <div className="mt-2 text-2xl font-bold text-ink">Predictable revenue</div>
            <ul className="mt-5 space-y-3">
              {after.map((t, i) => (
                <motion.li key={t}
                  initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 text-ink font-medium"
                >
                  <Check className="size-5 text-emerald-500 shrink-0" />{t}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Comparison table
═══════════════════════════════════════════════ */
function Comparison() {
  const rows = [
    { label: "Lead Response Time", t: "Hours to days", z: "Under 30 seconds" },
    { label: "Follow-Up Automation", t: "Manual reminders only", z: "Full AI-driven sequences" },
    { label: "Lead Qualification", t: "None", z: "Multi-layer AI scoring" },
    { label: "Call Analysis", t: "Not available", z: "AI intent + sentiment" },
    { label: "Voice AI Agents", t: "Not available", z: "Fully autonomous callers" },
    { label: "WhatsApp Chatbot", t: "Not available", z: "Official API integrated" },
    { label: "Performance Coaching", t: "Manager-dependent", z: "AI-generated recommendations" },
    { label: "24/7 Operation", t: "No", z: "Always on" },
  ];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow=""
          title={<>ZenXAI vs <span className="text-gradient">Traditional CRM</span></>}
          subtitle="There is simply no comparison."
        />
        <div className="glass-ultra rounded-3xl overflow-hidden shadow-glow">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center px-6 py-4 border-b border-border text-sm font-semibold text-ink-soft">
            <div>Capability</div>
            <div className="text-center">Traditional CRM</div>
            <div className="text-center font-bold text-ink">ZenXAI CRM</div>
          </div>
          {rows.map((row, i) => (
            <motion.div key={row.label}
              initial={{ opacity: 0, x: -22 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              whileHover={{ backgroundColor: "rgba(139,92,246,0.03)" }}
              className={`grid grid-cols-[1.4fr_1fr_1fr] items-center px-6 py-4 border-b border-border/60 text-sm ${i % 2 ? "bg-white/30" : ""}`}
            >
              <div className="font-medium text-ink">{row.label}</div>
              <div className="text-center text-slate-400">{row.t}</div>
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-600 px-3 py-1 font-semibold">
                  <Check className="size-4" /> {row.z}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Pricing
═══════════════════════════════════════════════ */
function Pricing() {
  return (
    <section id="pricing" className="relative py-24 bg-slate-50/50 mesh-bg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.45 }}
            className="inline-block"
          >
            <span className="inline-block rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-xs font-bold tracking-widest uppercase text-indigo-600">
              CHOOSE YOUR AI AGENT
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65, delay: 0.06 }}
            className="mt-6 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1e293b] leading-[1.1]"
          >
            Pick an <span className="text-indigo-600">AI Agent</span> that fits your sales process
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-5 text-base md:text-lg text-slate-500 max-w-2xl mx-auto"
          >
            From junior support to enterprise-grade sales automation — we've got you covered.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <motion.div
            initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0 }}
            className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col h-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="size-16 rounded-full bg-purple-50 flex items-center justify-center relative">
                <Users className="size-8 text-purple-500" />
                <div className="absolute -bottom-1 -right-1 size-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Star className="size-3.5 text-purple-500 fill-purple-500" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-purple-600">Junior</h3>
                <div className="text-slate-600 font-medium">Sales Agent</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-800">₹4,999<span className="text-sm font-medium text-slate-500">/mo</span></div>
              </div>
            </div>
            
            <div className="mb-8 flex justify-center">
              <span className="bg-purple-50 text-purple-600 text-xs font-bold px-3 py-1 rounded-full">
                Great for getting started
              </span>
            </div>

            <div className="flex items-center justify-between mb-8 relative">
              <div className="absolute top-6 left-8 right-8 h-px bg-slate-200 -z-10" />
              <div className="absolute top-[21px] left-10 right-10 flex justify-around -z-10 text-slate-300">
                <ArrowRight className="size-4" />
                <ArrowRight className="size-4" />
              </div>
              
              <div className="flex flex-col items-center text-center w-1/3 z-10 bg-white">
                <div className="size-12 rounded-full bg-purple-50 flex items-center justify-center mb-2 shadow-sm border border-purple-100/50">
                  <Phone className="size-5 text-purple-600" />
                </div>
                <div className="text-xs font-bold text-slate-800">Makes Calls</div>
                <div className="text-[10px] text-slate-500">to new leads</div>
              </div>
              
              <div className="flex flex-col items-center text-center w-1/3 z-10 bg-white">
                <div className="size-12 rounded-full bg-purple-50 flex items-center justify-center mb-2 shadow-sm border border-purple-100/50">
                  <Users className="size-5 text-purple-600" />
                </div>
                <div className="text-xs font-bold text-slate-800">Qualifies</div>
                <div className="text-[10px] text-slate-500">basic info</div>
              </div>

              <div className="flex flex-col items-center text-center w-1/3 z-10 bg-white">
                <div className="size-12 rounded-full bg-purple-50 flex items-center justify-center mb-2 shadow-sm border border-purple-100/50">
                  <Headphones className="size-5 text-purple-600" />
                </div>
                <div className="text-xs font-bold text-slate-800">Escalates</div>
                <div className="text-[10px] text-slate-500">to team</div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full mb-6" />

            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-purple-50 flex items-center justify-center shrink-0 border border-purple-200">
                  <Check className="size-3 text-purple-600" />
                </div>
                <span className="text-sm text-slate-700">Acts as a <span className="font-bold">backup sales person</span></span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-purple-50 flex items-center justify-center shrink-0 border border-purple-200">
                  <Check className="size-3 text-purple-600" />
                </div>
                <span className="text-sm text-slate-700">Handles leads missed by the team</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-purple-50 flex items-center justify-center shrink-0 border border-purple-200">
                  <Check className="size-3 text-purple-600" />
                </div>
                <span className="text-sm text-slate-700">Basic lead qualification</span>
              </li>
            </ul>

            <div className="bg-purple-50 rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-semibold text-purple-700">
              <Star className="size-4 fill-purple-700" />
              Must have for all sales teams
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-8 border border-blue-100 shadow-md flex flex-col h-full transform lg:-translate-y-2 relative"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="size-16 rounded-full bg-blue-50 flex items-center justify-center relative">
                <Users className="size-8 text-blue-500" />
                <div className="absolute -bottom-1 -right-1 size-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Star className="size-3.5 text-blue-500 fill-blue-500" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-blue-600">Senior</h3>
                <div className="text-slate-600 font-medium">Sales Agent</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-800">₹9,999<span className="text-sm font-medium text-slate-500">/mo</span></div>
              </div>
            </div>
            
            <div className="mb-8 flex justify-center">
              <span className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1 rounded-full">
                Best for growing teams
              </span>
            </div>

            <div className="flex items-center justify-between mb-8 relative">
              <div className="absolute top-6 left-6 right-6 h-px bg-slate-200 -z-10" />
              <div className="absolute top-[21px] left-8 right-8 flex justify-around -z-10 text-slate-300">
                <ArrowRight className="size-4" />
                <ArrowRight className="size-4" />
                <ArrowRight className="size-4" />
              </div>
              
              <div className="flex flex-col items-center text-center w-1/4 z-10 bg-white">
                <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center mb-2 shadow-sm border border-blue-100/50">
                  <Phone className="size-5 text-blue-600" />
                </div>
                <div className="text-[11px] font-bold text-slate-800">Makes Calls</div>
                <div className="text-[9px] text-slate-500">to new leads</div>
              </div>
              
              <div className="flex flex-col items-center text-center w-1/4 z-10 bg-white">
                <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center mb-2 shadow-sm border border-blue-100/50">
                  <MessageSquare className="size-5 text-blue-600" />
                </div>
                <div className="text-[11px] font-bold text-slate-800">Qualifies</div>
                <div className="text-[9px] text-slate-500">& engages</div>
              </div>

              <div className="flex flex-col items-center text-center w-1/4 z-10 bg-white">
                <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center mb-2 shadow-sm border border-blue-100/50">
                  <Activity className="size-5 text-blue-600" />
                </div>
                <div className="text-[11px] font-bold text-slate-800">Books</div>
                <div className="text-[9px] text-slate-500">meetings</div>
              </div>

              <div className="flex flex-col items-center text-center w-1/4 z-10 bg-white">
                <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center mb-2 shadow-sm border border-blue-100/50">
                  <Users className="size-5 text-blue-600" />
                </div>
                <div className="text-[11px] font-bold text-slate-800">Assigns</div>
                <div className="text-[9px] text-slate-500">to team</div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full mb-6" />

            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                  <Check className="size-3 text-blue-600" />
                </div>
                <span className="text-sm text-slate-700">Acts as the <span className="font-bold">first sales person</span></span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                  <Check className="size-3 text-blue-600" />
                </div>
                <span className="text-sm text-slate-700">Calls all fresh leads</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                  <Check className="size-3 text-blue-600" />
                </div>
                <span className="text-sm text-slate-700">Qualifies & books meetings</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                  <Check className="size-3 text-blue-600" />
                </div>
                <span className="text-sm text-slate-700">Assigns qualified leads to the team</span>
              </li>
            </ul>

            <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-semibold text-blue-700">
              <Star className="size-4 fill-blue-700" />
              Most popular
            </div>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col h-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="size-16 rounded-full bg-green-50 flex items-center justify-center">
                <Crown className="size-8 text-green-600 fill-green-600/20" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-600">Enterprise</h3>
                <div className="text-slate-600 font-medium">Sales Agent</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-800">Custom</div>
              </div>
            </div>
            
            <div className="mb-8 flex justify-center">
              <span className="bg-green-50 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-100">
                Built for scale & performance
              </span>
            </div>

            <div className="flex items-center justify-between mb-8 relative">
              <div className="absolute top-6 left-4 right-4 h-px bg-slate-200 -z-10" />
              <div className="absolute top-[21px] left-6 right-6 flex justify-around -z-10 text-slate-300">
                <ArrowRight className="size-3.5" />
                <ArrowRight className="size-3.5" />
                <ArrowRight className="size-3.5" />
                <ArrowRight className="size-3.5" />
              </div>
              
              <div className="flex flex-col items-center text-center w-1/5 z-10 bg-white">
                <div className="size-10 rounded-full bg-green-50 flex items-center justify-center mb-2 shadow-sm border border-green-100/50">
                  <Phone className="size-4 text-green-700" />
                </div>
                <div className="text-[9px] font-bold text-slate-800">Makes Calls</div>
                <div className="text-[7px] text-slate-500">to new leads</div>
              </div>
              
              <div className="flex flex-col items-center text-center w-1/5 z-10 bg-white">
                <div className="size-10 rounded-full bg-green-50 flex items-center justify-center mb-2 shadow-sm border border-green-100/50">
                  <MessageSquare className="size-4 text-green-700" />
                </div>
                <div className="text-[9px] font-bold text-slate-800">Qualifies</div>
                <div className="text-[7px] text-slate-500">& nurtures</div>
              </div>

              <div className="flex flex-col items-center text-center w-1/5 z-10 bg-white">
                <div className="size-10 rounded-full bg-green-50 flex items-center justify-center mb-2 shadow-sm border border-green-100/50">
                  <ClipboardList className="size-4 text-green-700" />
                </div>
                <div className="text-[9px] font-bold text-slate-800">Follows Up</div>
                <div className="text-[7px] text-slate-500">automatically</div>
              </div>

              <div className="flex flex-col items-center text-center w-1/5 z-10 bg-white">
                <div className="size-10 rounded-full bg-green-50 flex items-center justify-center mb-2 shadow-sm border border-green-100/50">
                  <BarChart3 className="size-4 text-green-700" />
                </div>
                <div className="text-[9px] font-bold text-slate-800">Reports</div>
                <div className="text-[7px] text-slate-500">& analyzes</div>
              </div>

              <div className="flex flex-col items-center text-center w-1/5 z-10 bg-white">
                <div className="size-10 rounded-full bg-green-50 flex items-center justify-center mb-2 shadow-sm border border-green-100/50">
                  <Users className="size-4 text-green-700" />
                </div>
                <div className="text-[9px] font-bold text-slate-800">Assigns</div>
                <div className="text-[7px] text-slate-500">to team</div>
              </div>
            </div>

            <div className="h-px bg-slate-100 w-full mb-6" />

            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-green-50 flex items-center justify-center shrink-0 border border-green-200">
                  <Check className="size-3 text-green-600" />
                </div>
                <span className="text-sm text-slate-700">End-to-end sales automation</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-green-50 flex items-center justify-center shrink-0 border border-green-200">
                  <Check className="size-3 text-green-600" />
                </div>
                <span className="text-sm text-slate-700">Multi-channel engagement (Calls, WhatsApp, SMS)</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-green-50 flex items-center justify-center shrink-0 border border-green-200">
                  <Check className="size-3 text-green-600" />
                </div>
                <span className="text-sm text-slate-700">Smart follow-ups & nurturing</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 size-4 rounded-full bg-green-50 flex items-center justify-center shrink-0 border border-green-200">
                  <Check className="size-3 text-green-600" />
                </div>
                <span className="text-sm text-slate-700">Advanced analytics & CRM sync</span>
              </li>
            </ul>

            <div className="bg-green-50 rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-semibold text-green-800">
              <ShieldCheck className="size-4 fill-green-700 text-white" />
              Best for enterprise & high volume teams
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Timeline
═══════════════════════════════════════════════ */
function Timeline() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const lineH = useTransform(scrollYProgress, [0, 0.9], ["0%", "100%"]);

  const items = [
    { y: "2020–2022", t: "Cloud CRMs era",    d: "Data captured, but action stayed manual." },
    { y: "2023–2024", t: "Rise of LLMs",       d: "AI assistants help reps draft and summarize." },
    { y: "2025 — Now", t: "Autonomous agents", d: "AI calls, qualifies, and closes end-to-end." },
    { y: "2026+",      t: "Self-driving revenue", d: "Continuous optimization of the entire funnel." },
  ];

  return (
    <section ref={ref} className="relative py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="The AI revolution"
          title={<>The AI Revolution <span className="text-gradient">In Sales</span></>}
        />
        <div className="relative pl-10 md:pl-12">
          <div className="absolute left-3 md:left-4 top-0 bottom-0 w-px bg-border" />
          <motion.div
            className="absolute left-3 md:left-4 top-0 w-px bg-gradient-brand origin-top"
            style={{ height: lineH }}
          />
          {items.map((it, i) => (
            <motion.div key={it.y}
              initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }} transition={{ delay: i * 0.12 }}
              className="relative pb-12"
            >
              <span className="absolute -left-[34px] md:-left-[38px] top-1 size-4 rounded-full bg-gradient-brand shadow-glow-sm ring-4 ring-white animate-glow-breathe" />
              <div className="text-xs font-bold uppercase tracking-wider text-gradient">{it.y}</div>
              <div className="mt-1 text-2xl font-bold text-ink">{it.t}</div>
              <div className="mt-1 text-ink-soft">{it.d}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Final CTA
═══════════════════════════════════════════════ */
function FinalCTA() {
  const { openDemo, goLogin } = useLanding();
  const feats = ["Live in 7 Days", "Full Training Included", "Dedicated Support", "ROI Guarantee"];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[2.5rem] p-10 md:p-16 text-center"
        >
          {/* Background */}
          <div aria-hidden className="absolute inset-0 bg-gradient-brand opacity-96 -z-10" />

          {/* Animated aurora orbs */}
          <div aria-hidden className="absolute -top-40 -left-40 size-[500px] rounded-full bg-white/15 blur-3xl animate-aurora -z-10" />
          <div aria-hidden className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-cyan-300/20 blur-3xl animate-aurora -z-10" style={{ animationDelay: "-8s" }} />
          <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[300px] rounded-full bg-white/10 blur-2xl animate-blob -z-10" style={{ animationDelay: "-4s" }} />

          {/* Noise grain */}
          <div aria-hidden className="absolute inset-0 opacity-[0.06] mix-blend-overlay -z-10"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
          />

          <motion.h2
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight"
          >
            Let's Automate Your{" "}
            <span className="block md:inline">Sales Today</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="mt-4 text-white/80 text-lg max-w-xl mx-auto"
          >
            The only question left is: how much revenue are you willing to leave on the table while you wait?
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.25 }}
            className="mt-6 flex flex-wrap justify-center gap-2.5 text-white/85 text-sm font-medium"
          >
            {feats.map((f) => (
              <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 px-4 py-1.5 hover:bg-white/25 transition-colors">
                <Check className="size-3.5" />{f}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.35 }}
            className="mt-9 flex flex-wrap justify-center gap-3"
          >
            <motion.button
              onClick={openDemo}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-ink shadow-glow-lg hover:shadow-xl transition-all animate-pulse-glow"
            >
              Book Free Demo <ArrowRight className="size-4" />
            </motion.button>
            <motion.button
              onClick={goLogin}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/25 transition-all"
            >
              Sign In
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Footer
═══════════════════════════════════════════════ */
function Footer() {
  const { openDemo, goLogin, goPlatform } = useLanding();
  return (
    <footer id="contact" className="relative pt-16 pb-10 border-t border-border/60">
      {/* Glass backdrop */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-xl -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3.5">
              <img
                src="/zenxai.png"
                alt="ZenXAI CRM Logo"
                className="h-12 w-auto object-contain drop-shadow-sm"
              />
              <span className="font-extrabold text-2xl tracking-tight text-ink uppercase flex items-center">
                ZENXAI <span className="text-gradient ml-2">CRM</span>
              </span>
            </div>
            <p className="mt-4 text-ink-soft max-w-md leading-relaxed">
              The AI-Powered Sales Operating System built for businesses that refuse to leave growth to chance.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <GradientButton onClick={goLogin} className="!py-2 !px-4 text-sm">Get Started</GradientButton>
              <GhostButton onClick={openDemo} className="!py-2 !px-4 text-sm">Book a Free Demo</GhostButton>
              <GhostButton onClick={goLogin} className="!py-2 !px-4 text-sm">Sign In to Dashboard</GhostButton>
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-ink mb-3">Links</div>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li><a href="#features" className="hover:text-ink transition-colors">Features</a></li>
              <li><a href="#pricing"  className="hover:text-ink transition-colors">Pricing</a></li>
              <li><a href="#contact"  className="hover:text-ink transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-bold text-ink mb-3">Contact Us</div>
            <ul className="space-y-2 text-sm text-ink-soft">
              <li>
                <a href="mailto:hello@zenxai.io" className="flex items-center gap-2 hover:text-ink transition-colors">
                  <Mail className="size-4 text-brand-purple shrink-0" />hello@zenxai.io
                </a>
              </li>
              <li>
                <a href="tel:+919003103018" className="flex items-center gap-2 hover:text-ink transition-colors">
                  <Phone className="size-4 text-brand-purple shrink-0" />+91 9003103018
                </a>
              </li>
              <li>
                <a href="https://wa.me/919003103018" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-ink transition-colors">
                  <MessageCircle className="size-4 text-emerald-500 shrink-0" />WhatsApp: +91 9003103018
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-border/60 text-xs text-ink-soft">
          <div>© 2026 ZenXAI CRM by Hexite Technologies. All rights reserved.</div>
          <button onClick={goPlatform} className="hover:text-ink transition-colors font-medium">Owner Login</button>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════
   Page root
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   Preloader
═══════════════════════════════════════════════ */
function Preloader({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(() => onComplete(), 1000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-purple/5 to-cyan-400/5 -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-brand opacity-15 blur-[100px] rounded-full -z-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <div className="relative">
          <motion.img
            src="/zenxai.png"
            alt="ZenXAI CRM Logo"
            className="h-20 sm:h-24 w-auto object-contain drop-shadow-md relative z-10"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute inset-0 bg-brand-purple rounded-full opacity-0 blur-xl z-0"
            animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.4, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <span className="font-extrabold text-3xl sm:text-4xl tracking-tight text-ink uppercase flex items-center">
            ZENXAI <span className="text-gradient ml-2.5">CRM</span>
          </span>
          
          <div className="h-1.5 w-40 bg-slate-100 rounded-full overflow-hidden mt-3 shadow-inner">
            <motion.div 
              className="h-full bg-gradient-brand"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.0, ease: "easeInOut" }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ZenXAILanding() {
  const [loading, setLoading] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);
  const navigate = useNavigate();

  const actions = useMemo(() => ({
    openDemo: () => setDemoOpen(true),
    goLogin: () => navigate("/login"),
    goPlatform: () => navigate("/platform/login"),
  }), [navigate]);

  useEffect(() => {
    if (loading) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [loading]);

  return (
    <LandingActions.Provider value={actions}>
      <div className="zenxai-landing relative min-h-screen text-ink overflow-x-clip">
      <AnimatePresence mode="wait">
        {loading && <Preloader key="preloader" onComplete={() => setLoading(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {demoOpen && <BookDemoModal onClose={() => setDemoOpen(false)} />}
      </AnimatePresence>

      <ScrollProgress />
      <Navbar />
      <main>
        <Hero />
        <PriceCalculator />
        <FlowSection />
        <Ecosystem />
        <AgentSection />
        <PainPoints />
        <ROICalc />
        <MarketGap />
        <Solution />
        <CoreFeatures />
        <CommandCenter />
        <HRSection />
        <Analytics />
        <Gamification />
        <Integrations />
        <BeforeAfter />
        <Comparison />
        <Pricing />
        <Timeline />
        <FinalCTA />
      </main>
      <Footer />
      </div>
    </LandingActions.Provider>
  );
}
