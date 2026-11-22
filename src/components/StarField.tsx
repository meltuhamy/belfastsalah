import React, { useLayoutEffect, useRef, useState } from "react";
import { fieldSide, makeStarfield, Starfield } from "../lib/starfield";
import "./StarField.css";

/**
 * The Sky theme's stars: a new scatter each time the card appears, turning
 * slowly about the middle of the card's top edge. Fills its positioned parent,
 * which clips it.
 *
 * The faint stars are painted once into a canvas, which the browser then only
 * has to rotate; the few bright ones are elements of their own so each can
 * twinkle on its own phase. Made on mount rather than on render, because the
 * app re-renders every second and a sky that changed with it would flicker.
 */
const StarField: React.FC = () => {
  const box = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sky, setSky] = useState<Starfield | null>(null);

  // A new sky for the card's size, and again if that size grows past what
  // the field covers - a phone turned on its side.
  useLayoutEffect(() => {
    const el = box.current;
    if (el == null) return;
    const make = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setSky((current) =>
        current != null && current.side >= fieldSide(width, height)
          ? current
          : makeStarfield(width, height)
      );
    };
    make();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(make);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = canvas.current;
    if (el == null || sky == null) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.round(sky.side * scale);
    el.height = Math.round(sky.side * scale);
    const context = el.getContext?.("2d");
    if (context == null) return;
    context.scale(scale, scale);
    for (const star of sky.faint) {
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 255, 255, ${star.a.toFixed(2)})`;
      context.fill();
    }
  }, [sky]);

  return (
    <span ref={box} className="StarField" data-testid="starfield">
      {sky != null && (
        <span
          className="StarField__sky"
          style={
            {
              width: sky.side,
              height: sky.side,
              "--start-angle": `${sky.startAngle.toFixed(1)}deg`,
            } as React.CSSProperties
          }
        >
          <canvas ref={canvas} className="StarField__faint" />
          {sky.bright.map((star, i) => (
            <span
              key={i}
              className="StarField__bright"
              style={{
                left: star.x,
                top: star.y,
                width: star.r * 2,
                height: star.r * 2,
                animationDelay: `${(-star.phase * 5.5).toFixed(2)}s`,
              }}
            />
          ))}
        </span>
      )}
    </span>
  );
};

export default StarField;
