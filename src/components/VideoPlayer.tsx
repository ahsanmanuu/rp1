"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Loader2, AlertCircle } from "lucide-react";

interface VideoSource {
  src: string;
  quality: string;
  label: string;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  sources?: VideoSource[];
  autoPlay?: boolean;
  onClose?: () => void;
  className?: string;
}

function getConnectionSpeed(): number {
  if (typeof navigator === 'undefined') return 10;
  const conn = (navigator as any).connection;
  if (!conn) return 10;
  if (conn.downlink) return conn.downlink;
  return conn.effectiveType === '4g' ? 10 : conn.effectiveType === '3g' ? 3 : 1;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, poster, sources, autoPlay = false, onClose, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [networkSpeed] = useState(getConnectionSpeed);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  const currentSrc = sources?.find(s => s.quality === currentQuality)?.src || src;

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (isPlaying) {
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, []);

  useEffect(() => {
    if (networkSpeed < 2 && currentQuality === 'auto' && sources && sources.length > 1) {
      const sorted = [...sources].sort((a, b) => parseInt(a.quality) - parseInt(b.quality));
      setCurrentQuality(sorted[0].quality);
    }
  }, [networkSpeed, sources, currentQuality]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || error) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    showControlsTemporarily();
  }, [error, showControlsTemporarily]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      if (autoPlay) {
        video.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleProgress = () => {
    const video = videoRef.current;
    if (video) {
      setIsBuffering(video.buffered.length === 0 || video.readyState < 3);
    }
  };

  const handleError = () => {
    const video = videoRef.current;
    if (video?.error) {
      const messages: Record<number, string> = {
        1: 'Video loading cancelled.',
        2: 'Network error. Please check your connection.',
        3: 'Video decoding failed. The file may be corrupted.',
        4: 'Video format not supported by your browser.',
      };
      setError(messages[video.error.code] || 'An unknown error occurred while loading the video.');
    } else {
      setError('Failed to load video. Please try again.');
    }
    setIsPlaying(false);
  };

  const handleWaiting = () => setIsBuffering(true);
  const handleCanPlay = () => setIsBuffering(false);
  const handleEnded = () => {
    setIsPlaying(false);
    showControlsTemporarily();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress || error) return;
    const rect = progress.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * duration;
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const v = parseFloat(e.target.value);
    video.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
    if (e.key === 'f') { e.preventDefault(); toggleFullscreen(); }
    if (e.key === 'm') { e.preventDefault(); toggleMute(); }
    if (e.key === 'Escape' && onClose && !document.fullscreenElement) { onClose(); }
    if (e.key === 'ArrowRight') { const v = videoRef.current; if (v) v.currentTime = Math.min(v.currentTime + 10, duration); }
    if (e.key === 'ArrowLeft') { const v = videoRef.current; if (v) v.currentTime = Math.max(v.currentTime - 10, 0); }
    if (e.key === 'ArrowUp') { const v = videoRef.current; if (v) { v.volume = Math.min(v.volume + 0.1, 1); setVolume(v.volume); } }
    if (e.key === 'ArrowDown') { const v = videoRef.current; if (v) { v.volume = Math.max(v.volume - 0.1, 0); setVolume(v.volume); } }
  };

  if (error) {
    return (
      <div className={`relative bg-black rounded-2xl overflow-hidden ${className}`} style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white p-8 text-center">
          <AlertCircle size={48} className="text-red-400" />
          <p className="text-lg font-bold">Playback Error</p>
          <p className="text-sm opacity-70 max-w-md">{error}</p>
          {onClose && (
            <button onClick={onClose} className="px-6 py-2 bg-white/20 rounded-xl text-sm font-bold hover:bg-white/30 transition-all">Close</button>
          )}
          <button onClick={() => { setError(null); videoRef.current?.load(); }} className="px-6 py-2 bg-white/20 rounded-xl text-sm font-bold hover:bg-white/30 transition-all">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-2xl overflow-hidden group select-none ${className}`}
      style={{ aspectRatio: '16/9' }}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); setShowSettings(false); setShowVolumeSlider(false); }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        src={currentSrc}
        poster={poster}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onProgress={handleProgress}
        onError={handleError}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        playsInline
        preload="metadata"
      />

      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={togglePlay}>
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
            <Play size={36} fill="#000" style={{ color: '#000', marginLeft: 4 }} />
          </div>
        </div>
      )}

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <Loader2 size={40} className="text-white animate-spin" />
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3 px-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div
          ref={progressRef}
          className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/progress mb-3 hover:h-2.5 transition-all"
          onClick={seek}
        >
          <div className="absolute inset-y-0 left-0 bg-primary-joy rounded-full" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
          <div className="absolute inset-y-0 left-0 bg-white/40 rounded-full" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 7px)` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="text-white hover:text-primary-joy transition-colors" title={isPlaying ? 'Pause (k)' : 'Play (k)'}>
            {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
          </button>

          <div className="relative"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button onClick={toggleMute} className="text-white hover:text-primary-joy transition-colors" title="Mute (m)">
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            {showVolumeSlider && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/90 rounded-lg shadow-xl">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1.5 accent-primary-joy appearance-none bg-white/20 rounded-full cursor-pointer"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                />
              </div>
            )}
          </div>

          <span className="text-white/80 text-xs font-medium tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {networkSpeed < 3 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-medium" title="Slow network detected. Lower quality may be used for smoother playback.">
              Slow Network
            </span>
          )}

          <div className="flex-1" />

          {sources && sources.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-primary-joy transition-colors"
                title="Quality"
              >
                <Settings size={18} />
              </button>
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/95 rounded-xl py-2 shadow-2xl border border-white/10 min-w-[180px]">
                  <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40">Quality</div>
                  <button
                    onClick={() => { setCurrentQuality('auto'); setShowSettings(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${currentQuality === 'auto' ? 'text-primary-joy bg-white/10' : 'text-white/70 hover:bg-white/5'}`}
                  >
                    Auto {currentQuality === 'auto' && networkSpeed < 3 ? '(Low)' : ''}
                  </button>
                  {sources.map((s) => (
                    <button
                      key={s.quality}
                      onClick={() => { setCurrentQuality(s.quality); setShowSettings(false); }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${currentQuality === s.quality ? 'text-primary-joy bg-white/10' : 'text-white/70 hover:bg-white/5'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={toggleFullscreen} className="text-white hover:text-primary-joy transition-colors" title="Fullscreen (f)">
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
