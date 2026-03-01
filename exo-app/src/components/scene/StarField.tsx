import { useEffect, useRef } from "react";

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameCount = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let stars: { x: number; y: number; r: number; base: number; phase: number }[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Only 80 stars — plenty for the effect
      stars = Array.from({ length: 80 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        base: Math.random() * 0.6 + 0.2,
        phase: Math.random() * 6.28,
      }));

      // Draw once immediately
      drawStatic();
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        ctx.fillStyle = `rgba(200, 215, 255, ${s.base})`;
        ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
      }
    };

    // Animate only every 4th frame (~15fps) — twinkle doesn't need 60fps
    const draw = (time: number) => {
      frameCount.current++;
      if (frameCount.current % 4 === 0) {
        ctx.clearRect(0, 0, w, h);
        const t = time * 0.0008;
        for (const s of stars) {
          const flicker = 0.6 + Math.sin(t + s.phase) * 0.4;
          ctx.fillStyle = `rgba(200, 215, 255, ${s.base * flicker})`;
          ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };

    resize();
    animRef.current = requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
