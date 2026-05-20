import { useEffect, useRef } from "react";
import { useMotionEnabled } from "../lib/motion/useMotionEnabled";
import {
  lerp,
  findClosestTarget,
  decayedTrail,
  type Point,
} from "../lib/motion/cursorHelpers";

const NEON = "#00ff87";
const MAGNET_RADIUS = 80;
const TRAIL_COUNT = 8;
const TARGET_SELECTOR =
  'a[href], button, [role="button"], [data-magnetic]';

export default function MagneticCursor() {
  const motionEnabled = useMotionEnabled();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!motionEnabled) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9998";
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const mouse: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let cursorPos: Point = { ...mouse };
    const trail: Point[] = [];
    let raf = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    const tick = () => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(TARGET_SELECTOR),
      ).filter((el) => el.getAttribute("data-magnetic") !== "off");

      const rects = els.map((el) => el.getBoundingClientRect());
      const closest = findClosestTarget(rects, mouse, MAGNET_RADIUS);

      if (closest) {
        const tx = closest.rect.left + closest.rect.width / 2;
        const ty = closest.rect.top + closest.rect.height / 2;
        cursorPos = {
          x: lerp(cursorPos.x, tx, 0.18),
          y: lerp(cursorPos.y, ty, 0.18),
        };
      } else {
        cursorPos = {
          x: lerp(cursorPos.x, mouse.x, 0.4),
          y: lerp(cursorPos.y, mouse.y, 0.4),
        };
      }

      trail.push({ ...cursorPos });
      if (trail.length > TRAIL_COUNT * 2) trail.splice(0, trail.length - TRAIL_COUNT * 2);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";

      const frames = decayedTrail(trail, TRAIL_COUNT);
      for (let i = frames.length - 1; i >= 0; i--) {
        const f = frames[i];
        ctx.beginPath();
        ctx.fillStyle = NEON;
        ctx.globalAlpha = f.opacity;
        ctx.arc(f.x, f.y, Math.max(1, f.radius), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.strokeStyle = NEON;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = NEON;
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, 2, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [motionEnabled]);

  return null;
}
