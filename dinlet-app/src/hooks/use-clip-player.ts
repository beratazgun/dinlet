import { useCallback, useEffect, useRef } from "react";
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from "expo-audio";

/**
 * Kısa sesleri (tekrar özeti, soru, cevap) sırayla çalmak için: `play`
 * ses bitince çözülür; `stop` çalanı keser ve bekleyeni iptal eder.
 */
export function useClipPlayer() {
  const playerRef = useRef<AudioPlayer | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    if (player) {
      player.pause();
      player.remove();
    }
  }, []);

  /** Sesi çalar; bitince `true`, durdurulursa `false` döner. */
  const play = useCallback(
    (url: string, rate = 1) =>
      new Promise<boolean>((resolve) => {
        stop();
        const player = createAudioPlayer({ uri: url }, { updateInterval: 200 });
        playerRef.current = player;
        player.setPlaybackRate(rate);
        let settled = false;
        const finish = (completed: boolean) => {
          if (settled) return;
          settled = true;
          subscription.remove();
          resolve(completed);
        };
        const subscription = player.addListener(
          "playbackStatusUpdate",
          (status: AudioStatus) => {
            if (status.didJustFinish) finish(true);
          }
        );
        cancelRef.current = () => finish(false);
        player.play();
      }),
    [stop]
  );

  useEffect(() => stop, [stop]);

  return { play, stop };
}
