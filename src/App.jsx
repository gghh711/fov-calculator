import { useState, useMemo } from "react";

function calcFOV({ Wm, Wi, H }) {
  return Math.atan(((Wi - Wm) * 1e-6) / (2 * H * 1e-6)) * 180 / Math.PI;
}

function InputRow({ label, value, onChange, unit, step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <label style={{ width: 130, fontWeight: 600, fontSize: 14 }}>{label}</label>
      <input type="number" value={value} step={step||1}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 100, padding: "6px 10px", border: "1px solid #bbb",
                 borderRadius: 6, fontSize: 15, fontWeight: 600 }} />
      <span style={{ fontSize: 13, color: "#777" }}>{unit}</span>
    </div>
  );
}

function ForwardCalc({ Wi }) {
  const [Wm, setWm] = useState(2200);
  const [H, setH] = useState(600);
  const fov = useMemo(() => calcFOV({ Wm, Wi, H }), [Wm, Wi, H]);
  const ok = fov >= 65;
  const H65 = ((Wi - Wm) * 1e-6 / 2 / Math.tan(65 * Math.PI / 180)) * 1e6;
  const Wi65 = Wm + 2 * H * Math.tan(65 * Math.PI / 180);

  return (
    <div>
      <InputRow label="Mask W_m" value={Wm} onChange={setWm} unit="um" />
      <InputRow label="Standoff H" value={H} onChange={setH} unit="um" />
      <div style={{ background: ok ? "#E8F5E9" : "#FFF3E0", borderRadius: 10, padding: 18,
                    border: `2px solid ${ok ? "#4CAF50" : "#FF9800"}`, marginTop: 12, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#555" }}>Usable FOV (spot fully on sensor)</div>
        <div style={{ fontSize: 42, fontWeight: 800 }}>+/-{fov.toFixed(1)} deg</div>
        <div style={{ fontSize: 13, color: "#777" }}>
          Area: {(Wm * Wm / 1e6).toFixed(2)} mm2
          {ok ? " -- meets +/-65 deg" : ""}
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, fontFamily: "monospace", background: "#f8f8f8",
                    borderRadius: 8, padding: 12, lineHeight: 1.8 }}>
        <div>theta = arctan(({Wi}-{Wm}) / (2*{H})) = <b>+/-{fov.toFixed(2)} deg</b></div>
        <div style={{ marginTop: 6 }}>To reach +/-65 deg:</div>
        <div>  H &lt;= {H65.toFixed(0)} um {H <= H65 ? "OK" : "-- too large"}</div>
        <div>  W_i &gt;= {Wi65.toFixed(0)} um {Wi >= Wi65 ? "OK" : "-- too small"}</div>
      </div>
    </div>
  );
}

