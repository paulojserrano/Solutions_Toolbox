import React, { useState, useEffect } from 'react';
import { formatNumber } from '../utils/formatters';

const NumberInput = ({ value, onChange, className, placeholder }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      // Check if value actually changed to avoid unnecessary updates/warnings
      const formatted = formatNumber(value);
      if (formatted !== localValue) {
        // Defer update to avoid synchronous warning
        setTimeout(() => setLocalValue(formatted), 0);
      }
    }
  }, [value, isFocused, localValue]);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setLocalValue(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onChange(parsed);
    else if (raw === '') onChange(0);
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onBlur={() => { setIsFocused(false); setLocalValue(formatNumber(value)); }}
      onFocus={() => { setIsFocused(true); setLocalValue(value?.toString() || ''); }}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default NumberInput;