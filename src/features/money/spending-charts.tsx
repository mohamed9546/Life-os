"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useMemo } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category?: string;
  type?: "income" | "expense";
}

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface-2)",
  border: "1px solid var(--surface-3)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--text-primary)",
};

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function SpendingCharts({ transactions }: { transactions: Transaction[] }) {
  const expenses = transactions.filter(t => (t.amount ?? 0) < 0);
  const income   = transactions.filter(t => (t.amount ?? 0) > 0);

  // 30-day daily trend
  const trendData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const spent = expenses.filter(t => t.date?.startsWith(dayStr)).reduce((s, t) => s + Math.abs(t.amount), 0);
      const earned = income.filter(t => t.date?.startsWith(dayStr)).reduce((s, t) => s + t.amount, 0);
      return { date: format(day, "dd MMM"), spent, earned };
    });
  }, [expenses, income]);

  // By category
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(t => {
      const cat = t.category || "Uncategorised";
      map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
    });
    return Object.entries(map)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [expenses]);

  // Income vs expense pie
  const totalSpent  = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const pieData = [
    { name: "Expenses", value: totalSpent },
    { name: "Income",   value: totalIncome },
  ];

  return (
    <div className="space-y-6">
      {/* 30-day trend */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">30-Day Spending Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="earnedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} interval={6} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} tickFormatter={fmt} width={50} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [fmt(Number(v))]} />
            <Area type="monotone" dataKey="spent"  stroke="#ef4444" fill="url(#spentGrad)"  strokeWidth={2} name="Spent" />
            <Area type="monotone" dataKey="earned" stroke="#22c55e" fill="url(#earnedGrad)" strokeWidth={2} name="Income" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By category */}
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Spending by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} tickLine={false} tickFormatter={fmt} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} tickLine={false} width={90} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [fmt(Number(v))]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Income vs expense */}
        <div className="card space-y-4 flex flex-col">
          <h3 className="text-sm font-semibold text-text-primary">Income vs Expenses</h3>
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={4}>
                  <Cell fill="#ef4444" />
                  <Cell fill="#22c55e" />
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [fmt(Number(v))]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xs text-text-tertiary flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger inline-block" /> Expenses</p>
                <p className="text-sm font-mono font-semibold text-danger">{fmt(totalSpent)}</p>
              </div>
              <div className="text-center">
                <p className="text-2xs text-text-tertiary flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Income</p>
                <p className="text-sm font-mono font-semibold text-success">{fmt(totalIncome)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
