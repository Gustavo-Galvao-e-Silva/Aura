import { useEffect, useRef, useState } from "react";
import { motion, useInView, useAnimationFrame, AnimatePresence } from "framer-motion";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";
import {
  ArrowRight, BarChart3, Calendar, Globe, Mail,
  Shield, TrendingUp, Waypoints, Zap,
} from "lucide-react";

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  maroon:  "#452829",
  gray:    "#57595B",
  rose:    "#E8D1C5",
  cream:   "#F3E8DF",
  cardBg:  "rgba(87,89,91,0.18)",
  border:  "rgba(232,209,197,0.12)",
  borderHover: "rgba(232,209,197,0.28)",
  muted:   "rgba(243,232,223,0.5)",
};

// ─── Aurora (actual ReactBits component — WebGL via OGL) ─────────────────────
const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {                               \
  int index = 0;                                                               \
  for (int i = 0; i < 2; i++) {                                                \
     ColorStop currentColor = colors[i];                                       \
     bool isInBetween = currentColor.position <= factor;                       \
     index = int(mix(float(index), float(i), float(isInBetween)));             \
  }                                                                            \
  ColorStop currentColor = colors[index];                                      \
  ColorStop nextColor = colors[index + 1];                                     \
  float range = nextColor.position - currentColor.position;                   \
  float lerpFactor = (factor - currentColor.position) / range;                \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor);          \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}`;

interface AuroraProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
}

function Aurora({ colorStops = ["#C4956A", "#F3E8DF", "#E8D1C5"], amplitude = 1.0, blend = 0.5, speed = 1.0 }: AuroraProps) {
  const propsRef = useRef<AuroraProps>({ colorStops, amplitude, blend, speed });
  propsRef.current = { colorStops, amplitude, blend, speed };
  const ctnDom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    (gl.canvas as HTMLCanvasElement).style.backgroundColor = "transparent";

    let program: Program | undefined;

    function resize() {
      if (!ctn) return;
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      if (program) program.uniforms.uResolution.value = [ctn.offsetWidth, ctn.offsetHeight];
    }
    window.addEventListener("resize", resize);

    const geometry = new Triangle(gl);
    if ((geometry as any).attributes.uv) delete (geometry as any).attributes.uv;

    const toStops = (stops: string[]) => stops.map(h => { const c = new Color(h); return [c.r, c.g, c.b]; });

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime:       { value: 0 },
        uAmplitude:  { value: amplitude },
        uColorStops: { value: toStops(colorStops) },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend:      { value: blend },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);
    resize();

    let id = 0;
    const tick = (t: number) => {
      id = requestAnimationFrame(tick);
      const p = propsRef.current;
      if (!program) return;
      program.uniforms.uTime.value = t * 0.001 * (p.speed ?? 1.0) * 0.1;
      program.uniforms.uAmplitude.value = p.amplitude ?? 1.0;
      program.uniforms.uBlend.value = p.blend ?? 0.5;
      program.uniforms.uColorStops.value = toStops(p.colorStops ?? colorStops);
      renderer.render({ scene: mesh });
    };
    id = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", resize);
      if (ctn && (gl.canvas as HTMLCanvasElement).parentNode === ctn) ctn.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ctnDom} className="w-full h-full" />;
}

// ─── ShinyText (actual ReactBits — framer-motion useAnimationFrame) ───────────
interface ShinyTextProps {
  text: string;
  speed?: number;
  color?: string;
  shineColor?: string;
  spread?: number;
  className?: string;
}

function ShinyText({
  text,
  speed = 2.5,
  color = C.rose,
  shineColor = C.cream,
  spread = 120,
  className = "",
}: ShinyTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useAnimationFrame((t) => {
    const p = ((t / 1000 / speed) % 1) * 100;
    if (ref.current) ref.current.style.backgroundPosition = `${150 - p * 2}% center`;
  });

  return (
    <span
      ref={ref}
      className={className}
      style={{
        background: `linear-gradient(${spread}deg, ${color} 0%, ${color} 40%, ${shineColor} 50%, ${color} 60%, ${color} 100%)`,
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
}

// ─── Magnet (actual ReactBits — pure CSS transform) ───────────────────────────
interface MagnetProps {
  children: React.ReactNode;
  padding?: number;
  magnetStrength?: number;
  disabled?: boolean;
  className?: string;
}

function Magnet({ children, padding = 80, magnetStrength = 3, disabled = false, className = "" }: MagnetProps) {
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) { setPos({ x: 0, y: 0 }); return; }
    const onMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const { left, top, width, height } = ref.current.getBoundingClientRect();
      const cx = left + width / 2;
      const cy = top + height / 2;
      const dx = Math.abs(cx - e.clientX);
      const dy = Math.abs(cy - e.clientY);
      if (dx < width / 2 + padding && dy < height / 2 + padding) {
        setActive(true);
        setPos({ x: (e.clientX - cx) / magnetStrength, y: (e.clientY - cy) / magnetStrength });
      } else {
        setActive(false);
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [padding, magnetStrength, disabled]);

  return (
    <div ref={ref} className={className} style={{ position: "relative", display: "inline-block" }}>
      <div
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          transition: active ? "transform 0.3s ease-out" : "transform 0.5s ease-in-out",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── SpotlightCard (adapted from ReactBits — CSS variable approach) ───────────
function SpotlightCard({
  children,
  className = "",
  style,
  spotlightColor = "rgba(232,209,197,0.14)",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  spotlightColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
    el.style.setProperty("--spotlight-color", spotlightColor);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={`card-spotlight ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// ─── BlobCursor ───────────────────────────────────────────────────────────────
