import { useModerateImage } from '@/lib/useModerate';
import { useI18n } from '@/lib/i18n';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
launchImageLibraryAsync,
requestMediaLibraryPermissionsAsync,
type ImagePickerAsset,
} from 'expo-image-picker';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import React,{ useCallback,useEffect,useRef,useState } from 'react';
import {
Alert,
Pressable,
StyleSheet,
Text,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIImageSheet } from '@/components/ai/AIImageSheet';
import { MusicPickerSheet } from '@/components/camera/MusicPickerSheet';
import type { PostSettingsState } from '@/components/create';
import { CreateProgressBar } from '@/components/create';
import {
  AdjustSheet,
  type AdjustValues,
  CoverPickerSheet,
  CropSheet,
  DetailsSheet,
  DrawCanvas,
  DrawToolbar,
  type DrawnPath,
  FilterSheet,
  isInTrash,
  PostSuccessOverlay,
  RotateSheet,
  type RotateState,
  SchedulerModal,
  SkiaFilteredImage,
  StickerOverlayItem,
  StickerSheet,
  SH,
  SW,
  Svg,
  SvgPath,
  TextOverlayEditor,
  TextOverlayItem,
  type TextOverlay,
  TrashZone,
  type TrimResult,
  VideoTrimSheet,
} from '@/components/create/editor';
import { useAuthStore } from '@/lib/authStore';
import type { ColorFilterId } from '@/lib/cameraFilters';
import { supabase } from '@/lib/supabase';
import ViewShot from 'react-native-view-shot';
import { bakeImageEdits } from '@/lib/bakeImageEdits';
import { generateAndUploadThumbnail,uploadPostMedia } from '@/lib/uploadMedia';
import { useDrafts } from '@/lib/useDrafts';
import type { MusicTrack } from '@/lib/useMusicPicker';
import { MUSIC_LIBRARY } from '@/lib/useMusicPicker';
import { usePostDraftsCloud } from '@/lib/usePostDraftsCloud';
import { useScheduledPosts } from '@/lib/useScheduledPosts';
import { useMyProducts } from '@/lib/useShop';
import { useQueryClient } from '@tanstack/react-query';
import { useVideoPlayer,VideoView } from 'expo-video';
import {
  ChevronRight,
  Crop,
  Image as CoverIcon,
  Music2,
  Palette,
  RotateCw,
  Scissors,
  Settings2,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Type,
  X,
} from 'lucide-react-native';

