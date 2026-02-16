import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveUserDocuments, getUserDocuments, saveTibetPermits, getTibetPermits, saveTotalDistance, getTotalDistance } from '../services/userData';
import LoginModal from '../components/LoginModal';

interface Document {
  id: string;
  type: 'Passport' | 'Visa' | 'License' | 'ID';
  fileName: string;
  uploadDate: string;
  fileUrl?: string;
  status: 'Pending' | 'Verified' | 'Rejected';
}

interface TibetPermit {
  id: string;
  permitNumber: string;
  issueDate: string;
  expiryDate: string;
  status: 'Active' | 'Expired' | 'Pending';
  fileUrl?: string;
  route?: string;
}

const Me: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [permits, setPermits] = useState<TibetPermit[]>([]);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 从 WordPress 或 localStorage 加载数据
  useEffect(() => {
    const loadData = async () => {
      const [docs, permitsData, distance] = await Promise.all([
        getUserDocuments(),
        getTibetPermits(),
        getTotalDistance(),
      ]);
      setDocuments(docs);
      setPermits(permitsData);
      setTotalDistance(distance);
    };
    loadData();
  }, []);

  // 计算总骑行距离（从导航历史）
  const calculateTotalDistance = () => {
    const savedTotal = localStorage.getItem('total_riding_distance');
    if (savedTotal) {
      setTotalDistance(parseFloat(savedTotal));
      return;
    }
    
    const rideHistory = localStorage.getItem('ride_history');
    if (rideHistory) {
      try {
        const history = JSON.parse(rideHistory);
        const total = history.reduce((sum: number, ride: any) => sum + (ride.distance || 0), 0);
        setTotalDistance(total);
        localStorage.setItem('total_riding_distance', total.toFixed(2));
      } catch (e) {
        console.error('Failed to parse ride history', e);
      }
    }
  };
  
  // 刷新总距离（当从其他页面返回时）
  useEffect(() => {
    const interval = setInterval(() => {
      const savedTotal = localStorage.getItem('total_riding_distance');
      if (savedTotal) {
        setTotalDistance(parseFloat(savedTotal));
      }
    }, 2000); // 每2秒检查一次
    
    return () => clearInterval(interval);
  }, []);

  // 处理文件上传
  const handleFileUpload = (type: string) => {
    setSelectedDocType(type);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocType) return;

    setUploadingDoc(selectedDocType);

    try {
      // 将文件转换为base64（实际应用中应该上传到服务器）
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        const newDoc: Document = {
          id: Date.now().toString(),
          type: selectedDocType as Document['type'],
          fileName: file.name,
          uploadDate: new Date().toISOString().split('T')[0],
          fileUrl: base64Data,
          status: 'Pending',
        };

        const updatedDocs = [...documents.filter(d => d.type !== newDoc.type), newDoc];
        setDocuments(updatedDocs);
        // 同步到 WordPress
        await saveUserDocuments(updatedDocs);
        setUploadingDoc(null);
        setSelectedDocType(null);
        
        // 重置文件输入
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadingDoc(null);
      setSelectedDocType(null);
    }
  };

  // 查看证件
  const viewDocument = (doc: Document) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    }
  };

  // 查看进藏函
  const viewPermit = (permit: TibetPermit) => {
    if (permit.fileUrl) {
      window.open(permit.fileUrl, '_blank');
    } else {
      // 如果没有文件，显示详情
      alert(`进藏函编号: ${permit.permitNumber}\n有效期: ${permit.expiryDate}\n状态: ${permit.status}`);
    }
  };

  // 添加示例进藏函（实际应该从服务器获取）
  useEffect(() => {
    const savedPermits = localStorage.getItem('tibet_permits');
    if (!savedPermits) {
      // 示例数据
      const examplePermits: TibetPermit[] = [
        {
          id: '1',
          permitNumber: 'TTB-2024-001234',
          issueDate: '2024-02-01',
          expiryDate: '2024-05-01',
          status: 'Active',
          route: 'Chengdu - Lhasa',
        },
      ];
      setPermits(examplePermits);
      localStorage.setItem('tibet_permits', JSON.stringify(examplePermits));
    }
  }, []);

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'Passport': return 'fa-passport';
      case 'Visa': return 'fa-stamp';
      case 'License': return 'fa-id-card';
      case 'ID': return 'fa-id-badge';
      default: return 'fa-file';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verified':
      case 'Active':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'Pending':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Rejected':
      case 'Expired':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* 用户信息卡片 */}
      <div className="bg-gradient-to-br from-orange-600 to-orange-500 p-6 pt-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white text-2xl border-4 border-white/30">
            <i className="fa-solid fa-user"></i>
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-xl">My Profile</h2>
            <p className="text-white/90 text-sm">Manage your documents & permits</p>
            {!isAuthenticated && (
              <button 
                onClick={() => setShowLoginModal(true)} 
                className="mt-2 bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/30 transition-colors"
              >
                Login to Sync Data
              </button>
            )}
            {isAuthenticated && user && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-white/90 text-sm">{user.name}</span>
                <button onClick={logout} className="text-white/80 text-xs underline hover:text-white transition-colors">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* 骑行统计 */}
        <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-xs font-bold uppercase mb-1">Total Distance</p>
              <p className="text-white text-3xl font-black">{totalDistance.toFixed(1)}</p>
              <p className="text-white/80 text-xs mt-1">Kilometers in China</p>
            </div>
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              <i className="fa-solid fa-route text-white text-2xl"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {/* 证件上传区域 */}
        <section>
          <h3 className="text-slate-900 font-bold text-lg mb-3 flex items-center gap-2">
            <i className="fa-solid fa-file-upload text-orange-600"></i>
            Upload Documents
          </h3>
          <p className="text-slate-500 text-xs mb-4">
            Upload your documents for Tibet Entry Permit (TTB) application. All documents are securely stored and reviewed by Ride In China staff.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            {['Passport', 'Visa', 'License', 'ID'].map((type) => {
              const doc = documents.find(d => d.type === type);
              return (
                <button
                  key={type}
                  onClick={() => !doc && handleFileUpload(type)}
                  className={`relative bg-white border-2 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all ${
                    doc 
                      ? 'border-green-300 bg-green-50/50' 
                      : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/30'
                  } ${uploadingDoc === type ? 'opacity-50' : ''}`}
                >
                  {uploadingDoc === type && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                      <i className="fa-solid fa-spinner fa-spin text-orange-600 text-xl"></i>
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    doc ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <i className={`fa-solid ${getDocIcon(type)} text-xl`}></i>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{type}</span>
                  {doc && (
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </div>
                  )}
                  {!doc && (
                    <span className="text-[9px] text-slate-400 font-medium">Tap to upload</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 已上传的证件列表 */}
          {documents.length > 0 && (
            <div className="mt-4 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => viewDocument(doc)}
                  className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      doc.status === 'Verified' ? 'bg-green-100 text-green-600' :
                      doc.status === 'Pending' ? 'bg-blue-100 text-blue-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      <i className={`fa-solid ${getDocIcon(doc.type)}`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{doc.type}</p>
                      <p className="text-[10px] text-slate-500">{doc.fileName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-2 py-1 rounded font-bold ${getStatusColor(doc.status)}`}>
                      {doc.status}
                    </span>
                    <i className="fa-solid fa-chevron-right text-slate-400 text-xs"></i>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 进藏函区域 */}
        <section>
          <h3 className="text-slate-900 font-bold text-lg mb-3 flex items-center gap-2">
            <i className="fa-solid fa-file-contract text-orange-600"></i>
            Tibet Entry Permits (TTB)
          </h3>
          
          {permits.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-file-circle-question text-slate-400 text-2xl"></i>
              </div>
              <p className="text-slate-600 text-sm font-medium mb-1">No permits yet</p>
              <p className="text-slate-400 text-xs">Upload your documents to apply for Tibet Entry Permit</p>
            </div>
          ) : (
            <div className="space-y-3">
              {permits.map((permit) => (
                <div
                  key={permit.id}
                  onClick={() => viewPermit(permit)}
                  className="bg-white border-2 border-slate-200 rounded-2xl p-4 active:bg-slate-50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        permit.status === 'Active' ? 'bg-green-100 text-green-600' :
                        permit.status === 'Expired' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <i className="fa-solid fa-file-contract text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{permit.permitNumber}</p>
                        {permit.route && (
                          <p className="text-[10px] text-slate-500 mt-0.5">{permit.route}</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-1 rounded font-bold border ${getStatusColor(permit.status)}`}>
                      {permit.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <div>
                      <span className="font-medium">Issued:</span> {permit.issueDate}
                    </div>
                    <div>
                      <span className="font-medium">Expires:</span> {permit.expiryDate}
                    </div>
                  </div>
                  
                  {permit.fileUrl && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Electronic copy available</span>
                      <i className="fa-solid fa-external-link text-orange-600 text-xs"></i>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 申请状态提示 */}
        {documents.filter(d => d.status === 'Pending').length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                <i className="fa-solid fa-clock"></i>
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-sm mb-1">Documents Under Review</h4>
                <p className="text-blue-700 text-xs">
                  {documents.filter(d => d.status === 'Pending').length} document(s) are being reviewed. 
                  You'll be notified once verification is complete.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileSelected}
        accept="image/*,.pdf"
        className="hidden"
      />

      {/* 登录弹窗 */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default Me;
