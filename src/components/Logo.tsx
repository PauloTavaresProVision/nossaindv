"use client";

import { useState } from "react";

interface Props {
  className?: string;
}

/**
 * Logo da Nossa Seguros.
 *
 * Tenta carregar `/logo-nossa.png` (oficial). Se não existir, faz fallback
 * para um SVG que aproxima o oficial.
 *
 * Para usar o oficial, guarda o ficheiro em `public/logo-nossa.png`.
 */
export function NossaLogo({ className = "" }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <FallbackSvg className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- preferimos <img> pelo controlo responsivo via className sem layout shift
    <img
      src="/logo-nossa.png"
      alt="Nossa Seguros"
      className={className}
      onError={() => setErrored(true)}
    />
  );
}

function FallbackSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 96"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Nossa Seguros"
    >
      <defs>
        <radialGradient id="nossaGlobe" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#5a7fbf" />
          <stop offset="55%" stopColor="#142d5e" />
          <stop offset="100%" stopColor="#020a1f" />
        </radialGradient>
        <pattern
          id="nossaDots"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1" fill="#aec3e8" opacity="0.55" />
        </pattern>
        <clipPath id="nossaGlobeClip">
          <circle cx="48" cy="48" r="34" />
        </clipPath>
      </defs>

      {/* Quadrado dark blue arredondado (moldura do globo) */}
      <rect x="6" y="6" width="84" height="84" rx="9" fill="#091a3a" />

      {/* Esfera com gradiente */}
      <circle cx="48" cy="48" r="34" fill="url(#nossaGlobe)" />

      {/* Halftone (padrão de pontos) recortado pela esfera */}
      <g clipPath="url(#nossaGlobeClip)">
        <rect x="14" y="14" width="68" height="68" fill="url(#nossaDots)" />
        {/* Curvas estilizadas a sugerir continentes */}
        <path
          d="M 30 30 Q 42 22 54 30 T 70 38 Q 62 50 50 52 T 36 50 Q 28 42 30 30 Z"
          fill="#0a1d3f"
          opacity="0.45"
        />
        <path
          d="M 32 60 Q 44 56 56 62 T 70 70"
          fill="none"
          stroke="#0a1d3f"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.45"
        />
      </g>

      {/* Highlight */}
      <ellipse cx="36" cy="32" rx="11" ry="7" fill="white" opacity="0.18" />

      {/* Separador vertical */}
      <rect x="106" y="16" width="2" height="64" fill="#091a3a" />

      {/* NOSSA — verde, peso heavy */}
      <text
        x="122"
        y="56"
        fontFamily="Arial Black, Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="44"
        fill="#7fbe3d"
        letterSpacing="-1"
      >
        NOSSA
      </text>

      {/* SEGUROS — azul escuro, espaçado */}
      <text
        x="123"
        y="80"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="500"
        fontSize="14"
        letterSpacing="9"
        fill="#091a3a"
      >
        SEGUROS
      </text>
    </svg>
  );
}
