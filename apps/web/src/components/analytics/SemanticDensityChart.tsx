'use client';

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const data = [
  { x: 100, y: 200, z: 200, group: 'A' },
  { x: 120, y: 100, z: 260, group: 'A' },
  { x: 170, y: 300, z: 400, group: 'B' },
  { x: 140, y: 250, z: 280, group: 'A' },
  { x: 150, y: 400, z: 500, group: 'B' },
  { x: 110, y: 280, z: 200, group: 'A' },
  { x: 180, y: 320, z: 450, group: 'B' },
  { x: 200, y: 200, z: 300, group: 'C' },
  { x: 220, y: 150, z: 350, group: 'C' },
  { x: 250, y: 200, z: 300, group: 'C' },
];

const COLORS = ['#06b6d4', '#8b5cf6', '#10b981'];

export default function SemanticDensityChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.2} />
          <XAxis type="number" dataKey="x" name="UMAP X" stroke="#64748b" tick={false} axisLine={false} />
          <YAxis type="number" dataKey="y" name="UMAP Y" stroke="#64748b" tick={false} axisLine={false} />
          <ZAxis type="number" dataKey="z" range={[60, 400]} name="Density" />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }} 
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
          />
          <Scatter name="Semantic Nodes" data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.8} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
