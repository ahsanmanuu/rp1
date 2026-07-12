/**
 * Diagram Templates for AI Diagram Studio
 *
 * Each template provides a complete starting set of nodes + connections
 * representing a common technical architecture pattern.
 */

import type { NodeColor, NodeType, ConnType, Arrowhead, DiagramNode, DiagramConnection } from '@/lib/diagramTypes';

export type { NodeColor, NodeType, ConnType, Arrowhead };

export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  category: 'architecture' | 'workflow' | 'database' | 'devops' | 'cloud';
  icon: string; // Material Symbol name
  color: string; // accent color
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  // ── Blank ─────────────────────────────────────────────────────────────────
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start fresh with an empty canvas',
    category: 'architecture',
    icon: 'add_box',
    color: '#64748b',
    nodes: [],
    connections: [],
  },

  // ── Computer Block Diagram ────────────────────────────────────────────────
  {
    id: 'computer-block',
    name: 'Computer Block Diagram',
    description: 'CPU → Primary RAM, GPU, Storage, and System Bus architecture',
    category: 'architecture',
    icon: 'computer',
    color: '#3b82f6',
    nodes: [
      { id: 'input',    title: 'Input Devices',     description: 'Keyboard, mouse, peripherals',      type: 'Computer',  x: 60,  y: 220, width: 200, height: 100, color: 'slate'  },
      { id: 'cpu',      title: 'CPU',               description: 'Central Processing Unit',            type: 'Computer',  x: 340, y: 220, width: 200, height: 100, color: 'blue'   },
      { id: 'ram',      title: 'RAM',               description: 'Random Access Memory (Primary)',     type: 'Database',  x: 620, y: 80,  width: 200, height: 100, color: 'indigo' },
      { id: 'gpu',      title: 'GPU',               description: 'Graphics Processing Unit (Display)', type: 'Technical', x: 620, y: 220, width: 200, height: 100, color: 'violet' },
      { id: 'storage',  title: 'Storage',           description: 'Solid State Drive / Hard Disk',      type: 'Database',  x: 620, y: 360, width: 200, height: 100, color: 'green'  },
      { id: 'bus',      title: 'System Bus',        description: 'Motherboard high-speed data pathways',type: 'Process',   x: 340, y: 490, width: 480, height: 100, color: 'rose'   },
      { id: 'output',   title: 'Output Devices',    description: 'Monitor, speakers, printer',         type: 'Technical', x: 900, y: 220, width: 200, height: 100, color: 'amber'  },
    ],
    connections: [
      { id: 'c1', from: 'input',   to: 'cpu',     type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'cpu',     to: 'ram',     type: 'Orthogonal', arrowhead: 'Arrow', label: 'L1/L2 Cache' },
      { id: 'c3', from: 'cpu',     to: 'gpu',     type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c4', from: 'cpu',     to: 'storage', type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c5', from: 'cpu',     to: 'bus',     type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c6', from: 'gpu',     to: 'output',  type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c7', from: 'bus',     to: 'ram',     type: 'Orthogonal', arrowhead: 'Arrow', lineStyle: 'dashed' },
      { id: 'c8', from: 'bus',     to: 'storage', type: 'Orthogonal', arrowhead: 'Arrow', lineStyle: 'dashed' },
    ],
  },

  // ── Microservices Architecture ────────────────────────────────────────────
  {
    id: 'microservices',
    name: 'Microservices',
    description: 'API Gateway → Service Mesh → Databases',
    category: 'architecture',
    icon: 'hub',
    color: '#6366f1',
    nodes: [
      { id: 'client',    title: 'Client App',      description: 'Web / Mobile frontend',          type: 'Computer',  x: 80,  y: 200, width: 200, height: 100, color: 'slate'  },
      { id: 'gateway',   title: 'API Gateway',     description: 'Auth, rate-limit, routing',       type: 'Technical', x: 360, y: 200, width: 200, height: 100, color: 'blue'   },
      { id: 'auth',      title: 'Auth Service',    description: 'JWT / OAuth 2.0',                 type: 'Process',   x: 640, y: 80,  width: 200, height: 100, color: 'amber'  },
      { id: 'user',      title: 'User Service',    description: 'CRUD for user profiles',          type: 'Process',   x: 640, y: 210, width: 200, height: 100, color: 'violet' },
      { id: 'order',     title: 'Order Service',   description: 'Manages order lifecycle',         type: 'Process',   x: 640, y: 340, width: 200, height: 100, color: 'green'  },
      { id: 'userdb',    title: 'User DB',         description: 'PostgreSQL',                       type: 'Database',  x: 920, y: 210, width: 180, height: 100, color: 'violet' },
      { id: 'orderdb',   title: 'Order DB',        description: 'MongoDB',                          type: 'Database',  x: 920, y: 340, width: 180, height: 100, color: 'green'  },
      { id: 'queue',     title: 'Message Queue',   description: 'RabbitMQ / Kafka',                type: 'Technical', x: 640, y: 470, width: 200, height: 100, color: 'rose'   },
    ],
    connections: [
      { id: 'c1', from: 'client',  to: 'gateway', type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c2', from: 'gateway', to: 'auth',    type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c3', from: 'gateway', to: 'user',    type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c4', from: 'gateway', to: 'order',   type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c5', from: 'user',    to: 'userdb',  type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c6', from: 'order',   to: 'orderdb', type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c7', from: 'order',   to: 'queue',   type: 'Curved',     arrowhead: 'Arrow', lineStyle: 'dashed' },
    ],
  },

  // ── CI/CD Pipeline ────────────────────────────────────────────────────────
  {
    id: 'cicd',
    name: 'CI/CD Pipeline',
    description: 'Code → Build → Test → Deploy',
    category: 'devops',
    icon: 'account_tree',
    color: '#f59e0b',
    nodes: [
      { id: 'dev',    title: 'Developer',       description: 'Push code to repository',             type: 'People',    x: 60,  y: 220, width: 200, height: 100, color: 'slate' },
      { id: 'repo',   title: 'Git Repository',  description: 'GitHub / GitLab',                     type: 'Technical', x: 340, y: 220, width: 200, height: 100, color: 'indigo' },
      { id: 'ci',     title: 'CI Server',       description: 'Trigger build on push',               type: 'Process',   x: 620, y: 100, width: 200, height: 100, color: 'amber' },
      { id: 'build',  title: 'Build & Lint',    description: 'Compile, bundle, lint checks',        type: 'Process',   x: 620, y: 220, width: 200, height: 100, color: 'blue' },
      { id: 'test',   title: 'Test Suite',      description: 'Unit + Integration tests',            type: 'Process',   x: 620, y: 340, width: 200, height: 100, color: 'green' },
      { id: 'qa',     title: 'QA Gate',         description: 'Approve / reject build',              type: 'Decision',  x: 900, y: 220, width: 200, height: 100, color: 'amber' },
      { id: 'staging',title: 'Staging Env',     description: 'Deploy to staging',                   type: 'Cloud',     x: 1160,y: 130, width: 200, height: 100, color: 'violet' },
      { id: 'prod',   title: 'Production',      description: 'Deploy to production (blue-green)',   type: 'Cloud',     x: 1160,y: 310, width: 200, height: 100, color: 'rose' },
    ],
    connections: [
      { id: 'c1', from: 'dev',    to: 'repo',    type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'repo',   to: 'ci',      type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c3', from: 'ci',     to: 'build',   type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c4', from: 'build',  to: 'test',    type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c5', from: 'test',   to: 'qa',      type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c6', from: 'qa',     to: 'staging', type: 'Orthogonal', arrowhead: 'Arrow', label: 'Pass' },
      { id: 'c7', from: 'qa',     to: 'prod',    type: 'Orthogonal', arrowhead: 'Arrow', label: 'Approve', lineStyle: 'dashed' },
    ],
  },

  // ── REST API Flow ─────────────────────────────────────────────────────────
  {
    id: 'rest-api',
    name: 'REST API Flow',
    description: 'Client → Middleware → Database tier',
    category: 'architecture',
    icon: 'api',
    color: '#22c55e',
    nodes: [
      { id: 'browser', title: 'Browser / App',  description: 'HTTP request from client',           type: 'Computer',  x: 60,  y: 200, width: 200, height: 100, color: 'slate' },
      { id: 'lb',      title: 'Load Balancer',  description: 'Nginx / HAProxy',                    type: 'Technical', x: 340, y: 200, width: 200, height: 100, color: 'blue' },
      { id: 'api1',    title: 'API Server 1',   description: 'Node.js / Express instance',         type: 'Process',   x: 620, y: 100, width: 200, height: 100, color: 'green' },
      { id: 'api2',    title: 'API Server 2',   description: 'Node.js / Express instance',         type: 'Process',   x: 620, y: 300, width: 200, height: 100, color: 'green' },
      { id: 'cache',   title: 'Redis Cache',    description: 'Hot-path data cache',                type: 'Database',  x: 900, y: 100, width: 200, height: 100, color: 'rose' },
      { id: 'db',      title: 'Database',       description: 'PostgreSQL / MySQL',                 type: 'Database',  x: 900, y: 300, width: 200, height: 100, color: 'indigo' },
    ],
    connections: [
      { id: 'c1', from: 'browser', to: 'lb',    type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'lb',      to: 'api1',  type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c3', from: 'lb',      to: 'api2',  type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c4', from: 'api1',    to: 'cache', type: 'Straight',   arrowhead: 'Arrow', lineStyle: 'dashed', label: 'cache hit' },
      { id: 'c5', from: 'api1',    to: 'db',    type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c6', from: 'api2',    to: 'db',    type: 'Orthogonal', arrowhead: 'Arrow' },
    ],
  },

  // ── Event-Driven System ───────────────────────────────────────────────────
  {
    id: 'event-driven',
    name: 'Event-Driven',
    description: 'Producers → Broker → Consumers',
    category: 'architecture',
    icon: 'event',
    color: '#f43f5e',
    nodes: [
      { id: 'producer1', title: 'Order Service',   description: 'Emits OrderPlaced events',         type: 'Process',   x: 60,  y: 140, width: 200, height: 100, color: 'blue'   },
      { id: 'producer2', title: 'Payment Service', description: 'Emits PaymentProcessed events',    type: 'Process',   x: 60,  y: 300, width: 200, height: 100, color: 'green'  },
      { id: 'broker',    title: 'Kafka Broker',    description: 'Topics: orders, payments',         type: 'Technical', x: 380, y: 220, width: 200, height: 100, color: 'rose'   },
      { id: 'consumer1', title: 'Email Consumer',  description: 'Sends confirmation emails',        type: 'Process',   x: 680, y: 100, width: 200, height: 100, color: 'amber'  },
      { id: 'consumer2', title: 'Analytics',       description: 'Streams to data warehouse',        type: 'Process',   x: 680, y: 230, width: 200, height: 100, color: 'violet' },
      { id: 'consumer3', title: 'Inventory Svc',   description: 'Reduces stock on order',           type: 'Process',   x: 680, y: 360, width: 200, height: 100, color: 'indigo' },
      { id: 'dlq',       title: 'Dead Letter Queue',description: 'Failed messages for retry',        type: 'Database',  x: 960, y: 220, width: 200, height: 100, color: 'slate'  },
    ],
    connections: [
      { id: 'c1', from: 'producer1', to: 'broker',    type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'producer2', to: 'broker',    type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c3', from: 'broker',    to: 'consumer1', type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c4', from: 'broker',    to: 'consumer2', type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c5', from: 'broker',    to: 'consumer3', type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c6', from: 'broker',    to: 'dlq',       type: 'Orthogonal', arrowhead: 'Arrow', lineStyle: 'dotted', label: 'retry fail' },
    ],
  },

  // ── Database ERD ──────────────────────────────────────────────────────────
  {
    id: 'erd',
    name: 'Database ERD',
    description: 'Users → Orders → Products schema',
    category: 'database',
    icon: 'table_chart',
    color: '#8b5cf6',
    nodes: [
      { id: 'users',      title: 'Users',       description: 'id, name, email, created_at',       type: 'Database',  x: 60,  y: 200, width: 220, height: 120, color: 'blue'   },
      { id: 'sessions',   title: 'Sessions',    description: 'id, user_id, token, expires',       type: 'Database',  x: 360, y: 60,  width: 220, height: 120, color: 'slate'  },
      { id: 'orders',     title: 'Orders',      description: 'id, user_id, status, total',        type: 'Database',  x: 360, y: 220, width: 220, height: 120, color: 'green'  },
      { id: 'order_items',title: 'Order Items', description: 'id, order_id, product_id, qty',     type: 'Database',  x: 660, y: 220, width: 220, height: 120, color: 'amber'  },
      { id: 'products',   title: 'Products',    description: 'id, name, price, stock, category',  type: 'Database',  x: 660, y: 60,  width: 220, height: 120, color: 'violet' },
      { id: 'categories', title: 'Categories',  description: 'id, name, parent_id',               type: 'Database',  x: 960, y: 60,  width: 220, height: 120, color: 'indigo' },
    ],
    connections: [
      { id: 'c1', from: 'users',       to: 'sessions',    type: 'Orthogonal', arrowhead: "Crow's Foot", label: '1:N' },
      { id: 'c2', from: 'users',       to: 'orders',      type: 'Orthogonal', arrowhead: "Crow's Foot", label: '1:N' },
      { id: 'c3', from: 'orders',      to: 'order_items', type: 'Straight',   arrowhead: "Crow's Foot", label: '1:N' },
      { id: 'c4', from: 'products',    to: 'order_items', type: 'Orthogonal', arrowhead: "Crow's Foot", label: '1:N' },
      { id: 'c5', from: 'categories',  to: 'products',    type: 'Straight',   arrowhead: "Crow's Foot", label: '1:N' },
    ],
  },

  // ── AWS Cloud Architecture ────────────────────────────────────────────────
  {
    id: 'aws',
    name: 'AWS Architecture',
    description: 'Classic 3-tier cloud infrastructure',
    category: 'cloud',
    icon: 'cloud',
    color: '#f59e0b',
    nodes: [
      { id: 'users',    title: 'End Users',       description: 'Browser / Mobile app',              type: 'People',    x: 60,  y: 230, width: 190, height: 100, color: 'slate'  },
      { id: 'cdn',      title: 'CloudFront CDN',  description: 'Global content delivery',           type: 'Cloud',     x: 330, y: 230, width: 190, height: 100, color: 'amber'  },
      { id: 'alb',      title: 'ALB',             description: 'Application Load Balancer',         type: 'Technical', x: 600, y: 230, width: 190, height: 100, color: 'blue'   },
      { id: 'ec2a',     title: 'EC2 Instance A',  description: 'App server – AZ-1a',               type: 'Cloud',     x: 870, y: 120, width: 190, height: 100, color: 'green'  },
      { id: 'ec2b',     title: 'EC2 Instance B',  description: 'App server – AZ-1b',               type: 'Cloud',     x: 870, y: 340, width: 190, height: 100, color: 'green'  },
      { id: 'rds',      title: 'RDS Aurora',      description: 'Multi-AZ managed database',        type: 'Database',  x: 1140,y: 230, width: 190, height: 100, color: 'violet' },
      { id: 's3',       title: 'S3 Bucket',       description: 'Static assets & backups',           type: 'Cloud',     x: 1140,y: 80,  width: 190, height: 100, color: 'amber'  },
      { id: 'elastic',  title: 'ElastiCache',     description: 'Redis session / cache layer',       type: 'Database',  x: 1140,y: 380, width: 190, height: 100, color: 'rose'   },
    ],
    connections: [
      { id: 'c1', from: 'users',  to: 'cdn',     type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'cdn',    to: 'alb',     type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c3', from: 'alb',    to: 'ec2a',    type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c4', from: 'alb',    to: 'ec2b',    type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c5', from: 'ec2a',   to: 'rds',     type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c6', from: 'ec2b',   to: 'rds',     type: 'Orthogonal', arrowhead: 'Arrow' },
      { id: 'c7', from: 'ec2a',   to: 's3',      type: 'Curved',     arrowhead: 'Arrow', lineStyle: 'dashed' },
      { id: 'c8', from: 'ec2a',   to: 'elastic', type: 'Curved',     arrowhead: 'Arrow', lineStyle: 'dotted' },
    ],
  },

  // ── Kubernetes Cluster ─────────────────────────────────────────────────────
  {
    id: 'kubernetes',
    name: 'Kubernetes Cluster',
    description: 'Control plane + worker nodes',
    category: 'cloud',
    icon: 'hub',
    color: '#3b82f6',
    nodes: [
      { id: 'ingress',  title: 'Ingress',         description: 'Nginx Ingress Controller',          type: 'Technical', x: 60,  y: 230, width: 190, height: 100, color: 'blue'   },
      { id: 'svc',      title: 'Service',         description: 'ClusterIP / LoadBalancer',          type: 'Technical', x: 330, y: 230, width: 190, height: 100, color: 'indigo' },
      { id: 'dep',      title: 'Deployment',      description: '3 replicas, rolling update',        type: 'Process',   x: 600, y: 230, width: 190, height: 100, color: 'green'  },
      { id: 'pod1',     title: 'Pod A',           description: 'app:v2, port 8080',                 type: 'Cloud',     x: 870, y: 100, width: 190, height: 100, color: 'green'  },
      { id: 'pod2',     title: 'Pod B',           description: 'app:v2, port 8080',                 type: 'Cloud',     x: 870, y: 230, width: 190, height: 100, color: 'green'  },
      { id: 'pod3',     title: 'Pod C',           description: 'app:v2, port 8080',                 type: 'Cloud',     x: 870, y: 360, width: 190, height: 100, color: 'green'  },
      { id: 'pvc',      title: 'PersistentVolume',description: 'StorageClass: gp2',                 type: 'Database',  x: 1140,y: 230, width: 190, height: 100, color: 'violet' },
      { id: 'cm',       title: 'ConfigMap/Secret',description: 'Env config & secrets',              type: 'Technical', x: 600, y: 390, width: 190, height: 100, color: 'amber'  },
    ],
    connections: [
      { id: 'c1', from: 'ingress', to: 'svc',  type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'svc',     to: 'dep',  type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c3', from: 'dep',     to: 'pod1', type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c4', from: 'dep',     to: 'pod2', type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c5', from: 'dep',     to: 'pod3', type: 'Curved',     arrowhead: 'Arrow' },
      { id: 'c6', from: 'pod2',    to: 'pvc',  type: 'Orthogonal', arrowhead: 'Arrow', lineStyle: 'dashed' },
      { id: 'c7', from: 'cm',      to: 'dep',  type: 'Straight',   arrowhead: 'Arrow', lineStyle: 'dotted' },
    ],
  },

  // ── User Auth Flow ────────────────────────────────────────────────────────
  {
    id: 'auth-flow',
    name: 'Auth Flow',
    description: 'Login → JWT → Protected resource',
    category: 'workflow',
    icon: 'lock',
    color: '#f43f5e',
    nodes: [
      { id: 'user',     title: 'User',            description: 'Provides credentials',               type: 'People',    x: 60,  y: 220, width: 190, height: 100, color: 'slate'  },
      { id: 'login',    title: 'Login Endpoint',  description: 'POST /auth/login',                    type: 'Process',   x: 330, y: 220, width: 190, height: 100, color: 'blue'   },
      { id: 'validate', title: 'Validate Creds',  description: 'Bcrypt hash comparison',              type: 'Decision',  x: 600, y: 220, width: 190, height: 100, color: 'amber'  },
      { id: 'userdb',   title: 'User Database',   description: 'Lookup user record',                  type: 'Database',  x: 600, y: 380, width: 190, height: 100, color: 'indigo' },
      { id: 'jwt',      title: 'Issue JWT',       description: 'Sign access + refresh tokens',       type: 'Process',   x: 870, y: 120, width: 190, height: 100, color: 'green'  },
      { id: 'err',      title: '401 Unauthorized',description: 'Return error response',               type: 'Process',   x: 870, y: 340, width: 190, height: 100, color: 'rose'   },
      { id: 'resource', title: 'Protected API',   description: 'Bearer token required',              type: 'Technical', x: 1140,y: 120, width: 190, height: 100, color: 'violet' },
    ],
    connections: [
      { id: 'c1', from: 'user',     to: 'login',    type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'login',    to: 'validate', type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c3', from: 'validate', to: 'userdb',   type: 'Curved',     arrowhead: 'Arrow', label: 'lookup' },
      { id: 'c4', from: 'validate', to: 'jwt',      type: 'Curved',     arrowhead: 'Arrow', label: 'valid' },
      { id: 'c5', from: 'validate', to: 'err',      type: 'Curved',     arrowhead: 'Arrow', label: 'invalid', lineStyle: 'dashed' },
      { id: 'c6', from: 'jwt',      to: 'resource', type: 'Straight',   arrowhead: 'Arrow' },
    ],
  },

  // ── Monolith → Microservices migration ───────────────────────────────────
  {
    id: 'monolith-migration',
    name: 'Strangler Fig Migration',
    description: 'Monolith → incremental service extraction',
    category: 'architecture',
    icon: 'transform',
    color: '#8b5cf6',
    nodes: [
      { id: 'client',    title: 'Client',           description: 'Browser / mobile',                 type: 'Computer',  x: 60,  y: 240, width: 190, height: 100, color: 'slate'  },
      { id: 'facade',    title: 'Strangler Facade', description: 'Routes new vs old traffic',        type: 'Technical', x: 330, y: 240, width: 190, height: 100, color: 'amber'  },
      { id: 'mono',      title: 'Monolith',         description: 'Legacy Rails / Django app',        type: 'Business',  x: 600, y: 370, width: 190, height: 100, color: 'rose'   },
      { id: 'svc1',      title: 'Auth Microservice',description: 'Extracted auth domain',            type: 'Process',   x: 600, y: 130, width: 190, height: 100, color: 'green'  },
      { id: 'svc2',      title: 'Product Service',  description: 'Extracted catalog domain',         type: 'Process',   x: 600, y: 250, width: 190, height: 100, color: 'blue'   },
      { id: 'shareddb',  title: 'Shared DB',        description: 'Temporary shared schema',          type: 'Database',  x: 870, y: 370, width: 190, height: 100, color: 'rose'   },
      { id: 'newdbs',    title: 'New Databases',    description: 'Per-service isolated DBs',         type: 'Database',  x: 870, y: 190, width: 190, height: 100, color: 'green'  },
    ],
    connections: [
      { id: 'c1', from: 'client',  to: 'facade', type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'facade',  to: 'mono',   type: 'Curved',     arrowhead: 'Arrow', label: 'legacy', lineStyle: 'dashed' },
      { id: 'c3', from: 'facade',  to: 'svc1',   type: 'Curved',     arrowhead: 'Arrow', label: 'new' },
      { id: 'c4', from: 'facade',  to: 'svc2',   type: 'Curved',     arrowhead: 'Arrow', label: 'new' },
      { id: 'c5', from: 'mono',    to: 'shareddb',type: 'Straight',  arrowhead: 'Arrow' },
      { id: 'c6', from: 'svc1',    to: 'newdbs', type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c7', from: 'svc2',    to: 'newdbs', type: 'Straight',   arrowhead: 'Arrow' },
    ],
  },

  // ── Venn Sweetspot ────────────────────────────────────────────────────────
  {
    id: 'venn-diagram',
    name: 'Venn Diagram',
    description: 'Viability, Feasibility, and Desirability sweetspot overlap',
    category: 'workflow',
    icon: 'adjust',
    color: '#8b5cf6',
    nodes: [
      { id: 'viability',    title: 'Viability (Business)',     description: 'Is it financially sound and strategic?',  type: 'VennCircle', x: 150, y: 100, width: 280, height: 280, color: 'blue', customFill: 'rgba(59,130,246,0.3)' },
      { id: 'feasibility',  title: 'Feasibility (Tech)',       description: 'Can we build it reliably and scale it?',  type: 'VennCircle', x: 390, y: 100, width: 280, height: 280, color: 'green', customFill: 'rgba(34,197,94,0.3)' },
      { id: 'desirability', title: 'Desirability (User)',     description: 'Do people want or need this product?',    type: 'VennCircle', x: 270, y: 240, width: 280, height: 280, color: 'violet', customFill: 'rgba(139,92,246,0.3)' },
      { id: 'sweetspot',    title: 'SWEET SPOT\nInnovation',   description: 'The golden intersection',                  type: 'Square',     x: 340, y: 250, width: 140, height: 80, color: 'amber', variant: 'text', titleStyle: { fontWeight: 'bold', fontSize: 13 } },
    ],
    connections: [],
  },

  // ── UML Domain Model ──────────────────────────────────────────────────────
  {
    id: 'uml-class',
    name: 'UML Class Diagram',
    description: 'Standard E-Commerce Domain Model class specifications',
    category: 'database',
    icon: 'domain',
    color: '#3b82f6',
    nodes: [
      { id: 'User',        title: 'User',            description: '+ id: int\n+ email: string\n+ passwordHash: string', notes: '+ authenticate(): bool\n+ resetPassword(): void', type: 'UMLClass', x: 100, y: 100, width: 240, height: 160, color: 'blue' },
      { id: 'Customer',    title: 'Customer',        description: '+ shippingAddress: string\n+ billingDetails: string', notes: '+ placeOrder(): Order\n+ getOrderHistory(): List', type: 'UMLClass', x: 100, y: 380, width: 240, height: 160, color: 'violet' },
      { id: 'Order',       title: 'Order',           description: '+ id: int\n+ totalAmount: double\n+ status: OrderStatus', notes: '+ calculateTotal(): void\n+ cancel(): bool\n+ ship(): void', type: 'UMLClass', x: 480, y: 380, width: 240, height: 160, color: 'green' },
      { id: 'OrderItem',   title: 'OrderItem',       description: '+ id: int\n+ quantity: int\n+ unitPrice: double', notes: '+ getSubtotal(): double', type: 'UMLClass', x: 860, y: 380, width: 240, height: 160, color: 'amber' },
      { id: 'Product',     title: 'Product',         description: '+ sku: string\n+ name: string\n+ price: double\n+ stockQty: int', notes: '+ reduceStock(qty: int): bool\n+ restock(qty: int): void', type: 'UMLClass', x: 860, y: 100, width: 240, height: 160, color: 'indigo' },
    ],
    connections: [
      { id: 'c1', from: 'Customer',  to: 'User',      type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'Customer',  to: 'Order',     type: 'Straight',   arrowhead: 'Arrow', label: 'places (1:N)' },
      { id: 'c3', from: 'Order',     to: 'OrderItem', type: 'Straight',   arrowhead: 'Arrow', label: 'contains (1:N)' },
      { id: 'c4', from: 'OrderItem', to: 'Product',   type: 'Straight',   arrowhead: 'Arrow', label: 'refers to (N:1)' },
    ],
  },

  // ── ERD Database Schema ───────────────────────────────────────────────────
  {
    id: 'er-diagram',
    name: 'Database ERD',
    description: 'Entity-Relationship database table schemas and keys',
    category: 'database',
    icon: 'table_chart',
    color: '#10b981',
    nodes: [
      { id: 'users',       title: 'users',           description: 'id (PK) [INT]\nemail [VARCHAR]\npassword_hash [VARCHAR]\ncreated_at [TIMESTAMP]', type: 'EREntity', x: 100, y: 200, width: 240, height: 160, color: 'blue' },
      { id: 'profiles',    title: 'profiles',        description: 'id (PK) [INT]\nuser_id (FK) [INT]\nfirst_name [VARCHAR]\nlast_name [VARCHAR]', type: 'EREntity', x: 100, y: 460, width: 240, height: 160, color: 'slate' },
      { id: 'orders',      title: 'orders',          description: 'id (PK) [INT]\nuser_id (FK) [INT]\nstatus [VARCHAR]\ntotal_amount [DECIMAL]\nordered_at [TIMESTAMP]', type: 'EREntity', x: 480, y: 200, width: 240, height: 160, color: 'green' },
      { id: 'order_items', title: 'order_items',     description: 'id (PK) [INT]\norder_id (FK) [INT]\nproduct_id (FK) [INT]\nquantity [INT]\nprice [DECIMAL]', type: 'EREntity', x: 860, y: 200, width: 240, height: 160, color: 'amber' },
      { id: 'products',    title: 'products',        description: 'id (PK) [INT]\nname [VARCHAR]\nprice [DECIMAL]\nstock_qty [INT]', type: 'EREntity', x: 860, y: 460, width: 240, height: 160, color: 'indigo' },
    ],
    connections: [
      { id: 'c1', from: 'users',     to: 'profiles',    type: 'Straight',   arrowhead: "Crow's Foot", label: 'has_one' },
      { id: 'c2', from: 'users',     to: 'orders',      type: 'Straight',   arrowhead: "Crow's Foot", label: 'places' },
      { id: 'c3', from: 'orders',    to: 'order_items', type: 'Straight',   arrowhead: "Crow's Foot", label: 'has_many' },
      { id: 'c4', from: 'products',  to: 'order_items', type: 'Straight',   arrowhead: "Crow's Foot", label: 'contains' },
    ],
  },

  // ── Process Swimlanes ─────────────────────────────────────────────────────
  {
    id: 'swimlane-flow',
    name: 'Swimlane Process',
    description: 'Process steps isolated across role swimlanes',
    category: 'workflow',
    icon: 'view_week',
    color: '#f59e0b',
    nodes: [
      { id: 'lane_customer', title: 'Customer Lane',     description: 'User Interaction Actions',           type: 'Swimlane', x: 50,  y: 50,  width: 320, height: 480, color: 'blue' },
      { id: 'lane_ops',      title: 'Operations Lane',   description: 'Fulfillment & Backend Actions',       type: 'Swimlane', x: 420, y: 50,  width: 320, height: 480, color: 'green' },
      { id: 'c_browse',      title: '1. Browse Catalog', description: 'User selects desired product items',  type: 'Oval',     x: 110, y: 100, width: 200, height: 80,  color: 'blue' },
      { id: 'c_pay',         title: '2. Submit Payment', description: 'Enters checkout & payment detail',   type: 'Process',  x: 110, y: 220, width: 200, height: 80,  color: 'blue' },
      { id: 'o_verify',      title: '3. Payment Verified?', description: 'Gateway processing verification', type: 'Decision', x: 480, y: 220, width: 200, height: 80,  color: 'green' },
      { id: 'o_ship',        title: '4. Pack & Ship',    description: 'Warehouse prints labels & delivers', type: 'Process',  x: 480, y: 350, width: 200, height: 80,  color: 'green' },
      { id: 'c_receive',     title: '5. Receive Order',  description: 'Shipment delivered to user end',     type: 'Oval',     x: 110, y: 350, width: 200, height: 80,  color: 'blue' },
    ],
    connections: [
      { id: 'c1', from: 'c_browse',  to: 'c_pay',      type: 'Straight',   arrowhead: 'Arrow' },
      { id: 'c2', from: 'c_pay',     to: 'o_verify',   type: 'Straight',   arrowhead: 'Arrow', label: 'Authorized' },
      { id: 'c3', from: 'o_verify',  to: 'o_ship',     type: 'Straight',   arrowhead: 'Arrow', label: 'Valid' },
      { id: 'c4', from: 'o_verify',  to: 'c_pay',      type: 'Curved',     arrowhead: 'Arrow', label: 'Declined', lineStyle: 'dashed' },
      { id: 'c5', from: 'o_ship',    to: 'c_receive',  type: 'Straight',   arrowhead: 'Arrow', label: 'Delivered' },
    ],
  },

  // ── Gantt Project Timeline ───────────────────────────────────────────────
  {
    id: 'gantt-chart',
    name: 'Gantt Project Schedule',
    description: 'Cascading Gantt task durations and sequence timelines',
    category: 'workflow',
    icon: 'calendar_today',
    color: '#ec4899',
    nodes: [
      { id: 'timeline',    title: 'Project Timeline: | Week 1-2 (Spec) | Week 3-4 (Dev) | Week 5-6 (Test & Release) |', description: '', type: 'Square', x: 300, y: 40, width: 620, height: 40, color: 'slate', variant: 'text', titleStyle: { fontFamily: 'monospace', fontSize: 11 } },
      { id: 'h_specs',     title: '1. Specs & Requirements', description: '', type: 'Square', x: 50,  y: 100, width: 220, height: 50, color: 'slate', variant: 'text', titleStyle: { fontWeight: 'bold' } },
      { id: 'h_uiux',      title: '2. UI/UX Prototype',      description: '', type: 'Square', x: 50,  y: 170, width: 220, height: 50, color: 'slate', variant: 'text', titleStyle: { fontWeight: 'bold' } },
      { id: 'h_build',     title: '3. Full-Stack Development',description: '', type: 'Square', x: 50,  y: 240, width: 220, height: 50, color: 'slate', variant: 'text', titleStyle: { fontWeight: 'bold' } },
      { id: 'h_qa',        title: '4. QA & Bug Fixes',       description: '', type: 'Square', x: 50,  y: 310, width: 220, height: 50, color: 'slate', variant: 'text', titleStyle: { fontWeight: 'bold' } },
      { id: 'h_launch',    title: '5. Production Deployment',description: '', type: 'Square', x: 50,  y: 380, width: 220, height: 50, color: 'slate', variant: 'text', titleStyle: { fontWeight: 'bold' } },
      
      { id: 't_specs',     title: 'Requirements Spec',       description: 'Days 1 - 10',      type: 'Gantt', x: 300, y: 100, width: 180, height: 50, color: 'blue' },
      { id: 't_uiux',      title: 'Figma Prototyping',       description: 'Days 8 - 18',      type: 'Gantt', x: 420, y: 170, width: 180, height: 50, color: 'violet' },
      { id: 't_build',     title: 'Core Development',        description: 'Days 16 - 32',     type: 'Gantt', x: 560, y: 240, width: 220, height: 50, color: 'green' },
      { id: 't_qa',        title: 'Testing Suite Runs',      description: 'Days 30 - 38',     type: 'Gantt', x: 740, y: 310, width: 120, height: 50, color: 'amber' },
      { id: 't_launch',    title: 'Release Live',            description: 'Days 38 - 42',     type: 'Gantt', x: 840, y: 380, width: 80,  height: 50, color: 'rose' },
    ],
    connections: [
      { id: 'c1', from: 't_specs',  to: 't_uiux',   type: 'Elbow', arrowhead: 'Arrow' },
      { id: 'c2', from: 't_uiux',   to: 't_build',  type: 'Elbow', arrowhead: 'Arrow' },
      { id: 'c3', from: 't_build',  to: 't_qa',     type: 'Elbow', arrowhead: 'Arrow' },
      { id: 'c4', from: 't_qa',     to: 't_launch', type: 'Elbow', arrowhead: 'Arrow' },
    ],
  },

  // ── DC Capacitor Filter Circuit ──────────────────────────────────────────
  {
    id: 'circuit-diagram',
    name: 'Capacitor Filter Circuit',
    description: 'DC voltage source filter circuit with capacitor and load resistor',
    category: 'architecture',
    icon: 'electric_bolt',
    color: '#6366f1',
    nodes: [
      { id: 'source',      title: 'Source V1',       description: '12V DC input battery supply',          type: 'CircuitSource',   x: 100, y: 180, width: 100, height: 100, color: 'blue' },
      { id: 'cap',         title: 'Capacitor C1',    description: '10uF decoupling capacitor',            type: 'CircuitCapacitor',x: 300, y: 100, width: 120, height: 60,  color: 'violet' },
      { id: 'resistor',    title: 'Load R1',         description: '1k load output resistor',              type: 'CircuitResistor', x: 500, y: 180, width: 120, height: 60,  color: 'green' },
      { id: 'gnd',         title: 'Ground GND',      description: 'System common zero voltage potential', type: 'CircuitGround',    x: 320, y: 320, width: 80,  height: 80,  color: 'slate' },
    ],
    connections: [
      { id: 'c1', from: 'source',   to: 'cap',      type: 'Orthogonal', arrowhead: 'Arrow', arrowDirection: 'none', label: 'V_cc (+)' },
      { id: 'c2', from: 'cap',      to: 'resistor', type: 'Orthogonal', arrowhead: 'Arrow', arrowDirection: 'none' },
      { id: 'c3', from: 'resistor', to: 'gnd',      type: 'Orthogonal', arrowhead: 'Arrow', arrowDirection: 'none' },
      { id: 'c4', from: 'source',   to: 'gnd',      type: 'Orthogonal', arrowhead: 'Arrow', arrowDirection: 'none', label: 'Low (-)' },
    ],
  },

  // ── Cost Bar Chart ────────────────────────────────────────────────────────
  {
    id: 'bar-chart',
    name: 'Cloud Costs Chart',
    description: 'Cloud provider monthly hosting cost comparison bar diagram',
    category: 'workflow',
    icon: 'bar_chart',
    color: '#e11d48',
    nodes: [
      { id: 'header',  title: 'Cloud Cost Comparison (Monthly hosting, 1M requests)', description: '', type: 'Square', x: 100, y: 40, width: 620, height: 40, color: 'slate', variant: 'text', titleStyle: { fontWeight: 'bold', fontSize: 13 } },
      { id: 'y_scale', title: 'Cost ($)\n\n400 -\n\n300 -\n\n200 -\n\n100 -\n\n  0 -', description: '', type: 'Square', x: 80,  y: 100, width: 60,  height: 240, color: 'slate', variant: 'text', titleStyle: { fontFamily: 'monospace', fontSize: 10 } },
      { id: 'bar_aws', title: 'AWS\n$360',       description: 'Scale: 90%', type: 'BarSegment', x: 180, y: 120, width: 80, height: 220, color: 'amber' },
      { id: 'bar_gcp', title: 'GCP\n$280',       description: 'Scale: 70%', type: 'BarSegment', x: 300, y: 170, width: 80, height: 170, color: 'green' },
      { id: 'bar_az',  title: 'Azure\n$320',     description: 'Scale: 80%', type: 'BarSegment', x: 420, y: 145, width: 80, height: 195, color: 'blue' },
      { id: 'bar_ver', title: 'Vercel\n$80',     description: 'Scale: 20%', type: 'BarSegment', x: 540, y: 265, width: 80, height: 75,  color: 'rose' },
      { id: 'bar_sub', title: 'Render\n$120',    description: 'Scale: 30%', type: 'BarSegment', x: 660, y: 240, width: 80, height: 100, color: 'violet' },
    ],
    connections: [],
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'all',          label: 'All Templates' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'workflow',     label: 'Workflow' },
  { id: 'database',     label: 'Database' },
  { id: 'devops',       label: 'DevOps' },
  { id: 'cloud',        label: 'Cloud' },
] as const;
