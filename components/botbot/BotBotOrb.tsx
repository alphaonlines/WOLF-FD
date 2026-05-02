import React from 'react';
import { motion } from 'framer-motion';
import { Bot, X, AlertCircle } from 'lucide-react';

type BotBotOrbProps = {
  isExpanded: boolean;
  isThinking: boolean;
  hasNotification: boolean;
  assistantName: string;
  theme: string;
  isDarkMode: boolean;
  onToggle: () => void;
};

const THEME_COLORS: Record<
  string,
  { bg: string; ring: string; glow: string; text: string }
> = {
  sky: { bg: 'bg-sky-500', ring: 'ring-sky-300', glow: 'shadow-sky-300/50', text: 'text-sky-400' },
  emerald: { bg: 'bg-emerald-500', ring: 'ring-emerald-300', glow: 'shadow-emerald-300/50', text: 'text-emerald-400' },
  violet: { bg: 'bg-violet-500', ring: 'ring-violet-300', glow: 'shadow-violet-300/50', text: 'text-violet-400' },
  amber: { bg: 'bg-amber-500', ring: 'ring-amber-300', glow: 'shadow-amber-300/50', text: 'text-amber-400' },
  rose: { bg: 'bg-rose-500', ring: 'ring-rose-300', glow: 'shadow-rose-300/50', text: 'text-rose-400' },
  teal: { bg: 'bg-teal-500', ring: 'ring-teal-300', glow: 'shadow-teal-300/50', text: 'text-teal-400' },
};

const BotBotOrb: React.FC<BotBotOrbProps> = ({
  isExpanded,
  isThinking,
  hasNotification,
  assistantName,
  theme,
  isDarkMode,
  onToggle,
}) => {
  const colors = THEME_COLORS[theme] ?? THEME_COLORS.sky;

  return (
    <motion.div
      data-tour-id="botbot-entry"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-4 z-50 sm:bottom-8 sm:right-6"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.button
        onClick={onToggle}
        aria-label={isExpanded ? 'Close BotBot' : `Open ${assistantName}`}
        className={`relative flex items-center justify-center rounded-full ${colors.bg} shadow-lg ring-2 ${colors.ring} transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 ${
          isExpanded ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-14 w-14 sm:h-16 sm:w-16'
        }`}
        whileHover={!isThinking ? { scale: 1.1 } : {}}
        whileTap={{ scale: 0.95 }}
        initial={isThinking ? { y: 0 } : undefined}
        animate={isThinking ? { y: [0, -8, 0] } : { y: 0 }}
        transition={isThinking ? { duration: 0.6, repeat: Infinity } : undefined}
      >
        {/* Subtle glow pulse when idle */}
        {!isExpanded && !isThinking && (
          <motion.div
            className={`absolute inset-0 rounded-full ${colors.bg} opacity-30`}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        )}

        {/* Icon */}
        <motion.div
          key={isExpanded ? 'close' : 'bot'}
          initial={{ opacity: 0, rotate: -90 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: 90 }}
          transition={{ duration: 0.15 }}
          className="relative z-10 text-white"
        >
          {isExpanded ? <X size={32} /> : <Bot size={24} />}
        </motion.div>

        {/* Notification badge */}
        {hasNotification && !isExpanded && (
          <motion.div
            className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="h-2 w-2 rounded-full bg-white" />
          </motion.div>
        )}
      </motion.button>

      {/* Tooltip on hover (not expanded) */}
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ opacity: 1, y: 0 }}
          className={`absolute bottom-24 right-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-white ${colors.bg} pointer-events-none`}
        >
          {assistantName}
        </motion.div>
      )}
    </motion.div>
  );
};

export default BotBotOrb;
