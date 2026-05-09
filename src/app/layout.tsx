import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nossa Seguros",
  description: "Portal Nossa Seguros",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
