import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Gaming Cabinet",
  description: "Place where you can have fun",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
