/**
 * The sign-in panel's living backdrop.
 *
 * Three soft lights drifting behind the mark, plus a faint grid of traces
 * creeping upward — the logo's circuit lines, continued past the edge of the
 * logo. It is decoration, and it is built to stay decoration: nothing here
 * animates anything but `transform`, the whole thing is `aria-hidden`, and it
 * sits behind a `pointer-events-none` layer so it can never take a click meant
 * for the form.
 *
 * The colours are the mark's own — the cyan of its traces, the blue of the
 * flute, the copper of the bell — so the panel reads as an extension of the
 * logo rather than as a gradient somebody happened to pick. They are literal
 * values rather than theme tokens on purpose: this is the *product's* brand,
 * which does not change when a school picks a different accent, and wiring it
 * to `--primary` would let one do exactly that.
 *
 * The keyframes live in app/globals.css, beside the note on why every duration
 * is so long.
 */
export function AuroraBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* The deep base the lights sit in. Darker than --primary so the copper
          orb has something to glow against. */}
      <div className="absolute inset-0 bg-[#0b1b3a]" />

      <div
        className="mizmar-orb mizmar-orb-a -top-32 -start-24 size-[36rem] opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, #22d3ee 0%, rgba(34,211,238,0) 70%)",
        }}
      />
      <div
        className="mizmar-orb mizmar-orb-b top-1/3 -end-40 size-[40rem] opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, #2563eb 0%, rgba(37,99,235,0) 70%)",
        }}
      />
      <div
        className="mizmar-orb mizmar-orb-c -bottom-24 start-1/4 size-[34rem] opacity-55"
        style={{
          background:
            "radial-gradient(closest-side, #c8862f 0%, rgba(200,134,47,0) 70%)",
        }}
      />

      {/* Kept faint: at any weight where you can read the grid, you are reading
          the grid instead of the headline in front of it. */}
      <div className="mizmar-traces opacity-40" />

      {/* Darkened towards the bottom, where the copyright line sits, and towards
          the middle, where the headline does. Without this the copper orb
          drifts under the text once a cycle and takes the contrast with it. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06122a]/70 via-[#06122a]/25 to-transparent" />
    </div>
  );
}
