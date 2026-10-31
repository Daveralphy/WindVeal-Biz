import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { GET_STARTED_URL, SIGN_IN_URL } from "../lib/site";
import { WORKSPACE_LIST } from "../lib/workspaces";

export function Logo({ light }: { light?: boolean }) {
  return <img className="logo" src={light ? "/logo-light.png" : "/logo.png"} alt="WindVeal" width={196} height={40} />;
}

export function Header({ overlay }: { overlay?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const dropRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number>();
  const productActive = location.pathname.startsWith("/product");

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const openSoon = () => {
    window.clearTimeout(closeTimer.current);
    setMenuOpen(true);
  };
  const closeSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenuOpen(false), 160);
  };

  return (
    <header className={`site-header${overlay ? " hdr-overlay" : ""}`}>
      <div className="container header-inner">
        <Link to="/" className="header-logo" aria-label="WindVeal home">
          <Logo light={overlay} />
        </Link>
        <nav className="header-nav" aria-label="Main">
          <div className="nav-drop" ref={dropRef} onMouseEnter={openSoon} onMouseLeave={closeSoon}>
            <button
              type="button"
              className={`nav-link${productActive ? " active" : ""}`}
              aria-expanded={menuOpen}
              aria-controls="product-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              Product <ChevronDown size={14} aria-hidden />
            </button>
            {menuOpen && (
              <div className="product-menu" id="product-menu">
                <div className="product-menu-grid">
                  {WORKSPACE_LIST.map((w) => (
                    <Link key={w.key} to={w.path} className="product-menu-item">
                      <span className="pm-icon">
                        <w.icon size={18} aria-hidden />
                      </span>
                      <span>
                        <b>{w.name}</b>
                        <small>{w.menuLine}</small>
                      </span>
                    </Link>
                  ))}
                </div>
                <Link to="/product" className="product-menu-all">
                  Explore all workspaces <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            )}
          </div>
          <NavLink to="/pricing" className="nav-link">
            Pricing
          </NavLink>
          <NavLink to="/about" className="nav-link">
            About
          </NavLink>
          <NavLink to="/contact" className="nav-link">
            Contact
          </NavLink>
        </nav>
        <div className="header-actions">
          <a href={SIGN_IN_URL} className="nav-link sign-in">
            Sign in
          </a>
          <a href={GET_STARTED_URL} className={`btn ${overlay ? "btn-light" : "btn-primary"} header-cta`}>
            Get started
          </a>
          <button type="button" className="menu-btn" aria-label="Open menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
            <Menu size={22} aria-hidden />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mobile-nav-top">
            <Link to="/" aria-label="WindVeal home">
              <Logo />
            </Link>
            <button type="button" className="menu-btn" aria-label="Close menu" onClick={() => setMobileOpen(false)} autoFocus>
              <X size={22} aria-hidden />
            </button>
          </div>
          <nav className="mobile-nav-body" aria-label="Mobile">
            <p className="mobile-nav-label">Product</p>
            <div className="mobile-ws">
              {WORKSPACE_LIST.map((w) => (
                <Link key={w.key} to={w.path} className="mobile-ws-item">
                  <span className="pm-icon">
                    <w.icon size={18} aria-hidden />
                  </span>
                  {w.name}
                </Link>
              ))}
            </div>
            <Link to="/product" className="mobile-link">
              Explore all workspaces <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to="/pricing" className="mobile-link">
              Pricing
            </Link>
            <Link to="/about" className="mobile-link">
              About
            </Link>
            <Link to="/contact" className="mobile-link">
              Contact
            </Link>
          </nav>
          <div className="mobile-nav-foot">
            <a href={GET_STARTED_URL} className="btn btn-primary btn-lg btn-block">
              Get started <ArrowRight size={16} aria-hidden />
            </a>
            <a href={SIGN_IN_URL} className="btn btn-secondary btn-lg btn-block">
              Sign in
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
