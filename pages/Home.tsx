
import React, { useState, useEffect } from 'react';
import { WPPost, AppTab } from '../types';
import { fetchBlogs, fetchRoutes } from '../services/wordpress';

interface HomeProps {
  onNavigate: (tab: AppTab) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const [blogs, setBlogs] = useState<WPPost[]>([]);
  const [featuredRoute, setFeaturedRoute] = useState<WPPost | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const b = await fetchBlogs();
      const r = await fetchRoutes();
      setBlogs(b);
      setFeaturedRoute(r[0]);
    };
    loadData();
  }, []);

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Hero Welcome */}
      <section className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-1">Hello, Rider!</h1>
          <p className="text-slate-400 text-sm mb-4">Ready for your next China adventure?</p>
          <div className="flex gap-4 text-xs font-semibold">
            <div className="bg-orange-500 px-3 py-1.5 rounded-full flex items-center gap-1">
              <i className="fa-solid fa-cloud-sun"></i> 22°C Chengdu
            </div>
            <div className="bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1">
              <i className="fa-solid fa-gas-pump text-orange-400"></i> 7.82 RMB/L
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 opacity-20">
          <i className="fa-solid fa-motorcycle text-8xl rotate-12"></i>
        </div>
      </section>

      {/* Featured Route */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-slate-800">Featured Route</h2>
          <button onClick={() => onNavigate(AppTab.ROUTES)} className="text-orange-600 text-xs font-bold uppercase">View All</button>
        </div>
        {featuredRoute && (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <img src={featuredRoute.featured_image} className="h-40 w-full object-cover" alt="" />
            <div className="p-4">
              <div className="flex gap-2 mb-2">
                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded uppercase">{featuredRoute.difficulty}</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded uppercase">{featuredRoute.distance}</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{featuredRoute.title}</h3>
              <p className="text-slate-500 text-sm line-clamp-2">{featuredRoute.excerpt}</p>
            </div>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-4 gap-4">
        <QuickAction icon="fa-map" label="Offline Map" color="bg-blue-500" />
        <QuickAction icon="fa-language" label="Translate" color="bg-indigo-500" />
        <QuickAction icon="fa-gas-pump" label="Fuel" color="bg-green-500" />
        <QuickAction icon="fa-screwdriver-wrench" label="Repair" color="bg-orange-500" />
      </section>

      {/* Recent Blog Posts */}
      <section>
        <h2 className="font-bold text-slate-800 mb-3">Tour Guide & Tips</h2>
        <div className="flex flex-col gap-3">
          {blogs.map(blog => (
            <div key={blog.id} className="flex gap-4 bg-white p-3 rounded-xl border border-slate-100 items-center">
              <img src={blog.featured_image} className="w-20 h-20 rounded-lg object-cover" alt="" />
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm mb-1 leading-snug">{blog.title}</h4>
                <p className="text-slate-500 text-xs line-clamp-2">{blog.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const QuickAction: React.FC<{ icon: string; label: string; color: string }> = ({ icon, label, color }) => (
  <button className="flex flex-col items-center gap-2">
    <div className={`${color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg`}>
      <i className={`fa-solid ${icon} text-lg`}></i>
    </div>
    <span className="text-[10px] font-bold text-slate-600 text-center uppercase leading-tight">{label}</span>
  </button>
);

export default Home;
