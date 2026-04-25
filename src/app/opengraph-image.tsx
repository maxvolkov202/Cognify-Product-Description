import { ImageResponse } from "next/og";

// Next.js generates a 1200x630 PNG at /opengraph-image automatically.
// This replaces the previous SVG OG asset, which Slack, Twitter, and
// LinkedIn frequently failed to render in link previews.

export const runtime = "edge";
export const alt = "Cognify, the Duolingo for communication";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #6aa3ff 0%, #9788ff 35%, #b072ff 70%, #e77cf0 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            C
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            Cognify
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            The Duolingo for communication
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.05,
            }}
          >
            Train clear thinking
            <br />
            into clear speech.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            opacity: 0.9,
          }}
        >
          <div style={{ display: "flex", gap: 32 }}>
            <span>Daily Workout</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>Skill Lab</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>Scenario Training</span>
          </div>
          <div style={{ fontWeight: 700 }}>cognifygym.com</div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
