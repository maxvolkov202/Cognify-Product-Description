import { useRef, useState, useEffect } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  permissionDenied: boolean;
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
    permissionDenied: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopAllTracks();
    };
  }, []);

  // Derive audioUrl from audioBlob
  useEffect(() => {
    if (state.audioBlob) {
      const url = URL.createObjectURL(state.audioBlob);
      setState(prev => ({ ...prev, audioUrl: url }));
      return () => URL.revokeObjectURL(url);
    }
  }, [state.audioBlob]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setState(prev => ({
        ...prev,
        recordingTime: prev.recordingTime + 1,
      }));
    }, 1000);
  };

  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      // Reset state
      chunksRef.current = [];
      setState(prev => ({
        ...prev,
        isRecording: false,
        audioBlob: null,
        audioUrl: null,
        error: null,
        permissionDenied: false,
        recordingTime: 0,
      }));

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Collect chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle stop event
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setState(prev => ({
          ...prev,
          audioBlob: blob,
          isRecording: false,
        }));
        stopAllTracks();
        stopTimer();
      };

      // Start recording
      mediaRecorder.start();
      setState(prev => ({ ...prev, isRecording: true }));
      startTimer();
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setState(prev => ({
          ...prev,
          error: 'Microphone permission denied',
          permissionDenied: true,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Failed to access microphone',
        }));
      }
      stopAllTracks();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const clearRecording = () => {
    stopTimer();
    stopAllTracks();
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    chunksRef.current = [];
    
    setState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioBlob: null,
      audioUrl: null,
      error: null,
      permissionDenied: false,
    });
  };

  return {
    ...state,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
