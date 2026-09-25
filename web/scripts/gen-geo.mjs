// Build-time geodata for the Edge Console (Natural Earth 110m land via world-atlas, public domain).
//   src/data/globe-dots.json  -> [lon*10, lat*10, glow(0-9), ...] land points on a Fibonacci sphere
//   src/data/flat-map.json    -> dotted equirectangular mini map + projected city positions
// Run: npm run gen:geo
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoContains, geoDistance, geoEquirectangular } from "d3-geo";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/land-110m.json", "utf8"));
const land = feature(topo, topo.objects.land);
const RAD = Math.PI / 180;

// Major metro areas [lon, lat, weight] — drives the "city lights" glow on the globe.
const METROS = [
  [139.69, 35.69, 3], [135.5, 34.69, 2], [126.98, 37.57, 3], [116.4, 39.9, 3], [121.47, 31.23, 3], [113.26, 23.13, 3],
  [114.17, 22.32, 2], [104.07, 30.67, 2], [106.55, 29.56, 2], [114.3, 30.59, 2], [108.94, 34.34, 1.5], [117.2, 39.13, 2],
  [121.56, 25.03, 2], [120.98, 14.6, 3], [100.5, 13.76, 3], [106.63, 10.82, 2.5], [105.83, 21.03, 2], [101.69, 3.14, 2],
  [103.82, 1.35, 2.5], [106.85, -6.21, 3], [112.75, -7.25, 2], [107.6, -6.9, 1.5], [96.2, 16.87, 1.5], [90.41, 23.81, 3],
  [88.36, 22.57, 3], [77.21, 28.61, 3], [72.88, 19.08, 3], [77.59, 12.97, 2.5], [80.27, 13.08, 2.5], [78.49, 17.39, 2.5],
  [67.0, 24.86, 3], [74.35, 31.55, 2.5], [79.86, 6.93, 1.5], [51.39, 35.69, 2.5], [46.68, 24.71, 2], [55.27, 25.2, 2],
  [28.98, 41.01, 3], [44.36, 33.31, 2], [-0.13, 51.51, 3], [2.35, 48.86, 3], [-3.7, 40.42, 2], [2.17, 41.39, 1.5],
  [12.5, 41.9, 2], [9.19, 45.46, 2], [13.4, 52.52, 2], [8.68, 50.11, 1.5], [7.0, 51.4, 2.5], [4.9, 52.37, 2],
  [21.01, 52.23, 1.5], [37.62, 55.76, 3], [30.34, 59.93, 1.5], [30.52, 50.45, 1.5], [16.37, 48.21, 1.5], [23.73, 37.98, 1.5],
  [31.24, 30.04, 3], [3.38, 6.52, 3], [15.27, -4.44, 2], [28.05, -26.2, 2.5], [36.82, -1.29, 1.5], [38.75, 9.03, 1.5],
  [-7.59, 33.57, 1.5], [-74.0, 40.71, 3], [-87.63, 41.88, 3], [-79.38, 43.65, 2], [-84.39, 33.75, 2], [-80.19, 25.76, 2],
  [-96.8, 32.78, 2.5], [-95.37, 29.76, 2.5], [-118.24, 34.05, 3], [-122.42, 37.77, 2.5], [-122.33, 47.61, 2],
  [-99.13, 19.43, 3], [-74.07, 4.71, 2], [-77.04, -12.05, 2], [-70.67, -33.45, 2], [-58.38, -34.6, 3], [-46.63, -23.55, 3],
  [-43.17, -22.91, 2.5], [151.21, -33.87, 2.5], [144.96, -37.81, 2.5], [153.03, -27.47, 1.5], [115.86, -31.95, 1.5],
  [174.76, -36.85, 1.5], [127.0, 37.3, 1.5], [133.0, 34.0, 1.2], [110.0, 20.0, 1.0], [118.8, 32.06, 2], [120.15, 30.27, 2],
];

// ---- globe: land points on a Fibonacci sphere ----
const N = 22000;
const golden = Math.PI * (3 - Math.sqrt(5));
const globe = [];
let lit = 0;
for (let i = 0; i < N; i++) {
  const y = 1 - (2 * (i + 0.5)) / N;
  const r = Math.sqrt(1 - y * y);
  const phi = i * golden;
  const lat = Math.asin(y) / RAD;
  const lon = ((Math.atan2(Math.sin(phi) * r, Math.cos(phi) * r) / RAD + 540) % 360) - 180;
  if (lat < -60) continue; // skip Antarctica
  if (!geoContains(land, [lon, lat])) continue;
  let glow = 0;
  for (const [mx, my, w] of METROS) {
    const d = geoDistance([lon, lat], [mx, my]) / RAD; // degrees
    if (d < 9) glow += w * Math.exp(-((d / 2.4) ** 2));
  }
  const g = Math.min(9, Math.round(glow * 3));
  if (g > 0) lit++;
  globe.push(Math.round(lon * 10), Math.round(lat * 10), g);
}
writeFileSync("src/data/globe-dots.json", JSON.stringify(globe));
console.log(`globe: ${globe.length / 3} land dots (${lit} lit)`);

// ---- flat mini map (equirectangular, 60N..-55S) ----
const W = 360, H = 118, STEP = 4;
const proj = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, 0]).center([10, 62]);
const dots = [];
for (let y = STEP / 2; y < H; y += STEP) {
  for (let x = STEP / 2; x < W; x += STEP) {
    const ll = proj.invert([x, y]);
    if (ll && ll[1] > -56 && geoContains(land, ll)) dots.push(`M${x} ${y}h0`);
  }
}
const CITIES = {
  SIN: [103.82, 1.35], BKK: [100.5, 13.76], HKG: [114.17, 22.32], NRT: [139.69, 35.69], ICN: [126.98, 37.57],
  SYD: [151.21, -33.87], MEL: [144.96, -37.81], BOM: [72.88, 19.08], DEL: [77.21, 28.61], CGK: [106.85, -6.21],
  MNL: [120.98, 14.6], KUL: [101.69, 3.14], DXB: [55.27, 25.2], FRA: [8.68, 50.11], LHR: [-0.45, 51.47],
  CDG: [2.35, 48.86], AMS: [4.9, 52.37], JNB: [28.05, -26.2], LOS: [3.38, 6.52], CAI: [31.24, 30.04],
  IAD: [-77.49, 39.04], ORD: [-87.63, 41.88], DFW: [-96.8, 32.78], LAX: [-118.24, 34.05], SJC: [-121.89, 37.34],
  SEA: [-122.33, 47.61], MIA: [-80.19, 25.76], GRU: [-46.63, -23.55], EZE: [-58.38, -34.6], BOG: [-74.07, 4.71],
  MEX: [-99.13, 19.43], YYZ: [-79.38, 43.65],
};
const cities = Object.fromEntries(Object.entries(CITIES).map(([k, ll]) => [k, proj(ll).map((v) => Math.round(v * 10) / 10)]));
writeFileSync("src/data/flat-map.json", JSON.stringify({ width: W, height: H, path: dots.join(""), cities }));
console.log(`flat map: ${W}x${H}, ${dots.length} dots`);
