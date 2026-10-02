import type { L10n, SportId } from "@/domain/sports/types";

/**
 * The two packages on the landing page. Prices are NOT decided yet: each stays
 * `{ status: "tbd" }` until the founder supplies real amounts.
 */
export type Currency = "TRY" | "USD" | "EUR";

export type Price = { status: "tbd" } | { status: "set"; currency: Currency; monthly: number };

export interface Package {
  id: "pt" | "coach";
  name: L10n;
  audience: L10n;
  features: L10n[];
  /** Sports the buyer chooses from at checkout. Only the Coach package has them. */
  sports?: SportId[];
  price: Price;
}

export const packages: Package[] = [
  {
    id: "pt",
    name: { tr: "PT", en: "PT" },
    audience: { tr: "Sporcularıyla bire bir çalışan personal trainer'lar için.", en: "For personal trainers who work one-on-one." },
    features: [
      { tr: "Sporcu profilleri ve ölçümler", en: "Athlete profiles and measurements" },
      { tr: "Kişisel antrenman programları", en: "Individual training programs" },
      { tr: "Seans kaydı: set, tekrar, yük, RPE", en: "Session logs: sets, reps, load, RPE" },
      { tr: "Formül tabanlı beslenme hedefleri", en: "Formula-based nutrition targets" },
      { tr: "İlerleme takibi ve performans testleri", en: "Progress tracking and performance tests" },
    ],
    price: { status: "tbd" },
  },
  {
    id: "coach",
    name: { tr: "Koç", en: "Coach" },
    audience: { tr: "Takımını yöneten koçlar için. Branşını seçersin, sistem ona göre kurulur.", en: "For coaches running a team. Pick your sport and the system is built for it." },
    features: [
      { tr: "Takım, roster ve staff yönetimi", en: "Team, roster and staff management" },
      { tr: "Takım antrenmanı ve takvim", en: "Team practice and calendar" },
      { tr: "Video analiz ve playbook", en: "Video analysis and playbook" },
      { tr: "Toplantılar ve kayıt erişimi", en: "Meetings and recording access" },
      { tr: "Branşa özel istatistik ve oyuncu değerlendirme", en: "Sport-specific stats and player evaluation" },
    ],
    sports: ["american-football", "flag-football"],
    price: { status: "tbd" },
  },
];
