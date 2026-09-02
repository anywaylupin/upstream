import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Upstream";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#1c1917",
        padding: 80,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", color: "#00786f", fontSize: 32 }}>
        Upstream
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "contents",
            color: "#fafaf9",
            fontSize: 72,
            lineHeight: 1.1,
          }}
        >
          Know what changed before you upgrade
        </div>
        <div style={{ display: "flex", color: "#a8a29e", fontSize: 32 }}>
          Release digests for the repos you depend on
        </div>
      </div>
    </div>,
    size,
  );
}
