"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cognify] global error (root layout threw)", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          background:
            "linear-gradient(135deg, #f2f2f6 0%, #e5e5ec 50%, #f9f9fb 100%)",
          color: "#0a0a0f",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            textAlign: "center",
            padding: "3rem",
            background: "white",
            borderRadius: 24,
            border: "1px solid #e5e5ec",
            boxShadow: "0 12px 40px -12px rgba(10,10,15,0.12)",
          }}
        >
          <div
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 64,
              height: 64,
              borderRadius: 16,
              marginBottom: 24,
              background:
                "linear-gradient(110deg, #6aa3ff 0%, #9788ff 35%, #b072ff 60%, #e77cf0 90%)",
              color: "white",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            !
          </div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: 0,
              color: "#0a0a0f",
            }}
          >
            Cognify crashed.
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 16,
              lineHeight: 1.6,
              color: "#6b6b83",
            }}
          >
            A critical error reached the root of the app. This is rare — your progress
            is safe. Reload the page to recover.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 16,
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                color: "#9696a8",
              }}
            >
              Error ID · {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              padding: "14px 32px",
              borderRadius: 999,
              border: "none",
              background:
                "linear-gradient(110deg, #6aa3ff 0%, #9788ff 35%, #b072ff 60%, #e77cf0 90%)",
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 12px 32px -8px rgba(151,136,255,0.55)",
            }}
          >
            Reload Cognify
          </button>
        </div>
      </body>
    </html>
  );
}
