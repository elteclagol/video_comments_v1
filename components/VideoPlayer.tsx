import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
  Text,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface VideoPlayerProps {
  uri: string;
  isPlaying: boolean;
  isTapEnabled?: boolean;
  onProgress?: (info: { positionMillis: number; durationMillis: number }) => void;
  onEnd?: () => void;
}

export default function VideoPlayer({ uri, isPlaying, isTapEnabled = true, onProgress, onEnd }: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isVideoPaused, setIsVideoPaused] = useState<boolean>(false);
  const [overlayIsPlaying, setOverlayIsPlaying] = useState<boolean | null>(null);
  const webVideoRef = useRef<any>(null);
  const [webIsPlaying, setWebIsPlaying] = useState<boolean>(false);

  const isWeb = Platform.select({ web: true, default: false });

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.log('Error configuring audio:', error);
      }
    };

    if (!isWeb) {
      configureAudio();
    }
  }, [isWeb]);

  useEffect(() => {
    if (isWeb) {
      const v = webVideoRef.current as HTMLVideoElement | null;
      if (v) {
        try {
          if (isPlaying && !isVideoPaused) {
            const playPromise = v.play?.();
            if (playPromise && typeof (playPromise as any).then === 'function') {
              (playPromise as Promise<void>)
                .then(() => setWebIsPlaying(true))
                .catch((err) => {
                  console.log('Web play blocked', err);
                  setWebIsPlaying(false);
                });
            } else {
              setWebIsPlaying(true);
            }
          } else {
            v.pause?.();
            setWebIsPlaying(false);
          }
        } catch (e) {
          console.log('Web video play/pause error', e);
        }
      }
      return;
    }
    if (videoRef.current) {
      if (isPlaying && !isVideoPaused) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isPlaying, isVideoPaused, isWeb]);

  const handlePlaybackStatusUpdate = (newStatus: AVPlaybackStatus) => {
    setStatus(newStatus);
    if ((newStatus as any).isLoaded) {
      setIsLoading(false);
      const s = newStatus as any;
      const position = typeof s.positionMillis === 'number' ? s.positionMillis : 0;
      const duration = typeof s.durationMillis === 'number' ? s.durationMillis : 0;
      if (onProgress) {
        onProgress({ positionMillis: position, durationMillis: duration });
      }
    }
  };

  const isStatusLoaded = (s: AVPlaybackStatus | null): s is AVPlaybackStatus & { isLoaded: true } => {
    return !!s && 'isLoaded' in s && (s as any).isLoaded === true;
  };

  useEffect(() => {
    if (isStatusLoaded(status)) {
      const s: any = status;
      if (s.didJustFinish) {
        if (onEnd) onEnd();
      }
    }
  }, [status, onEnd]);

  const togglePlayPause = () => {
    if (isWeb) {
      const v = webVideoRef.current as HTMLVideoElement | null;
      if (v) {
        const nextShouldPlay = !(webIsPlaying || false);
        setOverlayIsPlaying(nextShouldPlay);
        try {
          if (nextShouldPlay) {
            const playPromise = v.play?.();
            if (playPromise && typeof (playPromise as any).then === 'function') {
              (playPromise as Promise<void>)
                .then(() => setWebIsPlaying(true))
                .catch(() => setWebIsPlaying(false));
            } else {
              setWebIsPlaying(true);
            }
          } else {
            v.pause?.();
            setWebIsPlaying(false);
          }
        } catch (e) {
          console.log('Web toggle error', e);
        }
        setShowControls(true);
        setTimeout(() => {
          setShowControls(false);
          setOverlayIsPlaying(null);
        }, 800);
      }
      return;
    }
    if (videoRef.current && isStatusLoaded(status)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const nextShouldPlay = !status.isPlaying;
      setOverlayIsPlaying(nextShouldPlay);
      if (nextShouldPlay) {
        videoRef.current.playAsync();
        setIsVideoPaused(false);
      } else {
        videoRef.current.pauseAsync();
        setIsVideoPaused(true);
      }
      setShowControls(true);
      setTimeout(() => {
        setShowControls(false);
        setOverlayIsPlaying(null);
      }, 1200);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      // Haptic feedback for mute/unmute
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      const v = webVideoRef.current as HTMLVideoElement | null;
      if (!v) return;
      const handleTime = () => {
        if (!onProgress) return;
        const positionMillis = Math.floor((v.currentTime ?? 0) * 1000);
        const durationMillis = Math.floor((v.duration && isFinite(v.duration) ? v.duration : 0) * 1000);
        onProgress({ positionMillis, durationMillis });
      };
      const handleEnded = () => {
        if (onEnd) onEnd();
      };
      v.addEventListener('timeupdate', handleTime);
      v.addEventListener('loadedmetadata', handleTime);
      v.addEventListener('ended', handleEnded);
      return () => {
        v.removeEventListener('timeupdate', handleTime);
        v.removeEventListener('loadedmetadata', handleTime);
        v.removeEventListener('ended', handleEnded);
      };
    }
  }, [onProgress]);

  return (
    <TouchableWithoutFeedback onPress={togglePlayPause} disabled={!isTapEnabled}>
      <View style={styles.container} testID="video-player-container">
        {Platform.OS === 'web' ? (
          <View style={styles.webFallback}>
            <View style={styles.webVideoContainer}>
              <video
                ref={webVideoRef}
                src={uri}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                muted
                playsInline
                preload="metadata"
                autoPlay={isPlaying && !isVideoPaused}
              />
            </View>
            {!webIsPlaying && (
              <View style={styles.webOverlay} pointerEvents="none">
                <Play size={48} color="white" fill="white" />
                <Text style={styles.webText}>Tap to play video</Text>
              </View>
            )}
            <View style={styles.topSeekContainer} pointerEvents="box-none">
              <View style={styles.seekButtonsRow}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    const v = webVideoRef.current as HTMLVideoElement | null;
                    if (v) {
                      const target = Math.max(0, (v.currentTime ?? 0) - 15);
                      v.currentTime = target;
                    }
                  }}
                >
                  <View style={styles.seekButton} testID="seek-back-15">
                    <RotateCcw size={20} color="white" />
                    <Text style={styles.seekLabel}>15s</Text>
                  </View>
                </TouchableWithoutFeedback>

                <TouchableWithoutFeedback
                  onPress={() => {
                    const v = webVideoRef.current as HTMLVideoElement | null;
                    if (v) {
                      const duration = isFinite(v.duration) ? v.duration : 0;
                      const target = Math.min(duration, (v.currentTime ?? 0) + 15);
                      v.currentTime = target;
                    }
                  }}
                >
                  <View style={styles.seekButton} testID="seek-forward-15">
                    <RotateCw size={20} color="white" />
                    <Text style={styles.seekLabel}>15s</Text>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </View>
          </View>
        ) : (
          <>
            <Video
              ref={videoRef}
              source={{ uri }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isPlaying && !isVideoPaused}
              isMuted={isMuted}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              usePoster={false}
            />

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="white" />
              </View>
            )}

            {(() => {
              const playing = isWeb ? webIsPlaying : (isStatusLoaded(status) ? status.isPlaying : false);
              if (!playing) {
                return (
                  <View style={styles.controlsOverlay}>
                    <Play size={48} color="white" fill="white" />
                  </View>
                );
              }
              if (showControls && (isStatusLoaded(status) || isWeb)) {
                return (
                  <View style={styles.controlsOverlay}>
                    {playing ? (
                      <Pause size={48} color="white" fill="white" />
                    ) : (
                      <Play size={48} color="white" fill="white" />
                    )}
                  </View>
                );
              }
              return null;
            })()}

            <View style={styles.topSeekContainer} pointerEvents="box-none">
              <View style={styles.seekButtonsRow}>
                <TouchableWithoutFeedback
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      const v = webVideoRef.current as HTMLVideoElement | null;
                      if (v) {
                        const target = Math.max(0, (v.currentTime ?? 0) - 15);
                        v.currentTime = target;
                      }
                    } else if (videoRef.current && isStatusLoaded(status)) {
                      const s: any = status;
                      const current = typeof s.positionMillis === 'number' ? s.positionMillis : 0;
                      const target = Math.max(0, current - 15000);
                      videoRef.current.setPositionAsync(target);
                    }
                  }}
                >
                  <View style={styles.seekButton} testID="seek-back-15">
                    <RotateCcw size={20} color="white" />
                    <Text style={styles.seekLabel}>15s</Text>
                  </View>
                </TouchableWithoutFeedback>

                <TouchableWithoutFeedback
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      const v = webVideoRef.current as HTMLVideoElement | null;
                      if (v) {
                        const duration = isFinite(v.duration) ? v.duration : 0;
                        const target = Math.min(duration, (v.currentTime ?? 0) + 15);
                        v.currentTime = target;
                      }
                    } else if (videoRef.current && isStatusLoaded(status)) {
                      const s: any = status;
                      const current = typeof s.positionMillis === 'number' ? s.positionMillis : 0;
                      const duration = typeof s.durationMillis === 'number' ? s.durationMillis : 0;
                      const target = Math.min(duration, current + 15000);
                      videoRef.current.setPositionAsync(target);
                    }
                  }}
                >
                  <View style={styles.seekButton} testID="seek-forward-15">
                    <RotateCw size={20} color="white" />
                    <Text style={styles.seekLabel}>15s</Text>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </View>
          </>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webFallback: {
    flex: 1,
    position: 'relative',
  },
  webVideoContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  webText: {
    color: 'white',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  topSeekContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  seekButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  seekButton: {
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    marginRight: 12,
    marginBottom: 8,
  },
  seekLabel: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
  },
});