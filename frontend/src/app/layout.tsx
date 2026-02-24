import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthProvider from "@/contexts/AuthContext";
import PinGuard from "@/components/PinGuard";
import ToasterProvider from "@/components/ToasterProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Kardex Ticket Management",
  description: "Kardex Ticket Management System",
  icons: {
    icon: [
      { url: "/favicon-circle-simple.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/favicon-circle.svg", sizes: "64x64", type: "image/svg+xml" },
      { url: "/logo.png", sizes: "48x48", type: "image/png" },
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "16x16", type: "image/png" }
    ],
    shortcut: "/favicon-circle-simple.svg",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased text-[#2D3132]`}>
        <AuthProvider>
          <PinGuard>
            {children}
          </PinGuard>
          <ToasterProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
