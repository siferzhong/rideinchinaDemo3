import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserPermissions } from '../services/permissions';
import { getAllUserDocuments, uploadPermitForUser, updateDocumentStatus, getAllUsers, setUserRole } from '../services/admin';
import { setGroupDestination, getGroupDestination, clearGroupDestination } from '../services/groupDestination';
import { sendGroupMessage, getGroupMessages } from '../services/groupChat';
import type { UserDocumentView, UserInfo } from '../services/admin';
import type { GroupDestination } from '../services/groupDestination';
import type { GroupMessage } from '../services/groupChat';

type DocPreview = { userName: string; docType: string; fileUrl: string } | null;

const Admin: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'users' | 'destination' | 'messages'>('documents');
  const [userDocuments, setUserDocuments] = useState<UserDocumentView[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [groupDestination, setGroupDestination] = useState<GroupDestination | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [docPreview, setDocPreview] = useState<DocPreview>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const messageMediaInputRef = React.useRef<HTMLInputElement>(null);
  const [docFilter, setDocFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) return;
      
      const perms = await getUserPermissions();
      setPermissions(perms);
      
      if (perms.role === 'admin') {
        await loadAllData();
      } else if (perms.role === 'leader') {
        await loadLeaderData();
      }
      
      setLoading(false);
    };
    init();
  }, [isAuthenticated]);

  const loadAllData = async () => {
    try {
      const [docs, usersList, dest, messages] = await Promise.all([
        getAllUserDocuments(),
        getAllUsers(),
        getGroupDestination(),
        getGroupMessages(20),
      ]);
      setUserDocuments(docs);
      setUsers(usersList);
      setGroupDestination(dest);
      setGroupMessages(messages);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  const loadLeaderData = async () => {
    try {
      const [dest, messages] = await Promise.all([
        getGroupDestination(),
        getGroupMessages(20),
      ]);
      setGroupDestination(dest);
      setGroupMessages(messages);
    } catch (error) {
      console.error('Failed to load leader data:', error);
    }
  };

  const handleSetDestination = async () => {
    // 这里应该打开地图选择器，暂时用提示
    const name = prompt('Enter destination name:');
    if (!name) return;
    
    // 实际应该从地图选择位置
    const position: [number, number] = [104.066, 30.572]; // 示例坐标
    try {
      const dest = await setGroupDestination(name, position);
      setGroupDestination(dest);
      alert('Group destination set successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to set destination');
    }
  };

  const handleSendMessage = async (opts?: { imageBase64?: string; videoBase64?: string }) => {
    const text = messageInput.trim();
    if (!text && !opts?.imageBase64 && !opts?.videoBase64) return;
    const caption = text || (opts?.videoBase64 ? 'Video' : opts?.imageBase64 ? 'Image' : '');
    setSendingMedia(!!(opts?.imageBase64 || opts?.videoBase64));
    try {
      const message = await sendGroupMessage(caption, opts);
      setGroupMessages(prev => [message, ...prev]);
      setMessageInput('');
    } catch (error: any) {
      alert(error.message || 'Failed to send message');
    } finally {
      setSendingMedia(false);
    }
  };

  const onMessageMediaSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isVideo) {
      alert('Please select an image or video.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string) || '';
      if (isImage) handleSendMessage({ imageBase64: base64 });
      else handleSendMessage({ videoBase64: base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUpdateDocumentStatus = async (userId: number, docId: string, status: 'Verified' | 'Rejected') => {
    try {
      await updateDocumentStatus(userId, docId, status);
      await loadAllData();
      alert('Document status updated!');
    } catch (error: any) {
      alert(error.message || 'Failed to update status');
    }
  };

  const handleSetUserRole = async (userId: number, role: 'admin' | 'leader' | 'user') => {
    try {
      await setUserRole(userId, role);
      await loadAllData();
      alert('User role updated!');
    } catch (error: any) {
      alert(error.message || 'Failed to update role');
    }
  };

  if (!isAuthenticated || !permissions) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Please login to access admin panel</p>
        </div>
      </div>
    );
  }

  if (permissions.role !== 'admin' && permissions.role !== 'leader') {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <i className="fa-solid fa-lock text-4xl text-slate-400 mb-4"></i>
          <p className="text-slate-600">Admin access required</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <i className="fa-solid fa-spinner fa-spin text-4xl text-orange-600"></i>
      </div>
    );
  }

  // 计算统计数据
  const stats = {
    totalUsers: users.length,
    pendingDocs: userDocuments.reduce((sum, u) => sum + u.documents.filter(d => d.status === 'Pending').length, 0),
    totalMessages: groupMessages.length,
    hasDestination: !!groupDestination?.isActive,
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black mb-1">
              {permissions.role === 'admin' ? 'Admin Panel' : 'Leader Panel'}
            </h1>
            <p className="text-white/90 text-sm">{user?.name}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <i className="fa-solid fa-shield-halved text-2xl"></i>
          </div>
        </div>

        {/* 统计卡片 */}
        {permissions.role === 'admin' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20">
              <div className="text-white/70 text-[10px] font-bold uppercase mb-1">Users</div>
              <div className="text-white text-2xl font-black">{stats.totalUsers}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20">
              <div className="text-white/70 text-[10px] font-bold uppercase mb-1">Pending Docs</div>
              <div className="text-white text-2xl font-black">{stats.pendingDocs}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20">
              <div className="text-white/70 text-[10px] font-bold uppercase mb-1">Messages</div>
              <div className="text-white text-2xl font-black">{stats.totalMessages}</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20">
              <div className="text-white/70 text-[10px] font-bold uppercase mb-1">Destination</div>
              <div className="text-white text-lg font-black">
                {stats.hasDestination ? '✓ Active' : '✗ None'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        {permissions.role === 'admin' && (
          <>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 py-3 text-sm font-bold ${
                activeTab === 'documents' 
                  ? 'text-orange-600 border-b-2 border-orange-600' 
                  : 'text-slate-400'
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-3 text-sm font-bold ${
                activeTab === 'users' 
                  ? 'text-orange-600 border-b-2 border-orange-600' 
                  : 'text-slate-400'
              }`}
            >
              Users
            </button>
          </>
        )}
        <button
          onClick={() => setActiveTab('destination')}
          className={`flex-1 py-3 text-sm font-bold ${
            activeTab === 'destination' 
              ? 'text-orange-600 border-b-2 border-orange-600' 
              : 'text-slate-400'
          }`}
        >
          Destination
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-3 text-sm font-bold ${
            activeTab === 'messages' 
              ? 'text-orange-600 border-b-2 border-orange-600' 
              : 'text-slate-400'
          }`}
        >
          Messages
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'documents' && permissions.role === 'admin' && (
          <div className="space-y-4">
            {/* 文档筛选 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['all', 'pending', 'verified', 'rejected'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDocFilter(filter)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    docFilter === filter
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {filter === 'all' && `All (${userDocuments.reduce((s, u) => s + u.documents.length, 0)})`}
                  {filter === 'pending' && `Pending (${userDocuments.reduce((s, u) => s + u.documents.filter(d => d.status === 'Pending').length, 0)})`}
                  {filter === 'verified' && `Verified (${userDocuments.reduce((s, u) => s + u.documents.filter(d => d.status === 'Verified').length, 0)})`}
                  {filter === 'rejected' && `Rejected (${userDocuments.reduce((s, u) => s + u.documents.filter(d => d.status === 'Rejected').length, 0)})`}
                </button>
              ))}
            </div>

            {userDocuments.filter(u => 
              docFilter === 'all' || u.documents.some(d => d.status === (docFilter.charAt(0).toUpperCase() + docFilter.slice(1)) as any)
            ).length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-500">
                <i className="fa-solid fa-folder-open text-4xl mb-3 text-slate-300"></i>
                <p className="font-medium">暂无用户上传证件</p>
                <p className="text-sm mt-1">用户在 App 的 Me 页上传后，会在此显示</p>
              </div>
            ) : (
              userDocuments
                .filter(u => docFilter === 'all' || u.documents.some(d => d.status === (docFilter.charAt(0).toUpperCase() + docFilter.slice(1)) as any))
                .map((userDoc) => {
                  const filteredDocs = docFilter === 'all' 
                    ? userDoc.documents 
                    : userDoc.documents.filter(d => d.status === (docFilter.charAt(0).toUpperCase() + docFilter.slice(1)) as any);
                  if (filteredDocs.length === 0) return null;
                  return (
                <div key={userDoc.userId} className="bg-white rounded-2xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{userDoc.userName}</h3>
                      <p className="text-xs text-slate-500">{userDoc.userEmail}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {filteredDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800">{doc.type}</p>
                          <p className="text-xs text-slate-500 truncate">{doc.fileName}</p>
                          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            doc.status === 'Verified' ? 'bg-green-100 text-green-700' :
                            doc.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {doc.fileUrl && (
                            <button
                              type="button"
                              onClick={() => setDocPreview({ userName: userDoc.userName, docType: doc.type, fileUrl: doc.fileUrl! })}
                              className="px-3 py-1.5 bg-slate-600 text-white text-xs rounded-lg"
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateDocumentStatus(userDoc.userId, doc.id, 'Verified')}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateDocumentStatus(userDoc.userId, doc.id, 'Rejected')}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                  );
                }).filter(Boolean)
            )}
            {/* 证件图片预览弹窗 */}
            {docPreview && (
              <div
                className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
                onClick={() => setDocPreview(null)}
              >
                <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-800">{docPreview.userName} · {docPreview.docType}</span>
                    <button type="button" onClick={() => setDocPreview(null)} className="text-slate-500 hover:text-slate-800 p-1">
                      <i className="fa-solid fa-times"></i>
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[200px]">
                    {docPreview.fileUrl.startsWith('data:') || docPreview.fileUrl.startsWith('http') ? (
                      <img src={docPreview.fileUrl} alt={docPreview.docType} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                    ) : (
                      <p className="text-slate-500 text-sm">无法预览该文件</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && permissions.role === 'admin' && (
          <div className="space-y-3">
            {/* 用户搜索 */}
            <div className="relative">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full px-4 py-3 pl-10 bg-white border border-slate-200 rounded-xl text-sm"
              />
              <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>

            {users.filter(u => 
              !userSearch || 
              u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
              u.email.toLowerCase().includes(userSearch.toLowerCase())
            ).map((u) => (
              <div key={u.id} className="bg-white rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{u.name}</h3>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => handleSetUserRole(u.id, e.target.value as 'admin' | 'leader' | 'user')}
                    className="px-3 py-1 bg-slate-100 rounded-lg text-sm"
                  >
                    <option value="user">User</option>
                    <option value="leader">Leader</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'destination' && (
          <div className="space-y-4">
            {groupDestination ? (
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-2">{groupDestination.name}</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Set by {groupDestination.setBy.name} ({groupDestination.setBy.role})
                </p>
                {permissions.role === 'admin' && (
                  <button
                    onClick={async () => {
                      if (confirm('Clear group destination?')) {
                        try {
                          await clearGroupDestination();
                          setGroupDestination(null);
                        } catch (error: any) {
                          alert(error.message);
                        }
                      }
                    }}
                    className="w-full bg-red-600 text-white py-2 rounded-lg font-bold"
                  >
                    Clear Destination
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 border-2 border-dashed border-slate-300 text-center">
                <p className="text-slate-600 mb-4">No group destination set</p>
                <button
                  onClick={handleSetDestination}
                  className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold"
                >
                  Set Group Destination
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {groupMessages.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No group messages yet. Send one below.</div>
              ) : (
                groupMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl ${
                      msg.isHighlighted || msg.userRole === 'admin' || msg.userRole === 'leader'
                        ? 'bg-orange-100 border-2 border-orange-300'
                        : 'bg-white border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{msg.userName}</span>
                      <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      {(msg.userRole === 'admin' || msg.userRole === 'leader') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 font-bold">
                          {msg.userRole}
                        </span>
                      )}
                    </div>
                    {msg.message && <p className="text-sm">{msg.message}</p>}
                    {msg.imageUrl && (
                      <div className="mt-2">
                        <img src={msg.imageUrl} alt="" className="max-w-full max-h-48 rounded-lg object-cover" />
                      </div>
                    )}
                    {msg.videoUrl && (
                      <div className="mt-2">
                        <video src={msg.videoUrl} controls className="max-w-full max-h-48 rounded-lg" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="file"
                ref={messageMediaInputRef}
                accept="image/*,video/*"
                className="hidden"
                onChange={onMessageMediaSelected}
              />
              <button
                type="button"
                onClick={() => messageMediaInputRef.current?.click()}
                disabled={sendingMedia}
                className="p-2.5 bg-slate-100 rounded-xl text-slate-600 disabled:opacity-50"
                title="Send image or video"
              >
                {sendingMedia ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-image"></i>}
              </button>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={sendingMedia}
                className="bg-orange-600 text-white px-6 py-2 rounded-xl font-bold disabled:opacity-70"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
