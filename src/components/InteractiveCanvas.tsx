import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MetamodelAST, MetamodelEntity, MetamodelLayer, MetamodelRelationship, LayerId, ImpactTrace } from '../types';
import { ZoomIn, ZoomOut, Maximize2, Move, HelpCircle, Layers, Sparkles, AlertCircle, Route, Expand, Shrink, RotateCcw, BookOpen, ChevronDown, ChevronUp, Info, X } from 'lucide-react';

interface InteractiveCanvasProps {
  ast: MetamodelAST;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string | null) => void;
  activeLayers: Set<LayerId>;
  searchTerm: string;
  impactTrace: ImpactTrace | null;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

// Convert array of orthogonal points to SVG path string with rounded corners
function generateOrthoSvgPath(points: Point[], radius: number = 6): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 0.1 || len2 < 0.1) continue;

    const r = Math.min(radius, len1 / 2, len2 / 2);

    const startCornerX = curr.x - (dx1 / len1) * r;
    const startCornerY = curr.y - (dy1 / len1) * r;

    const endCornerX = curr.x + (dx2 / len2) * r;
    const endCornerY = curr.y + (dy2 / len2) * r;

    d += ` L ${startCornerX.toFixed(1)} ${startCornerY.toFixed(1)}`;
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${endCornerX.toFixed(1)} ${endCornerY.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  return d;
}

