export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-amadeus-blue-50/30">{children}</div>;
}
