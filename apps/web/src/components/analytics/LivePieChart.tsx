'use client';

import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6'];

export default function LivePieChart() {
  const [data, setData] = useState([
    { name: 'Processed', value: 70 },
    { name: 'Indexing', value: 20 },
    { name: 'Queued', value: 10 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData([
        { name: 'Processed', value: Math.floor(Math.random() * 20) + 60 },
        { name: 'Indexing', value: Math.floor(Math.random() * 15) + 10 },
        { name: 'Queued', value: Math.floor(Math.random() * 10) + 5 },
      ]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-64 w-full flex flex-col">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Live Processing Queue</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            isAnimationActive={true}
            animationDuration={1000}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
