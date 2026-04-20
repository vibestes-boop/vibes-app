/**
 * app/shop/my-shop.tsx — Creator: eigene Produkte verwalten
 *
 * - Liste aller eigenen Produkte (aktiv + inaktiv)
 * - Produkt erstellen (Bild + Daten)
 * - Produkt aktivieren / deaktivieren
 * - Produkt löschen
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, Alert, ActivityIndicator, Switch, Modal,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Plus, Package, Trash2,
  ShoppingBag, ChevronRight, MapPin, Truck, Percent,
  Image as ImageIcon, Box, FileText, Wrench, X, Images,
} from 'lucide-react-native';
import { launchImageLibraryAsync, MediaTypeOptions, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import {
  useMyProducts, useCreateProduct, useUpdateProduct,
  useDeleteProduct,
  type Product, type ProductCategory, type CreateProductInput,
} from '@/lib/useShop';
import { uploadPostMedia } from '@/lib/uploadMedia';
import { useCoinsWallet } from '@/lib/useGifts';
import { useTheme } from '@/lib/useTheme';

// ─── Kategorie-Optionen ───────────────────────────────────────────────────────

const CATEGORIES: { key: ProductCategory; label: string; icon: any; desc: string }[] = [
  { key: 'digital',  label: 'Digital',   icon: FileText, desc: 'PDF, Rezept, Preset, Tutorial' },
  { key: 'physical', label: 'Physisch',  icon: Box,      desc: 'Merchandise, Handwerk, Fashion' },
  { key: 'service',  label: 'Service',   icon: Wrench,   desc: 'Coaching, Beratung, Custom Order' },
];

// ─── Leerer Initialzustand ────────────────────────────────────────────────────

const EMPTY_FORM: CreateProductInput = {
  title:       '',
  description: '',
  price_coins: 100,
  category:    'digital',
  cover_url:   null,
  image_urls:  [],
  file_url:    null,
  stock:       -1,
  women_only:  false,
  is_active:   true,
  // v1.26.3: Richer Cards — Default: kein Angebot, kein Gratis-Versand, kein Ort
  sale_price_coins: null,
  free_shipping:    false,
  location:         null,
};

// ─── Hauptscreen ──────────────────────────────────────────────────────────────

export default function MyShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { diamonds } = useCoinsWallet();

  const { data: products = [], isLoading } = useMyProducts();
  const { mutateAsync: createProduct, isPending: isCreating } = useCreateProduct();
  const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateProduct();
  const { mutateAsync: deleteProduct } = useDeleteProduct();

  // v1.26.2: Sheet dient jetzt dual-mode: create (editingId=null) + edit (editingId=<uuid>)
  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateProductInput>(EMPTY_FORM);
  const [uploadingCover, setUploadingCover] = useState(false);
  const isEditMode = editingId !== null;
  const isSaving   = isCreating || isUpdating;

  // ── Cover hochladen ───────────────────────────────────────────────────────

  const pickCover = useCallback(async () => {
    const { granted } = await requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Berechtigung fehlt'); return; }
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingCover(true);
    try {
      const uri = result.assets[0].uri;
      const mimeType = result.assets[0].mimeType ?? 'image/jpeg';
      const user = (await import('@/lib/authStore')).useAuthStore.getState().user;
      const { url } = await uploadPostMedia(user?.id ?? 'anon', uri, mimeType);
      setForm(f => ({ ...f, cover_url: url }));
    } catch {
      Alert.alert('Upload fehlgeschlagen', 'Bitte nochmal versuchen.');
    } finally {
      setUploadingCover(false);
    }
  }, []);

  // ── Galerie-Bilder hinzufügen (bis zu 8 zusätzlich zum Cover) ─────────────

  const [uploadingGallery, setUploadingGallery] = useState(false);

  const pickGalleryImages = useCallback(async () => {
    if ((form.image_urls?.length ?? 0) >= 8) {
      Alert.alert('Maximum', 'Du kannst max. 8 Galerie-Bilder hinzufügen.');
      return;
    }
    const { granted } = await requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Berechtigung fehlt'); return; }
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 8 - (form.image_urls?.length ?? 0),
    });
    if (result.canceled || !result.assets?.length) return;
    setUploadingGallery(true);
    try {
      const user = (await import('@/lib/authStore')).useAuthStore.getState().user;
      const urls = await Promise.all(
        result.assets.map(async (asset) => {
          const { url } = await uploadPostMedia(user?.id ?? 'anon', asset.uri, asset.mimeType ?? 'image/jpeg');
          return url;
        })
      );
      setForm(f => ({ ...f, image_urls: [...(f.image_urls ?? []), ...urls].slice(0, 8) }));
    } catch {
      Alert.alert('Upload fehlgeschlagen', 'Bitte nochmal versuchen.');
    } finally {
      setUploadingGallery(false);
    }
  }, [form.image_urls]);

  const removeGalleryImage = useCallback((idx: number) => {
    setForm(f => ({ ...f, image_urls: (f.image_urls ?? []).filter((_, i) => i !== idx) }));
  }, []);

  // ── Sheet öffnen: Create-Mode ─────────────────────────────────────────────

  const openCreateSheet = useCallback(() => {
    impactAsync(ImpactFeedbackStyle.Light);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowSheet(true);
  }, []);

  // ── Sheet öffnen: Edit-Mode (Prefill aus existierendem Produkt) ───────────

  const openEditSheet = useCallback((product: Product) => {
    impactAsync(ImpactFeedbackStyle.Light);
    setEditingId(product.id);
    setForm({
      title:       product.title,
      description: product.description ?? '',
      price_coins: product.price_coins,
      category:    product.category,
      cover_url:   product.cover_url,
      image_urls:  product.image_urls ?? [],
      file_url:    product.file_url,
      stock:       product.stock,
      women_only:  product.women_only,
      is_active:   product.is_active,
      // v1.26.3
      sale_price_coins: product.sale_price_coins ?? null,
      free_shipping:    product.free_shipping ?? false,
      location:         product.location ?? null,
    });
    setShowSheet(true);
  }, []);

  const closeSheet = useCallback(() => {
    setShowSheet(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, []);

  // ── Produkt speichern (create oder update) ────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) { Alert.alert('Titel fehlt'); return; }
    if (form.price_coins < 1) { Alert.alert('Preis muss mindestens 1 Coin sein'); return; }
    // v1.26.3: Angebotspreis muss kleiner als regulärer Preis sein (und > 0)
    if (form.sale_price_coins != null) {
      if (form.sale_price_coins < 1) {
        Alert.alert('Angebotspreis ungültig', 'Muss mindestens 1 Coin sein.');
        return;
      }
      if (form.sale_price_coins >= form.price_coins) {
        Alert.alert('Angebotspreis ungültig', 'Muss kleiner als der reguläre Preis sein.');
        return;
      }
    }
    try {
      if (editingId) {
        await updateProduct({ id: editingId, ...form });
      } else {
        await createProduct(form);
      }
      impactAsync(ImpactFeedbackStyle.Medium);
      closeSheet();
    } catch (e: any) {
      Alert.alert(
        'Fehler',
        editingId ? 'Produkt konnte nicht gespeichert werden.' : 'Produkt konnte nicht erstellt werden.',
      );
      __DEV__ && console.warn('[my-shop] save failed:', e?.message);
    }
  }, [form, editingId, createProduct, updateProduct, closeSheet]);

  // ── Produkt löschen ───────────────────────────────────────────────────────

  const handleDelete = useCallback((product: Product) => {
    Alert.alert(
      'Produkt löschen',
      `"${product.title}" wirklich löschen? Alle Bestellungen bleiben erhalten.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen', style: 'destructive',
          onPress: async () => {
            try { await deleteProduct(product.id); }
            catch { Alert.alert('Fehler', 'Löschen fehlgeschlagen.'); }
          },
        },
      ]
    );
  }, [deleteProduct]);

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.bg.elevated, colors.bg.primary]}
        style={[s.header, { paddingTop: insets.top + 6 }]}
      >
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={16}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: colors.text.primary }]}>Mein Shop</Text>
          <Text style={[s.headerSub, { color: colors.text.muted }]}>
            {products.length} Produkt{products.length !== 1 ? 'e' : ''}
          </Text>
        </View>
        {/* Diamonds-Balance */}
        <View style={[s.diamondPill, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <Text style={{ fontSize: 14 }}>💎</Text>
          <Text style={[s.diamondText, { color: colors.text.primary }]}>{diamonds.toLocaleString('de-DE')}</Text>
        </View>
        {/* Neues Produkt erstellen */}
        <Pressable
          style={[s.addBtn, { backgroundColor: colors.text.primary }]}
          onPress={openCreateSheet}
          accessibilityLabel="Produkt erstellen"
        >
          <Plus size={18} color={colors.bg.primary} strokeWidth={2.5} />
        </Pressable>
      </LinearGradient>

      {/* Produktliste */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.accent.primary} />
      ) : products.length === 0 ? (
        <EmptyShop onAdd={openCreateSheet} colors={colors} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              colors={colors}
              onEdit={() => openEditSheet(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* ── Produkt-Sheet (create + edit dual-mode) ── */}
      <Modal
        visible={showSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSheet}
      >
        <ProductFormSheet
          form={form}
          setForm={setForm}
          isEditMode={isEditMode}
          onPickCover={pickCover}
          uploadingCover={uploadingCover}
          onPickGallery={pickGalleryImages}
          uploadingGallery={uploadingGallery}
          onRemoveGalleryImage={removeGalleryImage}
          onSubmit={handleSave}
          isSaving={isSaving}
          onClose={closeSheet}
          colors={colors}
          insets={insets}
        />
      </Modal>
    </View>
  );
}

// ─── Leerer Zustand ───────────────────────────────────────────────────────────

function EmptyShop({ onAdd, colors }: { onAdd: () => void; colors: any }) {
  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIconWrap, { backgroundColor: colors.bg.elevated }]}>
        <ShoppingBag size={40} color={colors.text.muted} strokeWidth={1.5} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Noch keine Produkte</Text>
      <Text style={[s.emptySub, { color: colors.text.muted }]}>
        Erstelle dein erstes Produkt und fang an zu verkaufen.
      </Text>
      <Pressable style={[s.emptyBtn, { backgroundColor: colors.text.primary }]} onPress={onAdd}>
        <Plus size={16} color={colors.bg.primary} strokeWidth={2.5} />
        <Text style={[s.emptyBtnText, { color: colors.bg.primary }]}>Erstes Produkt erstellen</Text>
      </Pressable>
    </View>
  );
}