function BlobCursor() {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [pointer, setPointer] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      setPointer(window.getComputedStyle(e.target as HTMLElement).cursor === "pointer");
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <>
      <motion.div
        className="fixed pointer-events-none z-[9999]"
        animate={{ x: pos.x - 20, y: pos.y - 20, scale: pointer ? 1.8 : 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        style={{ width: 40, height: 40 }}
      >
        <div className="w-full h-full rounded-full border" style={{ borderColor: `${C.rose}99` }} />
      </motion.div>
      <motion.div
        className="fixed pointer-events-none z-[9999]"
        animate={{ x: pos.x - 4, y: pos.y - 4 }}
        transition={{ type: "spring", stiffness: 800, damping: 40 }}
        style={{ width: 8, height: 8 }}
      >
        <div className="w-full h-full rounded-full" style={{ backgroundColor: C.cream }} />
      </motion.div>
    </>
  );
}

// ─── AnimatedContent ──────────────────────────────────────────────────────────
function AnimatedContent({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 44 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      {children}
    </motion.div>
  );
}

// ─── CountUp ──────────────────────────────────────────────────────────────────
function CountUp({ end, suffix = "" }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const t = setInterval(() => {
      frame++;
      setVal(Math.floor((frame / 60) * end));
      if (frame >= 60) { setVal(end); clearInterval(t); }
    }, 16);
    return () => clearInterval(t);
  }, [inView, end]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: TrendingUp, title: "Live FX Monitoring",          desc: "Real-time alerts across 150+ pairs. Time transfers for peak windows and save thousands on tuition." },
  { icon: Calendar,   title: "Smart Bill Scheduling",       desc: "Automated scheduling for tuition, rent, and bills. Zero missed payments, full currency visibility." },
  { icon: Waypoints,  title: "FX Route Optimizer",          desc: "AI scans Wise, Remitly, and Crebit in real time to route transfers through the cheapest path — up to 3% saved." },
  { icon: Shield,     title: "Blockchain Audit Trail",      desc: "Every AI recommendation is SHA-256 hashed on Stellar testnet — cryptographically verifiable proof of reason." },
  { icon: Zap,        title: "Stablecoin Payments",         desc: "Pay USD bills from BRL in seconds via USDC on Stellar. No SWIFT, no wait, no surprises." },
  { icon: BarChart3,  title: "AI Market Signal",            desc: "Aura's LLM agent synthesises BCB, FRED, and commodity data into a BULLISH / BEARISH signal with thesis." },
];

const STATS = [
  { end: 150, suffix: "+", label: "Currencies tracked" },
  { end: 3,   suffix: "%", label: "Avg. transfer savings" },
  { end: 2400, suffix: "+", label: "Annual USD saved per student" },
];

