/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Gender } from '../types';

// Deterministic seed-based PRNG
class SeededRandom {
  private seed: number;

  constructor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    this.seed = Math.abs(hash) || 987654321;
  }

  // Float [0, 1)
  next(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  // Range [min, max]
  range(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // Pick random element
  choice<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // Boolean with probability
  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }
}

interface PixelAvatarProps {
  seed: string;
  gender: Gender;
  size?: number | string;
  className?: string;
  id?: string;
}

export default function PixelAvatar({ seed, gender, size = 48, className = '', id }: PixelAvatarProps) {
  // Generate the 12x12 grid deterministically using the seed and gender
  const pixelGrid = useMemo(() => {
    const rng = new SeededRandom(seed + '_' + gender);

    // Initializing 12x12 grid to background colors
    const grid: string[][] = Array(12)
      .fill(null)
      .map(() => Array(12).fill(''));

    // Dark slate background or cyber colors
    const backgroundPalette = [
      '#0f172a', // Slate 900
      '#1e1b4b', // Indigo 950
      '#180025', // Dark deep purple
      '#020617', // Slate 950
      '#172554', // Blue 950
      '#14532d', // Green 950
      '#3b0764', // Purple 950
      '#450a0a', // Red 950
    ];
    const bagColor = rng.choice(backgroundPalette);

    // Filling background
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        grid[r][c] = bagColor;
      }
    }

    // 1. Skin tones
    const skinPalette = [
      '#fcd34d', // warm yellow-tan
      '#f87171', // reddish blush tan
      '#fdba74', // light peach
      '#f59e0b', // gold glow
      '#d97706', // bronze-dark
      '#b45309', // rich mahogany dark
      '#78350f', // deep ebony
      '#ffedd5', // pale cream
      '#fed7aa', // light sandy
      '#9a3412', // reddish brown skin
    ];
    const skinColor = rng.choice(skinPalette);

    // 2. Hair color
    const hairColors = [
      '#1e293b', // black
      '#451a03', // rich dark brown
      '#78350f', // deep warm brown
      '#ca8a04', // golden blonde
      '#b45309', // copper orange / auburn
      '#7c2d12', // deep ginger/rust
      '#e2e8f0', // platinum white
      '#64748b', // stylish steel gray
      '#db2777', // hot pink
      '#9333ea', // neon purple
      '#2563eb', // electric blue
      '#059669', // techno emerald green
    ];
    const hairColor = rng.choice(hairColors);

    // 3. Clothes / Shirt color
    const clothingColors = [
      '#ef4444', // Red
      '#f97316', // Orange
      '#eab308', // Yellow
      '#22c55e', // Green
      '#06b6d4', // Cyan
      '#3b82f6', // Blue
      '#6366f1', // Indigo
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#f43f5e', // Rose
    ];
    const shirtColor = rng.choice(clothingColors);

    // 4. Eye colors
    const eyeColors = [
      '#38bdf8', // bright sky-blue
      '#4ade80', // neon bright green
      '#fbbf24', // golden yellow
      '#a78bfa', // pastel violet
      '#f472b6', // pink
      '#bfdbfe', // crystal ice blue
      '#ffffff', // simple high contrast white
    ];
    const eyeColor = rng.choice(eyeColors);

    // Draw central base body (neck + shoulders)
    // Clothes: Row 10 and 11
    for (let c = 2; c <= 9; c++) {
      grid[10][c] = shirtColor;
      grid[11][c] = shirtColor;
    }
    // Deepen shoulders
    grid[11][1] = shirtColor;
    grid[11][10] = shirtColor;

    // Neck: Row 9, Columns 5,6
    grid[9][5] = skinColor;
    grid[9][6] = skinColor;

    // Draw Face Base (Rows 3 to 8, columns 3 to 8)
    for (let r = 3; r <= 8; r++) {
      for (let c = 3; c <= 8; c++) {
        grid[r][c] = skinColor;
      }
    }

    // Ear pixels
    grid[5][2] = skinColor;
    grid[5][9] = skinColor;
    grid[6][2] = skinColor;
    grid[6][9] = skinColor;

    // Generate gender-specific assets
    if (gender === 'male') {
      // --- MALE HAIR GENERATOR ---
      const maleHairStyle = rng.range(1, 5);
      
      // Basic flat hair top (Rows 2, Columns 3 to 8; Row 1, Columns 4 to 7)
      if (maleHairStyle === 1) { // Short crop
        for (let c = 3; c <= 8; c++) grid[2][c] = hairColor;
        for (let c = 4; c <= 7; c++) grid[1][c] = hairColor;
        // Sideburns
        grid[3][2] = hairColor;
        grid[3][9] = hairColor;
        grid[4][2] = hairColor;
        grid[4][9] = hairColor;
      } else if (maleHairStyle === 2) { // Mohawk / Spike
        for (let c = 5; c <= 6; c++) {
          grid[0][c] = hairColor;
          grid[1][c] = hairColor;
          grid[2][c] = hairColor;
        }
        for (let c = 4; c <= 7; c++) grid[2][c] = hairColor;
        grid[3][5] = hairColor;
        grid[3][6] = hairColor;
      } else if (maleHairStyle === 3) { // Side-part / Pompadour
        for (let c = 3; c <= 9; c++) grid[2][c] = hairColor;
        for (let c = 4; c <= 8; c++) grid[1][c] = hairColor;
        for (let c = 5; c <= 7; c++) grid[0][c] = hairColor;
        grid[3][3] = hairColor;
        grid[3][4] = hairColor;
        grid[4][3] = hairColor;
      } else if (maleHairStyle === 4) { // Messy / Frigid
        for (let c = 3; c <= 8; c++) grid[2][c] = hairColor;
        // Specks on row 1
        grid[1][3] = hairColor;
        grid[1][5] = hairColor;
        grid[1][6] = hairColor;
        grid[1][8] = hairColor;
      } else { // Cap/Helmet Style
        const capColors = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#4f46e5', '#3f3f46'];
        const capColor = rng.choice(capColors);
        for (let c = 3; c <= 8; c++) grid[2][c] = capColor;
        for (let c = 2; c <= 9; c++) grid[1][c] = capColor;
        grid[2][2] = capColor; // Cap bill
        grid[2][1] = capColor; // Cap bill edge
      }

      // --- MALE EYES ---
      grid[4][4] = '#ffffff';
      grid[4][7] = '#ffffff';
      grid[5][4] = eyeColor;
      grid[5][7] = eyeColor;

      // --- MALE FACIAL HAIR (Beard/Mustache) ---
      const hasBeard = rng.bool(0.6);
      if (hasBeard) {
        const beardType = rng.range(1, 3);
        const beardColors = [hairColor, '#18181b', '#27272a', '#3f3f46'];
        const beardColor = rng.choice(beardColors);

        if (beardType === 1) { // Full beard
          for (let c = 3; c <= 8; c++) grid[8][c] = beardColor;
          grid[7][3] = beardColor;
          grid[7][8] = beardColor;
          grid[6][3] = beardColor;
          grid[6][8] = beardColor;
          // mustache
          grid[7][5] = beardColor;
          grid[7][6] = beardColor;
        } else if (beardType === 2) { // Goatee / Chin strap
          grid[8][5] = beardColor;
          grid[8][6] = beardColor;
          grid[8][4] = beardColor;
          grid[8][7] = beardColor;
          grid[7][5] = beardColor;
          grid[7][6] = beardColor;
        } else { // Mustache alone
          grid[7][4] = beardColor;
          grid[7][5] = beardColor;
          grid[7][6] = beardColor;
          grid[7][7] = beardColor;
        }
      }

      // --- MALE MOUTH ---
      // If beard did not cover mouth
      if (grid[7][5] === skinColor) {
        grid[7][5] = '#18181b';
        grid[7][6] = '#18181b';
      }

    } else {
      // --- FEMALE HAIR GENERATOR ---
      const femaleHairStyle = rng.range(1, 5);

      if (femaleHairStyle === 1) { // Long locks flowing down the side
        // Crown
        for (let c = 3; c <= 8; c++) grid[2][c] = hairColor;
        for (let c = 4; c <= 7; c++) grid[1][c] = hairColor;
        // Sides flowing down
        for (let r = 3; r <= 9; r++) {
          grid[r][2] = hairColor;
          grid[r][9] = hairColor;
        }
        for (let r = 5; r <= 10; r++) {
          grid[r][1] = hairColor;
          grid[r][10] = hairColor;
        }
      } else if (femaleHairStyle === 2) { // Cute Bob / Bangs
        for (let c = 3; c <= 8; c++) grid[2][c] = hairColor;
        for (let c = 4; c <= 7; c++) grid[1][c] = hairColor;
        // Bangs on row 3
        grid[3][3] = hairColor;
        grid[3][4] = hairColor;
        grid[3][7] = hairColor;
        grid[3][8] = hairColor;
        grid[3][5] = hairColor; // full bang
        // Short sides
        for (let r = 3; r <= 6; r++) {
          grid[r][2] = hairColor;
          grid[r][9] = hairColor;
        }
      } else if (femaleHairStyle === 3) { // Pixie / Short Chic
        for (let c = 3; c <= 8; c++) grid[2][c] = hairColor;
        for (let c = 2; c <= 9; c++) grid[1][c] = hairColor;
        grid[3][3] = hairColor;
        grid[3][8] = hairColor;
        grid[4][2] = hairColor;
        grid[4][9] = hairColor;
      } else if (femaleHairStyle === 4) { // Space Buns (two round shapes on top corners)
        // Main skull hair
        for (let c = 3; c <= 8; c++) grid[2][c] = hairColor;
        for (let c = 4; c <= 7; c++) grid[1][c] = hairColor;
        // Buns at row 0, 1
        grid[0][1] = hairColor; grid[0][2] = hairColor;
        grid[1][1] = hairColor; grid[1][2] = hairColor;
        grid[0][9] = hairColor; grid[0][10] = hairColor;
        grid[1][9] = hairColor; grid[1][10] = hairColor;
        // Short sides
        grid[3][2] = hairColor;
        grid[3][9] = hairColor;
        grid[4][2] = hairColor;
        grid[4][9] = hairColor;
      } else { // Ponytail to one side (asymmetric!)
        for (let c = 3; c <= 8; c++) grid[2][c] = hairColor;
        for (let c = 4; c <= 7; c++) grid[1][c] = hairColor;
        // Side bangs
        grid[3][3] = hairColor;
        grid[3][4] = hairColor;
        // Flow of ponytail on the right
        grid[3][9] = hairColor;
        grid[4][9] = hairColor;
        grid[4][10] = hairColor;
        grid[5][10] = hairColor;
        grid[6][10] = hairColor;
        grid[7][10] = hairColor;
        grid[8][9] = hairColor;
      }

      // --- FEMALE EYES ---
      // Eyelashes & eyes
      grid[4][4] = '#ffffff';
      grid[4][7] = '#ffffff';
      grid[5][4] = eyeColor;
      grid[5][7] = eyeColor;
      // High shadow / eyelashes
      grid[4][3] = hairColor; // lash corner
      grid[4][8] = hairColor; // lash corner

      // --- ACCENTS (Blush & Earrings) ---
      grid[6][3] = '#fca5a5'; // Cute blush left cheek
      grid[6][8] = '#fca5a5'; // Cute blush right cheek

      const hasEarrings = rng.bool(0.7);
      if (hasEarrings) {
        const jewelGroup = ['#facc15', '#f43f5e', '#a855f7', '#06b6d4'];
        const jewelColor = rng.choice(jewelGroup);
        grid[7][2] = jewelColor; // Hanging earring
        grid[7][9] = jewelColor; // Hanging earring
      }

      // Accessories: Bow or head flower
      const hasAccessory = rng.bool(0.4);
      if (hasAccessory) {
        const bowColors = ['#ef4444', '#f472b6', '#4f46e5', '#10b981'];
        const bowColor = rng.choice(bowColors);
        grid[1][3] = bowColor;
        grid[1][4] = bowColor;
        grid[0][3] = bowColor;
      }

      // --- FEMALE MOUTH ---
      // Cute pink/red lips smile
      grid[7][5] = '#f43f5e';
      grid[7][6] = '#f43f5e';
    }

    return grid;
  }, [seed, gender]);

  return (
    <svg
      id={id}
      viewBox="0 0 12 12"
      width={size}
      height={size}
      className={`rounded-xl overflow-hidden shadow-md flex-shrink-0 select-none ${className}`}
      shapeRendering="crispEdges"
      style={{ minWidth: size, minHeight: size }}
    >
      {pixelGrid.map((row, r) =>
        row.map((color, c) => (
          <rect
            key={`${r}-${c}`}
            x={c}
            y={r}
            width={1}
            height={1}
            fill={color}
          />
        ))
      )}
    </svg>
  );
}
