import { Link } from '../../models/link.model';

export type EntitySummary = {
  table: string;
  id: string;
  label: string;
  imagePath?: string | null;
};

export type GraphNode = EntitySummary & {
  key: string;
  isRoot: boolean;
  x: number;
  y: number;
};

export type GraphEdge = {
  id: string;
  fromKey: string;
  toKey: string;
  name?: string;
  link: Link;
};

export type GraphView = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type Point = {
  x: number;
  y: number;
};
