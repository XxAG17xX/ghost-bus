import type {Metadata, Viewport} from "next";
import {Archivo_Black, Barlow, Barlow_Condensed, Courier_Prime, Doto} from "next/font/google";
import "./globals.css";

// the timetable fonts: Barlow for everything, the condensed one for big numbers and the route
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// the dotted font of the stop board
const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
  weight: "900",
});

// the a4 case file: a heavy title face for the folder, and a typewriter for every finding
const caseTitle = Archivo_Black({
  variable: "--font-case",
  subsets: ["latin"],
  weight: "400",
});
const typed = Courier_Prime({
  variable: "--font-typed",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Ghost bus recorder",
  description: "Records phone GPS on bus rides and saves it to the cloud as it happens",
};

// the colour of the phone's top bar: route blue by day, black at night
export const viewport: Viewport = {
  themeColor: [
    {media: "(prefers-color-scheme: light)", color: "#2438a8"},
    {media: "(prefers-color-scheme: dark)", color: "#0c0c0c"},
  ],
};

export default function RootLayout({children}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${doto.variable} ${caseTitle.variable} ${typed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
