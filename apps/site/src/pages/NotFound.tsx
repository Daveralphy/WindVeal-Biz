import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MarketingLayout } from "../components/Layout";
import { useTitle } from "../lib/site";

export default function NotFound() {
  useTitle("Page not found · WindVeal");
  return (
    <MarketingLayout>
      <section className="page-hero not-found">
        <div className="container">
          <p className="nf-code">404</p>
          <h1>
            We can't find <span className="accent">that page.</span>
          </h1>
          <p className="lede">The link may be old or mistyped. Let's get you back on track.</p>
          <div className="hero-buttons">
            <Link to="/" className="btn btn-primary btn-lg">
              Go to the home page <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/contact" className="btn btn-secondary btn-lg">
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
