
import React, { useState, useEffect } from 'react';
import { WPPost } from '../types';
import { fetchRoutes } from '../services/wordpress';

const Routes: React.FC = () => {
  const [routes, setRoutes] = useState<WPPost[]>([]);
  const [filter, setFilter] = useState('All');
  const [selectedRoute, setSelectedRoute] = useState<WPPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoutes().then((data) => {
      setRoutes(data);
      setLoading(false);
    });
  }, []);

  const categories = ['All', 'Tibet', 'Yunnan', 'Silk Road', 'Short Trips'];
  
  const filteredRoutes = filter === 'All' 
    ? routes 
    : routes.filter(r => r.category === filter.toLowerCase());

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <>
      <div className="p-4 flex flex-col gap-4">
        <div className="sticky top-0 bg-slate-50/90 backdrop-blur-md pt-2 pb-4 z-10 -mx-4 px-4 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                  filter === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-slate-400">
              <i className="fa-solid fa-spinner fa-spin text-3xl mb-2"></i>
              <p className="text-sm font-medium">Loading routes...</p>
            </div>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <i className="fa-solid fa-route text-4xl mb-3"></i>
            <p className="text-sm font-medium">No routes found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {filteredRoutes.map(route => (
              <div key={route.id} className="group flex flex-col">
                <div className="relative overflow-hidden rounded-2xl aspect-[16/9] mb-3 shadow-lg">
                  <img src={route.featured_image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={route.title} />
                  <div className="absolute top-4 right-4 flex gap-2">
                    {route.duration && (
                      <span className="bg-black/50 backdrop-blur text-white text-[10px] px-2 py-1 rounded-lg font-bold">
                        <i className="fa-regular fa-calendar-days mr-1"></i> {route.duration}
                      </span>
                    )}
                    {route.distance && (
                      <span className="bg-black/50 backdrop-blur text-white text-[10px] px-2 py-1 rounded-lg font-bold">
                        <i className="fa-solid fa-road mr-1"></i> {route.distance}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{route.title}</h3>
                  <p className="text-slate-500 text-sm mb-4 line-clamp-2">{route.excerpt}</p>
                  <button 
                    onClick={() => setSelectedRoute(route)}
                    className="w-full bg-slate-100 text-slate-900 font-bold py-3 rounded-xl border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    View Detailed Itinerary
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 文章详情模态框 */}
      {selectedRoute && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedRoute(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="relative h-64 overflow-hidden">
              <img 
                src={selectedRoute.featured_image} 
                className="w-full h-full object-cover" 
                alt={selectedRoute.title}
              />
              <button
                onClick={() => setSelectedRoute(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              >
                <i className="fa-solid fa-times"></i>
              </button>
              <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                {selectedRoute.duration && (
                  <span className="bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-lg font-bold">
                    <i className="fa-regular fa-calendar-days mr-1"></i> {selectedRoute.duration}
                  </span>
                )}
                {selectedRoute.distance && (
                  <span className="bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-lg font-bold">
                    <i className="fa-solid fa-road mr-1"></i> {selectedRoute.distance}
                  </span>
                )}
                {selectedRoute.difficulty && (
                  <span className="bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-lg font-bold">
                    <i className="fa-solid fa-mountain mr-1"></i> {selectedRoute.difficulty}
                  </span>
                )}
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{selectedRoute.title}</h1>
              <p className="text-slate-500 text-sm mb-6">
                <i className="fa-regular fa-calendar mr-2"></i>
                {formatDate(selectedRoute.date)}
              </p>
              
              {/* WordPress内容渲染 */}
              <div 
                className="wordpress-content"
                dangerouslySetInnerHTML={{ __html: selectedRoute.content }}
              />
            </div>

            {/* 底部操作栏 */}
            <div className="border-t border-slate-200 p-4 flex gap-3">
              <button
                onClick={() => {
                  window.open(`https://www.rideinchina.com/?p=${selectedRoute.id}`, '_blank');
                }}
                className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-external-link"></i>
                View on Website
              </button>
              <button
                onClick={() => setSelectedRoute(null)}
                className="px-6 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Routes;
