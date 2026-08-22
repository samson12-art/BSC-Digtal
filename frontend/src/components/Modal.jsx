import { X } from 'lucide-react';
export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`relative bg-white rounded-2xl shadow-lg w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`} style={{boxShadow:'0 18px 40px rgba(16,25,24,0.12)'}}>
          <div className="sticky top-0 bg-white border-b border-[#dfe7e4] px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
            <h3 className="text-lg font-semibold" style={{color:'#17211f'}}>{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
