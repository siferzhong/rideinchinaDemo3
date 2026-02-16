
import React, { useState, useEffect } from 'react';
import { PhotoItem } from '../types';

const MOCK_PHOTOS: PhotoItem[] = [
  { id: '1', tripCode: 'TIBET2024', url: 'https://images.unsplash.com/photo-1581084338139-4467d50f8361?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1581084338139-4467d50f8361?auto=format&fit=crop&q=60&w=600', timestamp: '10:30 AM' },
  { id: '2', tripCode: 'TIBET2024', url: 'https://images.unsplash.com/photo-1522045610531-97b779b5d275?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1522045610531-97b779b5d275?auto=format&fit=crop&q=60&w=600', timestamp: '11:15 AM' },
  { id: '3', tripCode: 'TIBET2024', url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=60&w=600', timestamp: '1:05 PM' },
  { id: '4', tripCode: 'YUNNAN2024', url: 'https://images.unsplash.com/photo-1502756123447-97d8b5175953?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1502756123447-97d8b5175953?auto=format&fit=crop&q=60&w=600', timestamp: '09:00 AM' },
  { id: '5', tripCode: 'TIBET2024', url: 'https://images.unsplash.com/photo-1543674892-7d64d45df18b?auto=format&fit=crop&q=80&w=1200', thumbnail: 'https://images.unsplash.com/photo-1543674892-7d64d45df18b?auto=format&fit=crop&q=60&w=600', timestamp: '3:40 PM' },
];

const PhotoLive: React.FC = () => {
  const [tripCode, setTripCode] = useState<string>(localStorage.getItem('tripCode') || '');
  const [inputCode, setInputCode] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [isLeader] = useState(true); // Simulated

  useEffect(() => {
    if (tripCode) {
      const filtered = MOCK_PHOTOS.filter(p => p.tripCode === tripCode.toUpperCase());
      setPhotos(filtered);
    }
  }, [tripCode]);

  const handleJoinTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      setTripCode(inputCode.toUpperCase());
      localStorage.setItem('tripCode', inputCode.toUpperCase());
    }
  };

  const handleLeaveTrip = () => {
    setTripCode('');
    localStorage.removeItem('tripCode');
    setPhotos([]);
  };

  if (!tripCode) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full bg-white">
        <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mb-6 text-orange-600 text-3xl">
          <i className="fa-solid fa-lock"></i>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Join Your Trip</h2>
        <p className="text-slate-500 text-sm text-center mb-8">Please enter the Trip Code provided by your guide to access the live photo stream.</p>
        <form onSubmit={handleJoinTrip} className="w-full max-w-xs flex flex-col gap-3">
          <input 
            type="text" 
            placeholder="e.g., TIBET2024" 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center font-bold tracking-widest text-slate-800 uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
          />
          <button className="bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all">
            Unlock Gallery
          </button>
        </form>
        <p className="mt-8 text-xs text-slate-400">Try "TIBET2024" for a demo</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur-md z-10">
        <div>
          <h2 className="font-bold text-slate-900 leading-tight">Live Photo Stream</h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">{tripCode}</span>
            <button onClick={handleLeaveTrip} className="text-[10px] text-slate-400 underline uppercase font-bold">Change Trip</button>
          </div>
        </div>
        {isLeader && (
          <button className="bg-orange-100 text-orange-600 w-10 h-10 rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-cloud-arrow-up"></i>
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="p-2 grid grid-cols-2 gap-2 overflow-y-auto hide-scrollbar pb-24">
        {photos.length === 0 ? (
          <div className="col-span-2 py-20 text-center text-slate-400 italic text-sm">
            No photos uploaded for this trip yet.
          </div>
        ) : (
          photos.map(photo => (
            <div 
              key={photo.id} 
              className="relative aspect-square overflow-hidden rounded-lg shadow-sm active:scale-95 transition-transform"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img src={photo.thumbnail} className="w-full h-full object-cover" alt="" />
              {/* Fake CSS Watermark */}
              <div className="absolute bottom-1 right-1 bg-black/30 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[8px] font-bold border border-white/20 select-none">
                RIDE IN CHINA
              </div>
              <div className="absolute top-1 left-1 bg-black/30 text-white text-[8px] px-1 rounded">
                {photo.timestamp}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="p-4 flex justify-between items-center text-white">
            <button onClick={() => setSelectedPhoto(null)} className="w-10 h-10 flex items-center justify-center"><i className="fa-solid fa-xmark text-xl"></i></button>
            <span className="text-xs font-bold uppercase tracking-widest">{selectedPhoto.timestamp}</span>
            <button onClick={() => window.open(selectedPhoto.url)} className="bg-white/20 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
              <i className="fa-solid fa-download"></i> Download
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <img src={selectedPhoto.url} className="max-w-full max-h-full object-contain" alt="" />
          </div>
          <div className="p-8 text-center">
            <p className="text-white/40 text-[10px] italic">Long press to save or use the Download button for HD version</p>
          </div>
        </div>
      )}

      {/* Leader Quick Actions - Floating */}
      {isLeader && (
        <div className="fixed bottom-24 right-4 z-20">
          <button className="w-14 h-14 bg-orange-600 text-white rounded-full shadow-2xl flex items-center justify-center text-xl animate-bounce">
            <i className="fa-solid fa-camera"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default PhotoLive;
