import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import {
  getUserSettings,
  loadUserSettings,
  saveUserSettings,
} from "@/lib/settings-storage";
import {
  calculateTotalBytes,
  checkCanDownload,
  downloadDocumentSections,
  loadDownloadsManifest,
  removeDocumentFiles,
  saveDownloadsManifest,
  type DocumentDetail,
  type DownloadedDocument,
  type InFlightDownload,
} from "@/lib/downloads";

export interface DownloadsContextValue {
  downloadedDocuments: DownloadedDocument[];
  inFlightDownloads: Record<number, InFlightDownload>;
  totalDownloadBytes: number;
  downloadOnlyOnWifi: boolean;
  isLoading: boolean;

  setDownloadOnlyOnWifi: (enabled: boolean) => Promise<void>;
  downloadDocument: (doc: DocumentDetail) => Promise<boolean>;
  cancelDownload: (documentId: number) => void;
  deleteDownload: (documentId: number) => Promise<void>;
  isDocumentDownloaded: (documentId: number) => boolean;
  isDocumentDownloading: (documentId: number) => boolean;
  getDownloadedDocument: (documentId: number) => DownloadedDocument | undefined;
  getLocalAudioUri: (sectionId: number) => string | null;
  refreshDownloads: () => Promise<void>;
}

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [downloadedDocuments, setDownloadedDocuments] = useState<DownloadedDocument[]>([]);
  const [inFlightDownloads, setInFlightDownloads] = useState<Record<number, InFlightDownload>>({});
  const [downloadOnlyOnWifi, setDownloadOnlyOnWifiState] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const activeControllersRef = useRef<Record<number, AbortController>>({});

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [manifest, settings] = await Promise.all([
        loadDownloadsManifest(),
        loadUserSettings(),
      ]);
      setDownloadedDocuments(manifest);
      setDownloadOnlyOnWifiState(settings.downloadOnlyOnWifi);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setDownloadOnlyOnWifi = useCallback(async (enabled: boolean) => {
    setDownloadOnlyOnWifiState(enabled);
    await saveUserSettings({ downloadOnlyOnWifi: enabled });
  }, []);

  const totalDownloadBytes = useMemo(() => {
    return calculateTotalBytes(downloadedDocuments);
  }, [downloadedDocuments]);

  const isDocumentDownloaded = useCallback(
    (documentId: number) => {
      return downloadedDocuments.some((d) => d.id === documentId);
    },
    [downloadedDocuments]
  );

  const isDocumentDownloading = useCallback(
    (documentId: number) => {
      return !!inFlightDownloads[documentId];
    },
    [inFlightDownloads]
  );

  const getDownloadedDocument = useCallback(
    (documentId: number) => {
      return downloadedDocuments.find((d) => d.id === documentId);
    },
    [downloadedDocuments]
  );

  const getLocalAudioUri = useCallback(
    (sectionId: number): string | null => {
      for (const doc of downloadedDocuments) {
        const sec = doc.sections.find((s) => s.id === sectionId);
        if (sec) return sec.localUri;
      }
      return null;
    },
    [downloadedDocuments]
  );

  const cancelDownload = useCallback((documentId: number) => {
    const controller = activeControllersRef.current[documentId];
    if (controller) {
      controller.abort();
      delete activeControllersRef.current[documentId];
    }
    setInFlightDownloads((prev) => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
  }, []);

  const deleteDownload = useCallback(
    async (documentId: number) => {
      const doc = downloadedDocuments.find((d) => d.id === documentId);
      if (!doc) return;

      await removeDocumentFiles(doc);
      const updated = downloadedDocuments.filter((d) => d.id !== documentId);
      setDownloadedDocuments(updated);
      await saveDownloadsManifest(updated);
    },
    [downloadedDocuments]
  );

  const downloadDocument = useCallback(
    async (doc: DocumentDetail): Promise<boolean> => {
      // Zaten indirilmişse
      if (isDocumentDownloaded(doc.id)) {
        return true;
      }
      // Zaten indiriliyorsa
      if (isDocumentDownloading(doc.id)) {
        return true;
      }

      // Ağ ve Wi-Fi denetimi
      const canDownload = await checkCanDownload();
      if (!canDownload.allowed) {
        Alert.alert("İndirme Yapılamıyor", canDownload.reason, [
          { text: "Tamam", style: "default" },
        ]);
        return false;
      }

      const controller = new AbortController();
      activeControllersRef.current[doc.id] = controller;

      try {
        const completedDoc = await downloadDocumentSections(doc, {
          signal: controller.signal,
          onProgress: (inFlight) => {
            setInFlightDownloads((prev) => ({
              ...prev,
              [doc.id]: inFlight,
            }));
          },
        });

        const updatedList = [
          ...downloadedDocuments.filter((d) => d.id !== doc.id),
          completedDoc,
        ];
        setDownloadedDocuments(updatedList);
        await saveDownloadsManifest(updatedList);
        return true;
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : "İndirme sırasında bir hata oluştu.";
          Alert.alert("İndirme Hatası", msg, [{ text: "Tamam" }]);
        }
        return false;
      } finally {
        delete activeControllersRef.current[doc.id];
        setInFlightDownloads((prev) => {
          const next = { ...prev };
          delete next[doc.id];
          return next;
        });
      }
    },
    [downloadedDocuments, isDocumentDownloaded, isDocumentDownloading]
  );

  const value: DownloadsContextValue = useMemo(
    () => ({
      downloadedDocuments,
      inFlightDownloads,
      totalDownloadBytes,
      downloadOnlyOnWifi,
      isLoading,
      setDownloadOnlyOnWifi,
      downloadDocument,
      cancelDownload,
      deleteDownload,
      isDocumentDownloaded,
      isDocumentDownloading,
      getDownloadedDocument,
      getLocalAudioUri,
      refreshDownloads: loadData,
    }),
    [
      downloadedDocuments,
      inFlightDownloads,
      totalDownloadBytes,
      downloadOnlyOnWifi,
      isLoading,
      setDownloadOnlyOnWifi,
      downloadDocument,
      cancelDownload,
      deleteDownload,
      isDocumentDownloaded,
      isDocumentDownloading,
      getDownloadedDocument,
      getLocalAudioUri,
      loadData,
    ]
  );

  return (
    <DownloadsContext.Provider value={value}>
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads(): DownloadsContextValue {
  const context = useContext(DownloadsContext);
  if (!context) {
    throw new Error("useDownloads must be used within a DownloadProvider");
  }
  return context;
}
