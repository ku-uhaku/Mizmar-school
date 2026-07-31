/**
 * The chrome-free half of the app: documents meant to leave the building.
 *
 * Its own route group so a printable page inherits the providers from the root
 * layout — language, direction, fonts — without the sidebar, the header or the
 * working-context switcher. Nothing here is part of the dashboard shell, which
 * is exactly the point: what is on screen is what comes out of the printer.
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="print-root">{children}</div>;
}
