import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Banknote, Check, Clock, LayoutGrid, MapPin, Share2 } from "lucide-react";
import { formatMoney } from "@windveal/shared";
import { CareersLayout, CareersState, OrgLogo } from "./CareersLayout";
import { careersApi, employmentLabel, formatDate, orgPlace, useLoad, type JobDetail } from "./api";

export function salaryText(s: JobDetail["salary"]): string | null {
  if (!s || (s.min == null && s.max == null)) return null;
  const unit = s.period
    ? s.period
        .toLowerCase()
        .trim()
        .replace(/^(annual|annually|yearly|per year)$/, "year")
        .replace(/^daily$/, "day")
        .replace(/ly$/, "")
    : "";
  const per = unit ? ` ${/^(hour|[aeiou])/.test(unit) ? "an" : "a"} ${unit}` : "";
  if (s.min != null && s.max != null && s.min !== s.max) return `${formatMoney(s.min, s.currency)} to ${formatMoney(s.max, s.currency)}${per}`;
  if (s.min != null && s.max != null) return `${formatMoney(s.min, s.currency)}${per}`;
  if (s.min != null) return `From ${formatMoney(s.min, s.currency)}${per}`;
  return `Up to ${formatMoney(s.max, s.currency)}${per}`;
}

const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s+/;

/** Renders plain-text job descriptions: blank lines split paragraphs, "-"/"•" lines become lists, short title-like lines become headings. */
export function Description({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) {
      out.push(
        <p key={out.length}>
          {para.map((l, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {l}
            </span>
          ))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      out.push(
        <ul key={out.length}>
          {list.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      return;
    }
    if (BULLET.test(line)) {
      flushPara();
      list.push(line.replace(BULLET, ""));
      return;
    }
    flushList();
    const next = lines.slice(idx + 1).find((l) => l.trim());
    const prevBlank = idx === 0 || !lines[idx - 1].trim();
    const isHeading = prevBlank && line.length <= 60 && !/[.,;!?]$/.test(line) && (!!next || line.endsWith(":"));
    if (isHeading && para.length === 0) {
      out.push(<h2 key={out.length}>{line.replace(/:$/, "")}</h2>);
      return;
    }
    para.push(line);
  });
  flushPara();
  flushList();
  return <div className="job-desc">{out}</div>;
}

export function JobFacts({ job, onSite }: { job: JobDetail; onSite?: boolean }) {
  const rows: [string, string][] = [];
  if (job.department) rows.push(["Department", job.department]);
  if (job.employmentType) rows.push(["Job type", employmentLabel(job.employmentType)]);
  if (job.location) rows.push(["Location", job.location]);
  if (onSite && job.applyBy) rows.push(["Apply by", formatDate(job.applyBy)]);
  if (!rows.length) return null;
  return (
    <dl className="side-kv">
      {rows.map(([a, b]) => (
        <div key={a}>
          <dt>{a}</dt>
          <dd>{b}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function JobPage() {
  const { slug = "", jobSlug = "" } = useParams();
  const load = useLoad(() => careersApi.job(slug, jobSlug), [slug, jobSlug]);
  const [shared, setShared] = useState(false);
  const data = load.status === "ok" ? load.data : null;

  useEffect(() => {
    document.title = data ? `${data.job.title} · ${data.org.name} careers` : "Careers";
  }, [data]);

  if (load.status !== "ok") return <CareersState state={load.status} error={load.status === "error" ? load.error : undefined} onRetry={() => window.location.reload()} />;
  const { org, job } = load.data;
  const salary = salaryText(job.salary);
  const applyHref = `/careers/${org.slug}/jobs/${job.slug}/apply`;

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 2500);
    } catch {
      window.prompt("Copy this link to share the role:", url);
    }
  };

  return (
    <CareersLayout org={org}>
      <div className="careers-inner">
        <section className="job-head">
          <Link to={`/careers/${org.slug}`} className="careers-back">
            <ArrowLeft size={15} aria-hidden /> All roles at {org.name}
          </Link>
          <h1>{job.title}</h1>
          <ul className="job-meta">
            {job.department && (
              <li>
                <LayoutGrid size={16} aria-hidden /> {job.department}
              </li>
            )}
            {job.location && (
              <li>
                <MapPin size={16} aria-hidden /> {job.location}
              </li>
            )}
            {job.employmentType && (
              <li>
                <Clock size={16} aria-hidden /> {employmentLabel(job.employmentType)}
              </li>
            )}
            {salary && (
              <li>
                <Banknote size={16} aria-hidden /> {salary}
              </li>
            )}
          </ul>
        </section>
      </div>
      <hr className="careers-rule" />
      <div className="careers-inner">
        <div className="careers-body job-body">
          <article>{job.description ? <Description text={job.description} /> : <p className="muted-text">More details about this role will be shared during the process.</p>}</article>
          <aside className="careers-side">
            <section className="apply-box">
              <div className="apply-org">
                <OrgLogo org={org} size={52} />
                <span>
                  <b>{org.name}</b>
                  {orgPlace(org) && <small>{orgPlace(org)}</small>}
                </span>
              </div>
              <Link to={applyHref} className="btn btn-brand btn-lg btn-block">
                Apply for this role <ArrowRight size={16} aria-hidden />
              </Link>
              <p className="apply-note">Takes about 5 minutes. No account needed.</p>
              <JobFacts job={job} onSite />
            </section>
            <button type="button" className="share-btn" onClick={share}>
              {shared ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />}
              {shared ? "Link copied" : "Share this role"}
            </button>
            <span className="sr-only" role="status">
              {shared ? "Link copied to clipboard" : ""}
            </span>
          </aside>
        </div>
      </div>
    </CareersLayout>
  );
}
