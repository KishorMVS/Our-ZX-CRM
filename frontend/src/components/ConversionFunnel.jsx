import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

const ConversionFunnel = ({ data = [] }) => {
    // Sort funnel by typical sales process
    const statusOrder = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'IN_PROGRESS', 'CONVERTED', 'LOST'];
    const sortedData = data
        .filter(item => statusOrder.includes(item.status))
        .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-xl shadow-gray-200/50 p-8 h-full transition-all duration-500 hover:shadow-2xl">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Conversion Pipeline</h3>
                <div className="px-3 py-1 bg-indigo-50 rounded-lg text-indigo-600 text-xs font-black uppercase tracking-wider">
                    Live Funnel
                </div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                    <BarChart
                        data={sortedData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="status"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                            width={100}
                        />
                        <Tooltip
                            cursor={{ fill: '#f9fafb' }}
                            contentStyle={{
                                borderRadius: '16px',
                                border: 'none',
                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                padding: '12px'
                            }}
                        />
                        <Bar dataKey="count" radius={[0, 12, 12, 0]} barSize={24}>
                            {sortedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-y-3 gap-x-6 border-t border-gray-50 pt-6">
                {sortedData.map((item, index) => (
                    <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{item.status}</span>
                        </div>
                        <span className="text-xs font-black text-gray-700">{item.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ConversionFunnel;
