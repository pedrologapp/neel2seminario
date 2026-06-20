import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "NEEL — Núcleo Espírita Esperança de Luz",
    template: "%s · NEEL",
  },
  description:
    "NEEL — Núcleo Espírita Esperança de Luz — Eventos, inscrições e pagamentos online.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "NEEL — Núcleo Espírita Esperança de Luz",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
