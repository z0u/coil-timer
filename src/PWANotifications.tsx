import { Download, X } from 'lucide-react';
import { usePWA } from './usePWA';

export default function PWANotifications() {
  const { updateAvailable, offlineReady, handleUpdate, dismissUpdate, dismissOfflineReady } = usePWA();

  if (!updateAvailable && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center">
      {updateAvailable && (
        <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm w-full flex items-center gap-3">
          <Download size={20} />
          <div className="flex-1">
            <p className="font-semibold text-sm">Update Available</p>
            <p className="text-xs opacity-90">A new version of Coil is ready to install.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-xs font-medium transition-colors"
            >
              Update
            </button>
            <button
              onClick={dismissUpdate}
              className="p-1 hover:bg-blue-700 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      
      {offlineReady && !updateAvailable && (
        <div className="bg-green-600 text-white rounded-lg shadow-lg p-4 max-w-sm w-full flex items-center gap-3">
          <div className="w-2 h-2 bg-green-300 rounded-full"></div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Ready for Offline Use</p>
            <p className="text-xs opacity-90">Coil is now available offline.</p>
          </div>
          <button
            onClick={dismissOfflineReady}
            className="p-1 hover:bg-green-700 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}