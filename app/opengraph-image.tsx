import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Echo Health — online therapy with licensed therapists in Kenya";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card.
 *
 * The badge here used to read "HIPAA compliant". HIPAA is a United States
 * statute with no application to a Kenyan service, and the rest of the site
 * had already removed that claim — but this file kept reasserting it in the
 * one asset that travels furthest, since it is what appears every time anyone
 * pastes an Echo link into a chat, a tweet or a message. A false claim in an
 * image is no less false for being hard to grep.
 *
 * Sitting at the app root, this cascades to every segment and outranks the
 * `openGraph.images` metadata field, so it is the card for all ~30 public
 * routes. If a page ever needs its own, add an `opengraph-image.tsx` to that
 * segment rather than editing this one.
 */
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
            You deserve <br /> to be heard.
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
            Licence-verified therapists
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
