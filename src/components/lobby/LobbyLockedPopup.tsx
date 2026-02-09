import React from 'react';
import { motion } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import { useLang } from "../../i18n/lang";
import { audioManager } from '../../lib/audioManager';

interface LobbyLockedPopupProps {
    onClose: () => void;
    message?: string;
}

const LobbyLockedPopup: React.FC<LobbyLockedPopupProps> = ({ onClose, message }) => {
    const lang = useLang();

    const handleClose = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        audioManager.playSfx("click-soft");
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-md bg-black/40 pointer-events-auto"
            onClick={(e) => handleClose(e)}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-sm bg-[#151921] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/10 blur-[80px] rounded-full" />

                {/* Lock Icon */}
                <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 bg-purple-600/10 blur-xl rounded-full" />
                    <Lock className="w-10 h-10 text-purple-400 relative z-10" />
                </div>

                {/* Text Content */}
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-3">
                    {lang("LOBBY_FEATURE_LOCKED") || "Feature Locked"}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed mb-8">
                    {message || lang('LOBBY_SUGGEST_OWN_LOCKED_DESC')}
                </p>

                {/* Action Button */}
                <button
                    type="button"
                    onClick={(e) => handleClose(e)}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black uppercase tracking-[0.3em] text-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-purple-900/40"
                >
                    {lang("LOBBY_LOCKED_GOT_IT") || "Got it"}
                </button>

                {/* Close Button */}
                <button
                    type="button"
                    onClick={(e) => handleClose(e)}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-white/20 hover:text-white transition-all"
                >
                    <X className="w-4 h-4" />
                </button>
            </motion.div>
        </motion.div>
    );
};

export default LobbyLockedPopup;