// ─── Produkt-Karte ────────────────────────────────────────────────────────────

// v1.26.2: UX-Redesign — ganze Karte ist tippbar (öffnet Edit-Sheet).
// Status (aktiv/inaktiv/WOZ) ist jetzt immer klar sichtbar als Pill; kein
// instant-Toggle mehr über ein Eye-Icon (hat zu versehentlichen Deaktivierungen
// geführt — Aktivierung ist jetzt bewusster Schritt im Edit-Sheet).
// Trash bleibt als einzige destruktive Quick-Action (mit bestehendem Confirm).

function ProductCard({
  product, colors, onEdit, onDelete,
}: {
  product: Product;
  colors: any;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const catMeta = CATEGORIES.find(c => c.key === product.category);
  const CatIcon = catMeta?.icon ?? Package;

  // Status-Pill bestimmen — drei sich gegenseitig ausschließende Zustände
  const statusPill = product.is_active
    ? product.women_only
      ? { dot: '#EC4899', label: 'Aktiv · Nur Frauen (WOZ)', textColor: '#EC4899' }
      : { dot: '#22C55E', label: 'Aktiv · Für alle sichtbar', textColor: '#22C55E' }
    : { dot: colors.text.muted, label: 'Inaktiv · Nicht im Shop', textColor: colors.text.muted };

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${product.title} bearbeiten`}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: colors.bg.elevated,
          borderColor: colors.border.subtle,
          opacity: product.is_active ? (pressed ? 0.8 : 1) : 0.55,
        },
      ]}
    >
      {/* Cover */}
      {product.cover_url ? (
        <Image source={{ uri: product.cover_url }} style={s.cardCover} contentFit="cover" />
      ) : (
        <View style={[s.cardCoverPlaceholder, { backgroundColor: colors.bg.primary }]}>
          <CatIcon size={28} color={colors.text.muted} strokeWidth={1.5} />
        </View>
      )}

      {/* Inhalt */}
      <View style={s.cardBody}>
        <View style={s.cardRow}>
          <Text style={[s.cardTitle, { color: colors.text.primary }]} numberOfLines={1}>{product.title}</Text>
        </View>

        {/* Status-Pill — immer sichtbar, klar lesbar */}
        <View style={[s.statusPill, { backgroundColor: colors.bg.primary }]}>
          <View style={[s.statusDot, { backgroundColor: statusPill.dot }]} />
          <Text style={[s.statusText, { color: statusPill.textColor }]} numberOfLines={1}>
            {statusPill.label}
          </Text>
        </View>

        <View style={s.cardMeta}>
          <View style={[s.catChip, { backgroundColor: colors.bg.primary }]}>
            <CatIcon size={11} color={colors.text.muted} strokeWidth={2} />
            <Text style={[s.catLabel, { color: colors.text.muted }]}>{catMeta?.label}</Text>
          </View>
          <Text style={[s.cardPrice, { color: colors.accent.primary }]}>
            🪙 {product.price_coins.toLocaleString('de-DE')}
          </Text>
        </View>
        <View style={s.cardStats}>
          <Text style={[s.cardStat, { color: colors.text.muted }]}>{product.sold_count} verkauft</Text>
          {product.stock >= 0 && (
            <Text style={[s.cardStat, { color: product.stock < 5 ? '#EF4444' : colors.text.muted }]}>
              {product.stock} auf Lager
            </Text>
          )}
        </View>
      </View>

      {/* Rechts: Löschen (quick-action) + Chevron als Tipp-Affordance */}
      <View style={s.cardActions}>
        <Pressable
          onPress={(e) => { e.stopPropagation(); onDelete(); }}
          hitSlop={10}
          accessibilityLabel="Löschen"
          style={s.cardActionBtn}
        >
          <Trash2 size={18} color='#EF4444' strokeWidth={2} />
        </Pressable>
        <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

// ─── Produkt-Form Sheet (create + edit dual-mode) ─────────────────────────────
// v1.26.2: Ehemals CreateProductSheet. Via isEditMode-Prop wechselt Header-Title
// und der Save-Button-Text; die Form-Felder sind identisch.

function ProductFormSheet({
  form, setForm, isEditMode,
  onPickCover, uploadingCover,
  onPickGallery, uploadingGallery, onRemoveGalleryImage,
  onSubmit, isSaving, onClose, colors, insets,
}: {
  form: CreateProductInput;
  setForm: React.Dispatch<React.SetStateAction<CreateProductInput>>;
  isEditMode: boolean;
  onPickCover: () => void;
  uploadingCover: boolean;
  onPickGallery: () => void;
  uploadingGallery: boolean;
  onRemoveGalleryImage: (idx: number) => void;
  onSubmit: () => void;
  isSaving: boolean;
  onClose: () => void;
  colors: any;
  insets: any;
}) {
  return (
    <KeyboardAvoidingView
      style={[s.sheetRoot, { backgroundColor: colors.bg.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Sheet-Header */}
      <View style={[s.sheetHeader, { borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={onClose} style={s.sheetClose}>
          <Text style={[s.sheetCloseText, { color: colors.text.muted }]}>Abbrechen</Text>
        </Pressable>
        <Text style={[s.sheetTitle, { color: colors.text.primary }]}>
          {isEditMode ? 'Produkt bearbeiten' : 'Neues Produkt'}
        </Text>
        <Pressable onPress={onSubmit} disabled={isSaving}>
          {isSaving
            ? <ActivityIndicator color={colors.accent.primary} />
            : <Text style={[s.sheetSave, { color: colors.accent.primary }]}>Speichern</Text>}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover-Upload */}
        <Text style={[s.label, { color: colors.text.primary, marginTop: 0 }]}>Titelbild *</Text>
        <Pressable onPress={onPickCover} style={[s.coverPicker, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}>
          {uploadingCover ? (
            <ActivityIndicator color={colors.accent.primary} />
          ) : form.cover_url ? (
            <Image source={{ uri: form.cover_url }} style={s.coverPreview} contentFit="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <ImageIcon size={32} color={colors.text.muted} strokeWidth={1.5} />
              <Text style={[s.coverHint, { color: colors.text.muted }]}>Titelbild hinzufügen</Text>
            </View>
          )}
        </Pressable>

        {/* Galerie-Bilder */}
        <View style={s.galleryHeader}>
          <Text style={[s.label, { color: colors.text.primary, marginTop: 0, flex: 1 }]}>
            Galerie ({(form.image_urls?.length ?? 0)}/8)
          </Text>
          <Pressable
            onPress={onPickGallery}
            disabled={uploadingGallery || (form.image_urls?.length ?? 0) >= 8}
            style={[s.galleryAddBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
          >
            {uploadingGallery
              ? <ActivityIndicator size="small" color={colors.text.primary} />
              : <><Images size={14} color={colors.text.primary} strokeWidth={2} /><Text style={[s.galleryAddText, { color: colors.text.primary }]}>+ Bilder</Text></>
            }
          </Pressable>
        </View>

        {/* Galerie-Vorschau Grid */}
        {(form.image_urls?.length ?? 0) > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.galleryScroll} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {(form.image_urls ?? []).map((url, idx) => (
              <View key={url + idx} style={s.galleryThumbWrap}>
                <Image source={{ uri: url }} style={s.galleryThumb} contentFit="cover" />
                <Pressable
                  style={[s.galleryRemoveBtn, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                  onPress={() => onRemoveGalleryImage(idx)}
                  hitSlop={4}
                >
                  <X size={12} color="#fff" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Kategorie wählen */}
        <Text style={[s.label, { color: colors.text.primary }]}>Kategorie</Text>
        <View style={s.catRow}>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = form.category === cat.key;
            return (
              <Pressable
                key={cat.key}
                style={[
                  s.catBtn,
                  { borderColor: isSelected ? colors.text.primary : colors.border.subtle, backgroundColor: colors.bg.elevated },
                  isSelected && { backgroundColor: colors.text.primary },
                ]}
                onPress={() => setForm(f => ({ ...f, category: cat.key }))}
              >
                <Icon size={16} color={isSelected ? colors.bg.primary : colors.text.muted} strokeWidth={2} />
                <Text style={[s.catBtnLabel, { color: isSelected ? colors.bg.primary : colors.text.primary }]}>{cat.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Titel */}
        <Text style={[s.label, { color: colors.text.primary }]}>Produktname *</Text>
        <TextInput
          style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
          placeholder="z.B. Hijab-Bindeanleitung PDF"
          placeholderTextColor={colors.text.muted}
          value={form.title}
          onChangeText={(t) => setForm(f => ({ ...f, title: t }))}
          maxLength={80}
        />

        {/* Beschreibung */}
        <Text style={[s.label, { color: colors.text.primary }]}>Beschreibung</Text>
        <TextInput
          style={[s.input, s.textarea, { color: colors.text.primary, backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
          placeholder="Was bekommt die Käuferin?"
          placeholderTextColor={colors.text.muted}
          value={form.description ?? ''}
          onChangeText={(t) => setForm(f => ({ ...f, description: t }))}
          multiline
          numberOfLines={4}
          maxLength={500}
        />

        {/* Preis */}
        <Text style={[s.label, { color: colors.text.primary }]}>Preis (BorzCoins)</Text>
        <View style={[s.priceRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <Text style={{ fontSize: 18 }}>🪙</Text>
          <TextInput
            style={[s.priceInput, { color: colors.text.primary }]}
            keyboardType="number-pad"
            value={String(form.price_coins)}
            onChangeText={(t) => setForm(f => ({ ...f, price_coins: Math.max(1, parseInt(t) || 0) }))}
          />
          <Text style={[s.priceHint, { color: colors.text.muted }]}>
            ≈ {((form.price_coins / 100) * 0.70).toFixed(2)} € für dich
          </Text>
        </View>

        {/* Stock */}
        <Text style={[s.label, { color: colors.text.primary }]}>Verfügbarkeit</Text>
        <View style={s.stockRow}>
          <Pressable
            style={[s.stockBtn, form.stock === -1 && { backgroundColor: colors.text.primary }, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}
            onPress={() => setForm(f => ({ ...f, stock: -1 }))}
          >
            <Text style={{ color: form.stock === -1 ? colors.bg.primary : colors.text.primary, fontWeight: '700', fontSize: 13 }}>∞ Unbegrenzt</Text>
          </Pressable>
          <Pressable
            style={[s.stockBtn, form.stock >= 0 && { backgroundColor: colors.text.primary }, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}
            onPress={() => setForm(f => ({ ...f, stock: f.stock < 0 ? 10 : f.stock }))}
          >
            <Text style={{ color: form.stock >= 0 ? colors.bg.primary : colors.text.primary, fontWeight: '700', fontSize: 13 }}>Begrenzt</Text>
          </Pressable>
          {form.stock >= 0 && (
            <TextInput
              style={[s.stockInput, { color: colors.text.primary, backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
              keyboardType="number-pad"
              value={String(form.stock)}
              onChangeText={(t) => setForm(f => ({ ...f, stock: Math.max(0, parseInt(t) || 0) }))}
            />
          )}
        </View>

        {/* v1.26.3: Angebots-Preis — optional, muss < price_coins sein */}
        <Text style={[s.label, { color: colors.text.primary }]}>
          <Percent size={12} color={colors.text.primary} /> Angebot (optional)
        </Text>
        <View style={[s.priceRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <Text style={{ fontSize: 18 }}>🪙</Text>
          <TextInput
            style={[s.priceInput, { color: colors.text.primary }]}
            keyboardType="number-pad"
            placeholder="kein Angebot"
            placeholderTextColor={colors.text.muted}
            value={form.sale_price_coins != null ? String(form.sale_price_coins) : ''}
            onChangeText={(t) => {
              const n = parseInt(t, 10);
              setForm(f => ({ ...f, sale_price_coins: isNaN(n) || n <= 0 ? null : n }));
            }}
          />
          {form.sale_price_coins != null && form.sale_price_coins < form.price_coins && (
            <Text style={[s.priceHint, { color: '#22C55E', fontWeight: '700' }]}>
              -{Math.round((1 - form.sale_price_coins / form.price_coins) * 100)}%
            </Text>
          )}
        </View>

        {/* v1.26.3: Ort / Location — Freitext */}
        <Text style={[s.label, { color: colors.text.primary }]}>
          <MapPin size={12} color={colors.text.primary} /> Ort (optional)
        </Text>
        <TextInput
          style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
          placeholder="z.B. Berlin, Deutschland"
          placeholderTextColor={colors.text.muted}
          value={form.location ?? ''}
          onChangeText={(t) => setForm(f => ({ ...f, location: t.trim() === '' ? null : t }))}
          maxLength={60}
        />

        {/* v1.26.3: Gratis-Versand — nur für physische Produkte sinnvoll */}
        {form.category === 'physical' && (
          <View style={[s.wozRow, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.wozTitle, { color: colors.text.primary }]}>🚚 Gratis Versand</Text>
              <Text style={[s.wozSub, { color: colors.text.muted }]}>
                „Gratis Versand"-Label auf der Shop-Karte anzeigen
              </Text>
            </View>
            <Switch
              value={form.free_shipping ?? false}
              onValueChange={(v) => setForm(f => ({ ...f, free_shipping: v }))}
              trackColor={{ false: colors.border.default, true: '#22C55E' }}
              thumbColor={colors.bg.primary}
            />
          </View>
        )}

        {/* Women-Only Toggle */}
        <View style={[s.wozRow, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated, marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.wozTitle, { color: colors.text.primary }]}>🌸 Women-Only Zone</Text>
            <Text style={[s.wozSub, { color: colors.text.muted }]}>Nur für verifizierte Frauen sichtbar</Text>
          </View>
          <Switch
            value={form.women_only}
            onValueChange={(v) => setForm(f => ({ ...f, women_only: v }))}
            trackColor={{ false: colors.border.default, true: '#EC4899' }}
            thumbColor={colors.bg.primary}
          />
        </View>

        {/* v1.26.2: Aktivierungs-Toggle — ersetzt ehemaligen Eye-Icon-Quick-Toggle.
            Bewusster Schritt statt versehentlicher Deaktivierung per Einmal-Tap. */}
        <View style={[s.wozRow, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated, marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.wozTitle, { color: colors.text.primary }]}>
              {form.is_active ? '🟢 Produkt ist aktiv' : '⚫ Produkt ist inaktiv'}
            </Text>
            <Text style={[s.wozSub, { color: colors.text.muted }]}>
              {form.is_active
                ? 'Im Shop sichtbar und kaufbar'
                : 'Nicht im Shop sichtbar — keine Käufe möglich'}
            </Text>
          </View>
          <Switch
            value={form.is_active ?? true}
            onValueChange={(v) => setForm(f => ({ ...f, is_active: v }))}
            trackColor={{ false: colors.border.default, true: '#22C55E' }}
            thumbColor={colors.bg.primary}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub:   { fontSize: 12, fontWeight: '500' },
  diamondPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  diamondText: { fontWeight: '700', fontSize: 13 },
  addBtn: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty
  emptyWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText:  { fontSize: 15, fontWeight: '700' },

  // Card
  card: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    alignItems: 'center',
  },
  cardCover: { width: 88, height: 104 },
  cardCoverPlaceholder: { width: 88, height: 104, alignItems: 'center', justifyContent: 'center' },
  cardBody:  { flex: 1, padding: 12, gap: 6 },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  wozBadge:  { fontSize: 14 },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  catLabel:  { fontSize: 10, fontWeight: '600' },
  cardPrice: { fontSize: 14, fontWeight: '800' },
  cardStats: { flexDirection: 'row', gap: 12 },
  cardStat:  { fontSize: 11 },
  cardActions: { flexDirection: 'column', alignItems: 'center', gap: 14, paddingHorizontal: 12 },
  cardActionBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  // Status-Pill (v1.26.2)
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Sheet
  sheetRoot:   { flex: 1 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetClose:     { minWidth: 80 },
  sheetCloseText: { fontSize: 15 },
  sheetTitle:     { fontSize: 17, fontWeight: '700' },
  sheetSave:      { fontSize: 15, fontWeight: '700', textAlign: 'right', minWidth: 80 },

  coverPicker: {
    width: '100%', height: 180, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20, overflow: 'hidden',
  },
  coverPreview: { width: '100%', height: '100%' },
  coverHint:    { fontSize: 13 },

  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 16 },

  catRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  catBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
  },
  catBtnLabel: { fontSize: 12, fontWeight: '700' },

  input: {
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15,
  },
  textarea: { height: 100, textAlignVertical: 'top', paddingTop: 12 },

  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  priceInput: { flex: 1, fontSize: 24, fontWeight: '800' },
  priceHint:  { fontSize: 12 },

  stockRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockBtn:  { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  stockInput: { width: 64, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlign: 'center' },

  wozRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 20,
  },
  wozTitle: { fontSize: 14, fontWeight: '700' },
  wozSub:   { fontSize: 12, marginTop: 2 },

  // Gallery
  galleryHeader:   { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  galleryAddBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  galleryAddText:  { fontSize: 12, fontWeight: '700' },
  galleryScroll:   { marginBottom: 8 },
  galleryThumbWrap:{ position: 'relative', width: 80, height: 80 },
  galleryThumb:    { width: 80, height: 80, borderRadius: 10 },
  galleryRemoveBtn:{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
