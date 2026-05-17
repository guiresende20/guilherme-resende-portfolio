import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

function PointCloud() {
  const pointsRef = useRef<THREE.Points>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
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

  const { positions, colors, linePositions } = useMemo(() => {
    const count = 900;
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const linePos: number[] = [];
    const neon = new THREE.Color("#00ff87");
    const electric = new THREE.Color("#4d8cff");
    const muted = new THREE.Color("#666680");

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const band = i / count;
      const radius = 2.2 + Math.sin(i * 0.17) * 0.55 + Math.random() * 1.2;
      const angle = band * Math.PI * 8 + Math.random() * 0.35;
      const height = (Math.random() - 0.5) * 2.8;

      pos[i3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.35;
      pos[i3 + 1] = height + Math.sin(angle * 0.7) * 0.5;
      pos[i3 + 2] = Math.sin(angle) * radius - 1.4 + (Math.random() - 0.5) * 0.35;

      const color = band % 0.21 < 0.08 ? neon : band % 0.34 < 0.08 ? electric : muted;
      cols[i3] = color.r;
      cols[i3 + 1] = color.g;
      cols[i3 + 2] = color.b;

      if (i % 18 === 0 && i > 18) {
        const prev = i3 - 18 * 3;
        linePos.push(pos[prev], pos[prev + 1], pos[prev + 2], pos[i3], pos[i3 + 1], pos[i3 + 2]);
      }
    }

    return {
      positions: pos,
      colors: cols,
      linePositions: new Float32Array(linePos),
    };
  }, []);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.045 + pointer.x * 0.12;
      pointsRef.current.rotation.x = -0.12 + pointer.y * 0.06;
      pointsRef.current.position.y = Math.sin(t * 0.45) * 0.08;
    }
    if (lineRef.current) {
      lineRef.current.rotation.y = t * 0.045 + pointer.x * 0.12;
      lineRef.current.rotation.x = -0.12 + pointer.y * 0.06;
      lineRef.current.position.y = Math.sin(t * 0.45) * 0.08;
    }
  });

  return (
    <group position={[1.9, 0.05, 0]} rotation={[0, -0.24, 0]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          map={particleTexture ?? undefined}
          size={0.026}
          sizeAttenuation
          transparent
          opacity={0.82}
          alphaTest={0.01}
          depthWrite={false}
        />
      </points>
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#00ff87" transparent opacity={0.12} />
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

function useHeroVisibility() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("inicio");
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px 0px 120px 0px", threshold: 0.01 }
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return visible;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

export default function HeroScene3D() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isHeroVisible = useHeroVisibility();

  if (prefersReducedMotion) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "linear-gradient(120deg, transparent 0%, rgba(0,255,135,0.05) 46%, rgba(77,140,255,0.08) 70%, transparent 100%)",
        }}
      />
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 6.2], fov: 48 }}
        dpr={[1, 1.6]}
        frameloop={isHeroVisible ? "always" : "never"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.8} />
        <PointCloud />
        <ScanPlanes />
      </Canvas>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0a0a0f_0%,rgba(10,10,15,0.88)_34%,rgba(10,10,15,0.36)_72%,#0a0a0f_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
