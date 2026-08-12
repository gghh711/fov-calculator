import { useState, useMemo } from "react";

const DEFAULTS = {
  square: { Wm: 2200, Wi: 4300, H: 600, g: 100, phi: 43.64 },
  cross:  { Wm: 100, Wi: 4300, H: 600, g: 100, phi: 43.64, armLen: 4300 },
};

function calcFOV({ type, Wm, Wi, H, armLen }) {
  const um = 1e-6;
  const wm = Wm * um, wi = Wi * um, h = H * um;
  const results = {};

  if (type === "square") {
    // No clipping: spot fully inside sensor
    const dMax_full = (wi - wm) / 2;
    const theta_full = Math.atan(dMax_full / h) * 180 / Math.PI;
    // Any overlap: spot partially overlaps sensor
    const dMax_partial = (wi + wm) / 2;
    const theta_partial = Math.atan(dMax_partial / h) * 180 / Math.PI;
    // Spot area at boresight
    const area = wm * wm;
    results.theta_full = theta_full;
    results.theta_partial = theta_partial;
    results.area_bore = area * 1e12; // µm²
    results.label = `Square ${Wm}×${Wm} µm`;
  } else {
    // Cross: two arms, width=Wm, length=armLen
    const arm = armLen * um;
    const g = Wm * um; // slit width = mask width for cross
    // Along arm direction: spot extends armLen/2 from center
    const dMax_arm = (wi + arm) / 2;
    const theta_arm = Math.atan(dMax_arm / h) * 180 / Math.PI;
    // Perpendicular to arm: spot only g/2 wide
    const dMax_perp_full = (wi - g) / 2;
    const theta_perp = Math.atan(dMax_perp_full / h) * 180 / Math.PI;
    // Cross overlap: both arms contribute
    const dMax_cross = (wi + g) / 2;
    const theta_cross = Math.atan(dMax_cross / h) * 180 / Math.PI;
    // Area = 2*armLen*g - g²
    const area = (2 * arm * g - g * g);
    results.theta_full = theta_perp; // limited by narrow direction
    results.theta_partial = theta_cross;
    results.area_bore = area * 1e12;
    results.label = `Cross ${Wm}×${armLen} µm`;
  }

  // H limits for target FOV
  results.H_for_65_full = ((Wi - Wm) * um / 2 / Math.tan(65 * Math.PI / 180)) * 1e6;
  results.H_for_65_partial = (((type === "square" ? Wi + Wm : Wi + Wm) * um) / 2 / Math.tan(65 * Math.PI / 180)) * 1e6;

  return results;
}

