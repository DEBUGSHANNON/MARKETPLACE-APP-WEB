import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Asterisk } from 'lucide-react';

interface AmbientOrbitBackdropProps {
  onReturnHome?: () => void;
}

export const AmbientOrbitBackdrop: React.FC<AmbientOrbitBackdropProps> = ({
  onReturnHome,
}) => {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const smoothX = useSpring(rawX, { stiffness: 70, damping: 22 });
  const smoothY = useSpring(rawY, { stiffness: 70, damping: 22 });

  const glowX = useTransform(smoothX, [-1, 1], ['-6%', '6%']);
  const glowY = useTransform(smoothY, [-1, 1], ['-5%', '5%']);
  const ringShiftX = useTransform(smoothX, [-1, 1], [-18, 18]);
  const ringShiftY = useTransform(smoothY, [-1, 1], [-14, 14]);
  const badgeShiftX = useTransform(smoothX, [-1, 1], [12, -12]);
  const badgeShiftY = useTransform(smoothY, [-1, 1], [10, -10]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      rawX.set(Math.max(-1, Math.min(1, nx)));
      rawY.set(Math.max(-1, Math.min(1, ny)));
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [rawX, rawY]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#F3F3EE]"
    >
      {/* Interactive cursor-following studio light & sage aura */}
      <motion.div
        style={{ x: glowX, y: glowY }}
        className="absolute -inset-[12%]"
      >
        <div
          className="w-full h-full"
          style={{
            background:
              'radial-gradient(circle at 22% 24%, rgba(101, 154, 115, 0.14) 0%, rgba(255, 255, 255, 0.65) 38%, rgba(243, 243, 238, 0.96) 76%), radial-gradient(circle at 82% 76%, rgba(10, 70, 44, 0.08) 0%, transparent 48%)',
          }}
        />
      </motion.div>

      {/* Architectural orbital rings echoing the Home 3D Orbit Sphere */}
      <motion.div
        style={{ x: ringShiftX, y: ringShiftY }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <motion.svg
          viewBox="0 0 1000 1000"
          className="w-[125vmax] h-[125vmax] opacity-65"
          animate={{ rotate: 360 }}
          transition={{ duration: 140, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx="500"
            cy="500"
            r="340"
            fill="none"
            stroke="#0A462C"
            strokeOpacity="0.065"
            strokeWidth="1.2"
          />
          <ellipse
            cx="500"
            cy="500"
            rx="430"
            ry="230"
            transform="rotate(-24 500 500)"
            fill="none"
            stroke="#659A73"
            strokeOpacity="0.11"
            strokeWidth="1.2"
            strokeDasharray="6 8"
          />
          <ellipse
            cx="500"
            cy="500"
            rx="410"
            ry="210"
            transform="rotate(32 500 500)"
            fill="none"
            stroke="#0A462C"
            strokeOpacity="0.06"
            strokeWidth="1"
          />
        </motion.svg>
      </motion.div>

      {/* Subtle sage campus badge linking visually back to Home Orbit Sphere */}
      {onReturnHome && (
        <motion.button
          type="button"
          onClick={onReturnHome}
          title="Return to 3D Orbit Home"
          style={{ x: badgeShiftX, y: badgeShiftY }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          className="pointer-events-auto hidden xl:flex fixed bottom-8 right-8 w-28 h-28 rounded-full bg-[#DCE8D5]/80 backdrop-blur-md border border-[#0A462C]/15 flex-col items-center justify-center text-center p-2 shadow-sm hover:shadow-md hover:border-[#0A462C]/35 transition-all cursor-pointer z-10"
        >
          <Asterisk className="w-4 h-4 text-[#0A462C] mb-1" />
          <span className="text-[10px] font-extrabold leading-tight text-[#0A462C]">
            Less waste.
            <br />
            Orbit Home
          </span>
        </motion.button>
      )}
    </div>
  );
};
