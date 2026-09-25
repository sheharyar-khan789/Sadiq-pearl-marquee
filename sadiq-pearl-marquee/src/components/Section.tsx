export default function SectionHead({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`mb-10 md:mb-14 max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold mb-3">{eyebrow}</p>
      <h2 className="font-display text-[30px] leading-[38px] md:text-[40px] md:leading-[50px] text-ink">{title}</h2>
      {intro && <p className="mt-4 text-base leading-7 text-ink-soft">{intro}</p>}
    </div>
  );
}
