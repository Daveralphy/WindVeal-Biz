import { Benefits, CtaBand, MarketingLayout } from "../components/Layout";
import { useTitle } from "../lib/site";

export default function About() {
  useTitle("About · WindVeal");
  return (
    <MarketingLayout>
      <section className="page-hero about-hero">
        <div className="container">
          <h1>
            Built for the way <span className="accent">business really works.</span>
          </h1>
          <figure className="about-photo">
            <img src="/images/about.jpg" alt="A team working on laptops around a shared table" />
            <figcaption>One place where a growing business can run its people, clients and daily work, even when the internet lets you down.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container story">
          <h2>Why we built WindVeal.</h2>
          <div>
            <p>
              Most growing businesses run on a patchwork of spreadsheets, chat groups, paper files and apps that don't talk to each other. Information gets lost, work gets
              repeated and nobody has the full picture.
            </p>
            <p>WindVeal brings that work into one place. It's built to be simple enough for any team to pick up, and dependable enough to keep going when the connection doesn't.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">What we believe.</h2>
          <Benefits
            items={[
              { title: "Simple beats clever", text: "Tools should fit how your team already works, not the other way round." },
              { title: "Your data is yours", text: "Your organisation's records stay private, secure and under your control." },
              { title: "Always available", text: "Business doesn't stop when the internet does, so neither should your tools." },
            ]}
          />
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <div className="dogfood">
            <div>
              <h2>We run WindVeal on WindVeal.</h2>
              <p>WindVeal is the first organisation to use the platform every day. Every feature is tested on our own work before it reaches yours.</p>
            </div>
            <dl className="dogfood-list">
              {[
                ["Recruitment", "Hiring our team"],
                ["People & HR", "Running our staff records"],
                ["CRM", "Managing our clients"],
                ["Workflows", "Getting our work done"],
              ].map(([a, b]) => (
                <div key={a}>
                  <dt>{a}</dt>
                  <dd>{b}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <CtaBand
        title="Want to work with us?"
        text="Join our team, or get in touch to talk about WindVeal for your business."
        primary={{ label: "Contact us", href: "/contact" }}
        secondary={{ label: "Careers at WindVeal", href: "/careers/windveal" }}
      />
    </MarketingLayout>
  );
}
