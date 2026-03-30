import React from "react";
import { motion } from "framer-motion";

type Props = {
  isDarkMode: boolean;
  onStartTutorial: () => void;
  onSkipTutorial: () => void;
};

const TutorialPromptOverlay: React.FC<Props> = ({ isDarkMode, onStartTutorial, onSkipTutorial }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`relative w-full max-w-lg rounded-3xl border shadow-2xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
      >
        <div className="px-8 py-8 text-center">
          <div className={`text-3xl font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            New to the Dashboard?
          </div>
          <div className={`mt-3 text-lg leading-7 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Would you like a quick tour of the features?
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={onStartTutorial}
              className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-lg font-bold transition ${isDarkMode ? "bg-sky-500 hover:bg-sky-400 text-white" : "bg-sky-600 hover:bg-sky-500 text-white"}`}
            >
              Start Tour
            </button>
            <button
              type="button"
              onClick={onSkipTutorial}
              className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-lg font-semibold transition ${isDarkMode ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
            >
              Skip
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TutorialPromptOverlay;
