import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { usePrefersReducedMotion } from "../lib/motion/usePrefersReducedMotion";
import { hueFromProgress } from "../lib/motion/hue";
import { useMotionEnabled } from "../lib/motion/useMotionEnabled";
import { generateProjectGrid, generateSpiralCloud } from "../lib/scene/shapes";

const POINT_COUNT = 900;
const LINE_STRIDE = 18;
const LERP_FACTOR = 0.06;

function buildColors(): Float32Array {
  const cols = new Float32Array(POINT_COUNT * 3);
  const neon = new THREE.Color("#00ff87");
  const electric = new THREE.Color("#4d8cff");
  const muted = new THREE.Color("#666680");
  for (let i = 0; i < POINT_COUNT; i++) {
    const band = i / POINT_COUNT;
    const color = band % 0.21 < 0.08 ? neon : band % 0.34 < 0.08 ? electric : muted;
    const i3 = i * 3;
    cols[i3] = color.r;
    cols[i3 + 1] = color.g;
    cols[i3 + 2] = color.b;
  }
  return cols;
}

function buildLinePositions(source: Float32Array): Float32Array {
  const pairs: number[] = [];
  for (let i = LINE_STRIDE * 2; i < POINT_COUNT; i += LINE_STRIDE) {
    const prev = (i - LINE_STRIDE) * 3;
    const curr = i * 3;
    pairs.push(
      source[prev], source[prev + 1], source[prev + 2],
      source[curr], source[curr + 1], source[curr + 2],
    );
  }
  return new Float32Array(pairs);
}

function PointCloud() {
  const pointsRef = useRef<THREE.Points>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const scrollProgressRef = useRef(0);
  const gridActiveRef = useRef(false);
  const motionEnabled = useMotionEnabled();
  const pointsMaterialRef = useRef<THREE.PointsMaterial>(null);
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);

  useEffect(() => {
    const hero = document.getElementById("inicio");
    const update = () => {
      if (hero) {
        const rect = hero.getBoundingClientRect();
        const range = rect.height;
        scrollProgressRef.current =
          range > 0 ? Math.max(0, Math.min(1, -rect.top / range)) : 0;
      } else {
        const scrollTop = document.documentElement.scrollTop;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgressRef.current = scrollable > 0 ? scrollTop / scrollable : 0;
      }
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const projetosHeader = document.getElementById("projetos");
    const projetosSection = projetosHeader?.closest("section");
    if (!projetosSection) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        gridActiveRef.current = entry.isIntersecting;
      },
      { threshold: 0.15 },
    );
    observer.observe(projetosSection);
    return () => observer.disconnect();
  }, []);

  const particleTexture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) return null;

    const radius = size / 2;
    const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.48, "rgba(255,255,255,0.92)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  useEffect(() => {
    return () => particleTexture?.dispose();
  }, [particleTexture]);

  const spiralPositions = useMemo(() => generateSpiralCloud(POINT_COUNT), []);
  const gridPositions = useMemo(() => generateProjectGrid(POINT_COUNT), []);
  const colors = useMemo(buildColors, []);
  const currentPositions = useMemo(() => new Float32Array(spiralPositions), [spiralPositions]);
  const initialLinePositions = useMemo(() => buildLinePositions(spiralPositions), [spiralPositions]);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    const target = gridActiveRef.current ? gridPositions : spiralPositions;
    const lerp = motionEnabled ? LERP_FACTOR : 1;

    for (let i = 0; i < currentPositions.length; i++) {
      currentPositions[i] += (target[i] - currentPositions[i]) * lerp;
    }

    if (pointsRef.current) {
      const attr = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      pointsRef.current.rotation.y = t * 0.045 + pointer.x * 0.12;
      pointsRef.current.rotation.x = -0.12 + pointer.y * 0.06;
      pointsRef.current.position.y = Math.sin(t * 0.45) * 0.08;
    }
    if (lineRef.current) {
      const lineAttr = lineRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const lines = lineAttr.array as Float32Array;
      let li = 0;
      for (let i = LINE_STRIDE * 2; i < POINT_COUNT; i += LINE_STRIDE) {
        const prev = (i - LINE_STRIDE) * 3;
        const curr = i * 3;
        lines[li++] = currentPositions[prev];
        lines[li++] = currentPositions[prev + 1];
        lines[li++] = currentPositions[prev + 2];
        lines[li++] = currentPositions[curr];
        lines[li++] = currentPositions[curr + 1];
        lines[li++] = currentPositions[curr + 2];
      }
      lineAttr.needsUpdate = true;
      lineRef.current.rotation.y = t * 0.045 + pointer.x * 0.12;
      lineRef.current.rotation.x = -0.12 + pointer.y * 0.06;
      lineRef.current.position.y = Math.sin(t * 0.45) * 0.08;
    }
    if (motionEnabled) {
      const hue = hueFromProgress(scrollProgressRef.current);
      if (pointsMaterialRef.current) {
        pointsMaterialRef.current.color.setHSL(hue, 0.85, 0.55);
      }
      if (lineMaterialRef.current) {
        lineMaterialRef.current.color.setHSL(hue, 0.85, 0.55);
      }
    }
  });

  return (
    <group position={[1.9, 0.05, 0]} rotation={[0, -0.24, 0]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[currentPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={pointsMaterialRef}
          vertexColors
          map={particleTexture ?? undefined}
          size={0.042}
          sizeAttenuation
          transparent
          opacity={0.9}
          alphaTest={0.01}
          depthWrite={false}
        />
      </points>
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initialLinePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={lineMaterialRef} color="#00ff87" transparent opacity={0.12} />
      </lineSegments>
    </group>
  );
}

function ScanPlanes() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.65) * 0.22;
  });

  return (
    <group ref={groupRef} position={[1.85, 0, -0.6]} rotation={[0.18, -0.55, 0.04]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, (i - 1) * 0.68, 0]}>
          <planeGeometry args={[4.8, 0.012]} />
          <meshBasicMaterial color={i === 1 ? "#00ff87" : "#4d8cff"} transparent opacity={i === 1 ? 0.34 : 0.16} />
        </mesh>
      ))}
    </group>
  );
}

function useDocumentVisibility() {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}

export default function HeroScene3D() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isVisible = useDocumentVisibility();

  if (prefersReducedMotion) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none opacity-60 z-0"
        style={{
          background:
            "linear-gradient(120deg, transparent 0%, rgba(0,255,135,0.05) 46%, rgba(77,140,255,0.08) 70%, transparent 100%)",
        }}
      />
    );
  }

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 6.2], fov: 48 }}
        dpr={[1, 1.6]}
        frameloop={isVisible ? "always" : "never"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.8} />
        <PointCloud />
        <ScanPlanes />
      </Canvas>
    </div>
  );
}
