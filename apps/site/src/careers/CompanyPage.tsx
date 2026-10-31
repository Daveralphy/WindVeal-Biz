import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Clock, Globe, LayoutGrid, MapPin, Users } from "lucide-react";
import { CareersLayout, CareersState, OrgLogo } from "./CareersLayout";
import { careersApi, employmentLabel, orgPlace, timeAgo, useLoad, websiteHost, websiteHref } from "./api";

export default function CompanyPage() {
  const { slug = "" } = useParams();
  const load = useLoad(() => careersApi.company(slug), [slug]);
  const [dept, setDept] = useState("All");
  const [loc, setLoc] = useState("");

  const data = load.status === "ok" ? load.data : null;
  useEffect(() => {
    document.title = data ? `Careers at ${data.org.name}` : "Careers";
  }, [data]);

  const jobs = data?.jobs ?? [];
  const depts = useMemo(() => [...new Set(jobs.map((j) => j.department).filter((d): d is string => !!d))].sort(), [jobs]);
  const locations = useMemo(() => [...new Set(jobs.map((j) => j.location).filter((d): d is string => !!d))].sort(), [jobs]);
  const shown = jobs.filter((j) => (dept === "All" || j.department === dept) && (!loc || j.location === loc));

  if (load.status !== "ok") return <CareersState state={load.status} error={load.status === "error" ? load.error : undefined} onRetry={() => window.location.reload()} />;
  const { org } = load.data;
  const place = orgPlace(org);
  const perks = org.perks?.filter(Boolean) ?? [];

  return (
    <CareersLayout org={org}>
      <div className="careers-container">
        <div className={`careers-cover${org.coverUrl ? "" : " no-image"}`}>{org.coverUrl && <img src={org.coverUrl} alt="" />}</div>
      </div>
      <div className="careers-inner">
        <section className="company-head">
          <OrgLogo org={org} size={112} className="company-logo" />
          <div className="company-title">
            <h1>{org.name}</h1>
            {org.tagline && <p>{org.tagline}</p>}
          </div>
          <a href="#open-roles" className="btn btn-brand btn-lg company-cta">
            See open roles <ArrowRight size={16} aria-hidden />
          </a>
        </section>

        {(org.industry || place || org.teamSize || org.website) && (
          <ul className="company-meta">
            {org.industry && (
              <li>
                <LayoutGrid size={16} aria-hidden /> {org.industry}
              </li>
            )}
            {place && (
              <li>
                <MapPin size={16} aria-hidden /> {place}
              </li>
            )}
            {org.teamSize && (
              <li>
                <Users size={16} aria-hidden /> {/employee|people/i.test(org.teamSize) ? org.teamSize.replace(/people/i, "employees") : `${org.teamSize} employees`}
              </li>
            )}
            {org.website && (
              <li>
                <Globe size={16} aria-hidden />
                <a href={websiteHref(org.website)} target="_blank" rel="noopener noreferrer">
                  {websiteHost(org.website)}
                </a>
              </li>
            )}
          </ul>
        )}

        <div className="careers-body">
          <section className="roles" id="open-roles" aria-labelledby="roles-title">
            <div className="roles-head">
              <h2 id="roles-title">Open roles</h2>
              <span>
                {jobs.length} {jobs.length === 1 ? "role" : "roles"}
              </span>
            </div>
            {jobs.length > 0 && (
              <div className="roles-filters">
                {depts.length > 1 && (
                  <div className="chip-row" role="group" aria-label="Filter by department">
                    {["All", ...depts].map((d) => (
                      <button key={d} type="button" className={`chip${dept === d ? " on" : ""}`} aria-pressed={dept === d} onClick={() => setDept(d)}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}
                {locations.length > 1 && (
                  <label className="loc-filter">
                    <span className="sr-only">Filter by location</span>
                    <select className="select chip-select-lg" value={loc} onChange={(e) => setLoc(e.target.value)}>
                      <option value="">All locations</option>
                      {locations.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
            {jobs.length === 0 ? (
              <div className="roles-empty">
                <b>No open roles right now</b>
                <p>Check back soon. New roles at {org.name} will appear here.</p>
              </div>
            ) : shown.length === 0 ? (
              <div className="roles-empty">
                <b>No roles match these filters</b>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setDept("All");
                    setLoc("");
                  }}
                >
                  Show all roles
                </button>
              </div>
            ) : (
              <ul className="role-list">
                {shown.map((j) => (
                  <li key={j.id}>
                    <Link to={`/careers/${org.slug}/jobs/${j.slug}`} className="role">
                      <span className="role-main">
                        <span className="role-title">
                          <b>{j.title}</b>
                          {j.isNew && <span className="new-badge">New</span>}
                        </span>
                        <span className="role-meta">
                          {j.department && (
                            <span>
                              <LayoutGrid size={14} aria-hidden /> {j.department}
                            </span>
                          )}
                          {j.location && (
                            <span>
                              <MapPin size={14} aria-hidden /> {j.location}
                            </span>
                          )}
                          {j.employmentType && (
                            <span>
                              <Clock size={14} aria-hidden /> {employmentLabel(j.employmentType)}
                            </span>
                          )}
                          {j.postedAt && <span>{timeAgo(j.postedAt)}</span>}
                        </span>
                      </span>
                      <span className="role-go" aria-hidden>
                        <ArrowRight size={16} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="careers-side">
            {(org.about || place || org.teamSize || org.industry) && (
              <section className="side-box">
                <h2>About us</h2>
                {org.about && <p className="about-text">{org.about}</p>}
                <dl className="side-kv">
                  {org.industry && (
                    <div>
                      <dt>Industry</dt>
                      <dd>{org.industry}</dd>
                    </div>
                  )}
                  {(org.city || org.country) && (
                    <div>
                      <dt>Headquarters</dt>
                      <dd>{org.city ?? place}</dd>
                    </div>
                  )}
                  {org.teamSize && (
                    <div>
                      <dt>Team</dt>
                      <dd>{org.teamSize.replace(/\s*(people|employees)$/i, "")}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
            {perks.length > 0 && (
              <section className="side-box">
                <h2>Why work with us</h2>
                <ul className="perks">
                  {perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </div>
    </CareersLayout>
  );
}
