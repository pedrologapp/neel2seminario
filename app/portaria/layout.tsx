import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portaria · NEEL",
};

export default function PortariaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-neel-blue-50/30">{children}</div>;
}