function ReverseCalc({ Wi }) {
  const [fovTarget, setFovTarget] = useState(65);
  const tanT = Math.tan(fovTarget * Math.PI / 180);
  const WmMax = Wi;  // Wm < Wi

  // Feasible pairs: H <= (Wi - Wm) / (2*tan(fov))
  // Generate contour data
  const wmRange = [];
  const hRange = [];
  for (let wm = 200; wm <= Wi - 100; wm += 100) {
    const hMax = ((Wi - wm) * 1e-6 / 2 / tanT) * 1e6;
    wmRange.push(wm);
    hRange.push(hMax);
  }

  // Key design points
  const designPts = [
    { Wm: 2200, H: 600, label: "Current" },
    { Wm: 2200, H: 490, label: "H reduced" },
    { Wm: 2000, H: 536, label: "Wm=2000" },
    { Wm: 1500, H: 652, label: "Wm=1500" },
  ];

  // SVG chart
  const svgW = 460, svgH = 300, pad = { t: 20, r: 20, b: 50, l: 60 };
  const plotW = svgW - pad.l - pad.r, plotH = svgH - pad.t - pad.b;
  const wmMin = 0, wmMaxPlot = Wi;
  const hMin = 0, hMaxPlot = 1200;
  const sx = wm => pad.l + (wm - wmMin) / (wmMaxPlot - wmMin) * plotW;
  const sy = h => pad.t + plotH - (h - hMin) / (hMaxPlot - hMin) * plotH;

  // Feasible boundary path
  let pathD = `M ${sx(wmRange[0])} ${sy(hRange[0])}`;
  for (let i = 1; i < wmRange.length; i++) {
    pathD += ` L ${sx(wmRange[i])} ${sy(hRange[i])}`;
  }
  pathD += ` L ${sx(wmRange[wmRange.length-1])} ${sy(0)} L ${sx(wmRange[0])} ${sy(0)} Z`;

  return (
    <div>
      <InputRow label="Target FOV" value={fovTarget} onChange={setFovTarget} unit="deg" step={1} />
      <div style={{ fontSize: 13, marginBottom: 8, color: "#555" }}>
        Constraint: <span style={{ fontFamily: "monospace" }}>H &lt;= (W_i - W_m) / (2 * tan({fovTarget} deg))</span>
      </div>
      <svg width={svgW} height={svgH} style={{ background: "white", borderRadius: 8, border: "1px solid #ddd" }}>
        {/* Feasible region */}
        <path d={pathD} fill="#E8F5E9" stroke="#4CAF50" strokeWidth="2" opacity="0.6" />
        {/* Infeasible label */}
        <text x={sx(Wi*0.6)} y={sy(hMaxPlot*0.7)} fontSize="13" fill="#C62828" fontWeight="700">
          FOV &lt; +/-{fovTarget} deg
        </text>
        <text x={sx(Wi*0.2)} y={sy(hMaxPlot*0.2)} fontSize="13" fill="#2E7D32" fontWeight="700">
          FOV &gt;= +/-{fovTarget} deg
        </text>
        {/* Axes */}
        <line x1={pad.l} y1={sy(0)} x2={pad.l+plotW} y2={sy(0)} stroke="#333" strokeWidth="1" />
        <line x1={pad.l} y1={sy(0)} x2={pad.l} y2={pad.t} stroke="#333" strokeWidth="1" />
        {/* X ticks */}
        {[0, 1000, 2000, 3000, 4000].filter(v=>v<=wmMaxPlot).map(v => (
          <g key={`x${v}`}>
            <line x1={sx(v)} y1={sy(0)} x2={sx(v)} y2={sy(0)+5} stroke="#333" />
            <text x={sx(v)} y={sy(0)+18} fontSize="11" textAnchor="middle" fill="#555">{v}</text>
          </g>
        ))}
        <text x={sx(wmMaxPlot/2)} y={svgH-4} fontSize="13" textAnchor="middle" fill="#333" fontWeight="600">
          W_m (um)
        </text>
        {/* Y ticks */}
        {[0, 200, 400, 600, 800, 1000, 1200].map(v => (
          <g key={`y${v}`}>
            <line x1={pad.l-5} y1={sy(v)} x2={pad.l} y2={sy(v)} stroke="#333" />
            <text x={pad.l-8} y={sy(v)+4} fontSize="11" textAnchor="end" fill="#555">{v}</text>
          </g>
        ))}
        <text x={14} y={sy(hMaxPlot/2)} fontSize="13" textAnchor="middle" fill="#333" fontWeight="600"
              transform={`rotate(-90, 14, ${sy(hMaxPlot/2)})`}>H (um)</text>
        {/* Design points */}
        {designPts.map((pt, i) => {
          const fov = calcFOV({ Wm: pt.Wm, Wi, H: pt.H });
          const inside = fov >= fovTarget;
          return (
            <g key={i}>
              <circle cx={sx(pt.Wm)} cy={sy(pt.H)} r={6}
                      fill={inside ? "#2E7D32" : "#C62828"} stroke="white" strokeWidth="2" />
              <text x={sx(pt.Wm)+10} y={sy(pt.H)+4} fontSize="11"
                    fill={inside ? "#2E7D32" : "#C62828"} fontWeight="600">
                {pt.label} ({pt.Wm}, {pt.H}) +/-{fov.toFixed(1)} deg
              </text>
            </g>
          );
        })}
        {/* Boundary label */}
        <text x={sx(wmRange[Math.floor(wmRange.length*0.3)])-10}
              y={sy(hRange[Math.floor(wmRange.length*0.3)])-8}
              fontSize="11" fill="#4CAF50" fontWeight="700">
          boundary: +/-{fovTarget} deg
        </text>
      </svg>

      {/* Table */}
      <div style={{ marginTop: 12, fontSize: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              {["W_m (um)", "H_max (um)", "Area (mm2)", "Status"].map(h => (
                <th key={h} style={{ padding: 5, borderBottom: "2px solid #ccc", textAlign: "center" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1000, 1500, 2000, 2200, 2500, 3000].map(wm => {
              const hMax = ((Wi - wm) * 1e-6 / 2 / tanT) * 1e6;
              return (
                <tr key={wm}>
                  <td style={{ padding: 4, borderBottom: "1px solid #eee", textAlign: "center" }}>{wm}</td>
                  <td style={{ padding: 4, borderBottom: "1px solid #eee", textAlign: "center", fontWeight: 700 }}>
                    {hMax > 0 ? hMax.toFixed(0) : "N/A"}
                  </td>
                  <td style={{ padding: 4, borderBottom: "1px solid #eee", textAlign: "center" }}>
                    {(wm * wm / 1e6).toFixed(2)}
                  </td>
                  <td style={{ padding: 4, borderBottom: "1px solid #eee", textAlign: "center",
                               color: hMax >= 600 ? "#2E7D32" : "#BF360C" }}>
                    {hMax >= 600 ? "H=600 OK" : `need H<=${hMax.toFixed(0)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [Wi, setWi] = useState(4300);
  const [tab, setTab] = useState("forward");

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: 24, maxWidth: 560 }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>Sun Sensor FOV Calculator</h2>
      <p style={{ color: "#666", fontSize: 13, marginTop: 4, marginBottom: 12 }}>
        Square mask — usable FOV where spot is fully on sensor
      </p>
      <InputRow label="Sensor W_i" value={Wi} onChange={setWi} unit="um" />

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {[["forward", "W_m, H --> FOV"], ["reverse", "FOV --> (W_m, H) pairs"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                     fontWeight: 700, fontSize: 13,
                     background: tab === k ? "#1565C0" : "#e0e0e0",
                     color: tab === k ? "white" : "#444" }}>{label}</button>
        ))}
      </div>

      {tab === "forward" ? <ForwardCalc Wi={Wi} /> : <ReverseCalc Wi={Wi} />}
    </div>
  );
}
