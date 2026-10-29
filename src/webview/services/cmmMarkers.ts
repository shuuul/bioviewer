import type { Marker, MarkerLink, MarkerSet } from "@molstudio/core";

/** Chimera's marker radius reads large next to atoms and density; markers are drawn at half of it. */
const CMM_MARKER_RADIUS_SCALE = 0.5;

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

function toHexComponent(value: number): string {
  const clamped = Math.min(Math.max(value, 0), 1);
  return Math.round(clamped * 255).toString(16).padStart(2, "0");
}

function readColor(
  element: Element,
  defaultRed: number,
  defaultGreen: number,
  defaultBlue: number,
): string {
  const red = parseOptionalNumber(element, "r", defaultRed);
  const green = parseOptionalNumber(element, "g", defaultGreen);
  const blue = parseOptionalNumber(element, "b", defaultBlue);
  return `#${toHexComponent(red)}${toHexComponent(green)}${toHexComponent(blue)}`;
}

function parseMarkerSet(markerSetElement: Element, label: string): MarkerSet {
  // Marker ids are scoped to their marker_set: links only reference markers of the same set.
  const indexById = new Map<string, number>();
  const markers = getDirectChildren(markerSetElement, "marker").map(
    (markerElement, index): Marker => {
      const id = markerElement.getAttribute("id")?.trim() ?? "";
      if (!id) {
        throw markerError(null, "missing id");
      }

      try {
        const marker: Marker = {
          position: [
            parseRequiredNumber(markerElement, "x"),
            parseRequiredNumber(markerElement, "y"),
            parseRequiredNumber(markerElement, "z"),
          ],
          radius: parsePositiveOptionalNumber(markerElement, "radius", 1) * CMM_MARKER_RADIUS_SCALE,
          color: readColor(markerElement, 1, 0, 0),
        };
        indexById.set(id, index);
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
    throw new Error(`CMM marker_set ${label} contains no markers.`);
  }

  const markerIndex = (id: string, attributeName: string): number => {
    if (!id) {
      throw new Error(`Invalid CMM link: missing ${attributeName}.`);
    }
    const index = indexById.get(id);
    if (index === undefined) {
      throw new Error(`Invalid CMM link: unknown marker id ${id}.`);
    }
    return index;
  };

  const links = getDirectChildren(markerSetElement, "link").map((linkElement): MarkerLink => ({
    from: markerIndex(linkElement.getAttribute("id1")?.trim() ?? "", "id1"),
    to: markerIndex(linkElement.getAttribute("id2")?.trim() ?? "", "id2"),
    radius: parsePositiveOptionalNumber(linkElement, "radius", 0.2),
    color: readColor(linkElement, 1, 1, 1),
  }));

  return { label, markers, links };
}

/**
 * Parses every marker_set of a CMM file, in file order. A file with one set is labelled by its file
 * name; with several, each set is labelled `<set name> · <file>` (unnamed sets by their position).
 */
export function parseCmmMarkerSets(xmlText: string, fileLabel: string): MarkerSet[] {
  if (typeof DOMParser === "undefined") {
    throw new Error("CMM parsing requires DOMParser.");
  }

  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid CMM XML.");
  }

  const markerSetElements = Array.from(document.getElementsByTagName("marker_set"));
  if (markerSetElements.length === 0) {
    throw new Error("CMM file does not contain a marker_set element.");
  }

  return markerSetElements.map((markerSetElement, index) => {
    if (markerSetElements.length === 1) {
      return parseMarkerSet(markerSetElement, fileLabel);
    }
    const name = markerSetElement.getAttribute("name")?.trim() || `marker set ${index + 1}`;
    return parseMarkerSet(markerSetElement, `${name} · ${fileLabel}`);
  });
}
