import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meet Duo | Private 1-on-1 Video Calling & Chat",
  description: "Secure, low-bandwidth 1-on-1 Google Meet style video calling and instant messaging for you and your friend.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-[#131314] text-[#e8eaed]">{children}</body>
    </html>
  );
}
