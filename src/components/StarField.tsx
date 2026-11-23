import React, { useLayoutEffect, useRef, useState } from "react";
import {
  DepthStar,
  fieldSide,
  makeStarfield,
  STAR_LAYERS,
  Starfield,
} from "../lib/starfield";
import { useTilt } from "../lib/useTilt";
import "./StarField.css";

/**
 * The Sky theme's stars: a new scatter each time the card appears, turning
 * slowly about the middle of the card's top edge. Fills its positioned parent,
 * which clips it.
 *
 * The stars sit at three depths, each its own layer turning in step with the
 * others: the two faint ones are painted once into a canvas each, which the
 * browser then only has to move; the few bright, nearest stars are elements
 * of their own so each can twinkle on its own phase. Made on mount rather
 * than on render, because the app re-renders every second and a sky that
 * changed with it would flicker.
 *
 * Tipping the phone shifts each layer a few px the other way, the near ones
 * furthest (STAR_LAYERS), so they slide past each other and the sky has
 * depth. That is written straight onto the elements, once a frame at most and
 * eased in CSS - not through state, for the same once-a-second reason.
 */
const StarField: React.FC = () => {
  const box = useRef<HTMLSpanElement>(null);
  const canvases = useRef<Array<HTMLCanvasElement | null>>([]);
  const layers = useRef<Array<HTMLSpanElement | null>>([]);
  const [sky, setSky] = useState<Starfield | null>(null);

  useTilt(({ x, y }) => {
    STAR_LAYERS.forEach((layer, i) => {
      layers.current[i]?.style.setProperty(
        "transform",
        `translate3d(${(x * layer.shift).toFixed(2)}px, ${(
          y * layer.shift
        ).toFixed(2)}px, 0)`
      );
    });
  });

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

  // The two faint layers, painted once each.
  useLayoutEffect(() => {
    if (sky == null) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    [0, 1].forEach((depth) => {
      const el = canvases.current[depth];
      if (el == null) return;
      el.width = Math.round(sky.side * scale);
      el.height = Math.round(sky.side * scale);
      const context = el.getContext?.("2d");
      if (context == null) return;
      context.scale(scale, scale);
      sky.faint
        .filter((star: DepthStar) => star.depth === depth)
        .forEach((star) => {
          context.beginPath();
          context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          context.fillStyle = `rgba(255, 255, 255, ${star.a.toFixed(2)})`;
          context.fill();
        });
    });
  }, [sky]);

  const field = (children: React.ReactNode) =>
    sky == null ? null : (
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
        {children}
      </span>
    );

  return (
    <span ref={box} className="StarField" data-testid="starfield">
      {STAR_LAYERS.map((_, depth) => (
        <span
          key={depth}
          ref={(el) => {
            layers.current[depth] = el;
          }}
          className="StarField__tilt"
          data-depth={depth}
        >
          {field(
            depth < 2 ? (
              <canvas
                ref={(el) => {
                  canvases.current[depth] = el;
                }}
                className="StarField__faint"
              />
            ) : (
              sky?.bright.map((star, i) => (
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
              ))
            )
          )}
        </span>
      ))}
    </span>
  );
};

export default StarField;
