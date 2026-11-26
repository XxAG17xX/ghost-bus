import Link from "next/link";
import "./stop/stop.css";

// the front cover of the case file: pick what you're doing
export default function Home() {
  return (
    <main className="case-phone cover">
      <div className="phone-folder">
        <p className="phone-tab">CASE GB-26 · DUBLIN BUS BOARDS</p>
        <h1 className="cover-title">The Ghost Bus File</h1>
        <p className="cover-lede">
          The board says your bus is coming. Is it? Ghost bus checks every line on Dublin&apos;s boards against the buses
          actually out there, and riders are the witnesses.
        </p>

        <nav className="cover-index" aria-label="What are you doing?">
          <Link href="/stop" className="cover-entry">
            <span className="cover-entry-title">I&apos;m at a stop</span>
            <span className="cover-entry-what">Check what the board says against what&apos;s really coming.</span>
          </Link>
          <Link href="/ride" className="cover-entry">
            <span className="cover-entry-title">I&apos;m on a bus</span>
            <span className="cover-entry-what">Record the ride. Your phone shows where the bus really is.</span>
          </Link>
          <Link href="/live" className="cover-entry">
            <span className="cover-entry-title">Show the whole city</span>
            <span className="cover-entry-what">Every Dublin bus right now, and the board trips with no bus behind them.</span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
