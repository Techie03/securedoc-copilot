'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function LiveLineGraph() {
  const [data, setData] = useState(
    Array.from({ length: 15 }, (_, i) => ({
      time: `-${15 - i}s`,
      requests: Math.floor(Math.random() * 100) + 20
    }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => {
        const newData = [...prevData.slice(1)];
        newData.push({
          time: 'Now',
          requests: Math.floor(Math.random() * 100) + 20
        });
        // Update time labels
        return newData.map((item, index) => ({
          ...item,
          time: index === 14 ? 'Now' : `-${14 - index}s`
        }));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-64 w-full flex flex-col">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Live Server Requests</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.2} />
          <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
          />
          <Line 
            type="monotone" 
            dataKey="requests" 
            stroke="#06b6d4" 
            strokeWidth={3}
            dot={{ r: 4, fill: '#06b6d4' }}
            activeDot={{ r: 6, fill: '#fff' }}
            isAnimationActive={true}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