function InputRow({ label, value, onChange, unit, min, max, step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <label style={{ width: 120, fontWeight: 500, fontSize: 14 }}>{label}</label>
      <input
        type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        min={min} max={max} step={step || 1}
        style={{ width: 90, padding: "4px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
      />
      <span style={{ fontSize: 13, color: "#666" }}>{unit}</span>
    </div>
  );
}

function ResultCard({ title, value, unit, color }) {
  return (
    <div style={{
      background: color || "#f0f4ff", borderRadius: 8, padding: "10px 16px",
      textAlign: "center", minWidth: 140
    }}>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#888" }}>{unit}</div>
    </div>
  );
}

export default function FOVCalculator() {
  const [type, setType] = useState("square");
  const [Wm, setWm] = useState(DEFAULTS.square.Wm);
  const [Wi, setWi] = useState(DEFAULTS.square.Wi);
  const [H, setH] = useState(DEFAULTS.square.H);
  const [armLen, setArmLen] = useState(DEFAULTS.cross.armLen);

  const switchType = (t) => {
    setType(t);
    const d = DEFAULTS[t];
    setWm(d.Wm); setWi(d.Wi); setH(d.H);
    if (t === "cross") setArmLen(d.armLen);
  };

  const r = useMemo(() => calcFOV({ type, Wm, Wi, H, armLen }), [type, Wm, Wi, H, armLen]);

  const formula_full = type === "square"
    ? `arctan((W_i − W_m) / (2H)) = arctan((${Wi}−${Wm}) / (2×${H}))`
    : `arctan((W_i − g) / (2H)) = arctan((${Wi}−${Wm}) / (2×${H}))`;

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: 20, maxWidth: 680 }}>
      <h2 style={{ margin: 0, fontSize: 20 }}>FOV Calculator</h2>
      <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
        Square / Cross mask sun sensor — maximum field of view
      </p>

      {/* Type selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["square", "cross"].map(t => (
          <button key={t} onClick={() => switchType(t)}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 14,
              background: type === t ? "#2980B9" : "#e8e8e8",
              color: type === t ? "white" : "#333",
            }}>{t === "square" ? "◻ Square Mask" : "✚ Cross Mask"}</button>
        ))}
      </div>

      {/* Inputs */}
      <div style={{
        background: "#fafafa", borderRadius: 8, padding: 16, marginBottom: 16,
        border: "1px solid #eee"
      }}>
        <InputRow label={type === "square" ? "W_m (mask)" : "g (slit width)"}
                  value={Wm} onChange={setWm} unit="µm" min={10} max={10000} />
        <InputRow label="W_i (sensor)" value={Wi} onChange={setWi} unit="µm" min={100} max={20000} />
        <InputRow label="H (standoff)" value={H} onChange={setH} unit="µm" min={50} max={5000} />
        {type === "cross" && (
          <InputRow label="Arm length" value={armLen} onChange={setArmLen} unit="µm" min={100} max={20000} />
        )}
      </div>

      {/* Results */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <ResultCard title="FOV (no clipping)" value={`±${r.theta_full.toFixed(1)}°`} unit="full spot inside" color="#e8f5e9" />
        <ResultCard title="FOV (with clipping)" value={`±${r.theta_partial.toFixed(1)}°`} unit="any overlap" color="#fff3e0" />
        <ResultCard title="Aperture area" value={`${(r.area_bore / 1e6).toFixed(2)}`} unit="mm²" color="#e3f2fd" />
      </div>

      {/* Formula */}
      <div style={{
        background: "#f5f5f5", borderRadius: 8, padding: 14, fontSize: 13,
        fontFamily: "monospace", lineHeight: 1.6, marginBottom: 16, border: "1px solid #ddd"
      }}>
        <div><b>No-clipping FOV:</b></div>
        <div>θ_max = {formula_full}</div>
        <div style={{ color: "#2980B9", fontWeight: 700 }}>= ±{r.theta_full.toFixed(2)}°</div>
        <br/>
        <div><b>To achieve ±65° (no clipping):</b></div>
        <div>H ≤ {r.H_for_65_full.toFixed(0)} µm {H <= r.H_for_65_full ? "✅" : `❌ (current H=${H} µm too large)`}</div>
        <div>or increase W_i to ≥ {(Wm + 2 * H * Math.tan(65 * Math.PI / 180)).toFixed(0)} µm</div>
      </div>

      {/* Comparison table */}
      {type === "square" && (
        <div style={{ fontSize: 13, color: "#555" }}>
          <b>Quick comparison (H={H} µm):</b>
          <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f0f0f0" }}>
                <th style={{ padding: 6, textAlign: "left", borderBottom: "2px solid #ccc" }}>W_m (µm)</th>
                <th style={{ padding: 6, borderBottom: "2px solid #ccc" }}>FOV no-clip</th>
                <th style={{ padding: 6, borderBottom: "2px solid #ccc" }}>FOV overlap</th>
                <th style={{ padding: 6, borderBottom: "2px solid #ccc" }}>Area (mm²)</th>
              </tr>
            </thead>
            <tbody>
              {[1000, 1500, 2000, 2200, 2500, 3000].map(wm => {
                const res = calcFOV({ type: "square", Wm: wm, Wi, H });
                return (
                  <tr key={wm} style={{ background: wm === Wm ? "#e8f0fe" : "transparent" }}>
                    <td style={{ padding: 5, borderBottom: "1px solid #eee", fontWeight: wm === Wm ? 700 : 400 }}>{wm}</td>
                    <td style={{ padding: 5, borderBottom: "1px solid #eee", textAlign: "center" }}>±{res.theta_full.toFixed(1)}°</td>
                    <td style={{ padding: 5, borderBottom: "1px solid #eee", textAlign: "center" }}>±{res.theta_partial.toFixed(1)}°</td>
                    <td style={{ padding: 5, borderBottom: "1px solid #eee", textAlign: "center" }}>{(res.area_bore/1e6).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
