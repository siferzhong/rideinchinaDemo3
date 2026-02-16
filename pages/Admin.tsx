import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserPermissions } from '../services/permissions';
import { getAllUserDocuments, uploadPermitForUser, updateDocumentStatus, getAllUsers, setUserRole } from '../services/admin';
import { setGroupDestination, getGroupDestination, clearGroupDestination } from '../services/groupDestination';
import { sendGroupMessage, getGroupMessages } from '../services/groupChat';
import type { UserDocumentView, UserInfo } from '../services/admin';
import type { GroupDestination } from '../services/groupDestination';
import type { GroupMessage } from '../services/groupChat';

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

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    try {
      const message = await sendGroupMessage(messageInput);
      setGroupMessages(prev => [message, ...prev]);
      setMessageInput('');
    } catch (error: any) {
      alert(error.message || 'Failed to send message');
    }
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

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 text-white">
        <h1 className="text-2xl font-black mb-2">
          {permissions.role === 'admin' ? 'Admin Panel' : 'Leader Panel'}
        </h1>
        <p className="text-white/90 text-sm">{user?.name}</p>
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
            {userDocuments.map((userDoc) => (
              <div key={userDoc.userId} className="bg-white rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{userDoc.userName}</h3>
                    <p className="text-xs text-slate-500">{userDoc.userEmail}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {userDoc.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-bold">{doc.type}</p>
                        <p className="text-xs text-slate-500">{doc.fileName}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateDocumentStatus(userDoc.userId, doc.id, 'Verified')}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateDocumentStatus(userDoc.userId, doc.id, 'Rejected')}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && permissions.role === 'admin' && (
          <div className="space-y-3">
            {users.map((u) => (
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
              {groupMessages.map((msg) => (
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
                  </div>
                  <p className="text-sm">{msg.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl"
              />
              <button
                onClick={handleSendMessage}
                className="bg-orange-600 text-white px-6 py-2 rounded-xl font-bold"
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
