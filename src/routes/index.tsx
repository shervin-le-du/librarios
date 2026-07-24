import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ScanLine, Sparkles, Wand2, Languages, Headphones,
  Bot, Share2, ShieldCheck, ArrowRight, Users, FileText,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;

    const { data: pa } = await supabase
      .from("platform_admins").select("id").eq("id", sess.session.user.id).maybeSingle();
    if (pa) throw redirect({ to: "/platform" });

    const { data: staff } = await supabase.rpc("get_current_staff");
    const me = (staff ?? [])[0];
    if (!me) throw redirect({ to: "/onboarding" });
    const { data: lib } = await supabase.from("libraries").select("subdomain").eq("id", me.library_id).maybeSingle();
    const slug = (lib as any)?.subdomain;
    if (slug) throw redirect({ to: "/$slug/app/dashboard", params: { slug } });
    throw redirect({ to: "/onboarding" });
  },
  head: () => ({
    meta: [
      { title: "LibrariOS — The AI operating system for libraries, worldwide" },
      { name: "description", content: "An AI-first, multilingual platform that runs every library on Earth: instant book scanning, autonomous cataloging agents, audio editions, translations, and reader-facing AI — on your own branded URL." },
      { property: "og:title", content: "LibrariOS — The AI operating system for libraries, worldwide" },
      { property: "og:description", content: "AI-first, multilingual library platform. Scan, catalog, translate, narrate, and lend — powered by autonomous agents." },
      { property: "og:url", content: "https://bibilio.lovable.app/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://bibilio.lovable.app/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "LibrariOS",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "AI-first, multilingual operating system for libraries worldwide.",
      }),
    }],
  }),
  component: HomePage,
});

