import { HEX_REGEX } from "./constants";

export function hexToRgb(hex) {
  const result = HEX_REGEX.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

export function rgbToString(rgb, alpha) {
  if (alpha === void 0) {
    alpha = 1;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
