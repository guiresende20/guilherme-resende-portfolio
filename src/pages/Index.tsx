import { lazy, Suspense, useEffect, useState } from "react";
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

const HeroScene3D = lazy(() => import("@/components/HeroScene3D"));

function useIdleSceneLoad(): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleId: number | undefined;
    let triggered = false;

    const fire = () => setLoaded(true);
    const remove = () => {
      window.removeEventListener("pointermove", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("touchstart", schedule);
      window.removeEventListener("keydown", schedule);
    };
    const schedule = () => {
      if (triggered) return;
      triggered = true;
      remove();
      if (win.requestIdleCallback) {
        idleId = win.requestIdleCallback(fire, { timeout: 1200 });
      } else {
        fire();
      }
    };

    window.addEventListener("pointermove", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("touchstart", schedule, { passive: true });
    window.addEventListener("keydown", schedule);

    return () => {
      remove();
      if (idleId !== undefined) win.cancelIdleCallback?.(idleId);
    };
  }, []);

  return loaded;
}

export default function Index() {
  const location = useLocation();
  const shouldLoadScene = useIdleSceneLoad();

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
      {shouldLoadScene && (
        <Suspense fallback={null}>
          <HeroScene3D />
        </Suspense>
      )}
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