function TopBar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-accent flex items-center justify-center">
            <div className="size-3.5 border-2 border-accent-foreground rounded-[3px]" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight uppercase">LibrariOS</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link to="/auth" className="text-muted-foreground hover:text-accent transition-colors">Sign in</Link>
          <Link to="/auth" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-all">
            Open your library
          </Link>
        </div>
        <Link to="/auth" className="md:hidden bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium">
          Open
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          AI-first · multilingual · worldwide
        </div>
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter mb-8 leading-[0.95]">
          The AI operating system
          <br />
          <span className="text-accent">for libraries, worldwide.</span>
        </h1>
        <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 font-light leading-relaxed">
          Human-first intelligence built to organize, protect, and amplify
          the world's collective knowledge — in any language, from any library.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/auth" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 bg-primary text-primary-foreground rounded-2xl font-semibold text-base hover:scale-[1.02] transition-transform">
            Open your library <ArrowRight className="size-4" />
          </Link>
          <Link to="/auth" className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-4 bg-card border border-border rounded-2xl font-semibold text-base hover:bg-card/60 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function AIBento() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-16 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Scan & auto-catalog — large */}
        <div className="md:col-span-8 bg-card rounded-[2rem] p-10 flex flex-col justify-between overflow-hidden relative group border border-border min-h-[360px]">
          <div className="relative z-10">
            <div className="size-12 bg-accent rounded-xl mb-6 flex items-center justify-center text-accent-foreground">
              <ScanLine className="size-6" />
            </div>
            <h3 className="font-display text-3xl font-bold mb-4 tracking-tight">Scan & auto-catalog</h3>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Photograph a cover or a whole shelf. AI extracts ISBN, author, edition,
              and writes the full record — including condition — in seconds.
            </p>
          </div>
          <div className="mt-10 -mb-10 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
            <div className="flex gap-4">
              <div className="w-48 h-32 bg-background/70 rounded-t-xl border border-border p-4 flex flex-col gap-2">
                <div className="h-2 w-1/2 bg-accent/30 rounded-full" />
                <div className="h-2 w-full bg-foreground/10 rounded-full" />
                <div className="h-2 w-3/4 bg-foreground/10 rounded-full" />
                <div className="h-2 w-2/3 bg-foreground/10 rounded-full mt-auto" />
              </div>
              <div className="w-48 h-32 bg-background/70 rounded-t-xl border border-border p-4 flex flex-col gap-2">
                <div className="h-2 w-1/3 bg-accent/30 rounded-full" />
                <div className="h-2 w-full bg-foreground/10 rounded-full" />
                <div className="h-2 w-2/3 bg-foreground/10 rounded-full" />
                <div className="h-2 w-1/2 bg-foreground/10 rounded-full mt-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Translations */}
        <div className="md:col-span-4 bg-card rounded-[2rem] p-8 border border-border flex flex-col">
          <div className="size-10 bg-primary rounded-lg mb-6 flex items-center justify-center text-primary-foreground">
            <Languages className="size-5" />
          </div>
          <h3 className="font-display text-xl font-bold mb-2">Real-time translations</h3>
          <p className="text-muted-foreground leading-relaxed">
            Catalog, descriptions, and reader chat localized into 100+ languages —
            no manual work, no plugins.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["EN", "ES", "FR", "AR", "ZH", "SW"].map((l, i) => (
              <span key={l} className={`px-2.5 py-1 rounded-full text-xs font-bold ${i === 2 ? "bg-accent text-accent-foreground" : "bg-background border border-border"}`}>{l}</span>
            ))}
          </div>
        </div>

        {/* Social — dark tile */}
        <div className="md:col-span-4 bg-primary rounded-[2rem] p-8 text-primary-foreground flex flex-col">
          <div className="size-10 bg-accent rounded-lg mb-6 flex items-center justify-center text-accent-foreground">
            <Share2 className="size-5" />
          </div>
          <h3 className="font-display text-xl font-bold mb-2">Social post generation</h3>
          <p className="text-primary-foreground/60 leading-relaxed">
            New arrivals, events, reading lists — turned into ready-to-publish posts
            in your library's voice.
          </p>
        </div>

        {/* Agents — wide */}
        <div className="md:col-span-8 bg-card rounded-[2rem] p-10 border border-border flex flex-col md:flex-row gap-8 items-center min-h-[260px]">
          <div className="flex-1">
            <div className="size-12 bg-accent/15 text-accent rounded-xl mb-6 flex items-center justify-center">
              <Bot className="size-6" />
            </div>
            <h3 className="font-display text-3xl font-bold mb-4 tracking-tight">Agents for every library</h3>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Dedicated agents per topic and per library. They learn your collection,
              your community, and answer readers in natural language.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="size-24 bg-accent/5 rounded-2xl flex items-center justify-center border border-accent/20">
              <div className="w-10 h-1 bg-accent rounded-full animate-pulse" />
            </div>
            <div className="size-24 bg-foreground/5 rounded-2xl flex items-center justify-center border border-border">
              <div className="size-8 rounded-full border-2 border-dashed border-foreground/20" />
            </div>
            <div className="size-24 bg-foreground/5 rounded-2xl flex items-center justify-center border border-border">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <div className="size-24 bg-accent/5 rounded-2xl flex items-center justify-center border border-accent/20">
              <div className="w-6 h-1 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Audiobooks */}
        <div className="md:col-span-4 bg-card rounded-[2rem] p-8 border border-border flex flex-col">
          <div className="size-10 bg-primary rounded-lg mb-6 flex items-center justify-center text-primary-foreground">
            <Headphones className="size-5" />
          </div>
          <h3 className="font-display text-xl font-bold mb-2">AI audiobooks</h3>
          <p className="text-muted-foreground leading-relaxed">
            Narrated editions of public-domain works and library originals,
            in natural voices, in any language.
          </p>
          <div className="mt-auto pt-6 flex items-end gap-1.5 h-12">
            {[6, 10, 4, 12, 8, 14, 6, 10, 4, 9, 12, 6].map((h, i) => (
              <div
                key={i}
                className="w-1.5 bg-accent rounded-full animate-pulse"
                style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Smart suggestions */}
        <div className="md:col-span-4 bg-card rounded-[2rem] p-8 border border-border flex flex-col">
          <div className="size-10 bg-accent/15 text-accent rounded-lg mb-6 flex items-center justify-center">
            <Wand2 className="size-5" />
          </div>
          <h3 className="font-display text-xl font-bold mb-2">Smart suggestions</h3>
          <p className="text-muted-foreground leading-relaxed">
            Personalized recommendations for each reader, grounded in your
            collection — not a generic feed.
          </p>
        </div>

        {/* Auto-written entries */}
        <div className="md:col-span-4 bg-card rounded-[2rem] p-8 border border-border flex flex-col">
          <div className="size-10 bg-accent/15 text-accent rounded-lg mb-6 flex items-center justify-center">
            <FileText className="size-5" />
          </div>
          <h3 className="font-display text-xl font-bold mb-2">Auto-written entries</h3>
          <p className="text-muted-foreground leading-relaxed">
            Summaries, themes, age range, content notes — AI drafts every field
            so librarians can review, not retype.
          </p>
        </div>
      </div>
    </section>
  );
}

