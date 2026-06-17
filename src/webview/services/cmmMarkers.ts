export interface CmmMarker {
  id: string;
  position: [number, number, number];
  radius: number;
  color: CmmColor;
}

export interface CmmLink {
  id1: string;
  id2: string;
  radius: number;
  color: CmmColor;
}

export interface CmmMarkerSet {
  name: string;
  markers: CmmMarker[];
  links: CmmLink[];
}

export type CmmColor = [number, number, number];

interface PlyVertex {
  position: [number, number, number];
  color: CmmColor;
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
const CMM_MARKER_RADIUS_SCALE = 0.5;
const MIN_VECTOR_LENGTH = 1e-6;

function getDirectChildren(element: Element, tagName: string): Element[] {
  const lowerTagName = tagName.toLowerCase();
  return Array.from(element.children).filter(
    (child) => child.tagName.toLowerCase() === lowerTagName,
  );
}

function parseOptionalNumber(
  element: Element,
  attributeName: string,
  defaultValue: number,
): number {
  const rawValue = element.getAttribute(attributeName);
  if (rawValue === null || rawValue.trim() === "") {
    return defaultValue;
  }

  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`invalid ${attributeName}`);
  }

  return parsedValue;
}

function parsePositiveOptionalNumber(
  element: Element,
  attributeName: string,
  defaultValue: number,
): number {
  const parsedValue = parseOptionalNumber(element, attributeName, defaultValue);
  if (parsedValue <= 0) {
    throw new Error(`${attributeName} must be greater than 0`);
  }

  return parsedValue;
}

function parseRequiredNumber(
  element: Element,
  attributeName: string,
): number {
  const rawValue = element.getAttribute(attributeName);
  if (rawValue === null || rawValue.trim() === "") {
    throw new Error(`missing ${attributeName}`);
  }

  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`invalid ${attributeName}`);
  }

  return parsedValue;
}

function markerError(markerId: string | null, reason: string): Error {
  const markerLabel = markerId ? ` marker ${markerId}` : "";
  return new Error(`Invalid CMM marker${markerLabel}: ${reason}.`);
}

function clampColorComponent(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function toColorBytes(red: number, green: number, blue: number): CmmColor {
  return [red, green, blue].map((component) =>
    Math.round(clampColorComponent(component) * 255),
  ) as CmmColor;
}

function readColor(
  element: Element,
  defaultRed: number,
  defaultGreen: number,
  defaultBlue: number,
): CmmColor {
  const red = parseOptionalNumber(element, "r", defaultRed);
  const green = parseOptionalNumber(element, "g", defaultGreen);
  const blue = parseOptionalNumber(element, "b", defaultBlue);
  return toColorBytes(red, green, blue);
}

function getMarkerSetElement(document: Document): Element {
  const markerSets = Array.from(document.getElementsByTagName("marker_set"));
  if (markerSets.length === 0) {
    throw new Error("CMM file does not contain a marker_set element.");
  }

  if (markerSets.length > 1) {
    throw new Error(
      "CMM files with multiple marker_set elements are not supported yet.",
    );
  }

  return markerSets[0];
}

export function parseCmmMarkerSet(
  xmlText: string,
  fallbackName: string,
): CmmMarkerSet {
  if (typeof DOMParser === "undefined") {
    throw new Error("CMM parsing requires DOMParser.");
  }

  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid CMM XML.");
  }

  const markerSetElement = getMarkerSetElement(document);
  const setName = markerSetElement.getAttribute("name")?.trim() || fallbackName;
  const markerById = new Map<string, CmmMarker>();
  const markers = getDirectChildren(markerSetElement, "marker").map(
    (markerElement) => {
      const id = markerElement.getAttribute("id")?.trim() ?? "";
      if (!id) {
        throw markerError(null, "missing id");
      }

      try {
        const marker: CmmMarker = {
          id,
          position: [
            parseRequiredNumber(markerElement, "x"),
            parseRequiredNumber(markerElement, "y"),
            parseRequiredNumber(markerElement, "z"),
          ],
          radius: parsePositiveOptionalNumber(markerElement, "radius", 1),
          color: readColor(markerElement, 1, 0, 0),
        };
        markerById.set(id, marker);
        return marker;
      } catch (error) {
        if (error instanceof Error) {
          throw markerError(id, error.message);
        }

        throw error;
      }
    },
  );

  if (markers.length === 0) {
    throw new Error("CMM marker_set contains no markers.");
  }

  const links = getDirectChildren(markerSetElement, "link").map((linkElement) => {
    const id1 = linkElement.getAttribute("id1")?.trim() ?? "";
    const id2 = linkElement.getAttribute("id2")?.trim() ?? "";
    if (!id1) {
      throw new Error("Invalid CMM link: missing id1.");
    }
    if (!id2) {
      throw new Error("Invalid CMM link: missing id2.");
    }
    if (!markerById.has(id1)) {
      throw new Error(`Invalid CMM link: unknown marker id ${id1}.`);
    }
    if (!markerById.has(id2)) {
      throw new Error(`Invalid CMM link: unknown marker id ${id2}.`);
    }

    return {
      id1,
      id2,
      radius: parsePositiveOptionalNumber(linkElement, "radius", 0.2),
      color: readColor(linkElement, 1, 1, 1),
    };
  });

  return { name: setName, markers, links };
}

function addVertex(
  mesh: PlyMesh,
  position: [number, number, number],
  color: CmmColor,
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
  color: CmmColor,
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
  color: CmmColor,
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
    `comment BioViewer CMM markers: ${sanitizeComment(label)}`,
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

export function buildCmmPlyMesh(markerSet: CmmMarkerSet): string {
  const markerById = new Map(
    markerSet.markers.map((marker) => [marker.id, marker] as const),
  );
  const mesh: PlyMesh = { vertices: [], faces: [] };
  let group = 0;

  for (const marker of markerSet.markers) {
    addSphere(
      mesh,
      marker.position,
      marker.radius * CMM_MARKER_RADIUS_SCALE,
      marker.color,
      group,
    );
    group += 1;
  }

  for (const link of markerSet.links) {
    const startMarker = markerById.get(link.id1);
    const endMarker = markerById.get(link.id2);
    if (!startMarker || !endMarker) {
      throw new Error("CMM marker links require parsed marker ids.");
    }

    addTube(
      mesh,
      startMarker.position,
      endMarker.position,
      link.radius,
      link.color,
      group,
    );
    group += 1;
  }

  return serializePly(mesh, markerSet.name);
}
