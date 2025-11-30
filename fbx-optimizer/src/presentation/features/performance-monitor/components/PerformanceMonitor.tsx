import React, { useEffect, useRef, useState } from 'react';
import type { ThemeStyle } from '../../../hooks/useTheme';
import { useSpineInstanceCount } from '../../../stores/spineStore';

// 擴展 Performance 介面以支援 Chrome 專用的 memory API
interface PerformanceMemory {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
    memory?: PerformanceMemory;
}

export interface RendererInfo {
    render: {
        calls: number;
        triangles: number;
        points: number;
        lines: number;
    };
    memory: {
        geometries: number;
        textures: number;
    };
    programs: number | null;
}

interface PerformanceMonitorProps {
    visible: boolean;
    rendererInfo: RendererInfo | null;
    currentTheme: ThemeStyle;
}

interface PerformanceStats {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    memoryUsed: number | null;
    geometries: number;
    textures: number;
}

const formatMemory = (bytes: number | null): string => {
    if (bytes === null) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
};

const formatNumber = (num: number): string => {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
};

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
    visible,
    rendererInfo,
    currentTheme
}) => {
    // Spine 實例數量
    const spineInstanceCount = useSpineInstanceCount();
    
    const [stats, setStats] = useState<PerformanceStats>({
        fps: 0,
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
        memoryUsed: null,
        geometries: 0,
        textures: 0
    });

    const frameTimesRef = useRef<number[]>([]);
    const lastTimeRef = useRef<number>(performance.now());
    const animationFrameRef = useRef<number>();

    useEffect(() => {
        if (!visible) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return;
        }

        const updateStats = () => {
            const now = performance.now();
            const delta = now - lastTimeRef.current;
            lastTimeRef.current = now;

            // 收集最近 60 幀的時間
            frameTimesRef.current.push(delta);
            if (frameTimesRef.current.length > 60) {
                frameTimesRef.current.shift();
            }

            // 計算平均幀時間和 FPS
            const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
            const fps = 1000 / avgFrameTime;

            // 獲取 JS 記憶體使用量（Chrome 專用）
            const perf = performance as ExtendedPerformance;
            const memoryUsed = perf.memory?.usedJSHeapSize ?? null;

            setStats({
                fps: Math.round(fps),
                frameTime: avgFrameTime,
                drawCalls: rendererInfo?.render.calls ?? 0,
                triangles: rendererInfo?.render.triangles ?? 0,
                memoryUsed,
                geometries: rendererInfo?.memory.geometries ?? 0,
                textures: rendererInfo?.memory.textures ?? 0
            });

            animationFrameRef.current = requestAnimationFrame(updateStats);
        };

        animationFrameRef.current = requestAnimationFrame(updateStats);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [visible, rendererInfo]);

    if (!visible) return null;

    // 根據 FPS 決定顏色
    const getFpsColor = (fps: number): string => {
        if (fps >= 55) return 'text-emerald-400';
        if (fps >= 30) return 'text-amber-400';
        return 'text-red-400';
    };

    return (
        <div
            className={`absolute right-4 bottom-4 z-[350] 
                bg-black/60 backdrop-blur-md rounded-xl 
                border border-white/10 shadow-2xl
                px-4 py-3 min-w-[180px]
                font-mono text-xs
                animate-fade-in
                ${currentTheme.text}`}
        >
            {/* 標題 */}
            <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                    Performance
                </span>
            </div>

            {/* 統計數據 */}
            <div className="space-y-1.5">
                {/* FPS */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">FPS</span>
                    <span className={`font-bold ${getFpsColor(stats.fps)}`}>
                        {stats.fps}
                    </span>
                </div>

                {/* Frame Time */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Frame Time</span>
                    <span className="text-cyan-400">
                        {stats.frameTime.toFixed(2)} ms
                    </span>
                </div>

                {/* 分隔線 */}
                <div className="h-px bg-white/5 my-1"></div>

                {/* Draw Calls */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Draw Calls</span>
                    <span className="text-purple-400">
                        {formatNumber(stats.drawCalls)}
                    </span>
                </div>

                {/* Triangles */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Triangles</span>
                    <span className="text-orange-400">
                        {formatNumber(stats.triangles)}
                    </span>
                </div>

                {/* 分隔線 */}
                <div className="h-px bg-white/5 my-1"></div>

                {/* JS Memory */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">JS Memory</span>
                    <span className="text-pink-400">
                        {formatMemory(stats.memoryUsed)}
                    </span>
                </div>

                {/* Geometries */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Geometries</span>
                    <span className="text-blue-400">
                        {stats.geometries}
                    </span>
                </div>

                {/* Textures */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Textures</span>
                    <span className="text-teal-400">
                        {stats.textures}
                    </span>
                </div>

                {/* Spine 區塊（只在有 Spine 時顯示） */}
                {spineInstanceCount > 0 && (
                    <>
                        {/* 分隔線 */}
                        <div className="h-px bg-white/5 my-1"></div>

                        {/* Spine Instances */}
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Spine 2D</span>
                            <span className="text-violet-400">
                                {spineInstanceCount}
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PerformanceMonitor;

