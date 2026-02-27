import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Club Albania Manager - Menaxhimi i Ekipit të Volejbollit",
  description: "Sistemi i menaxhimit për ekipin e volejbollit Club Albania. Menaxhoni lojtarët dhe pagesat mujore.",
  keywords: ["Club Albania", "volejboll", "menaxhim", "lojtarë", "pagesa", "Shqipëri"],
  authors: [{ name: "Club Albania" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Club Albania Manager",
    description: "Sistemi i menaxhimit për ekipin e volejbollit Club Albania",
    siteName: "Club Albania Manager",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
