import { Link } from "react-router-dom";
import { CheckCircle, Fingerprint, MagnifyingGlass, Prohibit, SealQuestion, ShieldCheck, Database, LinkSimple } from "@phosphor-icons/react";
import { Button } from "../components/ui";

const OUTCOMES = [
  { icon: CheckCircle, tone: "text-ok", title: "Authentic", text: "This exact file is on the registry and has not been withdrawn." },
  { icon: Prohibit, tone: "text-bad", title: "Revoked", text: "The registrar withdrew this document. The reason and date are shown." },
  { icon: SealQuestion, tone: "text-bad", title: "Not found", text: "Nothing matches. The file may be forged, altered or not yet registered." },
];

const STEPS = [
  { icon: Fingerprint, title: "Fingerprint", text: "Your browser turns the file into a 64-character fingerprint (SHA-256). Change one pixel and the fingerprint changes completely." },
  { icon: MagnifyingGlass, title: "Compare", text: "Only the fingerprint is sent. It is compared with the fingerprints the registrar has recorded on the blockchain." },
  { icon: ShieldCheck, title: "Decide", text: "You get a plain answer, with the property code and a link to the public transaction when the document is known." },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="contours absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-8 md:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div className="rise">
            <h1 className="max-w-[16ch] text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Check a land document before you trust it.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg text-muted">
              Compare a title deed or certificate with the registry. Your file never leaves your device.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/verify">
                <Button size="lg" className="px-7">Verify a document</Button>
              </Link>
              <Link to="/login" className="text-sm font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
                Staff and owner login
              </Link>
            </div>
          </div>

          <div className="rise rounded-xl border border-line bg-surface/90 p-2 shadow-[0_20px_50px_-24px_rgba(12,58,42,0.35)] backdrop-blur-sm" style={{ animationDelay: "120ms" }}>
            <h2 className="px-4 pb-1 pt-4 text-sm font-semibold text-muted">Every check ends in one of three answers</h2>
            <ul className="divide-y divide-line">
              {OUTCOMES.map(({ icon: Icon, tone, title, text }) => (
                <li key={title} className="flex gap-4 px-4 py-4">
                  <Icon size={30} weight="fill" className={`mt-0.5 shrink-0 ${tone}`} aria-hidden />
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="mt-0.5 text-sm text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8 md:py-20">
        <h2 className="max-w-[22ch] text-3xl font-bold">How a check works</h2>
        <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-[1fr_1.4fr]">
          <p className="max-w-[40ch] text-muted">
            Forgery works because paper is easy to copy. A fingerprint recorded at registration is not.
          </p>
          <ol className="space-y-8">
            {STEPS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon size={24} aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-1 max-w-[56ch] text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-px px-4 py-16 sm:px-8 md:grid-cols-2 md:gap-12 md:py-20">
          <div>
            <LinkSimple size={28} className="text-brand" aria-hidden />
            <h2 className="mt-3 text-2xl font-bold">What goes on the blockchain</h2>
            <p className="mt-2 max-w-[44ch] text-muted">
              The fingerprint of each document, the property code (for example LND-2026-0001) and an anonymous owner reference such as USR-12. Nothing else.
            </p>
          </div>
          <div className="mt-10 md:mt-0">
            <Database size={28} className="text-brand" aria-hidden />
            <h2 className="mt-3 text-2xl font-bold">What stays private</h2>
            <p className="mt-2 max-w-[44ch] text-muted">
              The documents themselves, owner names, emails and identity numbers stay in the registry database. They are never published on the chain.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-rail px-6 py-8 sm:px-10">
          <div>
            <h2 className="text-2xl font-bold text-rail-ink">Holding a document you are unsure about?</h2>
            <p className="mt-1 text-rail-muted">It takes a few seconds and needs no account.</p>
          </div>
          <Link to="/verify">
            <Button size="lg" className="bg-[#e6f0ea] text-[#0c3a2a] hover:bg-white">Verify a document</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