const STEPS = [
  { n: "01", title: "Deposit via Stripe",       desc: "Top up your Revellio wallet with a test card. Funds are credited after the Stripe webhook confirms." },
  { n: "02", title: "Aura recommends timing",   desc: "The AI agent synthesises BCB, FRED, and commodity prices into a BULLISH / BEARISH signal — wait or pay now." },
  { n: "03", title: "BRZ minted on Stellar",    desc: "You confirm. Revellio mints Mock-BRZ to your Stellar testnet account — fiat BRL is now on-chain." },
  { n: "04", title: "Swap → USDC → USD wire",   desc: "BRZ swapped for USDC on the Stellar DEX. Circle's off-ramp wires USD directly to the university. Bill marked paid." },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  function scrollTo(id: string) {
    if (id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const el = document.getElementById(id);
      if (!el) return;
      // offset by 64px (h-16 fixed navbar)
      const top = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  const heroVars = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };
  const heroItem = {
    hidden:   { opacity: 0, y: 36 },
    visible:  { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  };

  return (
    <div
      className="min-h-screen font-sans antialiased"
      style={{ background: C.maroon, color: C.cream, cursor: "none" }}
    >
      {/* Spotlight card CSS — injected once */}
      <style>{`
        .card-spotlight { position: relative; overflow: hidden; }
        .card-spotlight::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), var(--spotlight-color, rgba(232,209,197,0.14)), transparent 40%);
          opacity: 0;
          transition: opacity 0.35s;
          pointer-events: none;
          z-index: 1;
        }
        .card-spotlight:hover::before { opacity: 1; }
      `}</style>

      <BlobCursor />

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 z-50 w-full">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <button onClick={() => scrollTo("home")} className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.png" className="h-8 w-auto" alt="" />
            <span className="text-lg font-extrabold tracking-tight text-[#F3E8DF]">Revellio</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {[["Features", "features"], ["Solutions", "solutions"]].map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#F3E8DF]/55 transition-colors hover:bg-[#E8D1C5]/8 hover:text-[#F3E8DF]"
              >
                {label}
              </button>
            ))}

            <div className="mx-3 h-4 w-px shrink-0" style={{ background: C.border }} />

            <a
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-[#E8D1C5] transition-colors hover:text-[#F3E8DF]"
            >
              Log In
            </a>

            <a
              href="/login"
              className="ml-1 inline-flex items-center rounded-xl bg-[#E8D1C5] px-5 py-2 text-sm font-bold text-[#452829] transition-colors hover:bg-[#F3E8DF]"
            >
              Get Started
            </a>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="inline-flex items-center justify-center rounded-lg p-2 text-[#E8D1C5] transition-colors hover:bg-[#E8D1C5]/10 md:hidden"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden md:hidden"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              <div className="flex flex-col gap-1 px-4 py-3">
                <button onClick={() => { scrollTo("features"); setMenuOpen(false); }} className="rounded-lg px-4 py-2.5 text-left text-sm text-[#E8D1C5]/70 hover:text-[#E8D1C5]">Features</button>
                <button onClick={() => { scrollTo("solutions"); setMenuOpen(false); }} className="rounded-lg px-4 py-2.5 text-left text-sm text-[#E8D1C5]/70 hover:text-[#E8D1C5]">Solutions</button>
                <a href="/login" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#F3E8DF]">Log In</a>
                <a href="/login" className="mt-1 rounded-xl bg-[#E8D1C5] px-4 py-2.5 text-center text-sm font-bold text-[#452829]">Get Started</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16 pb-24">
        {/* Aurora WebGL background — dark palette so cream text stays readable */}
        <div className="absolute inset-0 pointer-events-none">
          <Aurora
            colorStops={["#57595B", "#7B3B2A", "#3D1F1F"]}
            amplitude={1.1}
            blend={0.5}
            speed={0.7}
          />
        </div>

        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(243,232,223,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(243,232,223,0.8) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Radial vignette — bottom fade to page bg */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 100% 80% at 50% 100%, ${C.maroon}ff 0%, transparent 65%)`,
          }}
        />

        {/* Dark scrim behind the text block so it never bleeds into the aurora */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% 40%, ${C.maroon}99 0%, transparent 100%)`,
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto max-w-4xl text-center"
            variants={heroVars}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div variants={heroItem} className="mb-8 inline-flex">
              <span
                className="inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.15em]"
                style={{
                  background: `${C.rose}18`,
                  border: `1px solid ${C.rose}40`,
                  color: C.rose,
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: C.rose }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: C.rose }} />
                </span>
                <ShinyText text="New — AI-powered FX & stablecoin payments" speed={3} color={C.rose} shineColor={C.cream} />
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroItem}
              className="mb-6 text-6xl font-black leading-[1.06] tracking-tight lg:text-8xl"
              style={{ color: C.cream }}
            >
              Global Finance,{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, ${C.rose} 0%, ${C.cream} 50%, ${C.rose} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Built for Students
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              variants={heroItem}
              className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed"
              style={{ color: C.muted }}
            >
              Revellio tracks live FX rates, schedules your tuition payments, and routes every transfer through the cheapest path — so you save more without thinking about it.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={heroItem} className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Magnet padding={60} magnetStrength={3}>
                <a
                  href="/login"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#E8D1C5] px-9 py-4 text-base font-bold text-[#452829] shadow-[0_0_40px_#E8D1C544] transition-all hover:bg-[#F3E8DF] hover:shadow-[0_0_60px_#F3E8DF55]"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <span className="relative flex items-center gap-2">Start for free <ArrowRight size={16} /></span>
                </a>
              </Magnet>
              <Magnet padding={60} magnetStrength={3}>
                <a
                  href="#features"
                  className="inline-flex items-center rounded-xl border border-[#E8D1C5]/25 px-9 py-4 text-base font-semibold text-[#E8D1C5] backdrop-blur-sm transition-all hover:border-[#E8D1C5]/60 hover:text-[#F3E8DF]"
                >
                  See features
                </a>
              </Magnet>
            </motion.div>
          </motion.div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="relative mx-auto mt-20 max-w-3xl"
          >
            <div
              className="absolute inset-x-16 -bottom-8 h-16 rounded-full blur-2xl"
              style={{ background: `${C.rose}30` }}
            />
            <div
              className="relative overflow-hidden rounded-2xl backdrop-blur-xl"
              style={{ background: `${C.gray}22`, border: `1px solid ${C.border}` }}
            >
              {/* Browser chrome */}
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: `1px solid ${C.border}`, background: `${C.maroon}66` }}
              >
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full" style={{ background: "#c0392b66" }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: "#f39c1266" }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: "#27ae6066" }} />
                </div>
                <span className="rounded-md px-3 py-1 text-xs font-mono" style={{ background: `${C.gray}33`, color: C.muted }}>
                  app.revellio.com/dashboard
                </span>
                <div className="w-16" />
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-4 p-5">
                {[
                  { label: "BRL/USD Rate", value: "5.41", sub: "↑ Favourable now", col: C.rose },
                  { label: "Balance",      value: "$2,400", sub: "↑ +$200 today",  col: C.cream },
                  { label: "Next Bill",    value: "14 days", sub: "↗ On track",    col: `${C.rose}bb` },
                ].map(card => (
                  <div key={card.label} className="rounded-xl p-4" style={{ background: `${C.gray}20`, border: `1px solid ${C.border}` }}>
                    <p className="mb-2 text-xs" style={{ color: C.muted }}>{card.label}</p>
                    <p className="text-2xl font-bold" style={{ color: card.col }}>{card.value}</p>
                    <p className="mt-1 text-xs" style={{ color: C.muted }}>{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Mini chart */}
              <div className="px-5 pb-5">
                <div className="rounded-xl p-4" style={{ background: `${C.gray}20`, border: `1px solid ${C.border}` }}>
                  <p className="mb-3 text-xs" style={{ color: C.muted }}>BRL/USD — 30 day trend</p>
                  <div className="flex items-end gap-1" style={{ height: 56 }}>
                    {[55,62,58,70,65,72,68,80,75,82,78,90,85,100].map((h, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{ background: `linear-gradient(to top, ${C.rose}, ${C.cream})`, opacity: 0.7, height: `${h}%`, transformOrigin: "bottom" }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.9 + i * 0.04, duration: 0.45, ease: "easeOut" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <section className="py-14" style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: `${C.gray}10` }}>
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STATS.map(({ end, suffix, label }, i) => (
              <AnimatedContent key={label} delay={i * 0.1} className="text-center">
                <p className="mb-1 text-5xl font-black" style={{ color: C.cream }}>
                  <CountUp end={end} suffix={suffix} />
                </p>
                <p className="text-sm" style={{ color: C.muted }}>{label}</p>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="py-32" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedContent className="mb-20 text-center">
            <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em]" style={{ color: C.rose }}>
              Platform capabilities
            </span>
            <h2 className="mb-4 text-4xl font-black tracking-tight lg:text-5xl" style={{ color: C.cream }}>
              Everything a student abroad needs,{" "}
              <span style={{
                background: `linear-gradient(135deg, ${C.rose}, ${C.cream})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>in one place</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg" style={{ color: C.muted }}>
              Built on live data from BCB, FRED, and Stellar — every recommendation is grounded in current market reality.
            </p>
          </AnimatedContent>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <AnimatedContent key={title} delay={i * 0.06}>
                <SpotlightCard
                  className="group h-full rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: C.cardBg,
                    border: `1px solid ${C.border}`,
                    backdropFilter: "blur(12px)",
                  } as React.CSSProperties}
                  spotlightColor={`${C.rose}20`}
                >
                  <div
                    className="mb-5 inline-flex rounded-xl p-3"
                    style={{
                      background: `${C.rose}18`,
                      border: `1px solid ${C.rose}30`,
                      boxShadow: `0 0 20px ${C.rose}20`,
                    }}
                  >
                    <Icon size={22} style={{ color: C.rose }} />
                  </div>
                  <h3 className="mb-3 text-lg font-bold" style={{ color: C.cream }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{desc}</p>
                </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="py-28" id="solutions" style={{ background: `${C.gray}0d` }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <AnimatedContent className="mb-16 text-center">
            <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em]" style={{ color: C.rose }}>
              The pipeline
            </span>
            <h2 className="text-4xl font-black tracking-tight lg:text-5xl" style={{ color: C.cream }}>
              Pay in BRL, land in USD —{" "}
              <span style={{
                background: `linear-gradient(135deg, ${C.rose}, ${C.cream})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>in under 30 seconds</span>
            </h2>
          </AnimatedContent>

          <div className="relative space-y-8">
            <div
              className="absolute left-6 top-0 hidden h-full w-px md:block"
              style={{ background: `linear-gradient(to bottom, transparent, ${C.rose}50, transparent)` }}
            />
            {STEPS.map(({ n, title, desc }, i) => (
              <AnimatedContent key={n} delay={i * 0.09}>
                <div className="flex gap-6 md:items-start">
                  <div
                    className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black"
                    style={{
                      background: `${C.rose}20`,
                      border: `1px solid ${C.rose}50`,
                      color: C.rose,
                      boxShadow: `0 0 18px ${C.rose}25`,
                    }}
                  >
                    {n}
                  </div>
                  <div className="pt-2">
                    <h3 className="mb-1.5 text-lg font-bold" style={{ color: C.cream }}>{title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{desc}</p>
                  </div>
                </div>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-28">
        <div className="mx-auto max-w-5xl px-4">
          <AnimatedContent>
            <div
              className="relative overflow-hidden rounded-3xl p-12 text-center lg:p-20"
              style={{
                background: `linear-gradient(135deg, #3a1e1e 0%, #2e1a1a 100%)`,
                border: `1px solid ${C.rose}30`,
                boxShadow: `0 0 80px ${C.rose}18`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${C.rose}22, transparent 65%)` }}
              />
              <div className="relative z-10">
                <span
                  className="mb-6 inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                  style={{ background: `${C.rose}18`, border: `1px solid ${C.rose}35`, color: C.rose }}
                >
                  Get started today — it&apos;s free
                </span>
                <h2 className="mb-6 text-4xl font-black lg:text-5xl" style={{ color: C.cream }}>
                  Stop leaving money on the{" "}
                  <span style={{
                    background: `linear-gradient(135deg, ${C.rose}, ${C.cream})`,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  }}>exchange table</span>
                </h2>
                <p className="mx-auto mb-10 max-w-xl text-lg" style={{ color: C.muted }}>
                  Join international students who time transfers with AI signals and settle bills via stablecoin rails.
                </p>
                <Magnet padding={80} magnetStrength={3}>
                  <a
                    href="/login"
                    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#E8D1C5] px-10 py-4 text-base font-bold text-[#452829] shadow-[0_0_50px_#E8D1C540] transition-all hover:bg-[#F3E8DF] hover:shadow-[0_0_70px_#F3E8DF50]"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative flex items-center gap-2">Start for free <ArrowRight size={16} /></span>
                  </a>
                </Magnet>
              </div>
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="pb-10 pt-16" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <img src="logo.png" className="h-10 w-auto" alt="Revellio" />
                <span className="text-xl font-extrabold" style={{ color: C.cream }}>Revellio</span>
              </div>
              <p className="max-w-sm text-sm" style={{ color: C.muted }}>
                AI-powered global finance for international students. Plan tuition, time FX conversions, and pay bills across borders with less stress.
              </p>
            </div>
            <div className="flex gap-3">
              {[Globe, Mail].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-all"
                  style={{ border: `1px solid ${C.border}`, color: C.muted }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = `${C.rose}60`; el.style.color = C.rose; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = C.border; el.style.color = C.muted; }}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
          <div className="pt-8 text-center text-xs" style={{ borderTop: `1px solid ${C.border}`, color: `${C.muted}` }}>
            © {new Date().getFullYear()} Revellio. Built for international students.
          </div>
        </div>
      </footer>
    </div>
  );
}
