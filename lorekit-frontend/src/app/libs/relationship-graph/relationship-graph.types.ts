import { Link } from '../../models/link.model';

export type EntitySummary = {
  table: string;
  id: string;
  label: string;
  imagePath?: string | null;
  Personalization?: any;
};

export type GraphNode = EntitySummary & {
  key: string;
  isRoot: boolean;
  x: number;
  y: number;
  radius: number;
  degree: number;
  isIsolated: boolean;
};

export type GraphEdge = {
  id: string;
  fromKey: string;
  toKey: string;
  name?: string;
  link: Link;
  visualSummary?: {
    pairKey: string;
    count: number;
    forwardCount: number;
    reverseCount: number;
    sourceEdgeId: string;
  };
};

export type GraphView = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
};

export type Point = {
  x: number;
  y: number;
};
