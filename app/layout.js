import "./globals.css";

export const metadata = {
  title: "Onyx Flux",
  description: "A WebGPU onyx study built with Next.js.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
