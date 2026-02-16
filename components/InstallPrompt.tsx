import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 检测是否在iOS上
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // 检测是否已经以独立模式运行（已安装）
    const standalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // 如果已经安装，不显示提示
    if (standalone) {
      return;
    }

    // 监听 beforeinstallprompt 事件（Android Chrome）
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Safari：延迟显示提示，给用户时间浏览
    if (iOS && !standalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // 3秒后显示
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android Chrome
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      // iOS Safari - 显示说明
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // 24小时内不再显示
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // 如果已安装或已关闭提示，不显示
  if (isStandalone || !showPrompt) {
    return null;
  }

  // 检查是否在24小时内关闭过
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed) {
    const dismissedTime = parseInt(dismissed, 10);
    const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
    if (hoursSinceDismissed < 24) {
      return null;
    }
  }

  return (
    <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto z-[100] px-4 animate-slide-up">
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-4 shadow-2xl border-2 border-orange-400">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-mobile-screen-button text-white text-xl"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm mb-1">安装到主屏幕</h3>
            {isIOS ? (
              <>
                <p className="text-white/90 text-xs mb-3 leading-relaxed">
                  获得更好的体验：点击 <i className="fa-solid fa-share text-white"></i> 分享按钮，然后选择"添加到主屏幕"
                </p>
                <div className="bg-white/20 backdrop-blur rounded-lg p-2 mb-2">
                  <div className="flex items-center gap-2 text-white/90 text-[10px]">
                    <span className="font-bold">步骤：</span>
                    <span>1. 点击底部 <i className="fa-solid fa-share"></i></span>
                    <span>2. 选择"添加到主屏幕"</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-white/90 text-xs mb-3 leading-relaxed">
                安装后可以像原生应用一样使用，支持离线访问和更快启动
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-white text-orange-600 text-xs font-bold py-2.5 px-4 rounded-lg hover:bg-orange-50 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isIOS ? (
                  <>
                    <i className="fa-solid fa-plus"></i>
                    查看步骤
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-download"></i>
                    立即安装
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 bg-white/20 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-white/30 active:scale-95 transition-all"
              >
                稍后
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors shrink-0"
          >
            <i className="fa-solid fa-times text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
