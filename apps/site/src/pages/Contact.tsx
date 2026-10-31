import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { TEAM_SIZES } from "@windveal/shared";
import { MarketingLayout } from "../components/Layout";
import { CONTACT_EMAIL, useTitle } from "../lib/site";

const TOPICS = [
  { key: "sales", label: "Sales and Enterprise pricing", title: "Sales and Enterprise", text: "Talk to us about a plan built for your organisation." },
  { key: "support", label: "Help with my account", title: "Support", text: "Already using WindVeal? We're here to help." },
  { key: "partnerships", label: "Partnerships", title: "Partnerships", text: "Work with us to bring WindVeal to more businesses." },
  { key: "other", label: "Something else", title: "", text: "" },
];

type Fields = { name: string; email: string; org: string; size: string; topic: string; message: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Contact() {
  useTitle("Contact · WindVeal");
  const [params] = useSearchParams();
  const initialTopic = TOPICS.find((t) => t.key === params.get("topic"))?.key ?? "sales";
  const [f, setF] = useState<Fields>({ name: "", email: "", org: "", size: "", topic: initialTopic, message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [sent, setSent] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const pickTopic = (key: string) => {
    setF((p) => ({ ...p, topic: key }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("c-name")?.focus({ preventScroll: true }), 300);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!f.name.trim()) errs.name = "Enter your name.";
    if (!EMAIL_RE.test(f.email.trim())) errs.email = "Enter a valid email address.";
    if (!f.message.trim()) errs.message = "Tell us a little about what you need.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`c-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    const topic = TOPICS.find((t) => t.key === f.topic)!;
    const subject = `${topic.label}${f.org ? ` · ${f.org}` : ""}`;
    const body = [
      f.message.trim(),
      "",
      "---",
      `Name: ${f.name.trim()}`,
      `Work email: ${f.email.trim()}`,
      f.org ? `Organisation: ${f.org}` : null,
      f.size ? `Team size: ${f.size}` : null,
      `Topic: ${topic.label}`,
    ]
      .filter((l) => l !== null)
      .join("\n");
    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setSent(href);
  };

  return (
    <MarketingLayout>
      <section className="contact">
        <div className="container contact-grid">
          <div className="contact-intro">
            <h1>Let's talk.</h1>
            <p className="lede">Questions about WindVeal, pricing or a plan for your organisation? Send us a message and we'll get back to you within one working day.</p>
            <ul className="contact-topics">
              {TOPICS.filter((t) => t.title).map((t) => (
                <li key={t.key}>
                  <button type="button" onClick={() => pickTopic(t.key)}>
                    <span>
                      <b>{t.title}</b>
                      <small>{t.text}</small>
                    </span>
                    <span className="round-arrow" aria-hidden>
                      <ArrowRight size={16} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="contact-card">
            {sent ? (
              <div className="contact-sent" role="status">
                <span className="sent-icon">
                  <CheckCircle2 size={28} aria-hidden />
                </span>
                <h2>Thanks, {f.name.split(" ")[0]}.</h2>
                <p>
                  Your email app should have opened with your message ready to send to <b>{CONTACT_EMAIL}</b>. Once it's sent, we'll get back to you within one working day.
                </p>
                <p className="muted-small">
                  Nothing opened? <a href={sent}>Try again</a> or write to us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => setSent(null)}>
                  Send another message
                </button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={submit} noValidate>
                <h2>Send us a message</h2>
                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="c-name">
                      Full name
                    </label>
                    <input id="c-name" className="input" placeholder="Your name" autoComplete="name" value={f.name} onChange={set("name")} aria-invalid={!!errors.name} aria-describedby={errors.name ? "c-name-err" : undefined} />
                    {errors.name && (
                      <span className="field-error" id="c-name-err">
                        {errors.name}
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="c-email">
                      Work email
                    </label>
                    <input id="c-email" type="email" className="input" placeholder="you@company.com" autoComplete="email" value={f.email} onChange={set("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? "c-email-err" : undefined} />
                    {errors.email && (
                      <span className="field-error" id="c-email-err">
                        {errors.email}
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="c-org">
                      Organisation
                    </label>
                    <input id="c-org" className="input" placeholder="Organisation name" autoComplete="organization" value={f.org} onChange={set("org")} />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="c-size">
                      Team size
                    </label>
                    <select id="c-size" className="select" value={f.size} onChange={set("size")}>
                      <option value="">Select</option>
                      {TEAM_SIZES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field span-2">
                    <label className="field-label" htmlFor="c-topic">
                      What can we help with?
                    </label>
                    <select id="c-topic" className="select" value={f.topic} onChange={set("topic")}>
                      {TOPICS.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field span-2">
                    <label className="field-label" htmlFor="c-message">
                      Message
                    </label>
                    <textarea id="c-message" className="textarea" rows={4} placeholder="Tell us a little about your business" value={f.message} onChange={set("message")} aria-invalid={!!errors.message} aria-describedby={errors.message ? "c-message-err" : undefined} />
                    {errors.message && (
                      <span className="field-error" id="c-message-err">
                        {errors.message}
                      </span>
                    )}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg btn-block contact-submit">
                  Send message <ArrowRight size={16} aria-hidden />
                </button>
                <p className="form-note">We'll only use your details to reply to your message.</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
