import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TruBrand",
  description: "Brand governance and content review platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#F8FAFC] text-[#1E293B]">
        {children}
      </body>
    </html>
  );
}
