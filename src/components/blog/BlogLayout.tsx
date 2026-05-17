import type { ReactNode } from "react";
import Navbar from "../Navbar";
import Footer from "../Footer";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
