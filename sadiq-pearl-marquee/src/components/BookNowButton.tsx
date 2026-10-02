import Link from "next/link";

/** The one booking entry point: every "Book" CTA leads to /book (sign-in gate → availability → request). */
export const BOOK_PATH = "/book";

export default function BookNowButton({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link href={BOOK_PATH} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
