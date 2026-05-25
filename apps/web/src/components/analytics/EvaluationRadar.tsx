'use client';

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const data = [
  { subject: 'Faithfulness', A: 98, B: 85, fullMark: 100 },
  { subject: 'Relevance', A: 95, B: 90, fullMark: 100 },
  { subject: 'Speed (ms)', A: 85, B: 60, fullMark: 100 },
  { subject: 'Citation Accuracy', A: 99, B: 80, fullMark: 100 },
  { subject: 'Context Recall', A: 92, B: 75, fullMark: 100 },
];

export default function EvaluationRadar() {
  return (
    <div className="h-64 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#475569" opacity={0.4} />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
          />
          <Radar name="Current NIM Model" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.5} />
          <Radar name="Previous Baseline" dataKey="B" stroke="#64748b" fill="#64748b" fillOpacity={0.2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
