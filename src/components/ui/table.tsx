import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  align,
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "right" }) {
  return (
    <th className={`py-2.5 pr-4 font-semibold ${align === "right" ? "text-right" : ""} ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/80 ${className}`}>{children}</tr>;
}

export function TableCell({
  children,
  align,
  mono,
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "right"; mono?: boolean }) {
  return (
    <td className={`py-2.5 pr-4 ${align === "right" ? "text-right" : ""} ${mono ? "font-mono text-xs" : ""} ${className}`} {...props}>
      {children}
    </td>
  );
}
