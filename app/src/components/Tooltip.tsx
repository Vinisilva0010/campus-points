"use client";

import React, { useState } from "react";
import { HelpCircle, X } from "lucide-react";

interface TooltipProps {
  title: string;
  content: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ title, content }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block ml-1.5 align-middle">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full bg-[#fc67f4]/20 border border-[#fc67f4] text-black hover:bg-[#fc67f4]/40 transition-colors"
        aria-label="Ajuda e explicações"
      >
        <HelpCircle className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:absolute sm:inset-auto sm:top-6 sm:left-0 sm:w-72 sm:bg-transparent sm:p-0">
          <div className="bg-white border-2 border-[#fc67f4] rounded-2xl p-4 shadow-2xl max-w-xs w-full text-black relative">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
              <span className="text-xs font-black uppercase tracking-wider text-[#381af8]">
                {title}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-black hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-bold text-gray-900 leading-relaxed">
              {content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
