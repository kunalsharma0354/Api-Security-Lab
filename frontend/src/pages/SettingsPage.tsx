export function SettingsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">Resources</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-desc">
            Configuration values the dashboard will use when talking to the
            local backend. They become editable once configuration APIs are
            added in a later part.
          </p>
        </div>
      </div>

      <section className="card" aria-label="Application settings (preview)">
        <div className="panel-head">
          <h3 className="panel-title">General</h3>
          <span className="section-note">read-only preview</span>
        </div>

        <div className="settings-group">
          <div className="field">
            <label className="field-label" htmlFor="api-base-url">
              Backend Base URL
            </label>
            <input
              id="api-base-url"
              className="field-input"
              type="text"
              value="http://localhost:3001"
              disabled
              readOnly
            />
            <span className="field-note">
              The Express backend listens here.
            </span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="request-timeout">
              Request Timeout
            </label>
            <input
              id="request-timeout"
              className="field-input"
              type="text"
              value="10000 ms"
              disabled
              readOnly
            />
            <span className="field-note">
              Applies to lab requests sent from this dashboard.
            </span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="theme-select">
              Theme
            </label>
            <select id="theme-select" className="field-select" disabled>
              <option>Dark (default)</option>
              <option>Light — planned</option>
            </select>
            <span className="field-note">
              NEXORA ships dark-first; light mode may follow later.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
