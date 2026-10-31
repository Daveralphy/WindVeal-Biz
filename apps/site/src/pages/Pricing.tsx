import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { PLAN_LIMITS, PLAN_PRICES, formatMoney } from "@windveal/shared";
import { CtaBand, MarketingLayout } from "../components/Layout";
import { GET_STARTED_URL, detectCurrency, useTitle } from "../lib/site";

type Billing = "monthly" | "yearly";
type PaidPlan = "growth" | "pro";

const gb = (bytes: number) => `${Math.round(bytes / 1024 ** 3)} GB`;

const PLANS: {
  key: "free" | PaidPlan;
  name: string;
  desc: string;
  cta: string;
  popular?: boolean;
  features: ReactNode[];
  ai: string;
}[] = [
  {
    key: "free",
    name: "Free",
    desc: "For teams getting everything in one place.",
    cta: "Get started free",
    ai: "No AI",
    features: [
      "All six workspaces",
      <>
        <b>{gb(PLAN_LIMITS.free.storageBytes)}</b> storage
      </>,
      "Import your spreadsheets",
      "Email support",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    desc: "For growing businesses that want a little help from AI.",
    cta: "Start with Growth",
    popular: true,
    ai: `AI: ${PLAN_LIMITS.growth.aiRequests.toLocaleString("en-GB")} / mo`,
    features: [
      "Everything in Free",
      <>
        <b>{gb(PLAN_LIMITS.growth.storageBytes)}</b> storage
      </>,
      <>
        <b>WindVeal AI</b>: {PLAN_LIMITS.growth.aiRequests.toLocaleString("en-GB")} requests a month
      </>,
      "Custom roles and permissions",
      "Priority support",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    desc: "For busy teams that use AI every day.",
    cta: "Start with Pro",
    ai: `AI: ${PLAN_LIMITS.pro.aiRequests.toLocaleString("en-GB")} / mo`,
    features: [
      "Everything in Growth",
      <>
        <b>{gb(PLAN_LIMITS.pro.storageBytes)}</b> storage
      </>,
      <>
        <b>WindVeal AI</b>: {PLAN_LIMITS.pro.aiRequests.toLocaleString("en-GB")} requests a month
      </>,
      "Advanced reports and exports",
      "Phone support",
    ],
  },
];

const COMPARE: [string, ...(string | boolean)[]][] = [
  ["All six workspaces", true, true, true, true],
  ["Storage", gb(PLAN_LIMITS.free.storageBytes), gb(PLAN_LIMITS.growth.storageBytes), gb(PLAN_LIMITS.pro.storageBytes), "Custom"],
  ["WindVeal AI requests / month", false, PLAN_LIMITS.growth.aiRequests.toLocaleString("en-GB"), PLAN_LIMITS.pro.aiRequests.toLocaleString("en-GB"), "Custom"],
  ["Custom roles and permissions", false, true, true, true],
  ["Advanced reports and exports", false, false, true, true],
  ["Dedicated onboarding", false, false, false, true],
];

const FAQ = [
  { q: "Which currency will I pay in?", a: "Prices are shown and charged in your local currency, based on where your organisation is." },
  { q: "Is the Free plan really free?", a: "Yes. Use all six workspaces with 5 GB of storage for as long as you like. Upgrade when you need more space or AI." },
  { q: "What is WindVeal AI?", a: "Optional AI help on Growth and Pro plans. Everything else in WindVeal works without it." },
  { q: "Can I change plans later?", a: "Yes. Upgrade or downgrade whenever you like, and switch between monthly and yearly billing." },
];

export default function Pricing() {
  useTitle("Pricing · WindVeal");
  const [billing, setBilling] = useState<Billing>("yearly");
  const currency = useMemo(detectCurrency, []);
  const prices = PLAN_PRICES[currency] ?? PLAN_PRICES.USD;

  const monthly = (k: "free" | PaidPlan) => (k === "free" ? 0 : prices[k]);
  const sub = (k: "free" | PaidPlan) => {
    if (k === "free") return "Free forever";
    return billing === "yearly" ? `${formatMoney(monthly(k) * 10, currency)} billed yearly` : "Billed monthly";
  };

  return (
    <MarketingLayout>
      <section className="page-hero pricing-hero">
        <div className="container">
          <h1>
            Plans that grow <span className="accent">with you.</span>
          </h1>
          <p className="lede">Start with what you need. Upgrade for more space and AI when you're ready.</p>
          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={billing === "monthly"} className={billing === "monthly" ? "on" : undefined} onClick={() => setBilling("monthly")}>
              Monthly
            </button>
            <button type="button" aria-pressed={billing === "yearly"} className={billing === "yearly" ? "on" : undefined} onClick={() => setBilling("yearly")}>
              Yearly <small>2 months free</small>
            </button>
          </div>
          <p className="currency-note">Prices shown in your local currency.</p>
        </div>
      </section>

      <section className="container">
        <div className="plans">
          {PLANS.map((p) => {
            const price = formatMoney(monthly(p.key), currency);
            return (
              <article key={p.key} className={`plan${p.popular ? " plan-popular" : ""}`}>
                <div className="plan-top">
                  <h2>{p.name}</h2>
                  {p.popular && <span className="plan-badge">Popular</span>}
                </div>
                <p className="plan-desc">{p.desc}</p>
                <div className="plan-price">
                  <b className={price.length > 6 ? "long" : undefined}>{price}</b>
                  <span>/ month</span>
                </div>
                <p className="plan-sub">{sub(p.key)}</p>
                <div className="plan-compact" aria-hidden>
                  <span>{gb(PLAN_LIMITS[p.key].storageBytes)} storage</span>
                  <span>{p.ai}</span>
                </div>
                <a href={`${GET_STARTED_URL}?plan=${p.key}&billing=${billing}`} className={`btn btn-lg btn-block ${p.popular ? "btn-light" : "btn-primary"}`}>
                  {p.cta}
                </a>
                <ul className="plan-features">
                  {p.features.map((f, i) => (
                    <li key={i}>
                      <Check size={15} aria-hidden /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <article className="plan-enterprise">
          <div>
            <h2>Enterprise</h2>
            <p>Storage, AI and support built around your organisation, with dedicated onboarding and a named account manager.</p>
          </div>
          <div className="enterprise-right">
            <b>Custom</b>
            <Link to="/contact?topic=sales" className="btn btn-secondary btn-lg">
              Contact us
            </Link>
          </div>
        </article>
      </section>

      <section className="section compare-section">
        <div className="container">
          <div className="table-scroll">
            <table className="compare">
              <caption className="sr-only">Compare plans</caption>
              <thead>
                <tr>
                  <th scope="col">Compare plans</th>
                  <th scope="col">Free</th>
                  <th scope="col">Growth</th>
                  <th scope="col">Pro</th>
                  <th scope="col">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, ...vals]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {vals.map((v, i) => (
                      <td key={i}>
                        {v === true ? (
                          <Check size={16} className="yes" aria-label="Included" />
                        ) : v === false ? (
                          <Minus size={16} className="no" aria-label="Not included" />
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <h2 className="section-title">Questions, answered.</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <div key={f.q} className="faq-item">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Need something built around you?"
        text="Talk to us about storage, AI and support that fit your organisation."
        primary={{ label: "Contact us", href: "/contact?topic=sales" }}
        secondary={{ label: "Get started", href: GET_STARTED_URL, external: true }}
      />
    </MarketingLayout>
  );
}
