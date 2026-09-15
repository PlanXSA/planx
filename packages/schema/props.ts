import type { Cardinal } from "./index.ts";

export interface StreetProps {
  name?: string;
  width_m?: number;
  highway?: string;
  section_id?: string;
}

export interface ParcelVertex {
  i: number;
  lon: number;
  lat: number;
  z?: number;
}

export interface ParcelEdge {
  i: number;
  length_m: number;
  frontage: boolean;
}

export interface ParcelNeighbor {
  id: string;
  dir: Cardinal;
}

export interface ParcelProps {
  area_m2?: number;
  vertices?: ParcelVertex[];
  edges?: ParcelEdge[];
  neighbors?: ParcelNeighbor[];
  frontage_m?: number;
  frontage_estimated?: boolean;
  coverage?: number;
  floors?: number;
}
