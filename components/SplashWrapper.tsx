"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";

export default function SplashWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [splashDone, setSplashDone] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
    if (!mobile) setSplashDone(true);
  }, []);

  // Antes de detectar dispositivo: mostra conteúdo direto (evita flash azul)
  if (isMobile === null) {
    return <>{children}</>;
  }

  return (
    <>
      {isMobile && <SplashScreen onFinish={() => setSplashDone(true)} />}

      <AnimatePresence>
        {splashDone && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: isMobile ? 0.7 : 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
