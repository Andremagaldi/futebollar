"use client";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  showBack,
  rightSlot,
}: Props) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 backdrop-blur-md">
      {showBack && (
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 active:scale-95 transition-transform"
        >
          <span className="text-sm text-gray-700 dark:text-gray-300">←</span>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-2xl leading-none tracking-wide text-gray-900 dark:text-white truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs mt-0.5 text-gray-400 dark:text-gray-600 truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {rightSlot}
        <ThemeToggle />
      </div>
    </header>
  );
}
