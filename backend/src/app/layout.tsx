export const metadata = {
  title: "Koyal Kinare API",
  description: "Backend API for Koyal Kinare Cafe Management App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
