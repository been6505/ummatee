// ชุดกราฟ SVG ใช้ร่วมกันในหน้า admin dashboard — โดนัท / แท่งนอน / แท่งตั้ง / เส้น
// ทุกตัวรับ data รูปแบบเดียวกัน: [{ label, value }]

const R = 70
const CIRC = 2 * Math.PI * R

export function DonutChart({ data, colors, unit, size = 200 }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let offset = 0
  return (
    <svg viewBox="0 0 180 180" className="admin-donut" style={{ width: size, height: size }}>
      <circle cx="90" cy="90" r={R} fill="none" stroke="#eee" strokeWidth="28" />
      {data.map((d, i) => {
        const len = (d.value / total) * CIRC
        const seg = (
          <circle
            key={d.label}
            cx="90" cy="90" r={R}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth="28"
            strokeDasharray={`${len} ${CIRC - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 90 90)"
          >
            <title>{d.label}: {d.value.toLocaleString()}</title>
          </circle>
        )
        offset += len
        return seg
      })}
      <circle cx="90" cy="90" r={R - 15} fill="#fff" />
      <text x="90" y="94" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1a5c3a">{total.toLocaleString()}</text>
      <text x="90" y="112" textAnchor="middle" fontSize="11" fill="#2e7d52">{unit}</text>
    </svg>
  )
}

export function HBarChart({ data, colors, valueLabel = (v) => v.toLocaleString() }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="admin-hbars">
      {data.map((d, i) => (
        <div className="admin-bar-row" key={d.label}>
          <span className="admin-bar-label" title={d.label}>{d.label}</span>
          <div className="admin-bar-track">
            <div className="admin-bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: colors[i % colors.length] }} />
          </div>
          <span className="admin-bar-value">{valueLabel(d.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function ColumnChart({ data, colors, valueLabel = (v) => v.toLocaleString() }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="admin-columns">
      {data.map((d, i) => (
        <div className="admin-col" key={d.label} title={`${d.label}: ${valueLabel(d.value)}`}>
          <span className="admin-col-value">{valueLabel(d.value)}</span>
          <div className="admin-col-bar" style={{ height: `${Math.max(4, (d.value / max) * 160)}px`, background: colors[i % colors.length] }} />
          <span className="admin-col-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function LineChart({ data, color = '#2e7d52', valueLabel = (v) => v.toLocaleString() }) {
  const W = 560, H = 200, PAD = 28
  const max = Math.max(1, ...data.map((d) => d.value))
  const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0
  const pts = data.map((d, i) => [PAD + i * step, H - PAD - (d.value / max) * (H - PAD * 2)])
  const path = pts.map((p) => p.join(',')).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="admin-line-chart">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={H - PAD - f * (H - PAD * 2)} y2={H - PAD - f * (H - PAD * 2)} stroke="#eee" />
      ))}
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="#ccc" />
      {pts.length > 1 && (
        <polygon points={`${PAD},${H - PAD} ${path} ${PAD + (data.length - 1) * step},${H - PAD}`} fill={color} opacity=".12" />
      )}
      <polyline points={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4" fill={color}>
            <title>{data[i].label}: {valueLabel(data[i].value)}</title>
          </circle>
          <text x={p[0]} y={H - PAD + 16} textAnchor="middle" fontSize="9" fill="#666">{data[i].label}</text>
        </g>
      ))}
    </svg>
  )
}

// ปุ่มสลับประเภทกราฟ
const CHART_TYPES = [
  { id: 'donut', label: 'โดนัท' },
  { id: 'hbar', label: 'แท่งนอน' },
  { id: 'column', label: 'แท่งตั้ง' },
  { id: 'line', label: 'เส้น' },
]

export function ChartTypeSwitch({ value, onChange, types = ['donut', 'hbar', 'column', 'line'] }) {
  return (
    <div className="admin-chart-switch">
      {CHART_TYPES.filter((t) => types.includes(t.id)).map((t) => (
        <button key={t.id} className={value === t.id ? 'active' : ''} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  )
}

// เรนเดอร์กราฟตามประเภทที่เลือก
export function Chart({ type, data, colors, unit, valueLabel }) {
  if (type === 'donut') return <DonutChart data={data} colors={colors} unit={unit} />
  if (type === 'column') return <ColumnChart data={data} colors={colors} valueLabel={valueLabel} />
  if (type === 'line') return <LineChart data={data} color={colors[0]} valueLabel={valueLabel} />
  return <HBarChart data={data} colors={colors} valueLabel={valueLabel} />
}

export const PALETTE = ['#2e7d52', '#e8194a', '#c9a84c', '#2196f3', '#8e44ad', '#e67e22', '#16a085', '#d35400']

export function legendColors(n) {
  return Array.from({ length: n }, (_, i) => `hsl(${Math.round((i * 360) / n)}, 65%, 55%)`)
}
