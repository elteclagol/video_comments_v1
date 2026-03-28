import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  KeyboardEvent,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SkipForward, ArrowUp } from 'lucide-react-native';

import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { mockVideos } from '@/mocks/videos';
import { mockComments } from '@/mocks/comments';
import type { Comment } from '@/types/video';
import VideoPlayer from '@/components/VideoPlayer';

export default function VideoScreen() {
  const [commentText, setCommentText] = useState<string>('');
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [playing, setPlaying] = useState<boolean>(true);
  const currentVideo = mockVideos[0];
  const commentSectionAnimation = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ positionMillis: number; durationMillis: number }>({ positionMillis: 0, durationMillis: 0 });
  const [scrollY, setScrollY] = useState<number>(0);
  const [commentYMap, setCommentYMap] = useState<Record<string, number>>({});
  const commentInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      } catch (e) {
        console.log('Initial scrollToEnd failed', e);
      }
    }, 50);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardWillShowListener = Keyboard.addListener(
      showEvent,
      (event: KeyboardEvent) => {
        const { endCoordinates, duration } = event;
        const height = endCoordinates.height;
        Animated.timing(commentSectionAnimation, {
          toValue: -height,
          duration: Platform.OS === 'ios' ? duration ?? 250 : 250,
          useNativeDriver: false,
        }).start();
        setKeyboardVisible(true);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      hideEvent,
      (event: KeyboardEvent) => {
        const duration = Platform.OS === 'ios' ? event.duration ?? 250 : 250;
        Animated.timing(commentSectionAnimation, {
          toValue: 0,
          duration,
          useNativeDriver: false,
        }).start();
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, [commentSectionAnimation]);

  const getSpanishTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) {
      return 'ahora';
    } else if (diffInMinutes < 60) {
      return `hace ${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `hace ${diffInHours}h`;
    } else if (diffInDays === 1) {
      return 'hace 1 día';
    } else {
      return `hace ${diffInDays} días`;
    }
  };

  const sendComment = () => {
    if (commentText.trim()) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const now = new Date();
      const timeString = getSpanishTimeAgo(now);
      const newComment: Comment = {
        id: Date.now().toString(),
        username: 'current_user',
        text: commentText.trim(),
        timestamp: timeString,
        likes: 0,
        avatar: 'https://i.pravatar.cc/150?img=10',
      };
      setComments([...comments, newComment]);
      setCommentText('');
      try {
        commentInputRef.current?.clear?.();
        commentInputRef.current?.setNativeProps?.({ text: '' });
      } catch (e) {
        console.log('Failed to clear input via ref', e);
      }
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const skipIntro = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPlaying(false);
    router.push('/hello');
  };

  const handleScreenTap = () => {
    Keyboard.dismiss();
  };

  const handleCommentsSectionTap = () => {
    if (keyboardVisible) {
      Keyboard.dismiss();
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      setPlaying(true);
      return () => {
        setPlaying(false);
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <TouchableWithoutFeedback onPress={handleScreenTap}>
        <View style={{ flex: 1 }}>
          <VideoPlayer
            uri={currentVideo.videoUrl}
            isPlaying={playing}
            isTapEnabled={!keyboardVisible}
            onProgress={(p) => {
              setProgress(p);
            }}
            onEnd={() => {
              try {
                setPlaying(false);
              } catch (e) {
                console.log('Failed to set playing false on end', e);
              }
              router.push('/hello');
            }}
          />
        </View>
      </TouchableWithoutFeedback>

      {keyboardVisible && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={StyleSheet.absoluteFill} pointerEvents="auto" testID="keyboard-dismiss-overlay" />
        </TouchableWithoutFeedback>
      )}

      <TouchableOpacity style={styles.skipButton} onPress={skipIntro}>
        <SkipForward size={16} color="white" style={styles.skipIcon} />
        <Text style={styles.skipButtonText}>
          {(() => {
            const remaining = Math.max(0, (progress.durationMillis || 0) - (progress.positionMillis || 0));
            const totalSeconds = Math.floor(remaining / 1000);
            const min = Math.floor(totalSeconds / 60);
            const sec = totalSeconds % 60;
            const minStr = min > 0 ? `${min}m` : '';
            const secStr = `${sec}s`;
            const suffix = minStr ? `${minStr} ${secStr}` : secStr;
            return `Saltear intro · ${suffix}`;
          })()}
        </Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.bottomContainer,
          {
            transform: [{ translateY: commentSectionAnimation }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.9)", "rgba(0,0,0,0.6)", "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.bottomGradient}
          pointerEvents="none"
          testID="bottom-safe-gradient"
        />
        <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea} testID="bottom-safe-area">
            <View style={styles.commentsSection}>
              <View style={styles.commentsContainer}>



                <ScrollView
                  ref={scrollViewRef}
                  showsVerticalScrollIndicator={false}
                  style={styles.commentsList}
                  contentContainerStyle={styles.commentsListContent}
                  scrollEnabled={true}
                  alwaysBounceVertical={true}
                  bounces={true}
                  overScrollMode="always"
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  onStartShouldSetResponderCapture={() => true}
                  onMoveShouldSetResponderCapture={() => true}
                  onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset?.y ?? 0;
                    setScrollY(y);
                  }}
                  onContentSizeChange={() => {
                    try {
                      scrollViewRef.current?.scrollToEnd({ animated: false });
                    } catch (e) {
                      console.log('onContentSizeChange scrollToEnd failed', e);
                    }
                  }}
                  scrollEventThrottle={16}
                  testID="comments-scroll"
                >
                {comments.map((item) => {
                  const y = commentYMap[item.id] ?? Number.MAX_SAFE_INTEGER;
                  const fadeHeight = 48;
                  const distance = y - scrollY;
                  const opacity = distance <= 0 ? 0 : distance < fadeHeight ? distance / fadeHeight : 1;

                  return (
                    <View
                      key={item.id}
                      style={[styles.commentItem, { opacity }]}
                      testID="comment-item"
                      onLayout={(e) => {
                        const ly = e.nativeEvent.layout?.y ?? 0;
                        setCommentYMap((prev) => ({ ...prev, [item.id]: ly }));
                      }}
                    >
                      <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentUsername}>{item.username}</Text>
                          <Text style={styles.commentTime}>{item.timestamp}</Text>
                        </View>
                        <Text style={styles.commentText}>{item.text}</Text>
                      </View>
                    </View>
                  );
                })}
                </ScrollView>
              </View>
              
              <TouchableWithoutFeedback onPress={handleCommentsSectionTap}>
              <View style={styles.commentInputContainer}>
              <TextInput
                ref={commentInputRef}
                style={styles.commentInput}
                placeholder="Deja un comentario..."
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={100}
                testID="comment-input"
                blurOnSubmit={false}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={sendComment}
                disabled={!commentText.trim()}
                style={[
                  styles.sendButton,
                  !commentText.trim() && styles.sendButtonDisabled,
                ]}
                testID="send-comment"
              >
                <ArrowUp size={22} color="white" />
              </TouchableOpacity>
              </View>
              </TouchableWithoutFeedback>
            </View>
        </SafeAreaView>
      </Animated.View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomSafeArea: {
    backgroundColor: 'transparent',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  commentsSection: {
    backgroundColor: 'transparent',
  },
  commentsGradient: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  commentsContainer: {
    height: 207,
    paddingHorizontal: 16,
    paddingTop: 20,
    position: 'relative',
  },

  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    justifyContent: 'flex-end',
    minHeight: 0,
    paddingBottom: 0,
    paddingTop: 48,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 0,
    paddingLeft: 14,
    paddingRight: 14,
    backgroundColor: 'transparent',
    borderRadius: 0,
    marginBottom: 8,
    alignItems: 'flex-start',
  },

  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontWeight: '600',
    fontSize: 12,
    color: 'white',
    marginBottom: 1,
  },
  commentText: {
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },

  commentInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
    borderRadius: 18,
    color: 'white',
  },
  sendButton: {
    marginLeft: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF7A00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sendButtonTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  skipButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  skipIcon: {
    marginRight: 6,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 8,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 2,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  }
});