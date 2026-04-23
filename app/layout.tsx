import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlgoLens",
  description: "A browser workbench for stepping through data-structure traces.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
