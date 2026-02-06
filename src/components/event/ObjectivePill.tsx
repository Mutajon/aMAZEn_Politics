import { motion } from "framer-motion";
import { Target, Trophy } from "lucide-react";

interface ObjectivePillProps {
    objective: string;
    isCompleted: boolean;
}

export const ObjectivePill = ({ objective, isCompleted }: ObjectivePillProps) => {
    if (!objective) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full flex items-center gap-3 px-4 rounded-2xl border transition-all duration-500 shadow-sm backdrop-blur-sm ${isCompleted
                ? "bg-green-500/10 border-green-500/40 text-green-300"
                : "bg-orange-500/10 border-orange-500/40 text-orange-200"
                }`}
            style={{ minHeight: "60px" }}
        >
            <div className="shrink-0 flex items-center justify-center h-full">
                {isCompleted ? (
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="bg-green-500/20 p-2 rounded-lg"
                    >
                        <Trophy size={18} className="text-yellow-400" />
                    </motion.div>
                ) : (
                    <div className="bg-orange-500/20 p-2 rounded-lg">
                        <Target size={18} className="text-orange-300" />
                    </div>
                )}
            </div>

            <div className="flex flex-col justify-center min-w-0 pr-2 py-2">
                <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">
                    Bonus Objective
                </div>
                <div className="text-xs md:text-sm font-medium leading-tight">
                    {objective}
                </div>
            </div>

            <div className={`ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${isCompleted
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : "bg-orange-500/20 text-orange-400 border-orange-500/30"
                }`}>
                {isCompleted ? "DONE" : "INCOMPLETE"}
            </div>
        </motion.div>
    );
};
