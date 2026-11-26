import { Archivo_Black, Courier_Prime } from "next/font/google";

// the case file's two fonts: a heavy title face for the folder, and a typewriter for every finding
const title = Archivo_Black({ variable: "--font-case", subsets: ["latin"], weight: "400" });
const typed = Courier_Prime({ variable: "--font-typed", subsets: ["latin"], weight: ["400", "700"] });

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${title.variable} ${typed.variable}`}>{children}</div>;
}
