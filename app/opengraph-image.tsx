import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Upstream - release digests for the repos in your stack';

const INK = '#fafaf9';
const MUTED = '#a8a29e';
const ACCENT = '#00786f';
const DANGER = '#f87171';

/** Satori has no `display: contents` and no default flex, so every box is explicit. */
function Chip({ label, color = MUTED }: { label: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: `1px solid ${color}`,
        borderRadius: 999,
        color,
        fontSize: 22,
        padding: '6px 18px'
      }}
    >
      {label}
    </div>
  );
}

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#1c1917',
        padding: 80,
        fontFamily: 'sans-serif'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 999, background: ACCENT }} />
        <div style={{ display: 'flex', color: ACCENT, fontSize: 32, letterSpacing: -0.5 }}>Upstream</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', color: INK, fontSize: 76, lineHeight: 1.1, letterSpacing: -2 }}>
          Know what breaks before you upgrade.
        </div>
        <div style={{ display: 'flex', color: MUTED, fontSize: 30, marginTop: 24, lineHeight: 1.4 }}>
          Every changelog in your stack, read and rated.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Chip label="breaking changes" color={DANGER} />
        <Chip label="upgrade effort" />
        <Chip label="repo ratings" />
        <Chip label="bring your own key" />
      </div>
    </div>,
    size
  );
}
