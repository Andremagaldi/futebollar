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
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "#0F172A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <video
            src="/splash-video-mobile.mp4"
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
