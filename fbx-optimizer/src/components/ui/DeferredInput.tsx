import React, { useState, useEffect } from 'react';

interface DeferredInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    /** 外部傳入的值 */
    value: string | number;
    /** 
     * 當值提交時觸發（失去焦點或按 Enter）
     * 注意：這裡傳的是用戶輸入的原始字串，由調用者自行 parse
     */
    onChange: (value: string) => void;
    /** 是否為數值輸入模式（會使用 inputMode="decimal"） */
    numeric?: boolean;
}

/**
 * 延遲提交的輸入框組件
 * 
 * 解決原生 input 在受控模式下的問題：
 * - 允許用戶輸入中間狀態（如 "0."、"-"、空字串）
 * - 只在失去焦點或按 Enter 時才提交值
 */
export const DeferredInput: React.FC<DeferredInputProps> = ({
    value,
    onChange,
    numeric = false,
    className,
    ...props
}) => {
    // 本地狀態：用於即時顯示用戶輸入的內容
    const [localValue, setLocalValue] = useState(String(value));
    const [isFocused, setIsFocused] = useState(false);

    // 外部值變化時同步到內部狀態（僅在未聚焦時）
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(String(value));
        }
    }, [value, isFocused]);

    // 提交邏輯
    const commitValue = () => {
        onChange(localValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            commitValue();
            (e.target as HTMLInputElement).blur();
        }
        // 調用原有的 onKeyDown（如果有）
        props.onKeyDown?.(e);
    };

    return (
        <input
            {...props}
            type={numeric ? 'text' : props.type}
            inputMode={numeric ? 'decimal' : props.inputMode}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onFocus={(e) => {
                setIsFocused(true);
                props.onFocus?.(e);
            }}
            onBlur={(e) => {
                setIsFocused(false);
                commitValue();
                props.onBlur?.(e);
            }}
            onKeyDown={handleKeyDown}
            className={className}
        />
    );
};


