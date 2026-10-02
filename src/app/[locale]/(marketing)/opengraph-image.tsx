import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { defaultLocale, isLocale, localeTags } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export const alt = "Atlethera";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const dict = await getDictionary(locale);
  const fontDir = join(process.cwd(), "src/assets/fonts");
  const [display, body, mark] = await Promise.all([
    readFile(join(fontDir, "BigShoulders-Black.ttf")),
    readFile(join(fontDir, "InstrumentSans-Medium.ttf")),
    readFile(join(process.cwd(), "src/assets/brand/atlethera-mark.png")),
  ]);
  // Satori's uppercasing is not locale-aware; do it here so "işletim" becomes "İŞLETİM".
  const headline = dict.meta.ogTitle.toLocaleUpperCase(localeTags[locale].intl);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#050706", padding: "64px 72px", position: "relative", fontFamily: "Instrument Sans" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 250, display: "flex", background: "linear-gradient(to top, #12301d, rgba(18,48,29,0))" }} />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, bottom: 36 + i * 30, height: 2, display: "flex", background: `rgba(242,244,237,${0.22 - i * 0.03})` }} />
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>. */}
          <img src={`data:image/png;base64,${mark.toString("base64")}`} width={56} height={56} alt="" />
          <span style={{ fontFamily: "Big Shoulders", fontSize: 44, color: "#f2f4ed", letterSpacing: 1.5 }}>ATLETHERA</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontFamily: "Big Shoulders", fontSize: 132, lineHeight: 0.9, color: "#f2f4ed", maxWidth: 1000 }}>{headline}</div>
          <div style={{ display: "flex", gap: 14 }}>
            {[dict.common.ptPackage, dict.common.coachPackage, "American Football", "Flag Football"].map((tag, i) => (
              <span
                key={tag}
                style={{
                  fontSize: 26,
                  padding: "8px 18px",
                  borderRadius: 999,
                  color: i < 2 ? "#050706" : "#d7ff3a",
                  background: i < 2 ? "#d7ff3a" : "rgba(215,255,58,0.1)",
                  border: "1.5px solid rgba(215,255,58,0.45)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Big Shoulders", data: display, weight: 900, style: "normal" },
        { name: "Instrument Sans", data: body, weight: 500, style: "normal" },
      ],
    },
  );
}
