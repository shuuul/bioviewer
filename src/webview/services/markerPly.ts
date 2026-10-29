import type { MarkerSet } from "@molstudio/core";

type RgbBytes = [number, number, number];

interface PlyVertex {
  position: [number, number, number];
  color: RgbBytes;
  group: number;
}

type PlyFace = [number, number, number];

interface PlyMesh {
  vertices: PlyVertex[];
  faces: PlyFace[];
}

const SPHERE_LATITUDE_SEGMENTS = 12;
const SPHERE_LONGITUDE_SEGMENTS = 24;
const TUBE_SEGMENTS = 12;
const MIN_VECTOR_LENGTH = 1e-6;

function hexToBytes(hex: string): RgbBytes {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as RgbBytes;
}

function addVertex(
  mesh: PlyMesh,
  position: [number, number, number],
  color: RgbBytes,
  group: number,
): number {
  mesh.vertices.push({ position, color, group });
  return mesh.vertices.length - 1;
}

function addFace(mesh: PlyMesh, a: number, b: number, c: number): void {
  mesh.faces.push([a, b, c]);
}

function addSphere(
  mesh: PlyMesh,
  center: [number, number, number],
  radius: number,
  color: RgbBytes,
  group: number,
): void {
  const top = addVertex(mesh, [center[0], center[1], center[2] + radius], color, group);
  const rings: number[][] = [];

  for (let latitude = 1; latitude < SPHERE_LATITUDE_SEGMENTS; latitude += 1) {
    const theta = (Math.PI * latitude) / SPHERE_LATITUDE_SEGMENTS;
    const z = center[2] + radius * Math.cos(theta);
    const ringRadius = radius * Math.sin(theta);
    const ring: number[] = [];

    for (let longitude = 0; longitude < SPHERE_LONGITUDE_SEGMENTS; longitude += 1) {
      const phi = (2 * Math.PI * longitude) / SPHERE_LONGITUDE_SEGMENTS;
      ring.push(
        addVertex(
          mesh,
          [
            center[0] + ringRadius * Math.cos(phi),
            center[1] + ringRadius * Math.sin(phi),
            z,
          ],
          color,
          group,
        ),
      );
    }

    rings.push(ring);
  }

  const bottom = addVertex(mesh, [center[0], center[1], center[2] - radius], color, group);
  const firstRing = rings[0];
  const lastRing = rings[rings.length - 1];

  for (let longitude = 0; longitude < SPHERE_LONGITUDE_SEGMENTS; longitude += 1) {
    const nextLongitude = (longitude + 1) % SPHERE_LONGITUDE_SEGMENTS;
    addFace(mesh, top, firstRing[longitude], firstRing[nextLongitude]);
  }

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const currentRing = rings[ringIndex];
    const nextRing = rings[ringIndex + 1];

    for (let longitude = 0; longitude < SPHERE_LONGITUDE_SEGMENTS; longitude += 1) {
      const nextLongitude = (longitude + 1) % SPHERE_LONGITUDE_SEGMENTS;
      addFace(mesh, currentRing[longitude], nextRing[longitude], currentRing[nextLongitude]);
      addFace(mesh, currentRing[nextLongitude], nextRing[longitude], nextRing[nextLongitude]);
    }
  }

  for (let longitude = 0; longitude < SPHERE_LONGITUDE_SEGMENTS; longitude += 1) {
    const nextLongitude = (longitude + 1) % SPHERE_LONGITUDE_SEGMENTS;
    addFace(mesh, bottom, lastRing[nextLongitude], lastRing[longitude]);
  }
}

function subtract(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(vector: [number, number, number]): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector: [number, number, number]): [number, number, number] {
  const vectorLength = length(vector);
  if (vectorLength < MIN_VECTOR_LENGTH) {
    throw new Error("Cannot normalize a zero-length vector.");
  }

  return [
    vector[0] / vectorLength,
    vector[1] / vectorLength,
    vector[2] / vectorLength,
  ];
}

