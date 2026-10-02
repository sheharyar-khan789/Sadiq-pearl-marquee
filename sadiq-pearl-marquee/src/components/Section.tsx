/** Section eyebrow + heading + intro, in the site's editorial style. */
export default function SectionHead({
  eyebrow,
  title,
  intro,
  id,
  align = "left",
  tone = "light",
  className = "",
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  /** id for the <h2>, so the section can use aria-labelledby. */
  id?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      data-reveal
      className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""} ${className}`}
    >
      <p className={`eyebrow ${dark ? "eyebrow-light" : ""} ${align === "center" ? "justify-center" : ""}`}>
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-4 font-display text-[2.375rem] font-medium leading-[1.05] tracking-[-0.01em] sm:text-5xl lg:text-[3.5rem] ${
          dark ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p className={`mt-5 text-base leading-relaxed sm:text-[1.0625rem] ${dark ? "text-white/70" : "text-ink-soft"}`}>
          {intro}
        </p>
      )}
    </div>
  );
}
