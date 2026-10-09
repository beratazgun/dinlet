import { useCallback, useEffect, useState } from "react";
import { setAudioModeAsync } from "expo-audio";
import { usePlayer } from "@/context";
import { useClipPlayer } from "@/hooks/use-clip-player";
import { resolveAudioUrl } from "@/lib/audio-url";

/**
 * Tek bir kısa sesi (mağaza örneği, kayıt klibi) dinletir; aynı anahtara
 * tekrar basınca durur. Ana oynatıcı çalıyorsa önce duraklatılır.
 */
export function useSamplePlayer() {
  const { play, stop } = useClipPlayer();
  const player = usePlayer();
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const toggle = useCallback(
    async (key: string, url: string | null | undefined) => {
      if (playingKey === key) {
        stop();
        setPlayingKey(null);
        return;
      }
      const uri = resolveAudioUrl(url);
      if (!uri) return;
      if (player.isPlaying) await player.pause();
      // Kayıt ekranından gelindiyse ses hoparlörden çalsın.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setPlayingKey(key);
      const finished = await play(uri);
      if (finished) setPlayingKey((current) => (current === key ? null : current));
    },
    [play, player, playingKey, stop]
  );

  const stopSample = useCallback(() => {
    stop();
    setPlayingKey(null);
  }, [stop]);

  useEffect(() => stopSample, [stopSample]);

  return { playingKey, toggle, stop: stopSample };
}