function addScaled(
  origin: [number, number, number],
  a: [number, number, number],
  aScale: number,
  b: [number, number, number],
  bScale: number,
): [number, number, number] {
  return [
    origin[0] + a[0] * aScale + b[0] * bScale,
    origin[1] + a[1] * aScale + b[1] * bScale,
    origin[2] + a[2] * aScale + b[2] * bScale,
  ];
}

function addTube(
  mesh: PlyMesh,
  start: [number, number, number],
  end: [number, number, number],
  radius: number,
  color: RgbBytes,
  group: number,
): void {
  const axisVector = subtract(end, start);
  if (length(axisVector) < MIN_VECTOR_LENGTH) {
    return;
  }

  const axis = normalize(axisVector);
  const reference: [number, number, number] =
    Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const u = normalize(cross(axis, reference));
  const v = cross(axis, u);
  const startRing: number[] = [];
  const endRing: number[] = [];

  for (let segment = 0; segment < TUBE_SEGMENTS; segment += 1) {
    const phi = (2 * Math.PI * segment) / TUBE_SEGMENTS;
    const uScale = radius * Math.cos(phi);
    const vScale = radius * Math.sin(phi);
    startRing.push(addVertex(mesh, addScaled(start, u, uScale, v, vScale), color, group));
    endRing.push(addVertex(mesh, addScaled(end, u, uScale, v, vScale), color, group));
  }

  for (let segment = 0; segment < TUBE_SEGMENTS; segment += 1) {
    const nextSegment = (segment + 1) % TUBE_SEGMENTS;
    addFace(mesh, startRing[segment], startRing[nextSegment], endRing[segment]);
    addFace(mesh, startRing[nextSegment], endRing[nextSegment], endRing[segment]);
  }

  const startCenter = addVertex(mesh, start, color, group);
  const endCenter = addVertex(mesh, end, color, group);
  for (let segment = 0; segment < TUBE_SEGMENTS; segment += 1) {
    const nextSegment = (segment + 1) % TUBE_SEGMENTS;
    addFace(mesh, startCenter, startRing[nextSegment], startRing[segment]);
    addFace(mesh, endCenter, endRing[segment], endRing[nextSegment]);
  }
}

function formatNumber(value: number): string {
  const normalizedValue = Math.abs(value) < 1e-9 ? 0 : value;
  if (Number.isInteger(normalizedValue)) {
    return normalizedValue.toString();
  }

  return normalizedValue.toFixed(6).replace(/\.?0+$/, "");
}

function sanitizeComment(value: string): string {
  return value.replace(/[\r\n]/g, " ");
}

function serializePly(mesh: PlyMesh, label: string): string {
  const lines = [
    "ply",
    "format ascii 1.0",
    `comment BioViewer markers: ${sanitizeComment(label)}`,
    `element vertex ${mesh.vertices.length}`,
    "property float x",
    "property float y",
    "property float z",
    "property uchar red",
    "property uchar green",
    "property uchar blue",
    "property int atomid",
    `element face ${mesh.faces.length}`,
    "property list uchar int vertex_indices",
    "end_header",
  ];

  for (const vertex of mesh.vertices) {
    lines.push(
      `${formatNumber(vertex.position[0])} ${formatNumber(vertex.position[1])} ${formatNumber(vertex.position[2])} ${vertex.color[0]} ${vertex.color[1]} ${vertex.color[2]} ${vertex.group}`,
    );
  }

  for (const face of mesh.faces) {
    lines.push(`3 ${face[0]} ${face[1]} ${face[2]}`);
  }

  return `${lines.join("\n")}\n`;
}

/** A marker set as an ASCII PLY mesh, for the classic viewer, which draws it with Mol*'s PLY reader. */
export function buildMarkerPlyMesh(markerSet: MarkerSet): string {
  const { markers, links } = markerSet;
  const mesh: PlyMesh = { vertices: [], faces: [] };
  let group = 0;

  for (const marker of markers) {
    addSphere(mesh, marker.position, marker.radius, hexToBytes(marker.color), group);
    group += 1;
  }

  for (const link of links) {
    addTube(mesh, markers[link.from].position, markers[link.to].position, link.radius, hexToBytes(link.color), group);
    group += 1;
  }

  return serializePly(mesh, markerSet.label);
}
