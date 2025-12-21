import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string | number;
    onChange: (value: string) => void;
    className?: string;
    textColor?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    className = '',
    textColor = 'text-white',
    min,
    max,
    step = 1,
    disabled,
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

    // 計算 step 的小數位數
    const getDecimalPlaces = (num: number): number => {
        const str = String(num);
        const decimalIndex = str.indexOf('.');
        return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
    };

    // 提交邏輯：將本地值解析後提交給父組件
    const commitValue = () => {
        const parsed = parseFloat(localValue);
        if (!isNaN(parsed)) {
            // 套用 min/max 限制
            let finalValue = parsed;
            if (min !== undefined) finalValue = Math.max(parseFloat(String(min)), finalValue);
            if (max !== undefined) finalValue = Math.min(parseFloat(String(max)), finalValue);
            onChange(String(finalValue));
        } else {
            // 無效值：還原為外部值
            setLocalValue(String(value));
        }
    };

    const handleIncrement = () => {
        if (disabled) return;
        const currentValue = parseFloat(localValue) || 0;
        const stepValue = parseFloat(String(step));
        let newValue = currentValue + stepValue;
        if (max !== undefined && newValue > parseFloat(String(max))) return;
        
        // 根據 step 的小數位數來格式化結果
        const decimalPlaces = getDecimalPlaces(stepValue);
        const formattedValue = newValue.toFixed(decimalPlaces);
        setLocalValue(formattedValue);
        onChange(formattedValue);
    };

    const handleDecrement = () => {
        if (disabled) return;
        const currentValue = parseFloat(localValue) || 0;
        const stepValue = parseFloat(String(step));
        let newValue = currentValue - stepValue;
        if (min !== undefined && newValue < parseFloat(String(min))) return;
        
        // 根據 step 的小數位數來格式化結果
        const decimalPlaces = getDecimalPlaces(stepValue);
        const formattedValue = newValue.toFixed(decimalPlaces);
        setLocalValue(formattedValue);
        onChange(formattedValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            commitValue();
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <div className={`relative group/number flex items-center ${className}`}>
            <input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    setIsFocused(false);
                    commitValue();
                }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={`w-full bg-transparent border-none text-center text-sm ${textColor} placeholder-gray-600 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                {...props}
            />
            <div className={`flex flex-col -ml-1 opacity-0 group-hover/number:opacity-100 transition-opacity ${disabled ? 'hidden' : ''}`}>
                <button
                    onClick={handleIncrement}
                    type="button"
                    className="text-gray-500 hover:text-white p-0.5 focus:outline-none"
                    tabIndex={-1}
                >
                    <ChevronUp size={10} strokeWidth={3} />
                </button>
                <button
                    onClick={handleDecrement}
                    type="button"
                    className="text-gray-500 hover:text-white p-0.5 focus:outline-none"
                    tabIndex={-1}
                >
                    <ChevronDown size={10} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
};
