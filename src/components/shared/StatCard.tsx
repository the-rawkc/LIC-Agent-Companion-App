import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendType = 'neutral',
  onClick,
  className = '',
}: StatCardProps) {
  const trendColor = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-rose-600 dark:text-rose-400',
    neutral: 'text-slate-500 dark:text-slate-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400 font-semibold',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow active:scale-[0.99]' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <h4 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words">
            {value}
          </h4>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-words">
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={`mt-1.5 text-xs ${trendColor[trendType]}`}>
              {trend}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-slate-700 dark:text-slate-200 shrink-0 ml-3">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
