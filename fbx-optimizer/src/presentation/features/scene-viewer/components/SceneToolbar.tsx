import React from 'react';
import { RotateCcw } from 'lucide-react';

interface SceneToolbarProps {
    onResetCamera: () => void;
}

const SceneToolbar: React.FC<SceneToolbarProps> = ({ onResetCamera }) => {
    return (
        <div className="absolute top-4 left-4 flex gap-2 z-10">
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg p-1 flex items-center shadow-lg">
                <button
                    onClick={onResetCamera}
                    className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors group relative"
                    title="Reset Camera"
                >
                    <RotateCcw size={20} />
                    <span className="sr-only">Reset Camera</span>

                    {/* Tooltip */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        重置相機
                    </div>
                </button>
            </div>
        </div>
    );
};

export default SceneToolbar;
