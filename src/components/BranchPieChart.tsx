'use client';

import React from 'react';

interface BranchSlice {
  branchId: string;
  branchName: string;
  branchCode: string;
  count: number;
  percentage: number;
}

interface PieChartProps {
  data: BranchSlice[];
  totalShifts: number;
}

const BRANCH_COLORS = [
  { bg: '#0284c7', name: 'Cyan Blue' },   // Branch 1
  { bg: '#d97706', name: 'Amber Gold' },  // Branch 2
  { bg: '#10b981', name: 'Emerald' },     // Branch 3
  { bg: '#ef4444', name: 'Red Coral' },   // Branch 4
  { bg: '#8b5cf6', name: 'Purple' },
  { bg: '#06b6d4', name: 'Teal' },
];

export default function BranchPieChart({ data, totalShifts }: PieChartProps) {
  if (!data || data.length === 0 || totalShifts === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
        <span>📊 ยังไม่มีประวัติการเข้างานในรอบเดือนนี้</span>
      </div>
    );
  }

  // Calculate SVG arc paths
  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const slices = data.map((slice, index) => {
    const startPercent = cumulativePercent;
    const slicePercent = slice.count / totalShifts;
    cumulativePercent += slicePercent;
    const endPercent = cumulativePercent;

    const [startX, startY] = getCoordinatesForPercent(startPercent);
    const [endX, endY] = getCoordinatesForPercent(endPercent);

    // If slice is > 50%, largeArcFlag is 1
    const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

    const pathData = [
      `M 0 0`,
      `L ${startX} ${startY}`,
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `Z`,
    ].join(' ');

    const color = BRANCH_COLORS[index % BRANCH_COLORS.length].bg;

    return {
      ...slice,
      pathData,
      color,
      percentStr: `${Math.round(slicePercent * 100)}%`,
    };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      {/* SVG Pie Chart */}
      <div className="relative w-44 h-44 flex-shrink-0">
        <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
          {slices.map((slice, idx) => (
            <path
              key={idx}
              d={slice.pathData}
              fill={slice.color}
              className="transition-all duration-300 hover:opacity-85 cursor-pointer"
            >
              <title>{`${slice.branchName}: ${slice.count} กะ (${slice.percentStr})`}</title>
            </path>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black text-slate-900">{totalShifts}</span>
          <span className="text-[10px] text-slate-500 font-bold">กะงานรวม</span>
        </div>
      </div>

      {/* Legend & Breakdown Table */}
      <div className="flex-1 w-full space-y-2">
        <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
          สัดส่วนการเข้างานรายสาขา (Branch Distribution):
        </h4>

        <div className="space-y-1.5">
          {slices.map((slice, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-bold text-slate-800">{slice.branchName}</span>
              </div>
              <div className="flex items-center gap-3 font-semibold text-slate-700">
                <span>{slice.count} วัน</span>
                <span className="bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-md text-[11px] font-black">
                  {slice.percentStr}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
