'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const data = [
  { time: '10:00', inputTokens: 4000, outputTokens: 2400 },
  { time: '10:15', inputTokens: 3000, outputTokens: 1398 },
  { time: '10:30', inputTokens: 2000, outputTokens: 9800 },
  { time: '10:45', inputTokens: 2780, outputTokens: 3908 },
  { time: '11:00', inputTokens: 1890, outputTokens: 4800 },
  { time: '11:15', inputTokens: 2390, outputTokens: 3800 },
  { time: '11:30', inputTokens: 3490, outputTokens: 4300 },
];

export default function TokenFlowChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} opacity={0.2} />
          <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
          />
          <Area type="monotone" dataKey="inputTokens" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorInput)" />
          <Area type="monotone" dataKey="outputTokens" stroke="#06b6d4" fillOpacity={1} fill="url(#colorOutput)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
