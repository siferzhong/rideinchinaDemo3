
import React, { useState } from 'react';
import { UserDocument } from '../types';

const Documents: React.FC = () => {
  const [docs, setDocs] = useState<UserDocument[]>([
    { id: '1', type: 'Passport', status: 'Verified', uploadDate: '2024-02-15', fileName: 'passport_main.jpg' },
    { id: '2', type: 'Visa', status: 'Verified', uploadDate: '2024-02-16', fileName: 'china_visa_0324.jpg' },
    { id: '3', type: 'License', status: 'Pending', uploadDate: '2024-05-22', fileName: 'moto_license_de.jpg' },
  ]);

  const handleFileUpload = (type: string) => {
    // In a real app, this opens file picker
    alert(`Selecting file for ${type}...`);
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">My Documents</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          Required for Tibet Entry Permits (TTB) and Temporary Chinese Driving Licenses. All data is encrypted and handled by Ride In China staff.
        </p>
      </header>

      <section className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-4 items-center">
        <div className="bg-orange-600 w-12 h-12 rounded-full flex items-center justify-center text-white text-xl shrink-0">
          <i className="fa-solid fa-circle-info"></i>
        </div>
        <div>
          <h4 className="font-bold text-orange-900 text-sm">Permit Application Status</h4>
          <p className="text-orange-700 text-xs">Waiting for License verification to start TTB Permit application.</p>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {['Passport', 'Visa', 'License', 'Permit'].map(type => {
          const doc = docs.find(d => d.type === type);
          return (
            <div key={type} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${doc ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-300'}`}>
                    <i className={`fa-solid ${type === 'Passport' ? 'fa-passport' : type === 'Visa' ? 'fa-stamp' : 'fa-id-card'} text-lg`}></i>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{type}</h4>
                    {doc ? (
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Uploaded {doc.uploadDate}</span>
                    ) : (
                      <span className="text-[10px] text-red-500 uppercase font-bold">Missing</span>
                    )}
                  </div>
                </div>
                
                {doc ? (
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                      doc.status === 'Verified' ? 'bg-green-100 text-green-700' : 
                      doc.status === 'Pending' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {doc.status}
                    </span>
                    <button className="text-slate-400 p-2"><i className="fa-solid fa-chevron-right"></i></button>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleFileUpload(type)}
                    className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl"
                  >
                    Upload
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-4 p-6 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-2xl">
          <i className="fa-solid fa-camera"></i>
        </div>
        <div>
          <h4 className="font-bold text-slate-900">Scan Documents</h4>
          <p className="text-xs text-slate-500 max-w-[200px] mx-auto">Use your camera to quickly scan and upload your documents.</p>
        </div>
        <button className="bg-slate-900 text-white w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
          Open Camera Scanner
        </button>
      </section>
    </div>
  );
};

export default Documents;
