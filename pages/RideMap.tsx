import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { pointToPathDistance, distanceMeters, toTuple, type LngLatLike } from '../utils/geo';
import { requestWakeLock, releaseWakeLock } from '../utils/wakeLock';
import { createSmoothFollow, cancelSmoothUpdate } from '../utils/smoothMap';
import { getGroupDestination } from '../services/groupDestination';
import { getGroupMessages, getLatestMessages } from '../services/groupChat';
import { getUserPermissions } from '../services/permissions';
import type { GroupDestination } from '../services/groupDestination';
import type { GroupMessage } from '../services/groupChat';

declare global {
  interface Window {
    AMap: any;
  }
}

/** 语音播报距离档位（米）：仅在这些距离触发 */
const VOICE_TRIGGER_DISTANCES = [500, 200, 50] as const;
const OFF_ROUTE_THRESHOLD_M = 50;

interface RiderStatus {
  id: string;
  name: string;
  role: 'leader' | 'member';
  position: [number, number];
  speed: number;
  altitude: number;
  heading?: number;
}

interface Waypoint {
  position: [number, number];
  name: string;
}

const getManeuverIcon = (instruction: string) => {
  const text = instruction.toLowerCase();
  if (text.includes('left')) return 'fa-arrow-turn-up -rotate-90';
  if (text.includes('right')) return 'fa-arrow-turn-up rotate-90';
  if (text.includes('u-turn')) return 'fa-arrow-rotate-left';
  if (text.includes('keep') || text.includes('straight')) return 'fa-arrow-up';
  if (text.includes('exit')) return 'fa-arrow-up-right-from-square';
  return 'fa-location-arrow';
};

/** 根据转向指令计算箭头旋转角度（度） */
const getTurnArrowRotation = (instruction: string): number => {
  const text = instruction.toLowerCase();
  if (text.includes('left')) return -90; // 左转
  if (text.includes('right')) return 90; // 右转
  if (text.includes('u-turn') || text.includes('uturn')) return 180; // 掉头
  if (text.includes('exit')) return 45; // 出口
  return 0; // 直行
};

/** 启动路径动画（高亮流动效果） */
const startRouteAnimation = (polyline: any) => {
  let animationFrame: number | null = null;
  let progress = 0;
  
  const animate = () => {
    progress = (progress + 0.02) % 1; // 每帧前进2%
    
    // 使用strokeDasharray和strokeDashoffset实现流动效果
    // 高德原生导航风格的路径高亮流动
    if (polyline.setOptions) {
      const dashLength = 30;
      const gapLength = 10;
      const offset = progress * (dashLength + gapLength);
      
      // 注意：AMap Polyline可能不支持strokeDasharray，这里使用透明度变化模拟
      const opacity = 0.5 + Math.sin(progress * Math.PI * 2) * 0.3;
      polyline.setOptions({
        strokeOpacity: opacity,
      });
    }
    
    animationFrame = requestAnimationFrame(animate);
  };
  
  animate();
  
  // 返回停止函数
  return () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  };
};

/** 提取并显示导航提示（限速、摄像头、电子眼等） */
const extractAndDisplayNavigationAlerts = (steps: any[], map: any, alertsRef: React.MutableRefObject<any[]>) => {
  if (!map || !window.AMap) return;
  
  steps.forEach((step: any, idx: number) => {
    const instruction = step.instruction || '';
    const stepPath = step.path;
    if (!stepPath || stepPath.length === 0) return;
    
    // 检查是否有限速信息（高德API可能包含在road字段中）
    const speedLimitMatch = instruction.match(/(\d+)\s*km\/h|限速\s*(\d+)/i);
    if (speedLimitMatch) {
      const speedLimit = speedLimitMatch[1] || speedLimitMatch[2];
      const alertPos = stepPath[Math.floor(stepPath.length / 2)]; // 在路径中点显示
      const pos = alertPos.lng != null 
        ? [alertPos.lng, alertPos.lat] 
        : [alertPos[0], alertPos[1]];
      
      const speedMarker = new window.AMap.Marker({
        position: pos,
        map: map,
        content: `
          <div style="
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
            white-space: nowrap;
          ">
            <i class="fa-solid fa-gauge-high" style="margin-right: 2px;"></i>
            ${speedLimit}km/h
          </div>
        `,
        offset: new window.AMap.Pixel(-20, -10),
        zIndex: 55,
      });
      alertsRef.current.push(speedMarker);
    }
    
    // 检查是否有摄像头/电子眼提示
    if (instruction.match(/摄像头|电子眼|监控|测速/i)) {
      const alertPos = stepPath[Math.floor(stepPath.length / 2)];
      const pos = alertPos.lng != null 
        ? [alertPos.lng, alertPos.lat] 
        : [alertPos[0], alertPos[1]];
      
      const cameraMarker = new window.AMap.Marker({
        position: pos,
        map: map,
        content: `
          <div style="
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 4px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
          ">
            <i class="fa-solid fa-camera"></i>
          </div>
        `,
        offset: new window.AMap.Pixel(-10, -10),
        zIndex: 55,
      });
      alertsRef.current.push(cameraMarker);
    }
  });
};

const getDistance = (p1: [number, number] | null, p2: [number, number] | null) => {
  if (!window.AMap || !p1 || !p2) return 0;
  return window.AMap.GeometryUtil.distance(p1, p2) / 1000;
};

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

// 路径动画控制（全局，避免重复创建）
let routeAnimationController: (() => void) | null = null;

const RideMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const gasMarkersRef = useRef<any[]>([]);
  const destMarkerRef = useRef<any>(null);
  const waypointMarkerRef = useRef<any>(null);
  const routeRef = useRef<any>(null);
  const customRoutePolylineRef = useRef<any>(null); // 自定义路径线（更粗更明显）
  const animatedRoutePolylineRef = useRef<any>(null); // 动画路径线（高亮流动效果）
  const turnArrowMarkersRef = useRef<any[]>([]); // 转向箭头标记
  const navigationAlertsRef = useRef<any[]>([]); // 导航提示（限速、摄像头等）
  const watchIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSpokenRef = useRef<string>('');
  const lastVoiceBucketRef = useRef<number>(Infinity);
  const currentStepIndexRef = useRef<number>(0);
  const routePathRef = useRef<LngLatLike[]>([]);
  const reRouteCooldownRef = useRef<number>(0);
  const smoothFollowRef = useRef<ReturnType<typeof createSmoothFollow> | null>(null);
  const smoothCenterRef = useRef<[number, number]>([0, 0]);
  const smoothRotationRef = useRef<number>(0);
  const lastHeadingRef = useRef<number>(0);
  const lastPositionRef = useRef<[number, number]>([0, 0]);
  const locationInitializedRef = useRef<boolean>(false);
  const destPositionRef = useRef<[number, number] | null>(null);
  const activeWaypointRef = useRef<Waypoint | null>(null);
  const isNavigatingRef = useRef<boolean>(false);
  const updateRoutePreviewRef = useRef<(target: [number, number], waypoint?: Waypoint | null, from?: [number, number]) => void>(() => {});
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [previewInfo, setPreviewInfo] = useState<{ distance: string; time: string; steps: any[]; rawDistance: number } | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [translatedInstruction, setTranslatedInstruction] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showGasStations, setShowGasStations] = useState(true);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [trafficLightCountdown, setTrafficLightCountdown] = useState<number | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [currentSpeedLimit, setCurrentSpeedLimit] = useState<number | null>(null);
  const [upcomingCamera, setUpcomingCamera] = useState<{ distance: number; type: string } | null>(null);
  
  const [activeWaypoint, setActiveWaypoint] = useState<Waypoint | null>(null);
  const [destPosition, setDestPosition] = useState<[number, number] | null>(null);
  const [startPosition, setStartPosition] = useState<[number, number] | null>(null);
  
  // 群功能相关状态
  const [groupDestination, setGroupDestination] = useState<GroupDestination | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [permissions, setPermissions] = useState<any>(null);
  const [showGroupMessages, setShowGroupMessages] = useState(false);

  useEffect(() => {
    destPositionRef.current = destPosition;
    activeWaypointRef.current = activeWaypoint;
  }, [destPosition, activeWaypoint]);
  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  const [riders, setRiders] = useState<RiderStatus[]>([
    { id: 'me', name: 'You', role: 'leader', speed: 0, altitude: 0, position: [0, 0] },
    { id: 'rider2', name: 'Hans', role: 'member', speed: 45, altitude: 500, position: [0, 0] },
  ]);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  // 加载群目的地和权限
  useEffect(() => {
    const loadGroupData = async () => {
      try {
        const [dest, perms] = await Promise.all([
          getGroupDestination(),
          getUserPermissions(),
        ]);
        setGroupDestination(dest);
        setPermissions(perms);
        
        // 如果有群目的地，自动设置为目的地
        if (dest && dest.isActive && !destPosition) {
          setDestPosition(dest.position);
        }
      } catch (error) {
        console.error('Failed to load group data:', error);
      }
    };
    loadGroupData();
    
    // 每30秒刷新群目的地
    const interval = setInterval(loadGroupData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 加载和轮询群消息
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const messages = await getGroupMessages(10);
        setGroupMessages(messages);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };
    
    loadMessages();
    // 每10秒轮询新消息
    const interval = setInterval(async () => {
      if (groupMessages.length > 0) {
        const latest = groupMessages[0];
        const newMessages = await getLatestMessages(latest.timestamp);
        if (newMessages.length > 0) {
          setGroupMessages(prev => [...newMessages, ...prev]);
        }
      } else {
        await loadMessages();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // 处理手机罗盘方向（供平滑旋转与 watchPosition 使用）
  useEffect(() => {
    const handleHeading = (e: any) => {
      let heading = 0;
      if (e.webkitCompassHeading) {
        heading = e.webkitCompassHeading; // iOS
      } else if (e.alpha) {
        heading = 360 - e.alpha; // Android
      }
      lastHeadingRef.current = heading;
      setDeviceHeading(heading);
      if (isNavigating && smoothFollowRef.current) {
        const speed = riders.find(r => r.id === 'me')?.speed ?? 0;
        smoothFollowRef.current.setTarget(lastPositionRef.current, heading, speed);
      } else if (isNavigating && mapRef.current) {
        mapRef.current.setRotation(heading);
      }
    };

    if (window.DeviceOrientationEvent) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission();
      }
      window.addEventListener('deviceorientation', handleHeading, true);
      return () => window.removeEventListener('deviceorientation', handleHeading);
    }
  }, [isNavigating]);

  const stopNavigation = useCallback(async () => {
    releaseWakeLock();
    cancelSmoothUpdate();
    smoothFollowRef.current?.stop();
    smoothFollowRef.current = null;
    
    // 停止路径动画
    if (routeAnimationController) {
      routeAnimationController();
      routeAnimationController = null;
    }
    
    if (routeRef.current) { routeRef.current.clear(); routeRef.current = null; }
    if (customRoutePolylineRef.current) { 
      customRoutePolylineRef.current.setMap(null); 
      customRoutePolylineRef.current = null; 
    }
    if (animatedRoutePolylineRef.current) {
      animatedRoutePolylineRef.current.setMap(null);
      animatedRoutePolylineRef.current = null;
    }
    turnArrowMarkersRef.current.forEach(m => m.setMap(null));
    turnArrowMarkersRef.current = [];
    navigationAlertsRef.current.forEach(m => m.setMap(null));
    navigationAlertsRef.current = [];
    
    if (destMarkerRef.current) { destMarkerRef.current.setMap(null); destMarkerRef.current = null; }
    if (waypointMarkerRef.current) { waypointMarkerRef.current.setMap(null); waypointMarkerRef.current = null; }
    gasMarkersRef.current.forEach(m => m.setMap(null));
    gasMarkersRef.current = [];
    routePathRef.current = [];
    lastVoiceBucketRef.current = Infinity;
    currentStepIndexRef.current = 0;

    // 保存骑行距离到历史记录
    if (previewInfo && startPosition && lastPositionRef.current[0] !== 0 && lastPositionRef.current[1] !== 0) {
      const completedDistance = getDistance(startPosition, lastPositionRef.current); // 公里
      if (completedDistance > 0.1) { // 至少100米才记录
        const rideHistory = JSON.parse(localStorage.getItem('ride_history') || '[]');
        rideHistory.push({
          date: new Date().toISOString(),
          distance: completedDistance,
          startPosition,
          endPosition: lastPositionRef.current,
          route: previewInfo.distance,
        });
        localStorage.setItem('ride_history', JSON.stringify(rideHistory));
        
        // 更新总距离
        const currentTotal = parseFloat(localStorage.getItem('total_riding_distance') || '0');
        const newTotal = currentTotal + completedDistance;
        localStorage.setItem('total_riding_distance', newTotal.toFixed(2));
        
        // 同步到 WordPress
        try {
          const { saveTotalDistance, saveRideHistory } = await import('../services/userData');
          await saveTotalDistance(newTotal);
          await saveRideHistory(rideHistory);
        } catch (error) {
          console.error('Failed to sync ride data:', error);
        }
      }
    }

    setIsNavigating(false);
    setIsAdjusting(false);
    setDestPosition(null);
    setActiveWaypoint(null);
    setPreviewInfo(null);
    setTranslatedInstruction('');
    localStorage.removeItem('ride_session');

    if (mapRef.current) {
      mapRef.current.setPitch(45);
      mapRef.current.setRotation(0);
      mapRef.current.setZoom(15);
    }
  }, []);

  const speakInstruction = async (text: string) => {
    if (!voiceEnabled || !text || text === lastSpokenRef.current) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Instruction: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setIsSpeaking(true);
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), audioCtxRef.current);
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtxRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
        lastSpokenRef.current = text;
      }
    } catch (e) { setIsSpeaking(false); }
  };

  const updateRoutePreview = (targetPos: [number, number], waypoint?: Waypoint | null, fromPosition?: [number, number]) => {
    if (!mapRef.current || !window.AMap.Driving) return;
    const start = fromPosition ?? riders[0].position;
    setDestPosition(targetPos);
    if (!startPosition) setStartPosition(start);

    if (destMarkerRef.current) destMarkerRef.current.setMap(null);
    if (waypointMarkerRef.current) waypointMarkerRef.current.setMap(null);
    if (routeRef.current) routeRef.current.clear();

    destMarkerRef.current = new window.AMap.Marker({
      position: targetPos,
      map: mapRef.current,
      content: `<div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center border-4 border-orange-600 shadow-2xl dest-pulse"><i class="fa-solid fa-flag-checkered text-orange-600"></i></div>`,
      offset: new window.AMap.Pixel(-20, -20)
    });

    if (waypoint) {
      waypointMarkerRef.current = new window.AMap.Marker({
        position: waypoint.position,
        map: mapRef.current,
        content: `<div class="bg-green-600 w-10 h-10 rounded-full border-4 border-white shadow-xl flex items-center justify-center animate-pulse"><i class="fa-solid fa-gas-pump text-white"></i></div>`,
        offset: new window.AMap.Pixel(-20, -20)
      });
    }

    const driving = new window.AMap.Driving({ 
      map: mapRef.current, 
      hideMarkers: true, 
      // 高德原生导航风格的路径样式
      outlineColor: '#f97316', // 路径轮廓色（橙色）
      autoFitView: !isNavigating,
      // 导航模式优化配置
      policy: window.AMap.DrivingPolicy.LEAST_TIME, // 最快路线
      extensions: 'all', // 返回详细信息
    });
    
    // 自定义路径样式（如果支持）
    if (driving.setRenderOptions) {
      driving.setRenderOptions({
        autoViewport: !isNavigating,
        hideMarkers: true,
        showTraffic: true, // 显示路况
      });
    }

    driving.search(start, targetPos, { waypoints: waypoint ? [waypoint.position] : [] }, (s: string, r: any) => {
      if (s === 'complete') {
        const route = r.routes[0];
        const allPathPoints = route.steps.reduce((acc: any[], step: any) => acc.concat(step.path), []);
        const pathForGeo = allPathPoints.map((p: any) => (p.lng != null ? [p.lng, p.lat] : [p[0], p[1]])) as LngLatLike[];
        routePathRef.current = pathForGeo;
        currentStepIndexRef.current = 0;
        lastVoiceBucketRef.current = Infinity;
        setPreviewInfo({
          distance: (route.distance / 1000).toFixed(1) + ' km',
          rawDistance: route.distance,
          time: Math.round(route.time / 60) + ' min',
          steps: route.steps,
        });
        findGasStationsAlongRoute(allPathPoints);

        // 添加自定义路径线（高德原生导航风格：更粗、更明显 + 动画效果）
        if (isNavigating && mapRef.current && window.AMap.Polyline) {
          // 清除旧的路径线和标记
          if (customRoutePolylineRef.current) {
            customRoutePolylineRef.current.setMap(null);
          }
          if (animatedRoutePolylineRef.current) {
            animatedRoutePolylineRef.current.setMap(null);
          }
          turnArrowMarkersRef.current.forEach(m => m.setMap(null));
          turnArrowMarkersRef.current = [];
          navigationAlertsRef.current.forEach(m => m.setMap(null));
          navigationAlertsRef.current = [];
          
          // 创建高德原生风格的路径线
          const pathLngLats = allPathPoints.map((p: any) => 
            p.lng != null ? new window.AMap.LngLat(p.lng, p.lat) : new window.AMap.LngLat(p[0], p[1])
          );
          
          // 主路径线（粗，带白色轮廓）
          customRoutePolylineRef.current = new window.AMap.Polyline({
            path: pathLngLats,
            isOutline: true,
            outlineColor: '#ffffff',
            borderWeight: 4,
            strokeColor: '#f97316',
            strokeOpacity: 1,
            strokeWeight: 12,
            strokeStyle: 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            zIndex: 50,
            map: mapRef.current,
          });
          
          // 动画路径线（高亮流动效果，高德原生风格）
          animatedRoutePolylineRef.current = new window.AMap.Polyline({
            path: pathLngLats,
            strokeColor: '#ffd700', // 金色高亮
            strokeOpacity: 0.8,
            strokeWeight: 8,
            strokeStyle: 'solid',
            lineJoin: 'round',
            lineCap: 'round',
            zIndex: 51, // 在主路径之上
            map: mapRef.current,
          });
          
          // 启动路径动画（高亮流动效果）
          if (routeAnimationController) {
            routeAnimationController(); // 停止旧的动画
          }
          routeAnimationController = startRouteAnimation(animatedRoutePolylineRef.current);
          
          // 添加转向箭头标记（在每个step的转向点）
          route.steps.forEach((step: any, idx: number) => {
            if (idx === 0) return; // 跳过第一步（起点）
            const stepPath = step.path;
            if (!stepPath || stepPath.length === 0) return;
            
            // 转向点在step路径的最后一个点
            const turnPoint = stepPath[stepPath.length - 1];
            const turnPos = turnPoint.lng != null 
              ? [turnPoint.lng, turnPoint.lat] 
              : [turnPoint[0], turnPoint[1]];
            
            // 计算转向角度（根据当前step和下一步的方向）
            const currentDir = step.instruction || '';
            const arrowRotation = getTurnArrowRotation(currentDir);
            
            // 创建转向箭头标记
            const arrowMarker = new window.AMap.Marker({
              position: turnPos,
              map: mapRef.current,
              content: `
                <div class="turn-arrow" style="
                  width: 32px; 
                  height: 32px; 
                  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                  border-radius: 50%;
                  border: 3px solid white;
                  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.5);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transform: rotate(${arrowRotation}deg);
                ">
                  <i class="fa-solid fa-arrow-up" style="color: white; font-size: 14px;"></i>
                </div>
              `,
              offset: new window.AMap.Pixel(-16, -16),
              zIndex: 60,
            });
            turnArrowMarkersRef.current.push(arrowMarker);
          });
          
          // 提取并显示导航提示（限速、摄像头等）
          extractAndDisplayNavigationAlerts(route.steps, mapRef.current, navigationAlertsRef);
        }

        if (isNavigating) {
          // 不再在此处自动播报，交由距离档位 500/200/50m 触发
          setTranslatedInstruction(route.steps[0]?.instruction || '');
        }
      }
    });
    routeRef.current = driving;
  };

  useEffect(() => {
    updateRoutePreviewRef.current = updateRoutePreview;
  });

  const translateAndSpeak = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const resp = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Short motorcycle GPS command for: "${text}"`,
        config: { systemInstruction: "Output only the translated brief instruction in Chinese if possible, or simple English." }
      });
      const translated = resp.text?.trim() || text;
      setTranslatedInstruction(translated);
      speakInstruction(translated);
    } catch (e) { setTranslatedInstruction(text); }
  };

  const findGasStationsAlongRoute = (rawPath: any[]) => {
    if (!window.AMap || !rawPath || rawPath.length === 0) return;
    
    window.AMap.plugin(['AMap.PlaceSearch'], () => {
      const ps = new window.AMap.PlaceSearch({ type: '加油站', pageSize: 30 });
      const pathStride = Math.max(1, Math.floor(rawPath.length / 40));
      const simplifiedPath = rawPath.filter((_, i) => i % pathStride === 0).map(p => new window.AMap.LngLat(p.lng || p[0], p.lat || p[1]));

      const onSearch = (status: string, result: any) => {
        if (status === 'complete' && result.poiList?.pois) {
          gasMarkersRef.current.forEach(m => m.setMap(null));
          gasMarkersRef.current = [];
          
          result.poiList.pois.slice(0, 5).forEach((poi: any) => {
            const marker = new window.AMap.Marker({
              position: [poi.location.lng, poi.location.lat],
              map: showGasStations ? mapRef.current : null,
              content: `
                <div class="flex flex-col items-center">
                  <div class="bg-green-600 w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center hover:scale-125 transition-transform">
                    <i class="fa-solid fa-gas-pump text-white text-[10px]"></i>
                  </div>
                  <div class="bg-white px-2 py-0.5 rounded text-[8px] font-black shadow-sm mt-1">ADD STOP</div>
                </div>
              `,
              offset: new window.AMap.Pixel(-16, -16)
            });
            marker.on('click', () => {
              if (navigator.vibrate) navigator.vibrate(50);
              const newWp = { position: [poi.location.lng, poi.location.lat] as [number, number], name: poi.name };
              setActiveWaypoint(newWp);
              if (destPosition) updateRoutePreview(destPosition, newWp);
            });
            gasMarkersRef.current.push(marker);
          });
        }
      };

      if (ps.searchAlongRoute) {
        ps.searchAlongRoute(simplifiedPath, { radius: 3000 }, onSearch);
      } else {
        ps.searchNearBy('', simplifiedPath[Math.floor(simplifiedPath.length / 2)], 10000, onSearch);
      }
    });
  };

  // 请求定位权限并获取当前位置（Safari需要在用户手势时调用）
  const requestLocationPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('您的浏览器不支持定位功能');
      return;
    }

    setLocationError(null);
    setLocationPermissionDenied(false);

    navigator.geolocation.getCurrentPosition(
      (geoPos) => {
        const realPos: [number, number] = [geoPos.coords.longitude, geoPos.coords.latitude];
        console.log('✅ Got real position:', realPos);
        lastPositionRef.current = realPos;
        setCurrentLocation(realPos);
        setRiders((prev) =>
          prev.map((r) => (r.id === 'me' ? { ...r, position: realPos } : r))
        );
        locationInitializedRef.current = true;
        
        if (mapRef.current) {
          if (isNavigating) {
            mapRef.current.setPitch(70);
            mapRef.current.setZoom(19);
            smoothFollowRef.current?.setCurrent(realPos, lastHeadingRef.current);
            mapRef.current.setCenter(realPos);
            mapRef.current.setRotation(lastHeadingRef.current);
          } else {
            mapRef.current.setCenter(realPos);
            mapRef.current.setZoom(16);
          }
        }
      },
      (error) => {
        console.error('❌ Geolocation error:', error.code, error.message);
        let errorMsg = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = '定位权限被拒绝。请在Safari设置中允许此网站访问您的位置。';
            setLocationPermissionDenied(true);
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = '无法获取位置信息。请检查GPS是否开启。';
            break;
          case error.TIMEOUT:
            errorMsg = '定位请求超时。请重试。';
            break;
          default:
            errorMsg = '定位失败：' + error.message;
        }
        setLocationError(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [isNavigating]);

  const centerOnMe = useCallback(() => {
    if (!mapRef.current) return;
    
    // 如果位置还是默认值（成都），主动请求定位
    const isDefaultPos = lastPositionRef.current[0] === 104.066 && lastPositionRef.current[1] === 30.572;
    
    if (isDefaultPos || (lastPositionRef.current[0] === 0 && lastPositionRef.current[1] === 0)) {
      // 在用户手势时请求定位权限（Safari要求）
      requestLocationPermission();
      return;
    }

    const pos = lastPositionRef.current;
    if (isNavigating) {
      // 高德原生导航视角
      mapRef.current.setPitch(75);
      mapRef.current.setZoom(19.5);
      smoothFollowRef.current?.setCurrent(pos, lastHeadingRef.current);
      mapRef.current.setCenter(pos);
      mapRef.current.setRotation(lastHeadingRef.current);
    } else {
      mapRef.current.setCenter(pos);
      mapRef.current.setZoom(16);
      mapRef.current.setPitch(45); // 非导航模式恢复标准视角
    }
  }, [isNavigating, requestLocationPermission]);

  // Safari/iOS 需要在用户手势时请求定位权限，不能在页面加载时自动请求
  // 所以这里只初始化地图，不自动获取位置
  useEffect(() => {
    if (locationInitializedRef.current || mapRef.current) return;
    
    // 检查定位权限和可用性
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      const defaultPos: [number, number] = [104.066, 30.572];
      lastPositionRef.current = defaultPos;
      setCurrentLocation(defaultPos);
      setRiders((prev) =>
        prev.map((r) => (r.id === 'me' ? { ...r, position: defaultPos } : r))
      );
      locationInitializedRef.current = true;
      return;
    }

    // 使用默认位置初始化地图，等待用户点击定位按钮
    const defaultPos: [number, number] = [104.066, 30.572];
    lastPositionRef.current = defaultPos;
    setCurrentLocation(defaultPos);
    setRiders((prev) =>
      prev.map((r) => (r.id === 'me' ? { ...r, position: defaultPos } : r))
    );
    locationInitializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !currentLocation) return;
    
    // 性能优化：预加载地图资源
    const preloadMapResources = () => {
      // 预加载常用地图切片（通过创建隐藏的地图实例）
      if (window.AMap && !(window as any).__amapPreloaded) {
        try {
          const preloadContainer = document.createElement('div');
          preloadContainer.style.display = 'none';
          preloadContainer.style.width = '1px';
          preloadContainer.style.height = '1px';
          document.body.appendChild(preloadContainer);
          
          const preloadMap = new window.AMap.Map(preloadContainer, {
            zoom: 15,
            center: currentLocation,
            viewMode: '3D',
          });
          
          // 预加载完成后移除
          preloadMap.on('complete', () => {
            setTimeout(() => {
              preloadMap.destroy();
              document.body.removeChild(preloadContainer);
              (window as any).__amapPreloaded = true;
            }, 1000);
          });
        } catch (e) {
          console.log('Preload skipped:', e);
        }
      }
    };
    
    // 延迟预加载，不阻塞主地图初始化
    setTimeout(preloadMapResources, 100);
    
    const map = new window.AMap.Map(containerRef.current, {
      zoom: 15,
      center: currentLocation,
      viewMode: '3D',
      pitch: 45,
      mapStyle: 'amap://styles/dark',
      rotation: 0,
      // 高德原生导航风格配置
      buildingAnimation: true, // 建筑物3D动画
      expandZoomRange: true, // 扩展缩放范围
      zooms: [3, 20], // 缩放级别范围
      features: ['bg', 'point', 'road', 'building'], // 显示要素
      showBuildingBlock: true, // 显示建筑物
      showLabel: true, // 显示标签
      defaultCursor: 'default',
      isHotspot: false,
      // 性能优化配置
      lazyLoad: false, // 禁用懒加载，确保地图完整加载
      resizeEnable: true, // 允许自动调整大小
      animateEnable: true, // 启用动画
      // 注意：mapStyle在初始化时使用dark，导航模式会切换
    });
    
    // 添加路况图层（实时交通）
    if (window.AMap.TileLayer && window.AMap.TileLayer.Traffic) {
      const trafficLayer = new window.AMap.TileLayer.Traffic({
        zIndex: 10,
        opacity: 0.8,
        autoRefresh: true,
        interval: 180,
      });
      trafficLayer.setMap(map);
    }
    
    // 性能优化：使用事件委托，减少监听器
    map.on('complete', () => {
      setMapLoaded(true);
      startTracking();
      const saved = localStorage.getItem('ride_session');
      if (saved) {
        const data = JSON.parse(saved);
        setDestPosition(data.destPosition);
        setActiveWaypoint(data.activeWaypoint);
        setStartPosition(data.startPosition);
        setIsNavigating(data.isNavigating);
        if (data.isNavigating) setIsAdjusting(true);
      }
    });
    
    mapRef.current = map;
  }, [currentLocation]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not available for watchPosition');
      return;
    }
    // 高德原生导航级别的定位精度配置
    const geoOptions: PositionOptions = {
      enableHighAccuracy: true, // 启用高精度GPS
      maximumAge: 1000, // 降低缓存时间，获取更实时位置（高德原生约1秒）
      timeout: 8000, // 超时时间
    };
    // 节流：避免过于频繁的更新（高德原生导航约1-2秒更新一次）
    let lastUpdateTime = 0;
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const isNav = isNavigatingRef.current;
        const UPDATE_INTERVAL = isNav ? 1000 : 2000; // 导航模式1秒，普通模式2秒
        
        // 节流：避免过于频繁的更新
        if (now - lastUpdateTime < UPDATE_INTERVAL) {
          return;
        }
        lastUpdateTime = now;
        
        const newPos: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const speed = pos.coords.speed ?? 0;
        const altitude = pos.coords.altitude ?? 0;
        
        // 更新位置引用和状态
        lastPositionRef.current = newPos;
        setCurrentLocation(newPos);
        setRiders((prev) =>
          prev.map((r) =>
            r.id === 'me'
              ? { ...r, position: newPos, speed, altitude }
              : r
          )
        );
        
        if (!mapRef.current) return;
        
        if (isNav) {
          // 导航模式：使用平滑跟随（高德原生风格）
          smoothFollowRef.current?.setTarget(newPos, lastHeadingRef.current, speed);
          
          // 偏航检测（高德原生导航会在偏离50米时重新规划）
          const path = routePathRef.current;
          if (path.length >= 2) {
            const { distance } = pointToPathDistance(newPos, path);
            if (distance > OFF_ROUTE_THRESHOLD_M && reRouteCooldownRef.current <= Date.now()) {
              reRouteCooldownRef.current = Date.now() + 15000;
              const dest = destPositionRef.current;
              const wp = activeWaypointRef.current;
              if (dest) updateRoutePreviewRef.current(dest, wp ?? undefined, newPos);
            }
          }
        } else {
          // 非导航模式：直接更新中心点（不需要平滑）
          mapRef.current.setCenter(newPos);
        }
        
        // 清除错误状态
        if (locationError) {
          setLocationError(null);
          setLocationPermissionDenied(false);
        }
      },
      (error) => {
        console.error('watchPosition error:', error.code, error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationPermissionDenied(true);
          setLocationError('定位权限被拒绝。请在Safari设置中允许此网站访问您的位置。');
        }
      },
      geoOptions
    );
  }, [isNavigating, locationError]);

  // 导航中：屏幕常亮 + 平滑视角 + 3D跟随模式（高德原生风格）
  useEffect(() => {
    if (!isNavigating || !mapRef.current) return;
    requestWakeLock();
    const map = mapRef.current;
    
    // 高德原生导航风格的3D视角配置
    map.setPitch(75); // 更高的俯视角度（高德原生约75-80度）
    map.setZoom(19.5); // 更近的缩放级别，接近车道级
    map.setRotation(lastHeadingRef.current);
    map.setCenter(lastPositionRef.current);
    
    // 启用建筑物3D显示（高德原生导航特色）
    if (map.setFeatures) {
      map.setFeatures(['bg', 'point', 'road', 'building']);
    }
    
    // 切换到导航专用地图样式（如果可用）
    try {
      map.setMapStyle('amap://styles/normal'); // 标准样式更适合导航
    } catch (e) {
      console.log('Map style not available');
    }
    
    if (!smoothFollowRef.current) {
      // 使用更激进的平滑系数，实现高德原生般的流畅跟随
      smoothFollowRef.current = createSmoothFollow(0.22, 0.25); // 更快的响应速度
      smoothFollowRef.current.start(map, lastPositionRef.current, lastHeadingRef.current);
    }
    
    return () => {
      smoothFollowRef.current?.stop();
      smoothFollowRef.current = null;
      releaseWakeLock();
    };
  }, [isNavigating]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    riders.forEach(r => {
      const heading = r.id === 'me' ? deviceHeading : (r.heading || 0);
      const content = `
        <div class="flex flex-col items-center">
          <div class="bg-white/90 text-slate-900 text-[8px] font-bold px-1 rounded-sm mb-1">${r.name}</div>
          <div class="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center ${r.role === 'leader' ? 'bg-orange-600 scale-125' : 'bg-slate-500'}" style="transform: rotate(${heading}deg)">
            <i class="fa-solid fa-motorcycle text-[12px] text-white"></i>
          </div>
        </div>
      `;
      if (markersRef.current[r.id]) {
        markersRef.current[r.id].setPosition(r.position);
        markersRef.current[r.id].setContent(content);
      } else {
        markersRef.current[r.id] = new window.AMap.Marker({ position: r.position, map: mapRef.current, content });
      }
    });
  }, [riders, deviceHeading, mapLoaded]);

  // 仅在距离下一转向点 500m / 200m / 50m 时触发语音播报；通过转向点后推进步骤
  useEffect(() => {
    if (!isNavigating || !voiceEnabled || !previewInfo?.steps?.length) return;
    const steps = previewInfo.steps;
    const idx = Math.min(currentStepIndexRef.current, steps.length - 1);
    const step = steps[idx];
    const path = step?.path;
    if (!path?.length) return;
    const turnPoint = path[path.length - 1];
    const turnLngLat = toTuple(turnPoint);
    const pos = lastPositionRef.current;
    const distToTurn = distanceMeters(pos, turnLngLat);
    for (const triggerM of VOICE_TRIGGER_DISTANCES) {
      if (distToTurn <= triggerM && lastVoiceBucketRef.current > triggerM) {
        lastVoiceBucketRef.current = triggerM;
        const instruction = step.instruction || '';
        translateAndSpeak(instruction);
        break;
      }
    }
    if (distToTurn <= 30 && idx < steps.length - 1) {
      currentStepIndexRef.current = idx + 1;
      lastVoiceBucketRef.current = Infinity;
    }
  }, [isNavigating, voiceEnabled, previewInfo?.steps, riders[0].position]);

  // 实时检测导航提示：限速、摄像头（高德原生导航风格）
  useEffect(() => {
    if (!isNavigating || !previewInfo?.steps?.length) {
      setCurrentSpeedLimit(null);
      setUpcomingCamera(null);
      return;
    }
    
    const steps = previewInfo.steps;
    const currentPos = lastPositionRef.current;
    let foundSpeedLimit: number | null = null;
    let foundCamera: { distance: number; type: string } | null = null;
    
    // 检查当前步骤和未来3个步骤中的限速和摄像头
    for (let i = currentStepIndexRef.current; i < Math.min(currentStepIndexRef.current + 3, steps.length); i++) {
      const step = steps[i];
      const instruction = step.instruction || '';
      const stepPath = step.path;
      if (!stepPath || stepPath.length === 0) continue;
      
      // 检查限速
      const speedLimitMatch = instruction.match(/(\d+)\s*km\/h|限速\s*(\d+)/i);
      if (speedLimitMatch && !foundSpeedLimit) {
        const speedLimit = parseInt(speedLimitMatch[1] || speedLimitMatch[2], 10);
        const stepStart = stepPath[0];
        const stepStartPos = toTuple(stepStart);
        const distToLimit = distanceMeters(currentPos, stepStartPos);
        if (distToLimit < 500) { // 500米内显示限速
          foundSpeedLimit = speedLimit;
        }
      }
      
      // 检查摄像头
      if (instruction.match(/摄像头|电子眼|监控|测速/i) && !foundCamera) {
        const stepStart = stepPath[0];
        const stepStartPos = toTuple(stepStart);
        const distToCamera = distanceMeters(currentPos, stepStartPos);
        if (distToCamera < 300) { // 300米内显示摄像头提示
          foundCamera = {
            distance: Math.round(distToCamera),
            type: instruction.includes('测速') ? 'speed' : 'camera',
          };
        }
      }
    }
    
    setCurrentSpeedLimit(foundSpeedLimit);
    setUpcomingCamera(foundCamera);
  }, [isNavigating, previewInfo?.steps, riders[0].position]);

  const progress = useMemo(() => {
    if (!isNavigating || !destPosition || !startPosition) return 0;
    const total = getDistance(startPosition, destPosition);
    const done = getDistance(startPosition, riders[0].position);
    return Math.min(100, Math.max(0, (done / total) * 100));
  }, [riders[0].position, isNavigating]);

  const wpProgress = useMemo(() => {
    if (!isNavigating || !activeWaypoint || !destPosition || !startPosition) return null;
    const total = getDistance(startPosition, destPosition);
    const wpDist = getDistance(startPosition, activeWaypoint.position);
    return (wpDist / total) * 100;
  }, [activeWaypoint, isNavigating]);

  return (
    <div className="h-full relative bg-slate-950 flex flex-col overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* 群消息提示（高亮显示） */}
      {groupMessages.length > 0 && groupMessages[0].isHighlighted && (
        <div className="absolute top-[env(safe-area-inset-top)] left-4 right-4 z-[65] mt-4">
          <div 
            onClick={() => setShowGroupMessages(!showGroupMessages)}
            className="bg-orange-600/95 backdrop-blur-xl border-2 border-orange-400 rounded-2xl p-4 shadow-2xl animate-pulse cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-bullhorn text-white text-xl"></i>
              </div>
              <div className="flex-1">
                <div className="text-white/90 text-xs font-bold uppercase mb-1">Group Message</div>
                <div className="text-white font-bold text-sm">{groupMessages[0].message}</div>
                <div className="text-white/70 text-[10px] mt-1">
                  {groupMessages[0].userName} • {new Date(groupMessages[0].timestamp).toLocaleTimeString()}
                </div>
              </div>
              <i className={`fa-solid fa-chevron-${showGroupMessages ? 'up' : 'down'} text-white`}></i>
            </div>
          </div>
          
          {/* 消息列表 */}
          {showGroupMessages && (
            <div className="mt-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl p-4 max-h-64 overflow-y-auto space-y-2">
              {groupMessages.slice(0, 5).map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-xl ${
                    msg.isHighlighted || msg.userRole === 'admin' || msg.userRole === 'leader'
                      ? 'bg-orange-600/30 border border-orange-400'
                      : 'bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-xs">{msg.userName}</span>
                    <span className="text-slate-400 text-[10px]">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-white text-sm">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 顶部导航 HUD */}
      {isNavigating && (
        <div className={`absolute ${groupMessages.length > 0 && groupMessages[0].isHighlighted ? 'top-32' : 'top-[env(safe-area-inset-top)]'} inset-x-0 z-[60] px-4 pt-4`}>
          <div className="bg-slate-900/95 backdrop-blur-xl border-b-2 border-orange-500 rounded-2xl p-4 shadow-2xl animate-slide-up">
            {/* 主信息行 */}
            <div className="flex items-center gap-4 mb-3">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white text-3xl shrink-0 ${isSpeaking ? 'bg-orange-600 animate-pulse' : 'bg-slate-800'}`}>
                 <i className={`fa-solid ${getManeuverIcon(translatedInstruction || previewInfo?.steps[0]?.instruction || '')}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                 <div className="text-orange-500 text-[9px] font-black uppercase tracking-widest">Next Maneuver</div>
                 <div className="text-white font-bold text-base truncate uppercase">{translatedInstruction || "Calculating..."}</div>
                 <div className="text-slate-400 text-[10px] font-bold mt-1 uppercase">{previewInfo?.steps[0]?.distance || 0}m Ahead</div>
              </div>
              {/* 导航提示组 */}
              <div className="flex items-center gap-2 shrink-0">
                {/* 限速提示 */}
                {currentSpeedLimit !== null && (
                  <div className="flex flex-col items-center justify-center bg-blue-600/90 rounded-xl px-3 py-2 min-w-[45px] border-2 border-blue-400">
                    <i className="fa-solid fa-gauge-high text-white text-xs mb-0.5"></i>
                    <div className="text-white font-black text-sm leading-none">{currentSpeedLimit}</div>
                    <div className="text-white/80 text-[7px] font-bold uppercase mt-0.5">KM/H</div>
                  </div>
                )}
                {/* 摄像头提示 */}
                {upcomingCamera && (
                  <div className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[45px] border-2 ${
                    upcomingCamera.type === 'speed' 
                      ? 'bg-red-600/90 border-red-400' 
                      : 'bg-yellow-600/90 border-yellow-400'
                  }`}>
                    <i className="fa-solid fa-camera text-white text-xs mb-0.5"></i>
                    <div className="text-white font-black text-xs leading-none">{upcomingCamera.distance}m</div>
                    <div className="text-white/80 text-[7px] font-bold uppercase mt-0.5">
                      {upcomingCamera.type === 'speed' ? 'SPEED' : 'CAM'}
                    </div>
                  </div>
                )}
                {/* 红绿灯倒计时（如果可用） */}
                {trafficLightCountdown !== null && trafficLightCountdown > 0 && (
                  <div className="flex flex-col items-center justify-center bg-red-600/90 rounded-xl px-3 py-2 min-w-[50px] border-2 border-red-400">
                    <i className="fa-solid fa-traffic-light text-white text-xs mb-1"></i>
                    <div className="text-white font-black text-lg leading-none">{trafficLightCountdown}</div>
                    <div className="text-white/80 text-[8px] font-bold uppercase mt-0.5">SEC</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 右侧垂直进度条 */}
      {isNavigating && (
        <div className="absolute top-32 right-6 bottom-40 z-[70] flex flex-col items-center">
           <div className="mb-6 flex flex-col gap-3">
             {riders.filter(r => r.id !== 'me').map(r => (
               <div key={r.id} className="bg-slate-900/90 border border-white/20 p-1.5 rounded-lg shadow-xl flex flex-col items-center">
                 <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold">{r.name[0]}</div>
                 <span className="text-[6px] font-black text-orange-500 mt-0.5">{getDistance(riders[0].position, r.position).toFixed(1)}K</span>
               </div>
             ))}
           </div>

           <div className="flex-1 w-5 relative flex flex-col items-center">
             <div className="absolute inset-y-0 w-2.5 bg-slate-900/50 backdrop-blur-md rounded-full border border-white/10 shadow-inner"></div>
             <div className="absolute bottom-0 w-2.5 bg-gradient-to-t from-green-600 to-green-400 rounded-full transition-all duration-700" style={{ height: `${progress}%` }}></div>
             
             <div className="absolute top-[-10px] w-6 h-6 bg-orange-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center z-30">
               <i className="fa-solid fa-flag-checkered text-[10px] text-white"></i>
             </div>

             <div className="absolute w-8 h-8 z-40 transition-all duration-700 -translate-x-1/2 left-1/2" style={{ bottom: `calc(${progress}% - 16px)` }}>
               <div className="w-full h-full bg-white rounded-lg rotate-45 shadow-2xl flex items-center justify-center border-2 border-slate-900">
                 <i className="fa-solid fa-motorcycle text-slate-900 text-[10px] -rotate-45"></i>
               </div>
             </div>

             {activeWaypoint && wpProgress !== null && (
               <div className="absolute w-5 h-5 z-20 -translate-x-1/2 left-1/2" style={{ bottom: `calc(${wpProgress}% - 10px)` }}>
                 <div className="w-full h-full bg-green-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                   <i className="fa-solid fa-gas-pump text-white text-[8px]"></i>
                 </div>
               </div>
             )}
             <div className="absolute bottom-[-5px] w-3 h-3 bg-white rounded-full border-2 border-slate-950"></div>
           </div>
        </div>
      )}

      {/* 定位错误提示 */}
      {locationError && (
        <div className="absolute top-[env(safe-area-inset-top)] left-4 right-4 z-[80] mt-4 animate-slide-up">
          <div className={`bg-slate-900/95 backdrop-blur-xl border-2 rounded-2xl p-4 shadow-2xl ${
            locationPermissionDenied ? 'border-red-500' : 'border-orange-500'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                locationPermissionDenied ? 'bg-red-600' : 'bg-orange-600'
              }`}>
                <i className={`fa-solid ${locationPermissionDenied ? 'fa-location-xmark' : 'fa-triangle-exclamation'} text-white text-lg`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm mb-1">
                  {locationPermissionDenied ? '定位权限被拒绝' : '定位失败'}
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed mb-3">{locationError}</p>
                {locationPermissionDenied && (
                  <div className="bg-slate-800/50 rounded-lg p-3 mb-2">
                    <p className="text-slate-300 text-xs font-bold mb-2">📱 通过IP地址访问时，请使用系统设置：</p>
                    <div className="space-y-2 text-slate-400 text-[11px] leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
                        <span>打开 iPhone <span className="text-white font-bold">设置</span> App</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
                        <span>找到并点击 <span className="text-white font-bold">Safari</span></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-orange-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</span>
                        <span>找到 <span className="text-white font-bold">"隐私与安全性"</span> → 确保 <span className="text-white font-bold">"位置服务"</span> 已开启</span>
                      </div>
                      <div className="flex items-start gap-2 mt-3 pt-2 border-t border-slate-700">
                        <span className="text-orange-400">💡</span>
                        <span className="text-slate-300 text-[10px]">
                          <strong>说明：</strong>通过IP地址访问时，Safari不提供网站级别的权限设置。需要确保Safari的全局定位权限已开启。
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPermissionGuide(true)}
                      className="mt-3 w-full bg-slate-700 text-white text-xs font-bold py-2 rounded-lg hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-question-circle"></i>
                      查看详细步骤和替代方案
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLocationError(null);
                      setLocationPermissionDenied(false);
                      requestLocationPermission();
                    }}
                    className="flex-1 bg-orange-600 text-white text-xs font-bold py-2 px-3 rounded-lg hover:bg-orange-700 active:scale-95 transition-all"
                  >
                    重试
                  </button>
                  <button
                    onClick={() => {
                      setLocationError(null);
                      setLocationPermissionDenied(false);
                    }}
                    className="px-4 bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded-lg hover:bg-slate-600 active:scale-95 transition-all"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 底部控制栏 */}
      <div className="absolute top-40 left-4 z-[70] flex flex-col gap-3">
        <button 
          onClick={centerOnMe} 
          className={`w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center active:scale-90 transition-all ${
            locationPermissionDenied 
              ? 'bg-red-600 text-white animate-pulse' 
              : 'bg-white text-slate-900'
          }`}
          title="定位到当前位置"
        >
          <i className="fa-solid fa-location-crosshairs text-xl"></i>
        </button>
        <button onClick={() => setShowGasStations(!showGasStations)} className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-2xl transition-all ${showGasStations ? 'bg-green-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
          <i className="fa-solid fa-gas-pump text-xl"></i>
        </button>
      </div>

      {!isNavigating && !isAdjusting && (
        <div className="absolute bottom-12 left-4 right-4 z-10 space-y-3">
          {/* 群目的地按钮 */}
          {groupDestination && groupDestination.isActive ? (
            <button 
              onClick={() => {
                setDestPosition(groupDestination.position);
                setIsAdjusting(true);
                updateRoutePreview(groupDestination.position);
              }} 
              className="w-full bg-green-600 text-white py-5 rounded-2xl font-black shadow-3xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl uppercase italic"
            >
              <i className="fa-solid fa-users"></i> Start Group Ride: {groupDestination.name}
            </button>
          ) : permissions?.canSetGroupDestination ? (
            <button 
              onClick={() => setIsSearching(true)} 
              className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black shadow-3xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl uppercase italic"
            >
              <i className="fa-solid fa-map-location-dot"></i> Set Group Destination
            </button>
          ) : (
            <div className="w-full bg-slate-800/90 text-slate-300 py-5 rounded-2xl font-bold shadow-3xl flex items-center justify-center gap-3 text-lg uppercase italic border-2 border-slate-600">
              <i className="fa-solid fa-clock"></i> Waiting for Leader to Set Destination
            </div>
          )}
          
          {/* 普通导航按钮（如果有权限） */}
          {permissions?.canSetGroupDestination && (
            <button 
              onClick={() => setIsSearching(true)} 
              className="w-full bg-slate-700 text-white py-4 rounded-2xl font-bold shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-sm uppercase"
            >
              <i className="fa-solid fa-map-location-dot"></i> Start Personal Ride
            </button>
          )}
        </div>
      )}

      {isSearching && (
        <div className="absolute inset-0 z-[100] bg-slate-950 flex flex-col p-6 pt-16">
           <div className="flex items-center gap-4 mb-6">
              <input autoFocus value={searchQuery} onChange={(e) => {
                setSearchQuery(e.target.value);
                const ps = new window.AMap.PlaceSearch({ pageSize: 15 });
                ps.search(e.target.value, (s:any, r:any) => s === 'complete' && setSearchResults(r.poiList.pois));
              }} className="flex-1 bg-white/5 border border-white/10 rounded-xl py-4 px-5 text-white font-bold outline-none" placeholder="Destination..." />
              <button onClick={() => setIsSearching(false)} className="text-slate-500 font-bold uppercase text-xs">Close</button>
           </div>
           <div className="flex-1 overflow-y-auto space-y-2">
              {searchResults.map(poi => (
                <button key={poi.id} onClick={() => { setIsSearching(false); setIsAdjusting(true); updateRoutePreview([poi.location.lng, poi.location.lat]); }} className="w-full text-left bg-white/5 p-4 rounded-xl flex items-center gap-4 border border-white/5 active:bg-orange-600 transition-all">
                  <i className="fa-solid fa-location-dot text-orange-500"></i>
                  <div className="flex-1 truncate">
                    <h4 className="text-white font-bold truncate">{poi.name}</h4>
                    <p className="text-slate-500 text-[10px] truncate uppercase">{poi.address}</p>
                  </div>
                </button>
              ))}
           </div>
        </div>
      )}

      {isAdjusting && (
        <div className="absolute bottom-12 left-4 right-4 z-50 animate-slide-up">
           <div className="bg-slate-900/98 backdrop-blur-2xl border border-orange-500/30 rounded-3xl p-6 shadow-3xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-white font-black text-2xl uppercase italic">Ready to Ride</h3>
                  <div className="flex gap-2 text-[10px] font-black uppercase text-green-500">
                    <i className="fa-solid fa-check-circle"></i> GPS Connected
                  </div>
                </div>
                <div className="text-right">
                   <div className="text-orange-500 font-black text-2xl italic leading-none">{previewInfo?.distance}</div>
                   <div className="text-slate-500 text-[8px] font-bold mt-1 uppercase">Distance</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={stopNavigation} className="flex-1 bg-slate-800 text-slate-400 py-4 rounded-xl font-black uppercase text-xs">Reset</button>
                <button 
                  onClick={() => { 
                    setIsAdjusting(false); 
                    setIsNavigating(true);
                    // 开始导航时主动请求定位权限
                    requestLocationPermission();
                    setTimeout(() => centerOnMe(), 500);
                  }} 
                  className="flex-[2] bg-orange-600 text-white text-lg font-black py-4 rounded-xl shadow-xl uppercase italic active:scale-95 transition-all"
                >
                  Ignition
                </button>
              </div>
           </div>
        </div>
      )}

      {isNavigating && (
        <div className="absolute inset-x-0 bottom-0 z-50 p-6 pb-10">
           <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 shadow-3xl flex items-center justify-around border-b-8 border-orange-600/30">
              <div className="flex flex-col items-center">
                 <div className="text-[8px] text-slate-500 font-black uppercase">KM/H</div>
                 <div className="text-4xl font-black text-white italic tracking-tighter leading-none">{Math.round(riders[0].speed)}</div>
              </div>
              <div className="w-px h-12 bg-white/10"></div>
              <div className="flex flex-col items-center">
                 <div className="text-[8px] text-orange-500 font-black uppercase">ALT</div>
                 <div className="text-3xl font-black text-white italic tracking-tighter leading-none">{Math.round(riders[0].altitude)}M</div>
              </div>
              <div className="w-px h-12 bg-white/10"></div>
              <div className="flex flex-col items-center">
                 <div className="text-[8px] text-slate-500 font-black uppercase">REMAIN</div>
                 <div className="text-xl font-black text-white italic leading-none">{previewInfo?.distance.split(' ')[0]}K</div>
              </div>
              <button onClick={() => { if(confirm("End Trip?")) stopNavigation(); }} className="w-14 h-14 bg-red-600/10 text-red-500 border-2 border-red-600/20 rounded-2xl flex items-center justify-center active:scale-90 transition-all">
                <i className="fa-solid fa-power-off text-2xl"></i>
              </button>
           </div>
        </div>
      )}

      {/* Safari 定位权限详细指南 */}
      {showPermissionGuide && (
        <div 
          className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPermissionGuide(false)}
        >
          <div 
            className="bg-slate-900 rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-2 border-orange-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-location-crosshairs text-white text-xl"></i>
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Safari 定位权限设置</h2>
                    <p className="text-white/90 text-xs">按步骤操作即可</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPermissionGuide(false)}
                  className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
              </div>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <span className="bg-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                  找到 Safari 底部地址栏右侧的菜单
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-3">
                  由于你通过 <strong className="text-white">IP地址</strong> 访问（192.168.x.x），Safari不会显示锁图标。请使用以下方法：
                </p>
                <div className="bg-slate-700 rounded-lg p-4 mb-3">
                  <p className="text-white font-bold text-sm mb-2">方法一：通过底部地址栏（推荐）</p>
                  <div className="flex items-center gap-2 text-slate-300 text-xs">
                    <span>1. 查看 Safari 底部地址栏</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-xs mt-2">
                    <span>2. 点击地址栏右侧的</span>
                    <span className="bg-orange-600 text-white px-2 py-1 rounded">"..."</span>
                    <span>三个点图标</span>
                  </div>
                </div>
                <div className="bg-slate-700 rounded-lg p-4">
                  <p className="text-white font-bold text-sm mb-2">方法二：通过分享按钮</p>
                  <div className="flex items-center gap-2 text-slate-300 text-xs">
                    <span>1. 点击 Safari 底部的</span>
                    <span className="bg-orange-600 text-white px-2 py-1 rounded">分享</span>
                    <span>按钮（方形图标，向上箭头）</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 text-xs mt-2">
                    <span>2. 向下滚动，找到</span>
                    <span className="bg-orange-600 text-white px-2 py-1 rounded">"网站设置"</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <span className="bg-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                  在菜单中找到"网站设置"
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-3">
                  点击"..."菜单后，会看到多个选项。找到并点击：
                </p>
                <div className="space-y-2">
                  <div className="bg-slate-700 rounded-lg p-3 border-l-4 border-orange-500">
                    <p className="text-white font-bold text-sm flex items-center gap-2">
                      <i className="fa-solid fa-gear text-orange-500"></i>
                      "网站设置" 或 "位置服务"
                    </p>
                    <p className="text-slate-400 text-[10px] mt-1">通常在菜单的中间位置</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-2 border border-slate-600">
                    <p className="text-slate-400 text-[10px]">
                      💡 如果没看到"网站设置"，也可以尝试点击"分享"按钮，然后向下滚动查找
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <span className="bg-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                  允许定位权限
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed mb-3">
                  在设置页面中找到"位置"选项，选择：
                </p>
                <div className="space-y-2">
                  <div className="bg-green-600/20 border border-green-500 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-check-circle text-green-400"></i>
                      <span className="text-green-400 font-bold text-sm">允许</span>
                    </div>
                  </div>
                  <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 opacity-50">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-times-circle text-slate-400"></i>
                      <span className="text-slate-400 text-sm">拒绝（不要选这个）</span>
                    </div>
                  </div>
                  <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 opacity-50">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-question-circle text-slate-400"></i>
                      <span className="text-slate-400 text-sm">询问（每次都要确认）</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-orange-600/20 border border-orange-500 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-lightbulb text-orange-400 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-orange-300 font-bold text-xs mb-1">⚠️ 通过IP地址访问的限制</p>
                    <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
                      通过 <strong className="text-white">IP地址</strong>（192.168.x.x）访问时，Safari 可能<strong className="text-white">不提供网站级别的权限设置</strong>。这是Safari的安全限制。
                    </p>
                    <p className="text-slate-300 text-[11px] leading-relaxed font-bold">
                      解决方案：请使用下面的"通过系统设置"方法，或者使用HTTPS访问（推荐）。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600/20 border border-blue-500 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-gear text-blue-400 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-blue-300 font-bold text-xs mb-2">🔧 方法三：通过iOS系统设置（适用于IP访问）</p>
                    <div className="space-y-2 text-slate-300 text-[11px] leading-relaxed">
                      <div className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
                        <span>打开 iPhone <strong className="text-white">设置</strong> App</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
                        <span>向下滚动，找到并点击 <strong className="text-white">Safari</strong></span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</span>
                        <span>向下滚动，找到 <strong className="text-white">"隐私与安全性"</strong> 部分</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">4</span>
                        <span>确保 <strong className="text-white">"位置服务"</strong> 已开启</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">5</span>
                        <span>返回应用，点击定位按钮重试</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-600/20 border border-green-500 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-rocket text-green-400 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-green-300 font-bold text-xs mb-1">🚀 推荐方案：使用HTTPS访问</p>
                    <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
                      使用 <strong className="text-white">ngrok</strong> 等工具创建HTTPS隧道，这样Safari会显示锁图标，可以正常设置权限。
                    </p>
                    <div className="bg-slate-700 rounded-lg p-2 mt-2">
                      <p className="text-slate-300 text-[10px] font-mono">
                        # 在电脑终端运行：<br/>
                        ngrok http 3000
                      </p>
                    </div>
                    <p className="text-slate-400 text-[10px] mt-2">
                      然后使用ngrok提供的HTTPS地址访问，Safari会显示锁图标，可以正常设置权限。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600/20 border border-blue-500 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <i className="fa-solid fa-info-circle text-blue-400 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-blue-300 font-bold text-xs mb-1">📱 设置完成后</p>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      返回应用，点击左上角的 <span className="bg-white/20 px-2 py-0.5 rounded">📍 定位按钮</span>，地图会自动跳转到你的当前位置。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="border-t border-slate-700 p-4 flex gap-3">
              <button
                onClick={() => {
                  setShowPermissionGuide(false);
                  requestLocationPermission();
                }}
                className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-location-crosshairs"></i>
                设置完成后重试
              </button>
              <button
                onClick={() => setShowPermissionGuide(false)}
                className="px-6 bg-slate-700 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-600 active:scale-95 transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RideMap;