// ─── Haupt-Screen ────────────────────────────────────────────────────────────
export default function CreatePostScreen() {
  const { t: tr } = useI18n();
  useThemedStatusBar('light');
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const { saveDraft } = useDrafts();
  const { moderate } = useModerateImage();
  // v1.20 — Cloud-Drafts + Scheduled-Posts
  const { saveDraft: saveCloudDraft, fetchDraft, deleteDraft: deleteCloudDraft } = usePostDraftsCloud();
  const { schedulePost } = useScheduledPosts();

  const { mediaUri, mediaType: mediaTypeParam, caption: captionParam,
          audioUrl, audioVolume: audioVolumeParam,
          draftId } =
    useLocalSearchParams<{
      mediaUri?: string; mediaType?: string; caption?: string;
      audioUrl?: string; audioVolume?: string;
      draftId?: string;
    }>();

  // Media
  const initialAsset: ImagePickerAsset | null = mediaUri
    ? { uri: mediaUri, type: (mediaTypeParam as 'image' | 'video') ?? 'image',
        width:0, height:0, assetId:null, base64:null, duration:null, exif:null,
        fileName:null, fileSize:undefined, mimeType: mediaTypeParam==='video' ? 'video/mp4' : 'image/jpeg' }
    : null;
  const [image, setImage] = useState<ImagePickerAsset | null>(initialAsset);

  // Caption & Tags (bearbeitet im DetailsSheet)
  const [caption, setCaption]           = useState(captionParam ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Shoppable Posts (#2): optionales Produkt zum Verknüpfen (eigene Shop-Produkte).
  const { data: myProducts = [] } = useMyProducts();
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null);
  const [postSettings, setPostSettings] = useState<PostSettingsState>({
    privacy: 'public', allowComments: true, allowDownload: true, allowDuet: true, womenOnly: false,
  });

  // Upload
  const [uploading, setUploading]   = useState(false);
  const [uploadPct, setUploadPct]   = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // v1.20 — Cloud-Draft + Scheduled-Post Cache (vermeidet Re-Upload)
  const [activeCloudDraftId, setActiveCloudDraftId] = useState<string | null>(null);
  const uploadedMediaRef     = useRef<{ url: string | null; thumbnailUrl: string | null }>({ url: null, thumbnailUrl: null });
  const [showScheduler, setShowScheduler]    = useState(false);
  const [schedulingBusy, setSchedulingBusy]  = useState(false);
  const [draftSavingBusy, setDraftSavingBusy] = useState(false);
  const hydratedRef = useRef(false);

  // Musik
  const initialAudioUrl    = audioUrl && audioUrl.startsWith('http') ? audioUrl : null;
  const initialAudioVolume = audioVolumeParam ? Math.max(0, Math.min(1, parseFloat(audioVolumeParam))) : 0.8;
  const [currentAudioTrack, setCurrentAudioTrack] = useState<MusicTrack | null>(
    () => MUSIC_LIBRARY.find((t) => t.url === initialAudioUrl) ?? null
  );
  const [currentAudioVolume, setCurrentAudioVolume] = useState(initialAudioVolume);

  // UI-State
  const [showMusicPicker, setShowMusicPicker]   = useState(false);
  const [showDetails, setShowDetails]           = useState(false);
  const [showTextEditor, setShowTextEditor]     = useState(false);
  const [showTrimSheet, setShowTrimSheet]       = useState(false);
  const [showStickerSheet, setShowStickerSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet]   = useState(false);
  const [showAdjustSheet, setShowAdjustSheet]   = useState(false);
  const [showRotateSheet, setShowRotateSheet]   = useState(false);
  const [showCropSheet, setShowCropSheet]       = useState(false);
  const [showCoverSheet, setShowCoverSheet]     = useState(false);
  const [coverTimeMs, setCoverTimeMs]           = useState(0);

  // ── View-Shot Compositing (Text/Sticker ins Bild brennen) ──────────────
  const shotRef = useRef<ViewShot>(null);
  const [capturing, setCapturing]               = useState(false);  // swap Skia→normales Bild während Capture
  const [captureUri, setCaptureUri]             = useState<string | null>(null);
  const [textOverlays, setTextOverlays]         = useState<TextOverlay[]>([]);
  const [stickerOverlays, setStickerOverlays]   = useState<{ id: string; url: string; x: number; y: number }[]>([]);
  const [activeFilter, setActiveFilter]         = useState<ColorFilterId | null>(null);
  const [adjustValues, setAdjustValues]         = useState<AdjustValues>({ brightness: 0, contrast: 0, saturation: 0 });
  const [rotateState, setRotateState]           = useState<RotateState>({ rotation: 0, flipH: false });
  const [trimResult, setTrimResult]             = useState<TrimResult | null>(null);
  const [isDrawMode, setIsDrawMode]             = useState(false);
  const [drawnPaths, setDrawnPaths]             = useState<DrawnPath[]>([]);
  const [drawColor, setDrawColor]               = useState('#fff');
  const [drawWidth, setDrawWidth]               = useState(6);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isTrashHovered, setIsTrashHovered]       = useState(false);
  const isTrashHoveredRef = useRef(false);

  // Video-Player für Inline-Vorschau
  const videoPlayer = useVideoPlayer(mediaTypeParam === 'video' ? (mediaUri ?? '') : '', (p) => {
    p.loop = true; p.play();
  });

  // v1.20 — Hydrate von Cloud-Draft (?draftId=…)
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!draftId) return;
    (async () => {
      const d = await fetchDraft(draftId);
      if (!d) return;
      hydratedRef.current = true;
      setActiveCloudDraftId(d.id);
      setCaption(d.caption ?? '');
      setSelectedTags(d.tags);
      if (d.mediaUrl) {
        setImage({
          uri: d.mediaUrl,
          type: d.mediaType === 'video' ? 'video' : 'image',
          width: 0, height: 0, assetId: null, base64: null, duration: null, exif: null,
          fileName: null, fileSize: undefined,
          mimeType: d.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        });
        uploadedMediaRef.current = { url: d.mediaUrl, thumbnailUrl: d.thumbnailUrl };
      }
      setPostSettings((prev) => ({
        privacy:        d.settings.privacy        ?? prev.privacy,
        allowComments:  d.settings.allowComments  ?? prev.allowComments,
        allowDownload:  d.settings.allowDownload  ?? prev.allowDownload,
        allowDuet:      d.settings.allowDuet      ?? prev.allowDuet,
        womenOnly:      d.settings.womenOnly      ?? prev.womenOnly,
      }));
      const resumedTrack = d.settings.audioUrl
        ? MUSIC_LIBRARY.find((t) => t.url === d.settings.audioUrl) ?? null
        : null;
      if (resumedTrack) setCurrentAudioTrack(resumedTrack);
      if (typeof d.settings.audioVolume === 'number') setCurrentAudioVolume(d.settings.audioVolume);
    })();
  }, [draftId, fetchDraft]);

  // Brennt die Vorschau (Foto + Filter + Text + Sticker) via view-shot in ein Bild.
  // Während des Captures wird das Skia-Bild durch ein normales Bild ersetzt (Filter
  // vorab gebacken) → kein Skia-View im Capture-Baum → zuverlässig erfassbar, das Foto
  // kann nicht „verschwinden". Null bei Fehler → Aufrufer fällt auf bakeImageEdits zurück.
  const compositeViaCapture = useCallback(async (): Promise<string | null> => {
    if (!image || image.type === 'video') return null;
    const filterBaked = await bakeImageEdits(image.uri, { filterId: activeFilter, rotation: 0, flipH: false });
    setCaptureUri(filterBaked ?? image.uri);
    setCapturing(true);
    await new Promise((r) => setTimeout(r, 160));   // einen Frame warten bis gerendert
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) return null;
      // view-shot (result:'tmpfile') liefert einen nackten Pfad OHNE file://-Schema
      // → fetch/Upload wirft sonst „Invalid URL". Schema ergänzen.
      return uri.startsWith('file://') ? uri : `file://${uri}`;
    } catch (e) {
      __DEV__ && console.warn('[compositeViaCapture]', e);
      return null;
    } finally {
      setCapturing(false);
    }
  }, [image, activeFilter]);

  /** Sorgt dafür, dass das lokale Image zu R2 hochgeladen ist (Cache). Nutzt ggf. bestehende URL. */
  const ensureMediaUploaded = useCallback(async (signal: AbortSignal | undefined): Promise<{
    mediaUrl:     string | null;
    thumbnailUrl: string | null;
    mediaType:    'image' | 'video' | null;
  }> => {
    if (!profile) throw new Error(tr('create.noProfile'));
    if (!image)  return { mediaUrl: null, thumbnailUrl: null, mediaType: null };
    const mt: 'image' | 'video' = image.type === 'video' ? 'video' : 'image';
    if (image.uri.startsWith('http') && uploadedMediaRef.current.url === image.uri) {
      return {
        mediaUrl:     uploadedMediaRef.current.url,
        thumbnailUrl: uploadedMediaRef.current.thumbnailUrl,
        mediaType:    mt,
      };
    }
    const isVideo = mt === 'video';
    setUploading(true); setUploadPct(0);
    try {
      // Bild für den Upload zusammenrechnen (nur Bilder). Mit Text/Sticker/Zeichnung:
      // via view-shot die fertige Vorschau einfangen. Sonst (oder bei Capture-Fehler):
      // Filter + Drehen/Spiegeln via Skia backen. Beides defensiv → schlimmstenfalls
      // rohes Bild (kein Regress).
      let uploadUri = image.uri;
      let uploadMime = image.mimeType;
      if (!isVideo) {
        const hasOverlays = textOverlays.length > 0 || stickerOverlays.length > 0 || drawnPaths.length > 0;
        const composited = hasOverlays ? await compositeViaCapture() : null;
        if (composited) {
          uploadUri = composited; uploadMime = 'image/jpeg';
        } else {
          const baked = await bakeImageEdits(image.uri, {
            filterId: activeFilter,
            rotation: rotateState.rotation,
            flipH: rotateState.flipH,
          });
          if (baked) { uploadUri = baked; uploadMime = 'image/jpeg'; }
        }
      }
      const { url } = await uploadPostMedia(profile.id, uploadUri, uploadMime, (pct) => setUploadPct(pct), signal);
      let thumbnailUrl: string | null = null;
      if (isVideo) thumbnailUrl = await generateAndUploadThumbnail(profile.id, image.uri, signal, coverTimeMs);
      uploadedMediaRef.current = { url, thumbnailUrl };
      return { mediaUrl: url, thumbnailUrl, mediaType: mt };
    } finally {
      setUploading(false); setUploadPct(0);
    }
  }, [profile, image, coverTimeMs, activeFilter, rotateState, textOverlays, stickerOverlays, drawnPaths, compositeViaCapture]);

  const addTextOverlay = (overlay: Omit<TextOverlay,'id'|'x'|'y'>) => {
    setTextOverlays(prev => [...prev, {
      ...overlay, id: `text-${Date.now()}`, x: 0.15, y: 0.35,
    }]);
    setShowTextEditor(false);
  };
  const removeTextOverlay = (id: string) => setTextOverlays(prev => prev.filter(o => o.id !== id));

  const addSticker = (url: string) => setStickerOverlays(prev => [...prev, { id: `sticker-${Date.now()}`, url, x: 0.3, y: 0.3 }]);
  const removeSticker = (id: string) => setStickerOverlays(prev => prev.filter(o => o.id !== id));

  // Zuschneiden anwenden: neues (lokales) Bild übernehmen + Upload-Cache invalidieren,
  // damit das zugeschnittene Bild frisch hochgeladen wird.
  const applyCrop = (croppedUri: string) => {
    setShowCropSheet(false);
    if (!image || croppedUri === image.uri) return;
    uploadedMediaRef.current = { url: null, thumbnailUrl: null };
    setImage({ ...image, uri: croppedUri });
  };

  // Trash zone callbacks
  const handleDragStart = () => {
    setIsDraggingOverlay(true);
    setIsTrashHovered(false);
    isTrashHoveredRef.current = false;
  };

  const handleOverlayMove = (x: number, y: number) => {
    const over = isInTrash(x, y);
    if (over !== isTrashHoveredRef.current) {
      isTrashHoveredRef.current = over;
      setIsTrashHovered(over);
      if (over) Haptics.selectionAsync();
    }
  };

  const handleDragEnd = (x: number, y: number, id: string) => {
    setIsDraggingOverlay(false);
    setIsTrashHovered(false);
    isTrashHoveredRef.current = false;
    if (x >= 0 && isInTrash(x, y)) {
      removeTextOverlay(id);
      removeSticker(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  // Media picker aus Galerie
  const pickFromLibrary = async () => {
    const { status } = await requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(tr('create.permission'), tr('create.allowMedia')); return; }
    const result = await launchImageLibraryAsync({ mediaTypes:['images','videos'], quality:0.92, videoMaxDuration:60 });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0]);
  };

  // v1.28.0: AI-Image-Sheet als Alternative zum Galerie-Pick (nur Bild-Posts)
  const [showAIPostSheet, setShowAIPostSheet] = useState(false);
  const applyAIImage = useCallback((url: string) => {
    setImage({
      uri: url,
      type: 'image',
      width: 0, height: 0, assetId: null, base64: null, duration: null, exif: null,
      fileName: null, fileSize: undefined, mimeType: 'image/png',
    });
    uploadedMediaRef.current = { url, thumbnailUrl: null };
  }, []);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev,tag].slice(0,4));

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setUploading(false); setUploadPct(0);
  }, []);

  const handlePost = async () => {
    if (!profile) return;
    if (!image && !caption.trim()) { Alert.alert(tr('create.almostDone'), tr('create.addImageOrCaption')); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { mediaUrl, thumbnailUrl, mediaType } = await ensureMediaUploaded(controller.signal);
      if (controller.signal.aborted) return;
      const { data: insertedRows, error } = await supabase.from('posts').insert({
        author_id:      profile.id,
        caption:        caption.trim() || null,
        media_url:      mediaUrl,
        media_type:     mediaType,
        thumbnail_url:  thumbnailUrl,
        tags:           selectedTags.map(t=>t.toLowerCase()),
        // Nur mitschicken, wenn wirklich ein Produkt verknüpft wurde — so bricht
        // normales Posten nicht, falls die product_id-Migration noch nicht läuft.
        ...(linkedProductId ? { product_id: linkedProductId } : {}),
        is_guild_post:  false,
        guild_id:       profile.guild_id,
        audio_url:      currentAudioTrack?.url ?? null,
        audio_volume:   currentAudioTrack ? currentAudioVolume : null,
        privacy:        postSettings.privacy,
        allow_comments: postSettings.allowComments,
        allow_download: postSettings.allowDownload,
        allow_duet:     postSettings.allowDuet,
        women_only:     postSettings.womenOnly,
      }).select('id').single();
      if (error) throw error;
      if (mediaUrl && mediaType === 'image' && insertedRows?.id) {
        moderate(insertedRows.id, mediaUrl);
      }
      if (mediaUrl && mediaType === 'video' && insertedRows?.id) {
        // Bunny-ABR-Ingest anstoßen (fire & forget). R2 bleibt Sofort-Quelle;
        // Bunny zieht das Video aus der R2-URL + transkodiert im Hintergrund zu
        // HLS. Fehler bewusst ignoriert — der R2-Fallback trägt den Post.
        supabase.functions
          .invoke('bunny-ingest', { body: { postId: insertedRows.id, videoUrl: mediaUrl } })
          .catch(() => { /* R2-Fallback bleibt aktiv */ });
      }
      if (activeCloudDraftId) {
        try { await deleteCloudDraft(activeCloudDraftId); } catch {}
      }
      await queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['guild-feed'] });
      await queryClient.invalidateQueries({ queryKey: ['user-posts', profile.id] });
      await queryClient.invalidateQueries({ queryKey: ['user-has-posted', profile.id] });
      setShowSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '';
      const isNetwork = msg.includes('network') || msg.includes('fetch') || msg.includes('Network');
      Alert.alert(
        tr('create.publishFailed'),
        isNetwork
          ? tr('create.noInternet')
          : (msg || tr('create.postUploadFailed')),
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false); setUploadPct(0);
    }
  };

  // v1.20 — Cloud-Draft speichern (upsert, Media wird einmalig nach R2 hochgeladen)
  const handleSaveCloudDraft = async () => {
    if (!profile) return;
    if (!image && !caption.trim() && selectedTags.length === 0) {
      Alert.alert(tr('create.empty'), tr('create.addTextTagsMedia'));
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setDraftSavingBusy(true);
    try {
      const { mediaUrl, thumbnailUrl, mediaType } = await ensureMediaUploaded(controller.signal);
      if (controller.signal.aborted) return;
      const id = await saveCloudDraft({
        id:            activeCloudDraftId ?? undefined,
        caption:       caption.trim() || null,
        tags:          selectedTags.map((t) => t.toLowerCase()),
        mediaType,
        mediaUrl,
        thumbnailUrl,
        settings: {
          privacy:       postSettings.privacy,
          allowComments: postSettings.allowComments,
          allowDownload: postSettings.allowDownload,
          allowDuet:     postSettings.allowDuet,
          womenOnly:     postSettings.womenOnly,
          audioUrl:      currentAudioTrack?.url     ?? null,
          audioVolume:   currentAudioTrack          ? currentAudioVolume : null,
        },
      });
      setActiveCloudDraftId(id);
      setShowDetails(false);
      Alert.alert(tr('create.draftSaved'), tr('create.draftInCloud'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      Alert.alert(tr('create.oops'), err instanceof Error ? err.message : tr('create.draftFailed'));
    } finally {
      setDraftSavingBusy(false);
      setUploading(false); setUploadPct(0);
    }
  };

  // v1.20 — Post planen (Scheduler-Modal öffnet sich zuvor)
  const handleSchedule = async (publishAt: Date) => {
    if (!profile) return;
    if (!image && !caption.trim()) { Alert.alert(tr('create.almostDone'), tr('create.addImageOrCaption')); return; }
    const controller = new AbortController();
    abortRef.current = controller;
    setSchedulingBusy(true);
    try {
      const { mediaUrl, thumbnailUrl, mediaType } = await ensureMediaUploaded(controller.signal);
      if (controller.signal.aborted) return;
      await schedulePost({
        publishAt,
        caption:        caption.trim() || null,
        mediaUrl,
        mediaType,
        thumbnailUrl,
        tags:           selectedTags.map((t) => t.toLowerCase()),
        isGuildPost:    false,
        guildId:        profile.guild_id ?? null,
        audioUrl:       currentAudioTrack?.url ?? null,
        audioVolume:    currentAudioTrack ? currentAudioVolume : null,
        privacy:        postSettings.privacy,
        allowComments:  postSettings.allowComments,
        allowDownload:  postSettings.allowDownload,
        allowDuet:      postSettings.allowDuet,
        womenOnly:      postSettings.womenOnly,
      });
      if (activeCloudDraftId) {
        try { await deleteCloudDraft(activeCloudDraftId); } catch {}
      }
      setShowScheduler(false);
      setShowDetails(false);
      Alert.alert(tr('create.scheduled'), tr('create.scheduledText'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      Alert.alert(tr('create.oops'), err instanceof Error ? err.message : tr('create.scheduleFailed'));
    } finally {
      setSchedulingBusy(false);
      setUploading(false); setUploadPct(0);
    }
  };

  const isVideo = image?.type === 'video';

  return (
    <View style={s.root}>
      {/* ── Fortschrittsbalken (Upload) ─────────────────────── */}
      <CreateProgressBar visible={uploading} progress={uploadPct} onCancel={handleCancel} />

      {/* ── Vollbild-Vorschau (mit Transform: Rotate + Flip) — in ViewShot für Compositing ── */}
      <ViewShot ref={shotRef} style={s.preview} options={{ format: 'jpg', quality: 0.92, result: 'tmpfile' }}>
      <View style={[s.preview, {
        transform: [
          { rotate: `${rotateState.rotation}deg` },
          { scaleX: rotateState.flipH ? -1 : 1 },
        ],
      }]}>
        {image ? (
          isVideo ? (
            <VideoView
              player={videoPlayer}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
            />
          ) : capturing && captureUri ? (
            <Image source={{ uri: captureUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
          ) : (
            <SkiaFilteredImage uri={image.uri} filterId={activeFilter} />
          )
        ) : (
          <View style={s.emptyState}>
            <Pressable onPress={pickFromLibrary} style={{ alignItems: 'center' }}>
              <Text style={s.emptyIcon}>📷</Text>
              <Text style={s.emptyText}>{tr('create.tapSelectMedia')}</Text>
            </Pressable>
            <Pressable onPress={() => setShowAIPostSheet(true)} style={s.emptyAIBtn}>
              <Sparkles size={14} color="#fff" strokeWidth={2} />
              <Text style={s.emptyAIText}>{tr('create.aiWithAi')}</Text>
            </Pressable>
          </View>
        )}

        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {adjustValues.brightness !== 0 && (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {
                backgroundColor: adjustValues.brightness > 0
                  ? `rgba(255,255,255,${(adjustValues.brightness / 50) * 0.25})`
                  : `rgba(0,0,0,${(Math.abs(adjustValues.brightness) / 50) * 0.35})`,
              }]}
            />
          )}

          <View style={s.vignetteTop} pointerEvents="none" />
          <View style={s.vignetteBottom} pointerEvents="none" />

          {textOverlays.map((ov) => (
            <TextOverlayItem
              key={ov.id}
              overlay={ov}
              onRemove={removeTextOverlay}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onMove={handleOverlayMove}
            />
          ))}

          {stickerOverlays.map((ov) => (
            <StickerOverlayItem
              key={ov.id}
              overlay={ov}
              onRemove={removeSticker}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onMove={handleOverlayMove}
            />
          ))}

          {isDrawMode ? (
            <DrawCanvas
              paths={drawnPaths}
              activeColor={drawColor}
              activeWidth={drawWidth}
              onAddPath={(p: DrawnPath) => setDrawnPaths((prev: DrawnPath[]) => [...prev, p])}
            />
          ) : (
            drawnPaths.length > 0 && Svg && SvgPath && (
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {drawnPaths.map((dp: DrawnPath, i: number) => (
                  <SvgPath key={i} d={pointsToSvgPath(dp.points)} stroke={dp.color}
                    strokeWidth={dp.width} strokeLinejoin="round" strokeLinecap="round" fill="none" />
                ))}
              </Svg>
            )
          )}
        </View>

      </View>
      </ViewShot>

      {/* Trash Zone — außerhalb des Preview-Containers */}
      <TrashZone visible={isDraggingOverlay} isOver={isTrashHovered} />

      {/* Draw Toolbar — erscheint wenn Draw-Mode aktiv */}
      {isDrawMode && (
        <DrawToolbar
          activeColor={drawColor}
          onColor={setDrawColor}
          activeWidth={drawWidth}
          onWidth={setDrawWidth}
          onUndo={() => setDrawnPaths((prev: DrawnPath[]) => prev.slice(0, -1))}
          onClose={() => setIsDrawMode(false)}
          bottomOffset={insets.bottom + 96}
        />
      )}

      {/* Text Overlay Editor */}
      <TextOverlayEditor
        visible={showTextEditor}
        onDone={addTextOverlay}
        onCancel={() => setShowTextEditor(false)}
      />
      {/* ── Top-Bar (im Zeichnen-Modus ausgeblendet — DrawToolbar bringt eigene) ── */}
      {!isDrawMode && (
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        {/* Zurück */}
        <Pressable
          onPress={() => {
            if ((caption.trim() || image) && !uploading) {
              Alert.alert(tr('create.saveDraftTitle'), '', [
                { text: tr('create.discard'), style: 'destructive', onPress: () => router.back() },
                { text: tr('create.saveDraft'), onPress: async () => {
                  await saveDraft({ caption, tags: selectedTags, mediaUri: image?.uri ?? null, mediaType: image?.type === 'video' ? 'video' : image ? 'image' : null });
                  router.back();
                }},
              ]);
            } else { router.back(); }
          }}
          style={s.topBtn}
          hitSlop={10}
        >
          <X size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>

        {/* Musik-Badge */}
        <Pressable onPress={() => setShowMusicPicker(true)} style={s.musicBadge}>
          <Music2 size={13} color="#fff" strokeWidth={2.5} />
          <Text style={s.musicBadgeText} numberOfLines={1}>
            {currentAudioTrack ? currentAudioTrack.title : tr('create.addSound')}
          </Text>
          {currentAudioTrack && (
            <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation(); setCurrentAudioTrack(null); }}>
              <X size={11} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
            </Pressable>
          )}
        </Pressable>

        {/* Einstellungsrad — oben rechts → öffnet Details-Sheet */}
        <Pressable onPress={() => setShowDetails(true)} style={s.topBtn} hitSlop={10}>
          <Settings2 size={20} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>
      )}

      {/* ── Rechte Tool-Sidebar (im Zeichnen-Modus ausgeblendet) ── */}
      {!isDrawMode && (
      <View style={[s.sidebar, { top: insets.top + 70 }]}>

        <Pressable onPress={() => setShowMusicPicker(true)} style={s.sideBtn}>
          <Music2 size={26} color="#fff" strokeWidth={1.8} />
          {currentAudioTrack && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>{tr('create.sound')}</Text>
        </Pressable>

        <Pressable style={s.sideBtn} onPress={() => setShowTextEditor(true)}>
          <Type size={26} color="#fff" strokeWidth={1.8} />
          {textOverlays.length > 0 && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>{tr('create.text')}</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, stickerOverlays.length > 0 && s.sideBtnActive]} onPress={() => setShowStickerSheet(true)}>
          <Smile size={26} color="#fff" strokeWidth={1.8} />
          {stickerOverlays.length > 0 && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>{tr('create.sticker')}</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, !!activeFilter && s.sideBtnActive]} onPress={() => setShowFilterSheet(true)}>
          <Palette size={26} color="#fff" strokeWidth={1.8} />
          {!!activeFilter && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>{tr('create.filter')}</Text>
        </Pressable>

        {/* Zeichnen-Button entfernt (funktionierte nicht) — Draw-Code bleibt dormant für später */}

        <Pressable style={[s.sideBtn, (adjustValues.brightness !== 0 || adjustValues.contrast !== 0 || adjustValues.saturation !== 0) && s.sideBtnActive]} onPress={() => setShowAdjustSheet(true)}>
          <SlidersHorizontal size={26} color="#fff" strokeWidth={1.8} />
          {(adjustValues.brightness !== 0 || adjustValues.contrast !== 0) && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>{tr('create.adjust')}</Text>
        </Pressable>

        <Pressable style={[s.sideBtn, (rotateState.rotation !== 0 || rotateState.flipH) && s.sideBtnActive]} onPress={() => setShowRotateSheet(true)}>
          <RotateCw size={26} color="#fff" strokeWidth={1.8} />
          {(rotateState.rotation !== 0 || rotateState.flipH) && <View style={s.sideBtnDot} />}
          <Text style={s.sideLabel}>{tr('create.rotate')}</Text>
        </Pressable>

        {/* Zuschneiden — nur für Bilder (v1: Seitenverhältnis-Center-Crop) */}
        {!isVideo && image && (
          <Pressable style={s.sideBtn} onPress={() => setShowCropSheet(true)}>
            <Crop size={26} color="#fff" strokeWidth={1.8} />
            <Text style={s.sideLabel}>{tr('create.crop')}</Text>
          </Pressable>
        )}

        {/* Schneiden — nur für Videos */}
        {isVideo && (
          <Pressable style={[s.sideBtn, trimResult && s.sideBtnActive]} onPress={() => setShowTrimSheet(true)}>
            <Scissors size={26} color="#fff" strokeWidth={1.8} />
            {trimResult && <View style={s.sideBtnDot} />}
            <Text style={s.sideLabel}>{tr('create.trim')}</Text>
          </Pressable>
        )}

        {/* Cover — nur für Videos (Start-Frame fürs Feed-Thumbnail) */}
        {isVideo && image && (
          <Pressable style={[s.sideBtn, coverTimeMs > 0 && s.sideBtnActive]} onPress={() => setShowCoverSheet(true)}>
            <CoverIcon size={26} color="#fff" strokeWidth={1.8} />
            {coverTimeMs > 0 && <View style={s.sideBtnDot} />}
            <Text style={s.sideLabel}>{tr('create.cover')}</Text>
          </Pressable>
        )}

      </View>
      )}

      {/* ── Bottom-Buttons (im Zeichnen-Modus ausgeblendet) ───── */}
      {!isDrawMode && (
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {image && (
          <Pressable onPress={pickFromLibrary} style={s.thumbBtn}>
            <Image source={{ uri: image.uri }} style={s.thumb} contentFit="cover" />
          </Pressable>
        )}

        <View style={s.bottomActions}>
          {/* Story-Button */}
          <Pressable style={s.storyBtn} onPress={handlePost} disabled={uploading}>
            <Text style={s.storyBtnText}>{tr('create.story')}</Text>
          </Pressable>

          {/* Weiter → Details-Sheet */}
          <Pressable
            style={s.nextBtn}
            onPress={() => setShowDetails(true)}
            disabled={uploading}
          >
            <Text style={s.nextBtnText}>{tr('create.next')}</Text>
            <ChevronRight size={18} color="#000" strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
      )}

      {/* ── MusicPickerSheet ────────────────────────────────── */}
      <MusicPickerSheet
        visible={showMusicPicker}
        selectedTrack={currentAudioTrack}
        audioVolume={currentAudioVolume}
        onSelect={(track, vol) => { setCurrentAudioTrack(track); setCurrentAudioVolume(vol); }}
        onClose={() => setShowMusicPicker(false)}
      />

      {/* ── StickerSheet ─────────────────────────────────────── */}
      <StickerSheet visible={showStickerSheet} onAdd={addSticker} onClose={() => setShowStickerSheet(false)} />

      {/* ── FilterSheet ──────────────────────────────────────── */}
      <FilterSheet
        visible={showFilterSheet}
        mediaUri={image?.uri ?? ''}
        currentId={activeFilter}
        onSelect={setActiveFilter}
        onClose={() => setShowFilterSheet(false)}
      />

      {/* ── AdjustSheet ──────────────────────────────────────── */}
      <AdjustSheet
        visible={showAdjustSheet}
        values={adjustValues}
        onChange={setAdjustValues}
        onClose={() => setShowAdjustSheet(false)}
      />

      {/* ── RotateSheet ──────────────────────────────────────── */}
      <RotateSheet
        visible={showRotateSheet}
        state={rotateState}
        onChange={setRotateState}
        onClose={() => setShowRotateSheet(false)}
      />

      {/* ── CropSheet (Bild zuschneiden) ─────────────────────── */}
      {image && !isVideo && (
        <CropSheet
          visible={showCropSheet}
          uri={image.uri}
          onDone={applyCrop}
          onClose={() => setShowCropSheet(false)}
        />
      )}

      {/* ── CoverPickerSheet (Video-Cover wählen) ────────────── */}
      {image && isVideo && (
        <CoverPickerSheet
          visible={showCoverSheet}
          uri={image.uri}
          durationMs={image.duration}
          initialTimeMs={coverTimeMs}
          onDone={(t) => { setCoverTimeMs(t); setShowCoverSheet(false); }}
          onClose={() => setShowCoverSheet(false)}
        />
      )}

      {/* ── VideoTrimSheet ───────────────────────────────────── */}
      {isVideo && image && (
        <VideoTrimSheet
          visible={showTrimSheet}
          uri={image.uri}
          onDone={(r) => { setTrimResult(r); setShowTrimSheet(false); }}
          onCancel={() => setShowTrimSheet(false)}
        />
      )}

      {/* ── Details-Sheet (Caption / Tags / Privacy / Post) ── */}
      <DetailsSheet
        visible={showDetails}
        onClose={() => setShowDetails(false)}
        caption={caption}
        onCaption={setCaption}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        settings={postSettings}
        onSettings={setPostSettings}
        onPost={handlePost}
        uploading={uploading}
        onSchedule={() => setShowScheduler(true)}
        onSaveDraft={handleSaveCloudDraft}
        busyDraft={draftSavingBusy}
        busySchedule={schedulingBusy}
        products={myProducts.map((p) => ({ id: p.id, title: p.title, cover_url: p.cover_url ?? null }))}
        linkedProductId={linkedProductId}
        onLinkProduct={setLinkedProductId}
      />

      {/* v1.20 — Scheduler-Modal */}
      <SchedulerModal
        visible={showScheduler}
        onClose={() => setShowScheduler(false)}
        onSave={handleSchedule}
        isSaving={schedulingBusy}
      />

      {/* ── Erfolgs-Overlay ─────────────────────────────────── */}
      <PostSuccessOverlay
        visible={showSuccess}
        onDone={() => { setShowSuccess(false); router.back(); }}
      />

      {/* v1.28.0: AI-Image-Sheet als Alternative zum Galerie-Pick */}
      <AIImageSheet
        visible={showAIPostSheet}
        onClose={() => setShowAIPostSheet(false)}
        onUseImage={applyAIImage}
        purpose="post_cover"
        defaultSize="1024x1536"
        
        promptPlaceholder={tr('create.aiPrompt')}
        suggestions={[
          tr('create.aiMoody'),
          tr('create.aiAbstract'),
          tr('create.aiStreet'),
        ]}
      />
    </View>
  );
}

// ─── Helper — must be accessible in the JSX above ────────────────────────────
// pointsToSvgPath is re-exported from DrawTool via the barrel, but we also
// need it directly here for the static SVG rendering of completed drawn paths.
function pointsToSvgPath(points: number[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    d += ` L ${points[i]} ${points[i + 1]}`;
  }
  return d;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Vollbild-Preview
  preview: { ...StyleSheet.absoluteFillObject },
  vignetteTop: { position:'absolute', top:0, left:0, right:0, height:160, backgroundColor:'transparent' },
  vignetteBottom: { position:'absolute', bottom:0, left:0, right:0, height:220, backgroundColor:'transparent' },

  // Leerer State
  emptyState: { flex:1, alignItems:'center', justifyContent:'center', gap:16, backgroundColor:'#080810' },
  emptyIcon: { fontSize: 52 },
  emptyText: { color:'rgba(255,255,255,0.25)', fontSize:15, textAlign:'center', maxWidth:200, lineHeight:22 },
  emptyAIBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139,92,246,0.6)',
  },
  emptyAIText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Top-Bar ──────────────────────────────────────────────
  topBar: {
    position:'absolute', top:0, left:0, right:0,
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:14, paddingBottom:14,
  },
  topBtn: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'rgba(0,0,0,0.35)',
    alignItems:'center', justifyContent:'center',
  },
  musicBadge: {
    flexDirection:'row', alignItems:'center', gap:7,
    backgroundColor:'rgba(0,0,0,0.42)',
    borderRadius:22, paddingHorizontal:13, paddingVertical:9,
    maxWidth: SW * 0.52,
    shadowColor:'#fff', shadowOpacity:0.07, shadowRadius:8, shadowOffset:{width:0,height:0},
  },
  musicBadgeText: { color:'#fff', fontSize:13, fontWeight:'700', flex:1 },

  // ── Rechte Sidebar — kein Hintergrund, kein Rahmen ─────
  sidebar: {
    position:'absolute', right:10,
    flexDirection:'column', alignItems:'center', gap:22,
  },
  sideBtn: {
    alignItems:'center', justifyContent:'center', width:50, paddingVertical:2,
  },
  sideBtnActive: {
    opacity: 1,
  },
  sideBtnIcon: { fontSize: 24 },
  sideLabel: {
    color:'rgba(255,255,255,0.75)',
    fontSize:10, fontWeight:'700',
    marginTop:4, textAlign:'center',
    textShadowColor:'rgba(0,0,0,0.8)', textShadowOffset:{width:0,height:1}, textShadowRadius:4,
  },
  sideBtnDot: {
    position:'absolute', top:0, right:4,
    width:9, height:9, borderRadius:5,
    backgroundColor:'#fff',
    borderWidth:1.5, borderColor:'rgba(0,0,0,0.5)',
  },

  // ── Bottom-Bar ───────────────────────────────────────────
  bottomBar: {
    position:'absolute', bottom:0, left:0, right:0,
    paddingHorizontal:14, paddingTop:16,
    flexDirection:'row', alignItems:'flex-end', gap:10,
  },
  thumbBtn: {
    width:56, height:56, borderRadius:12,
    overflow:'hidden',
    borderWidth:2, borderColor:'rgba(255,255,255,0.3)',
    shadowColor:'#000', shadowOpacity:0.4, shadowRadius:6, shadowOffset:{width:0,height:2},
  },
  thumb: { width:56, height:56 },
  bottomActions: { flex:1, flexDirection:'row', gap:8 },

  storyBtn: {
    flex:1, paddingVertical:17, borderRadius:16,
    backgroundColor:'rgba(255,255,255,0.1)',
    borderWidth:1.5, borderColor:'rgba(255,255,255,0.22)',
    alignItems:'center', justifyContent:'center',
  },
  storyBtnText: { color:'#fff', fontSize:15, fontWeight:'700', letterSpacing:0.2 },

  nextBtn: {
    flex:1.7, paddingVertical:17, borderRadius:16,
    backgroundColor:'#fff',
    alignItems:'center', justifyContent:'center',
    flexDirection:'row', gap:6,
    shadowColor:'#fff', shadowOpacity:0.2, shadowRadius:12, shadowOffset:{width:0,height:0},
  },
  nextBtnText: { color:'#000', fontSize:15, fontWeight:'700', letterSpacing:0.2 },
});

// SH is exported from the barrel but not needed directly in this file
void SH;
