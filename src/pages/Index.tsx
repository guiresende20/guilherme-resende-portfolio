import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import Education from "@/components/Education";
import Skills from "@/components/Skills";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import ChatWidget from "@/components/ChatWidget";

export default function Index() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = window.setTimeout(() => {
      if (id === "chat") {
        window.dispatchEvent(new Event("open-chat"));
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <About />
      <Experience />
      <Projects />
      <Education />
      <Skills />
      <Contact />
      <Footer />
      <ChatWidget />
    </div>
  );
}
