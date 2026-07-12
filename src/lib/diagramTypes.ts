export type NodeColor = 'blue' | 'violet' | 'green' | 'amber' | 'rose' | 'indigo' | 'slate';
export type NodeType  = 'Process' | 'Decision' | 'Database' | 'Cloud' | 'People' | 'Business' | 'Technical' | 'Computer' | 'Oval' | 'Diamond' | 'Parallelogram' | 'Document' | 'Hexagon' | 'Triangle' | 'Square' | 'Swimlane' | 'Gantt' | 'UMLClass' | 'EREntity' | 'CircuitResistor' | 'CircuitCapacitor' | 'CircuitGround' | 'CircuitSource' | 'VennCircle' | 'BarSegment' | 'PieWedge' | 'LinePoint' | 'ScatterPoint' | 'HistogramBar' | 'DFDProcess' | 'DFDDataStore' | 'DFDExternalEntity';
export type ConnType  = 'Orthogonal' | 'Curved' | 'Straight' | 'Elbow';
export type Arrowhead = 'Arrow' | 'Dot' | 'Diamond' | "Crow's Foot";
export type EditorMode = 'Code' | 'Visual Edit';
export type DiagramEngine = 'Mermaid' | 'PlantUML' | 'GraphViz' | 'D2' | 'Excalidraw';
export type NodeVariant = 'icon' | 'text' | 'shape';
export type PortSide = 't' | 'r' | 'b' | 'l';

export interface TextStyle {
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  verticalAlign?: string;
}

export interface DiagramNode {
  id: string;
  title: string;
  description: string;
  notes?: string;
  icon?: string;
  variant?: NodeVariant;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: NodeColor;
  customFill?: string;
  customBorderColor?: string;
  customBorderWidth?: number;
  rotation?: number;
  imageUrl?: string;
  _animating?: boolean;
  titleStyle?: TextStyle;
  descriptionStyle?: TextStyle;
}

export interface DiagramConnection {
  id: string;
  from: string;
  to: string;
  type: ConnType;
  arrowhead: Arrowhead;
  label?: string;
  fromPort?: PortSide;
  toPort?: PortSide;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  arrowDirection?: 'forward' | 'backward' | 'both' | 'none';
  thickness?: number;
  routingOffset?: number;
  routingOffsetY?: number;
}