function getOrthoRoute(
  fromPos: NodePosition,
  toPos: NodePosition,
  relIdx: number,
  rel: MetamodelRelationship,
  activeRels: MetamodelRelationship[],
  allNodes: Record<string, NodePosition>
): { points: Point[]; labelPos: Point } {
  // 1. Self Loop
  if (rel.from === rel.to) {
    const startX = fromPos.x + fromPos.width;
    const startY = fromPos.y + fromPos.height * 0.35;
    const endX = fromPos.x + fromPos.width * 0.65;
    const endY = fromPos.y + fromPos.height;
    const offset = 28 + (relIdx % 3) * 14;

    const pts = [
      { x: startX, y: startY },
      { x: startX + offset, y: startY },
      { x: startX + offset, y: endY + offset },
      { x: endX, y: endY + offset },
      { x: endX, y: endY }
    ];
    return {
      points: pts,
      labelPos: { x: startX + offset, y: (startY + endY + offset) / 2 }
    };
  }

  // Count parallel edges between same node pair
  const samePairRels = activeRels.filter(
    (r) => (r.from === rel.from && r.to === rel.to) || (r.from === rel.to && r.to === rel.from)
  );
  const pairIdx = samePairRels.findIndex((r) => r === rel);
  const pairCount = samePairRels.length;

  const pairOffset = pairCount > 1 ? (pairIdx - (pairCount - 1) / 2) * 18 : 0;
  const laneShift = (((relIdx * 17) % 7) - 3) * 10;

  interface ObstacleBox {
    id: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
    centerX: number;
    centerY: number;
  }

  // Build obstacle boxes for all OTHER active nodes
  const obstacles: ObstacleBox[] = Object.entries(allNodes)
    .filter(([id]) => id !== rel.from && id !== rel.to)
    .map(([id, pos]) => ({
      id,
      left: pos.x - 12,
      right: pos.x + pos.width + 12,
      top: pos.y - 12,
      bottom: pos.y + pos.height + 12,
      centerX: pos.x + pos.width / 2,
      centerY: pos.y + pos.height / 2
    }));

  const fromBottom = fromPos.y + fromPos.height;
  const fromTop = fromPos.y;
  const toTop = toPos.y;
  const toBottom = toPos.y + toPos.height;

  const checkVertObstacle = (x: number, y1: number, y2: number): ObstacleBox | null => {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (const obs of obstacles) {
      if (x >= obs.left && x <= obs.right && maxY >= obs.top && minY <= obs.bottom) {
        return obs;
      }
    }
    return null;
  };

  const checkHorizObstacle = (x1: number, x2: number, y: number): ObstacleBox | null => {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (const obs of obstacles) {
      if (y >= obs.top && y <= obs.bottom && maxX >= obs.left && minX <= obs.right) {
        return obs;
      }
    }
    return null;
  };

  const findClearCorridorX = (targetX: number, y1: number, y2: number): number => {
    const obs = checkVertObstacle(targetX, y1, y2);
    if (!obs) return targetX;

    const leftX = obs.left - 16 - Math.abs(laneShift);
    const rightX = obs.right + 16 + Math.abs(laneShift);

    if (Math.abs(leftX - targetX) <= Math.abs(rightX - targetX)) {
      if (!checkVertObstacle(leftX, y1, y2)) return leftX;
      if (!checkVertObstacle(rightX, y1, y2)) return rightX;
    } else {
      if (!checkVertObstacle(rightX, y1, y2)) return rightX;
      if (!checkVertObstacle(leftX, y1, y2)) return leftX;
    }
    return targetX + (obs.centerX < targetX ? 60 : -60);
  };

  // Case A: Downward Layer Connection
  if (toPos.y >= fromBottom - 10) {
    const startX = fromPos.x + fromPos.width / 2 + pairOffset;
    const startY = fromBottom;
    const endX = toPos.x + toPos.width / 2 + pairOffset;
    const endY = toTop;

    const gapY = endY - startY;
    const baseMidY = startY + gapY / 2;
    const midY = Math.min(Math.max(baseMidY + laneShift, startY + 12), endY - 12);

    const seg1Obs = checkVertObstacle(startX, startY, midY);
    const seg2Obs = checkHorizObstacle(startX, endX, midY);
    const seg3Obs = checkVertObstacle(endX, midY, endY);

    if (!seg1Obs && !seg2Obs && !seg3Obs) {
      if (Math.abs(startX - endX) < 2) {
        if (laneShift !== 0 || pairOffset !== 0) {
          const sideX = startX + (pairOffset !== 0 ? pairOffset : laneShift);
          const pts = [
            { x: startX, y: startY },
            { x: startX, y: startY + 10 },
            { x: sideX, y: startY + 10 },
            { x: sideX, y: endY - 10 },
            { x: endX, y: endY - 10 },
            { x: endX, y: endY }
          ];
          return { points: pts, labelPos: { x: sideX, y: (startY + endY) / 2 } };
        }
        return {
          points: [{ x: startX, y: startY }, { x: endX, y: endY }],
          labelPos: { x: startX, y: (startY + endY) / 2 }
        };
      }
      const pts = [
        { x: startX, y: startY },
        { x: startX, y: midY },
        { x: endX, y: midY },
        { x: endX, y: endY }
      ];
      return { points: pts, labelPos: { x: (startX + endX) / 2, y: midY } };
    }

    const corridorX = findClearCorridorX((startX + endX) / 2, startY + 10, endY - 10);
    const pts = [
      { x: startX, y: startY },
      { x: startX, y: startY + 12 },
      { x: corridorX, y: startY + 12 },
      { x: corridorX, y: endY - 12 },
      { x: endX, y: endY - 12 },
      { x: endX, y: endY }
    ];
    return { points: pts, labelPos: { x: corridorX, y: (startY + endY) / 2 } };
  }

  // Case B: Upward Layer Connection
  if (fromTop >= toBottom - 10) {
    const startX = fromPos.x + fromPos.width / 2 + pairOffset;
    const startY = fromTop;
    const endX = toPos.x + toPos.width / 2 + pairOffset;
    const endY = toBottom;

    const gapY = startY - endY;
    const baseMidY = endY + gapY / 2;
    const midY = Math.min(Math.max(baseMidY + laneShift, endY + 12), startY - 12);

    const seg1Obs = checkVertObstacle(startX, startY, midY);
    const seg2Obs = checkHorizObstacle(startX, endX, midY);
    const seg3Obs = checkVertObstacle(endX, midY, endY);

    if (!seg1Obs && !seg2Obs && !seg3Obs) {
      if (Math.abs(startX - endX) < 2) {
        if (laneShift !== 0 || pairOffset !== 0) {
          const sideX = startX + (pairOffset !== 0 ? pairOffset : laneShift);
          const pts = [
            { x: startX, y: startY },
            { x: startX, y: startY - 10 },
            { x: sideX, y: startY - 10 },
            { x: sideX, y: endY + 10 },
            { x: endX, y: endY + 10 },
            { x: endX, y: endY }
          ];
          return { points: pts, labelPos: { x: sideX, y: (startY + endY) / 2 } };
        }
        return {
          points: [{ x: startX, y: startY }, { x: endX, y: endY }],
          labelPos: { x: startX, y: (startY + endY) / 2 }
        };
      }
      const pts = [
        { x: startX, y: startY },
        { x: startX, y: midY },
        { x: endX, y: midY },
        { x: endX, y: endY }
      ];
      return { points: pts, labelPos: { x: (startX + endX) / 2, y: midY } };
    }

    const corridorX = findClearCorridorX((startX + endX) / 2, endY + 10, startY - 10);
    const pts = [
      { x: startX, y: startY },
      { x: startX, y: startY - 12 },
      { x: corridorX, y: startY - 12 },
      { x: corridorX, y: endY + 12 },
      { x: endX, y: endY + 12 },
      { x: endX, y: endY }
    ];
    return { points: pts, labelPos: { x: corridorX, y: (startY + endY) / 2 } };
  }

  // Case C: Same Layer or Horizontal Connection
  const fromCenterX = fromPos.x + fromPos.width / 2;
  const toCenterX = toPos.x + toPos.width / 2;

  if (fromCenterX < toCenterX) {
    const startX = fromPos.x + fromPos.width;
    const startY = fromPos.y + fromPos.height / 2 + pairOffset;
    const endX = toPos.x;
    const endY = toPos.y + toPos.height / 2 + pairOffset;

    const horizObs = checkHorizObstacle(startX, endX, (startY + endY) / 2);

    if (!horizObs) {
      const midX = startX + (endX - startX) / 2 + laneShift;
      const pts = [
        { x: startX, y: startY },
        { x: midX, y: startY },
        { x: midX, y: endY },
        { x: endX, y: endY }
      ];
      return { points: pts, labelPos: { x: midX, y: (startY + endY) / 2 } };
    } else {
      const routeY = fromPos.y - 30 - Math.abs(laneShift);
      const pts = [
        { x: fromPos.x + fromPos.width / 2, y: fromPos.y },
        { x: fromPos.x + fromPos.width / 2, y: routeY },
        { x: toPos.x + toPos.width / 2, y: routeY },
        { x: toPos.x + toPos.width / 2, y: toPos.y }
      ];
      return { points: pts, labelPos: { x: (fromPos.x + toPos.x) / 2, y: routeY } };
    }
  } else {
    const startX = fromPos.x;
    const startY = fromPos.y + fromPos.height / 2 + pairOffset;
    const endX = toPos.x + toPos.width;
    const endY = toPos.y + toPos.height / 2 + pairOffset;

    const horizObs = checkHorizObstacle(startX, endX, (startY + endY) / 2);

    if (!horizObs) {
      const midX = endX + (startX - endX) / 2 + laneShift;
      const pts = [
        { x: startX, y: startY },
        { x: midX, y: startY },
        { x: midX, y: endY },
        { x: endX, y: endY }
      ];
      return { points: pts, labelPos: { x: midX, y: (startY + endY) / 2 } };
    } else {
      const routeY = fromPos.y - 30 - Math.abs(laneShift);
      const pts = [
        { x: fromPos.x + fromPos.width / 2, y: fromPos.y },
        { x: fromPos.x + fromPos.width / 2, y: routeY },
        { x: toPos.x + toPos.width / 2, y: routeY },
        { x: toPos.x + toPos.width / 2, y: toPos.y }
      ];
      return { points: pts, labelPos: { x: (fromPos.x + toPos.x) / 2, y: routeY } };
    }
  }
}

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  ast,
  selectedEntityId,
  onSelectEntity,
  activeLayers,
  searchTerm,
  impactTrace
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Canvas viewport state
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Line routing mode: 'ortho' or 'curved'
  const [lineStyle, setLineStyle] = useState<'ortho' | 'curved'>('ortho');

  // Hovered entity state for direct neighbor focus
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

  // Direct neighbor set & edge set for hovered entity
  const hoverNeighbors = useMemo(() => {
    if (!hoveredEntityId) return null;

    const neighbors = new Set<string>([hoveredEntityId]);
    const connectedEdgeKeys = new Set<string>();

    ast.relationships.forEach((rel) => {
      if (rel.from === hoveredEntityId) {
        neighbors.add(rel.to);
        connectedEdgeKeys.add(`${rel.from}->${rel.to}`);
      } else if (rel.to === hoveredEntityId) {
        neighbors.add(rel.from);
        connectedEdgeKeys.add(`${rel.from}->${rel.to}`);
      }
    });

    return {
      neighbors,
      connectedEdgeKeys
    };
  }, [hoveredEntityId, ast.relationships]);

  // Full screen view state
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  // Collapsible Architecture Legend state
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Node position overrides (for dragging)
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const layerGap = 70;
  const startLayerTop = 40;
  const defaultLayerHeight = 220;

  const layerTopMap = useMemo(() => {
    const map: Record<LayerId, number> = {
      layer1: 0,
      layer2: 0,
      layer3: 0,
      layer4: 0,
      layer5: 0
    };
    ast.layers.forEach((layer, idx) => {
      map[layer.id] = startLayerTop + idx * (defaultLayerHeight + layerGap);
    });
    return map;
  }, [ast.layers]);

  // Initial node auto-layout calculation
  const initialPositions = useMemo(() => {
    const pos: Record<string, NodePosition> = {};

    // Group entities by layer
    const layerEntities: Record<LayerId, MetamodelEntity[]> = {
      layer1: [],
      layer2: [],
      layer3: [],
      layer4: [],
      layer5: []
    };

    ast.entities.forEach((ent) => {
      if (layerEntities[ent.layerId]) {
        layerEntities[ent.layerId].push(ent);
      }
    });

    const nodeWidth = 210;
    const gapX = 25;

    (Object.keys(layerEntities) as LayerId[]).forEach((layerId) => {
      const ents = layerEntities[layerId];
      const top = layerTopMap[layerId] || startLayerTop;
      const totalWidth = ents.length * nodeWidth + (ents.length - 1) * gapX;
      const startX = Math.max(70, (1280 - totalWidth) / 2);

      ents.forEach((ent, idx) => {
        pos[ent.id] = {
          x: startX + idx * (nodeWidth + gapX),
          y: top + 56,
          width: nodeWidth,
          height: ent.attributes.length > 0 ? 115 : 85
        };
      });
    });

    return pos;
  }, [ast, layerTopMap]);

  // Combine initial positions with drag overrides
  const effectivePositions = useMemo(() => {
    return { ...initialPositions, ...nodePositions };
  }, [initialPositions, nodePositions]);

  // Uniform layer box dimensions & vertical positions (calculated from effectivePositions)
  const uniformLayerHeight = useMemo(() => {
    let maxCardH = 115;
    (Object.values(effectivePositions) as NodePosition[]).forEach((pos) => {
      if (pos.height > maxCardH) maxCardH = pos.height;
    });
    return Math.max(defaultLayerHeight, maxCardH + 105);
  }, [effectivePositions]);

  const uniformLayerWidth = useMemo(() => {
    let maxRightX = 1280;
    (Object.values(effectivePositions) as NodePosition[]).forEach((pos) => {
      const right = pos.x + pos.width + 55;
      if (right > maxRightX) maxRightX = right;
    });
    return maxRightX - 40;
  }, [effectivePositions]);

  // Handle Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 2.2));
  };

  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
    } else if (draggingNodeId) {
      const newX = (e.clientX - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - pan.y) / zoom - dragOffset.y;
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          ...prev[draggingNodeId],
          x: Math.max(20, newX),
          y: Math.max(20, newY)
        }
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleStartDragNode = (e: React.MouseEvent, entityId: string) => {
    e.stopPropagation();
    const pos = effectivePositions[entityId];
    if (!pos) return;
    setDraggingNodeId(entityId);
    setDragOffset({
      x: (e.clientX - pan.x) / zoom - pos.x,
      y: (e.clientY - pan.y) / zoom - pos.y
    });
    onSelectEntity(entityId);
  };

  const handleResetView = () => {
    setZoom(0.85);
    setPan({ x: 50, y: 30 });
    setNodePositions({});
  };

  // Filter entities
  const filteredEntities = useMemo(() => {
    return ast.entities.filter((ent) => {
      if (!activeLayers.has(ent.layerId)) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        ent.name.toLowerCase().includes(term) ||
        ent.id.toLowerCase().includes(term) ||
        ent.attributes.some(
          (a) => a.name.toLowerCase().includes(term) || a.type.toLowerCase().includes(term)
        )
      );
    });
  }, [ast.entities, activeLayers, searchTerm]);

  // Connected relationships for selected entity or search term
  const activeRelationships = useMemo(() => {
    return ast.relationships.filter((rel) => {
      const fromPos = effectivePositions[rel.from];
      const toPos = effectivePositions[rel.to];
      if (!fromPos || !toPos) return false;

      const fromEntity = ast.entities.find((e) => e.id === rel.from);
      const toEntity = ast.entities.find((e) => e.id === rel.to);

      if (!fromEntity || !toEntity) return false;
      if (!activeLayers.has(fromEntity.layerId) || !activeLayers.has(toEntity.layerId)) {
        return false;
      }
      return true;
    });
  }, [ast.relationships, effectivePositions, ast.entities, activeLayers]);

  // Calculate SVG paths between nodes
  const renderRelationshipEdge = (rel: MetamodelRelationship, idx: number) => {
    const fromPos = effectivePositions[rel.from];
    const toPos = effectivePositions[rel.to];
    if (!fromPos || !toPos) return null;

    const isSelected =
      selectedEntityId === rel.from || selectedEntityId === rel.to;
    const isImpact =
      impactTrace &&
      (impactTrace.connectedEdgeKeys.has(`${rel.from}->${rel.to}`) ||
        (impactTrace.sourceId === rel.from && impactTrace.downstreamIds.has(rel.to)));

    const isHoverDirectEdge = hoverNeighbors?.connectedEdgeKeys.has(`${rel.from}->${rel.to}`);
    const isHoverActive = !!hoverNeighbors;

    let pathD = '';
    let labelPos = { x: 0, y: 0 };

    if (lineStyle === 'ortho') {
      const route = getOrthoRoute(
        fromPos,
        toPos,
        idx,
        rel,
        activeRelationships,
        effectivePositions
      );
      pathD = generateOrthoSvgPath(route.points, 6);
      labelPos = route.labelPos;
    } else {
      let startX = fromPos.x + fromPos.width / 2;
      let startY = fromPos.y + fromPos.height;
      let endX = toPos.x + toPos.width / 2;
      let endY = toPos.y;

      if (toPos.y < fromPos.y) {
        startY = fromPos.y;
        endY = toPos.y + toPos.height;
      }

      const deltaY = Math.abs(endY - startY);
      const cp1Y = startY < endY ? startY + deltaY * 0.5 : startY - deltaY * 0.5;
      const cp2Y = startY < endY ? endY - deltaY * 0.5 : endY + deltaY * 0.5;

      pathD = `M ${startX} ${startY} C ${startX} ${cp1Y}, ${endX} ${cp2Y}, ${endX} ${endY}`;
      labelPos = { x: (startX + endX) / 2, y: (startY + endY) / 2 };
    }

    const strokeColor = isHoverActive
      ? isHoverDirectEdge
        ? '#38BDF8' // bright sky blue for direct neighbor edges
        : '#1E293B' // dim dark slate for non-focused edges
      : isImpact
      ? '#EC4899' // pink for impact
      : isSelected
      ? '#3B82F6' // blue for selected
      : '#64748B'; // slate

    const opacity = isHoverActive
      ? isHoverDirectEdge
        ? 1
        : 0.08
      : selectedEntityId
      ? isSelected || isImpact
        ? 1
        : 0.15
      : 0.65;

    return (
      <g key={`edge-${rel.from}-${rel.to}-${idx}`} className="transition-all duration-300">
        {/* Glow backdrop for hovered / selected / impact edges */}
        {(isHoverDirectEdge || isSelected || isImpact) && (
          <path
            d={pathD}
            fill="none"
            stroke={isHoverDirectEdge ? '#0EA5E9' : isImpact ? '#F43F5E' : '#3B82F6'}
            strokeWidth={isHoverDirectEdge ? 5 : isImpact ? 6 : 4}
            strokeOpacity={isHoverDirectEdge ? 0.45 : 0.3}
            className={isImpact ? 'animate-pulse' : undefined}
          />
        )}

        {/* Main Edge Path */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={isHoverDirectEdge ? 2.5 : isSelected || isImpact ? 2.5 : 1.5}
          strokeDasharray={rel.type === 'dashed' ? '5,5' : undefined}
          strokeOpacity={opacity}
          markerEnd={
            isHoverDirectEdge
              ? 'url(#arrowhead-hover)'
              : isImpact
              ? 'url(#arrowhead-impact)'
              : isSelected
              ? 'url(#arrowhead-selected)'
              : 'url(#arrowhead)'
          }
          className="transition-all hover:stroke-blue-400 hover:stroke-2 cursor-pointer"
        />

        {/* Relationship Label Pill */}
        {rel.label && (
          <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
            <rect
              x={-rel.label.length * 3.2 - 6}
              y={-10}
              width={rel.label.length * 6.4 + 12}
              height={18}
              rx={9}
              fill="#1E293B"
              stroke={strokeColor}
              strokeWidth={isSelected || isImpact ? 1.5 : 1}
              strokeOpacity={opacity}
            />
            <text
              x={0}
              y={2}
              textAnchor="middle"
              fill={isSelected || isImpact ? '#F8FAFC' : '#94A3B8'}
              fontSize={10}
              fontWeight={isSelected || isImpact ? '600' : '400'}
              opacity={opacity < 0.3 ? 0.3 : 1}
              className="select-none pointer-events-none"
            >
              {rel.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDownCanvas}
      onMouseMove={handleMouseMoveCanvas}
      onMouseUp={handleMouseUpCanvas}
      className={`${
        isFullScreen
          ? 'fixed inset-0 z-50 w-screen h-screen'
          : 'relative w-full h-[calc(100vh-140px)] min-h-[600px]'
      } bg-slate-950 overflow-hidden select-none`}
      style={{
        cursor: isPanning ? 'grabbing' : 'grab',
        backgroundImage:
          'radial-gradient(circle, rgba(45, 212, 191, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Full Screen Active Banner */}
      {isFullScreen && (
        <div className="absolute top-4 left-4 z-20 bg-slate-900/95 border border-sky-500/40 px-3.5 py-1.5 rounded-xl shadow-2xl backdrop-blur-md text-xs text-slate-200 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span className="font-semibold text-sky-300">Full Screen Mode</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[11px]">
            Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono text-[10px]">ESC</kbd> or click toggle to exit
          </span>
        </div>
      )}

      {/* Floating Canvas Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-xl backdrop-blur-sm">
        <button
          onClick={() => setIsFullScreen((f) => !f)}
          className={`p-2 rounded-lg transition-colors ${
            isFullScreen
              ? 'text-sky-400 bg-sky-500/15 border border-sky-500/40 shadow-lg shadow-sky-950/50'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={isFullScreen ? 'Exit Full Screen (ESC)' : 'Full Screen View'}
        >
          {isFullScreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setLineStyle((s) => (s === 'ortho' ? 'curved' : 'ortho'))}
          className={`p-2 rounded-lg transition-colors ${
            lineStyle === 'ortho'
              ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={`Line Style: ${lineStyle === 'ortho' ? 'Orthogonal (Rerouted)' : 'Curved'}`}
        >
          <Route className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.15, 2.2))}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.85, 0.4))}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Fit Canvas"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="text-[10px] text-center font-mono text-slate-400 border-t border-slate-800 pt-1">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Collapsible Architecture Layer Legend & Floating Controls */}
      <div className="absolute bottom-4 left-4 z-20 max-w-md w-full sm:w-[420px] pointer-events-auto">
        {!isLegendOpen ? (
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-xl backdrop-blur-md text-xs text-slate-300">
            {/* Open Legend Toggle Button */}
            <button
              onClick={() => setIsLegendOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/35 hover:border-blue-500/60 text-blue-300 hover:text-white rounded-lg transition-all font-medium cursor-pointer"
              title="Expand 6-Layer Architecture Legend"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-slate-200">Layer Legend</span>
              <span className="px-1.5 py-0.2 text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/60 rounded font-mono font-bold">
                6
              </span>
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <span className="text-slate-800">|</span>

            {/* Quick Tips */}
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Move className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Pan: Drag canvas</span>
            </div>

            {hoverNeighbors && (
              <>
                <span className="text-slate-800">|</span>
                <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-[11px] bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">
                    Focus: {ast.entities.find((e) => e.id === hoveredEntityId)?.name}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[520px]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    Metamodel Architecture Legend
                  </h3>
                  <p className="text-[10px] text-slate-400">6 Structural Layers & Domain Scope</p>
                </div>
              </div>
              <button
                onClick={() => setIsLegendOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Collapse Legend"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Layer List */}
            <div className="p-3.5 overflow-y-auto space-y-3 divide-y divide-slate-800/50 custom-scrollbar text-xs">
              {ast.layers.map((layer) => {
                const isActive = activeLayers.has(layer.id);
                const layerEnts = ast.entities.filter((e) => e.layerId === layer.id);

                return (
                  <div
                    key={layer.id}
                    className={`pt-3 first:pt-0 transition-opacity ${
                      !isActive ? 'opacity-40 grayscale' : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Layer color indicator badge */}
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: layer.borderColor,
                            boxShadow: `0 0 10px ${layer.borderColor}90`
                          }}
                        />
                        <span className="font-bold text-slate-100 text-xs truncate">
                          L{layer.number}: {layer.name}
                        </span>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0"
                        style={{
                          backgroundColor: `${layer.borderColor}20`,
                          color: layer.borderColor,
                          border: `1px solid ${layer.borderColor}40`
                        }}
                      >
                        {layer.subtitle}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed pl-3.5 border-l-2 border-slate-800 mb-2">
                      {layer.description}
                    </p>

                    {/* Entities pill tags */}
                    {layerEnts.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-3.5">
                        <span className="text-[10px] font-mono text-slate-500 self-center mr-1">
                          Entities:
                        </span>
                        {layerEnts.map((ent) => (
                          <span
                            key={ent.id}
                            onClick={() => onSelectEntity(ent.id)}
                            className="px-1.5 py-0.5 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 text-slate-300 hover:text-blue-300 rounded text-[10px] font-mono transition-colors cursor-pointer"
                            title={`Click to inspect ${ent.name}`}
                          >
                            <span className="font-bold text-blue-400 mr-1">{ent.id}</span>
                            {ent.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2.5 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                Click entity tags to focus & inspect
              </span>
              <button
                onClick={() => setIsLegendOpen(false)}
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline font-medium cursor-pointer"
              >
                Collapse Legend
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main SVG & Canvas Transform Container */}
      <div
        className="w-full h-full transform-origin-0-0 transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        <svg
          width={uniformLayerWidth + 100}
          height={startLayerTop + ast.layers.length * (uniformLayerHeight + layerGap) + 100}
          className="overflow-visible pointer-events-none"
        >
          {/* Arrowhead Marker Definitions */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="0"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#64748B" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="10"
              markerHeight="10"
              refX="0"
              refY="5"
              orient="auto"
            >
              <polygon points="0 0, 10 5, 0 10" fill="#3B82F6" />
            </marker>
            <marker
              id="arrowhead-hover"
              markerWidth="10"
              markerHeight="10"
              refX="0"
              refY="5"
              orient="auto"
            >
              <polygon points="0 0, 10 5, 0 10" fill="#38BDF8" />
            </marker>
            <marker
              id="arrowhead-impact"
              markerWidth="10"
              markerHeight="10"
              refX="0"
              refY="5"
              orient="auto"
            >
              <polygon points="0 0, 10 5, 0 10" fill="#EC4899" />
            </marker>
          </defs>

          {/* LAYER BACKGROUND FRAMES */}
          {ast.layers.map((layer) => {
            if (!activeLayers.has(layer.id)) return null;

            const top = layerTopMap[layer.id] || startLayerTop;

            return (
              <g key={`layer-frame-${layer.id}`}>
                <rect
                  x={40}
                  y={top}
                  width={uniformLayerWidth}
                  height={uniformLayerHeight}
                  rx={16}
                  fill={layer.color}
                  fillOpacity={0.12}
                  stroke={layer.borderColor}
                  strokeWidth={1.5}
                  strokeDasharray="4,4"
                  className="transition-all"
                />
                {/* Layer Title Header */}
                <foreignObject
                  x={55}
                  y={top + 10}
                  width={uniformLayerWidth - 30}
                  height={38}
                >
                  <div className="flex items-center justify-between text-xs px-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className="px-2 py-0.5 rounded-full font-bold text-[11px] uppercase tracking-wider text-white shadow-sm"
                        style={{ backgroundColor: layer.borderColor }}
                      >
                        Layer {layer.number}
                      </span>
                      <span className="font-bold text-slate-200 text-sm">
                        {layer.name}
                      </span>
                      <span className="text-slate-400 font-normal italic">
                        ({layer.subtitle})
                      </span>
                    </div>
                    <span className="text-slate-400 hidden sm:inline text-[11px]">
                      {layer.description}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* RELATIONSHIP EDGES */}
          {activeRelationships.map(renderRelationshipEdge)}
        </svg>

        {/* HTML OVERLAY FOR ENTITY NODES */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {filteredEntities.map((entity) => {
            const pos = effectivePositions[entity.id];
            if (!pos) return null;

            const isSelected = selectedEntityId === entity.id;
            const isUpstream = impactTrace?.upstreamIds.has(entity.id);
            const isDownstream = impactTrace?.downstreamIds.has(entity.id);
            const isImpactSource = impactTrace?.sourceId === entity.id;

            const isHovered = hoveredEntityId === entity.id;
            const isDirectNeighbor = hoverNeighbors?.neighbors.has(entity.id) && !isHovered;

            const isDimmedByHover = hoverNeighbors ? !hoverNeighbors.neighbors.has(entity.id) : false;

            const isDimmedBySelect =
              !hoverNeighbors &&
              selectedEntityId &&
              !isSelected &&
              !isUpstream &&
              !isDownstream &&
              !isImpactSource;

            const isDimmed = isDimmedByHover || isDimmedBySelect;

            const layer = ast.layers.find((l) => l.id === entity.layerId);
            const borderColor = layer ? layer.borderColor : '#3B82F6';

            return (
              <div
                key={`entity-card-${entity.id}`}
                onMouseDown={(e) => handleStartDragNode(e, entity.id)}
                onClick={() => onSelectEntity(entity.id)}
                onMouseEnter={() => setHoveredEntityId(entity.id)}
                onMouseLeave={() => setHoveredEntityId(null)}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: `${pos.width}px`,
                  height: `${pos.height}px`,
                  borderColor: isHovered
                    ? '#38BDF8'
                    : isDirectNeighbor
                    ? '#0284C7'
                    : isImpactSource
                    ? '#EC4899'
                    : isSelected
                    ? '#3B82F6'
                    : isUpstream || isDownstream
                    ? '#8B5CF6'
                    : borderColor
                }}
                className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing rounded-xl bg-slate-900/95 border-2 p-3 shadow-xl backdrop-blur-md transition-all duration-200 flex flex-col justify-between group ${
                  isHovered
                    ? 'ring-4 ring-sky-400/50 scale-105 z-40 bg-slate-900 shadow-xl shadow-sky-950/60'
                    : isDirectNeighbor
                    ? 'ring-2 ring-sky-500/40 scale-[1.03] z-30 bg-slate-900/95 shadow-md shadow-sky-950/40'
                    : isSelected
                    ? 'ring-4 ring-blue-500/30 scale-105 z-30'
                    : isImpactSource
                    ? 'ring-4 ring-pink-500/30 scale-105 z-30'
                    : isDimmed
                    ? 'opacity-20 filter grayscale-[60%]'
                    : 'hover:border-blue-400 hover:scale-[1.02] hover:z-20'
                }`}
              >
                {/* Node Top Row: Name & ID Badge */}
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-slate-100 group-hover:text-blue-300 transition-colors leading-snug">
                      {entity.name}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 shadow-sm"
                      style={{
                        backgroundColor: `${borderColor}25`,
                        color: borderColor,
                        border: `1px solid ${borderColor}50`
                      }}
                    >
                      {entity.id}
                    </span>
                  </div>

                  {/* Hover / Impact / Role Badges */}
                  {isHovered && (
                    <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-sky-500/25 text-sky-300 border border-sky-400/50 rounded-full mb-1">
                      Focused
                    </span>
                  )}
                  {isDirectNeighbor && (
                    <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded-full mb-1">
                      Direct Neighbor
                    </span>
                  )}
                  {isImpactSource && !isHovered && (
                    <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/40 rounded-full mb-1">
                      Target Focus
                    </span>
                  )}
                  {isUpstream && !isHovered && !isDirectNeighbor && (
                    <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full mb-1">
                      Upstream Driver
                    </span>
                  )}
                  {isDownstream && !isHovered && !isDirectNeighbor && (
                    <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full mb-1">
                      Downstream Impact
                    </span>
                  )}

                  {/* Attributes List */}
                  {entity.attributes.length > 0 && (
                    <div className="space-y-0.5 mt-1 border-t border-slate-800/80 pt-1">
                      {entity.attributes.slice(0, 2).map((attr, aIdx) => (
                        <div
                          key={aIdx}
                          className="text-[10px] font-mono text-slate-400 flex items-center justify-between"
                        >
                          <span className="text-slate-300 truncate max-w-[110px]">
                            +{attr.name}
                          </span>
                          <span className="text-slate-500 text-[9px] truncate max-w-[80px]">
                            {attr.type}
                          </span>
                        </div>
                      ))}
                      {entity.attributes.length > 2 && (
                        <div className="text-[9px] text-slate-500 italic">
                          +{entity.attributes.length - 2} more fields...
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Node Footer: Layer Indicator */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/50 text-[9px] text-slate-500">
                  <span className="truncate">L{entity.layerId.replace('layer', '')}</span>
                  <span className="text-blue-400 font-medium group-hover:underline">
                    Inspect →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
