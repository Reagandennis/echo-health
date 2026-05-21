import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Echo Health — Therapy, reimagined";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
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
            "linear-gradient(135deg, #0d6e6e 0%, #1a8a8a 50%, #f5efe6 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: 800,
              color: "#0d6e6e",
            }}
          >
            E
          </div>
          <span style={{ fontSize: "32px", color: "white", fontWeight: 600 }}>
            Echo Health
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h1
            style={{
              fontSize: "84px",
              lineHeight: 1.05,
              color: "white",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Feel heard. <br /> Heal forward.
          </h1>
          <p
            style={{
              fontSize: "32px",
              color: "rgba(255,255,255,0.85)",
              maxWidth: "900px",
              margin: 0,
            }}
          >
            Connect with licensed therapists who truly listen — online,
            on your terms.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "22px", color: "rgba(255,255,255,0.7)" }}>
            echohealth.app
          </span>
          <span
            style={{
              fontSize: "20px",
              color: "white",
              padding: "12px 24px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            HIPAA compliant · Licensed clinicians
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
