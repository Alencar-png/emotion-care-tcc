"use client";

import { ToastProvider } from "@/components/toast";

export default function RespondLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-br from-[#f0fdf4] via-white to-[#ecfdf5]">
        {children}
      </div>
    </ToastProvider>
  );
}
