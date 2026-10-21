// Small, authored fixtures. No third-party network resource is needed.
const svgData = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

export const LANDSCAPE = svgData(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64"><rect width="96" height="64" rx="8" fill="#b4dfd6"/><circle cx="74" cy="16" r="8" fill="#f6cb72"/><path d="M0 54L31 19L62 54Z" fill="#30776e"/><path d="M32 64L67 27L96 64Z" fill="#174b49"/></svg>',
);

// E = mc² represented as paths, so the example needs no font or TeX engine.
export const ENERGY_FORMULA = svgData(
  '<svg xmlns="http://www.w3.org/2000/svg" width="116" height="28" viewBox="0 0 116 28"><g fill="none" stroke="#111111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3V25H18M3 3H18M3 14H15M27 10H43M27 18H43M53 25V11M53 14C57 8 63 8 63 15V25M63 14C68 8 74 8 74 15V25M94 12C80 5 77 30 94 23M100 5C104-1 111 2 108 7L101 13H111"/></g></svg>',
);

// Deliberately malformed image bytes: exercises a local decode failure.
export const BROKEN_IMAGE = 'data:image/png;base64,bm90LWEtcG5n';