function Foundations() {
  const items = [
    { eyebrow: "Catalog", title: "Every copy, every condition" },
    { eyebrow: "Readers", title: "Profiles & history" },
    { eyebrow: "Lending", title: "Loans, renewals, returns" },
    { eyebrow: "Reservations", title: "Queues, automated" },
  ];
  return (
    <section className="border-y border-border bg-card/40 py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          {items.map((it) => (
            <div key={it.eyebrow}>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {it.eyebrow}
              </div>
              <div className="font-display text-xl md:text-2xl font-bold tracking-tight">
                {it.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Worldwide() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-primary text-primary-foreground rounded-[2.5rem] p-12 md:p-24 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <h2 className="font-display text-4xl md:text-6xl font-bold mb-8 leading-[1.05] tracking-tight">
              One platform.
              <br />Every library.
              <br /><span className="text-accent">Every language.</span>
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/70 leading-relaxed max-w-xl">
              From a village reading room to a national archive — each library gets
              its own branded URL, its own data, and the same world-class AI.
              Ethically built, humans first.
            </p>
          </div>
          <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
            <svg viewBox="0 0 800 400" fill="none" stroke="currentColor" strokeWidth="0.5" className="w-full h-full text-accent">
              <circle cx="200" cy="150" r="2.5" fill="currentColor" />
              <circle cx="450" cy="100" r="2.5" fill="currentColor" />
              <circle cx="600" cy="250" r="2.5" fill="currentColor" />
              <circle cx="120" cy="280" r="2.5" fill="currentColor" />
              <circle cx="700" cy="160" r="2.5" fill="currentColor" />
              <path d="M200 150 Q 325 50 450 100" strokeDasharray="4 4" />
              <path d="M450 100 Q 525 175 600 250" strokeDasharray="4 4" />
              <path d="M120 280 Q 160 215 200 150" strokeDasharray="4 4" />
              <path d="M600 250 Q 650 205 700 160" strokeDasharray="4 4" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function Trust() {
  const pillars = [
    { icon: ShieldCheck, eyebrow: "Tenant isolation", title: "Each library, its own world", body: "Catalogs, members, and loans are fully separated at the database layer." },
    { icon: Languages, eyebrow: "Multilingual by default", title: "Adapts to your readers", body: "Interface, content, and AI agents speak the languages your community does." },
    { icon: Users, eyebrow: "Role-based access", title: "The right tools, the right people", body: "Owner, admin, librarian, assistant — capabilities scoped to the job." },
  ];
  return (
    <section className="max-w-7xl mx-auto px-6 py-20 md:py-24 grid grid-cols-1 md:grid-cols-3 gap-10">
      {pillars.map((p) => (
        <div key={p.eyebrow}>
          <div className="size-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-5">
            <p.icon className="size-5" />
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {p.eyebrow}
          </div>
          <h3 className="font-display text-xl font-bold mb-2 tracking-tight">{p.title}</h3>
          <p className="text-muted-foreground leading-relaxed">{p.body}</p>
        </div>
      ))}
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="px-6 pb-24 md:pb-32">
      <div className="max-w-5xl mx-auto text-center bg-card border border-border rounded-[2.5rem] p-12 md:p-20">
        <h2 className="font-display text-4xl md:text-6xl font-extrabold tracking-tighter leading-[1.05] mb-6">
          Bring your library
          <br /><span className="text-accent">into the AI age.</span>
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
          Open a branded library in under a minute. No credit card.
        </p>
        <Link to="/auth" className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground rounded-2xl font-semibold text-base hover:scale-[1.02] transition-transform">
          Open your library <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-card border-t border-border py-16 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <div className="size-6 bg-accent rounded-md flex items-center justify-center">
              <div className="size-2.5 border-2 border-accent-foreground rounded-[2px]" />
            </div>
            <span className="font-display text-lg font-bold uppercase tracking-tight">LibrariOS</span>
          </div>
          <p className="text-muted-foreground max-w-sm leading-relaxed">
            The AI operating system for libraries, worldwide. Built with respect
            for the past and intelligence for the future.
          </p>
        </div>
        <div>
          <h4 className="font-display font-bold mb-5">Product</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-accent transition-colors">Sign in</Link></li>
            <li><Link to="/auth" className="hover:text-accent transition-colors">Open a library</Link></li>
            <li><Link to="/platform" className="hover:text-accent transition-colors">Platform</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-bold mb-5">Library</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>Catalog</li>
            <li>Readers</li>
            <li>Lending & reservations</li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto pt-12 mt-12 border-t border-border flex flex-col md:flex-row justify-between text-xs text-muted-foreground gap-3">
        <p>© {new Date().getFullYear()} LibrariOS · for libraries, worldwide.</p>
      </div>
    </footer>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main>
        <Hero />
        <AIBento />
        <Foundations />
        <Worldwide />
        <Trust />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
