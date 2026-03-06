"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";

export default function SplashWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <>
      {/* Splash Screen */}
      <SplashScreen onFinish={() => setSplashDone(true)} />

      {/* Conteúdo principal com fade-in suave após splash */}
      <AnimatePresence>
        {splashDone && (
          <motion.div
            key="main"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
