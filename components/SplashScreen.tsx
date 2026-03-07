"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detecta se é mobile pela largura da tela
    setIsMobile(window.innerWidth <= 768);

    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  // No desktop, chama onFinish imediatamente sem mostrar nada
  useEffect(() => {
    if (
      isMobile === false &&
      typeof window !== "undefined" &&
      window.innerWidth > 768
    ) {
      onFinish();
    }
  }, [isMobile]);

  // Enquanto não sabe se é mobile (SSR), não renderiza nada
  if (typeof window === "undefined") return null;
  if (window.innerWidth > 768) return null;

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <video
            src="/splash-video-logo.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-contain"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
