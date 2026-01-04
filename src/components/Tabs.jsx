export default function Tabs({ value, onChange, tabs }) {
  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center" }}>
        {tabs.map(t => (
          <button
            key={t.value}
            className={t.value === value ? "primary" : ""}
            onClick={() => onChange(t.value)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
