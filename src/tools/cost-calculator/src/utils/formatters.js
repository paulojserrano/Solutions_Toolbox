// Helper for formatting numbers with commas
export const formatNumber = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

export const formatCurrency = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

export const formatCost3Decimals = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0.000';
  return num.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};