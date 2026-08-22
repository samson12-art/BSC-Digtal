export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12', xl: 'h-16 w-16' };
  return <div className={`flex items-center justify-center ${className}`}><div className={`animate-spin rounded-full border-2 border-gray-200 border-t-primary-800 ${sizes[size]}`} /></div>;
}
