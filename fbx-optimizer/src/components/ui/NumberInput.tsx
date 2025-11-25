import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string | number;
    onChange: (value: string) => void;
    className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    className = '',
    min,
    max,
    step = 1,
    disabled,
    ...props
}) => {
    // 計算 step 的小數位數
    const getDecimalPlaces = (num: number): number => {
        const str = String(num);
        const decimalIndex = str.indexOf('.');
        return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
    };

    const handleIncrement = () => {
        if (disabled) return;
        const currentValue = parseFloat(String(value)) || 0;
        const stepValue = parseFloat(String(step));
        const newValue = currentValue + stepValue;
        if (max !== undefined && newValue > parseFloat(String(max))) return;
        
        // 根據 step 的小數位數來格式化結果
        const decimalPlaces = getDecimalPlaces(stepValue);
        const formattedValue = newValue.toFixed(decimalPlaces);
        onChange(formattedValue);
    };

    const handleDecrement = () => {
        if (disabled) return;
        const currentValue = parseFloat(String(value)) || 0;
        const stepValue = parseFloat(String(step));
        const newValue = currentValue - stepValue;
        if (min !== undefined && newValue < parseFloat(String(min))) return;
        
        // 根據 step 的小數位數來格式化結果
        const decimalPlaces = getDecimalPlaces(stepValue);
        const formattedValue = newValue.toFixed(decimalPlaces);
        onChange(formattedValue);
    };

    return (
        <div className={`relative group/number flex items-center ${className}`}>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={`w-full bg-transparent border-none text-center text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                min={min}
                max={max}
                step={step}
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
