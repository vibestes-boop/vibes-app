// Der Sendeplan im Verkaufen-Reiter: einen Termin ankündigen.
//
// Warum Kacheln und kein Datums-Wähler: Ein freier Zeitstempel lädt dazu ein,
// „irgendwann Dienstag halb neun" zu senden. Das Ritual aus der Analyse ist aber
// gerade die Wiederholung — „donnerstags um 14:30 dieselbe Person". Feste
// Abendplätze machen das Wiederkommen zur Standardeinstellung statt zur
// Ausnahme.
//
// Nebeneffekt, der kein Nebeneffekt ist: `@react-native-community/datetimepicker`
// wäre ein natives Modul und damit ein Build. Zwei Reihen Pressables sind es
// nicht.

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { CalendarClock, ImagePlus, X } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { pickAndUpload } from '../lib/uploadImage';
import { formatSlot, formatUntil, MAX_WEEKS, type PlannedShow } from '../lib/useSchedule';

/** Abendplätze. Live-Auktionen laufen, wenn die Leute zu Hause sind. */
const TIMES = [17, 18, 19, 20, 21, 22];

/**
 * „Gleich geht's los" — in Minuten.
 *
 * Die Abendplätze allein waren zu eng: Wer spontan senden will („ich mach in
 * einer halben Stunde auf"), fand keinen passenden Platz, und am späten Abend
 * war für heute gar keiner mehr übrig. Beides ist ein echter Fall, kein
 * Sonderfall — und ohne diese Zeile hätte man den Termin gar nicht ankündigen
 * können, also genau das gelassen, worum es hier geht.
 *
 * Eine spontane Sendung ist bewusst **keine Reihe**: Wer „in 30 Minuten" wählt,
 * meint diesen einen Abend, nicht die nächsten vier.
 */
const SOON = [
  { minutes: 30, label: 'in 30 Min' },
  { minutes: 60, label: 'in 1 Std' },
  { minutes: 120, label: 'in 2 Std' },
];

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

type Props = {
  plans: PlannedShow[];
  busy: boolean;
  onPlan: (input: {
    title: string;
    at: Date;
    weeks: number;
    coverUrl: string | null;
  }) => void;
  onCancel: (id: string) => void;
};

export function SchedulePlanner({ plans, busy, onPlan, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState(20);
  // Wöchentlich ist die Voreinstellung, nicht die Ausnahme. Die Analyse verlangt
  // wiederkehrende Sendungen — wer bewusst nur einmal senden will, schaltet um.
  const [weekly, setWeekly] = useState(true);
  /** Minuten ab jetzt, wenn eine spontane Sendung gewählt ist. Sonst `null`. */
  const [soon, setSoon] = useState<number | null>(null);

  // Die sieben wählbaren Tage. Einmal je Aufbau gerechnet — über Mitternacht
  // hinweg zeigt die Liste sonst „Heute" für gestern.
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today.getTime() + offset * 86_400_000);
      return {
        offset,
        label: offset === 0 ? 'Heute' : offset === 1 ? 'Morgen' : DAY_LABELS[date.getDay()],
        sub: `${date.getDate()}.${date.getMonth() + 1}.`,
      };
    });
  }, []);

  const isToday = dayOffset === 0;

  // Für heute nur Stunden, die noch kommen. Vorher standen um 21:30 alle sechs
  // Abendplätze da, fünf davon in der Vergangenheit — man tippte darauf und
  // bekam bloß „Dieser Zeitpunkt ist schon vorbei".
  const times = useMemo(() => {
    if (!isToday) return TIMES;
    const now = new Date();
    // Fünf Minuten Puffer wie auf dem Server: Eine Kachel, die ohnehin
    // abgelehnt würde, gehört nicht in die Auswahl.
    const limit = now.getHours() + (now.getMinutes() > 55 ? 1 : 0);
    return TIMES.filter((value) => value > limit);
  }, [isToday, dayOffset, hour, soon]);

  // Fällt die gewählte Stunde aus der Liste (Tageswechsel, Zeitablauf), rutscht
  // die Auswahl auf die erste noch mögliche — statt auf eine tote Kachel.
  const effectiveHour = times.includes(hour) ? hour : (times[0] ?? hour);

  /**
   * Der Zieltermin.
   *
   * Bei den relativen Wahlen **beim Drücken neu gerechnet**: Zwischen Anzeigen
   * und Tippen können Minuten vergehen, und „in 30 Min" muss dann auch 30
   * Minuten ab dem Tippen heißen.
   */
  const buildTarget = useCallback((): Date => {
    if (soon !== null) {
      const date = new Date(Date.now() + soon * 60_000);
      date.setSeconds(0, 0);
      return date;
    }
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(effectiveHour, 0, 0, 0);
    return date;
  }, [soon, dayOffset, effectiveHour]);

  const target = buildTarget();

  // Der Server lehnt alles unter fünf Minuten ab. Das hier vorher zu sagen ist
  // freundlicher, als es sich als Fehlermeldung abzuholen.
  const tooSoon = target.getTime() <= Date.now() + 5 * 60_000;
  // `uploading` blockiert mit: Wer währenddessen einträgt, verlöre das Bild —
  // `coverUrl` wird erst nach dem Hochladen gesetzt.
  const canPlan = title.trim().length > 0 && !tooSoon && !busy && !uploading;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <CalendarClock size={18} color={ui.text} />
        <Text style={s.title}>Nächsten Termin ankündigen</Text>
      </View>
      <Text style={s.body}>
        Wer dir folgt, bekommt 15 Minuten vorher eine Erinnerung aufs Handy. Ein fester
        Abend bringt die Leute wieder — mehr als jede einzelne gute Show.
      </Text>

      {/* Bild links, Titel rechts — dieselbe Anordnung wie bei „Artikel
          auflegen" und „Dauerhaft anbieten". Drei Formulare im selben Reiter,
          die unterschiedlich aussehen, sind der Grund, warum am 16.08.2026
          niemand fand, wo ein Dauerangebot sein Foto bekommt. */}
      <View style={s.titleRow}>
        <Pressable
          style={s.picker}
          disabled={uploading}
          onPress={() => {
            setUploading(true);
            setUploadError(null);
            // `cover` = Speicherort (`thumbnails/`), `square` = Form: Die Karte
            // im „Demnächst"-Streifen zeichnet quadratisch, genau wie die
            // Live-Karten darunter.
            void pickAndUpload('cover', 'square')
              .then((url) => {
                if (url) setCoverUrl(url);
              })
              .catch((error: unknown) =>
                setUploadError(
                  error instanceof Error ? error.message : 'Das Bild kam nicht durch.',
                ),
              )
              .finally(() => setUploading(false));
          }}
          accessibilityRole="button"
          accessibilityLabel={coverUrl ? 'Bild ändern' : 'Bild wählen'}
        >
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
            />
          ) : null}
          {uploading ? (
            <ActivityIndicator color={ui.brand} />
          ) : coverUrl ? null : (
            <ImagePlus size={20} color={ui.textMuted} />
          )}
        </Pressable>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Parfüm-Abend ab 1 €"
          placeholderTextColor={ui.textMuted}
          style={[s.input, s.titleInput]}
          maxLength={80}
        />
      </View>

      {/* Kein Zwang, aber gesagt werden muss es: Ein Termin ist das einzige
          Ding in Berkat, das ganz ohne Kamera auskommen muss. Wer kein Bild
          wählt, bekommt serverseitig das Cover seiner letzten Show — deshalb
          steht hier „meistens", nicht „immer". */}
      {!coverUrl && !uploading ? (
        <Text style={s.photoHint}>
          Ohne Bild nehmen wir das Cover deiner letzten Show. Hast du noch keine, steht dein
          Abend nur als Text auf der Startseite.
        </Text>
      ) : null}
      {uploadError ? <Text style={s.warn}>{uploadError}</Text> : null}

      <Text style={s.label}>Wann?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row}>
        {days.map((day) => {
          const active = day.offset === dayOffset;
          return (
            <Pressable
              key={day.offset}
              onPress={() => {
                setDayOffset(day.offset);
                // „In 30 Minuten" gibt es nur für heute — an einem anderen Tag
                // wäre die Angabe sinnlos.
                if (day.offset !== 0) setSoon(null);
              }}
              style={[s.dayTile, active && s.tileActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${day.label} ${day.sub}`}
            >
              <Text style={[s.dayLabel, active && s.tileTextActive]}>{day.label}</Text>
              <Text style={[s.daySub, active && s.tileSubActive]}>{day.sub}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row}>
        {/* Spontan zuerst — wer heute noch senden will, hat es eiliger als der,
            der den nächsten Samstag plant. Nur für heute. */}
        {isToday
          ? SOON.map((option) => {
              const active = soon === option.minutes;
              return (
                <Pressable
                  key={option.minutes}
                  onPress={() => {
                    setSoon(option.minutes);
                    // Eine spontane Sendung ist keine Reihe.
                    setWeekly(false);
                  }}
                  style={[s.timeTile, active && s.tileActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.timeLabel, active && s.tileTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })
          : null}

        {times.map((value) => {
          const active = soon === null && value === effectiveHour;
          return (
            <Pressable
              key={value}
              onPress={() => {
                setHour(value);
                setSoon(null);
              }}
              style={[s.timeTile, active && s.tileActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.timeLabel, active && s.tileTextActive]}>{value}:00</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Der Rhythmus ist die eigentliche Entscheidung, nicht der einzelne Tag —
          deshalb steht er als eigene Zeile und nicht als Häkchen am Rand. */}
      {soon === null ? (
      <View style={s.repeatRow}>
        {[
          { weekly: false, label: 'Einmal' },
          { weekly: true, label: `Jede Woche · ${MAX_WEEKS}×` },
        ].map((option) => {
          const active = option.weekly === weekly;
          return (
            <Pressable
              key={option.label}
              onPress={() => setWeekly(option.weekly)}
              style={[s.repeatTile, active && s.tileActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.repeatLabel, active && s.tileTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      ) : null}

      <Pressable
        style={[s.primary, !canPlan && s.primaryOff]}
        disabled={!canPlan}
        onPress={() => {
          onPlan({ title, at: buildTarget(), weeks: weekly ? MAX_WEEKS : 1, coverUrl });
          setTitle('');
          setCoverUrl(null);
          setUploadError(null);
        }}
        accessibilityRole="button"
        accessibilityLabel="Termin eintragen"
      >
        <Text style={s.primaryText}>
          {tooSoon
            ? 'Dieser Zeitpunkt ist schon vorbei'
            : weekly
              ? `Ab ${formatSlot(target.toISOString())} — jede Woche`
              : `Für ${formatSlot(target.toISOString())} eintragen`}
        </Text>
      </Pressable>

      {weekly && !tooSoon ? (
        <Text style={s.repeatHint}>
          Trägt {MAX_WEEKS} Termine ein, immer {DAY_LABELS[target.getDay()]} um{' '}
          {String(effectiveHour).padStart(2, '0')}:00. Weiter als 30 Tage lässt der Server nicht
          zu — danach einfach neu eintragen.
        </Text>
      ) : null}

      {plans.length > 0 ? (
        <View style={s.list}>
          {plans.map((plan) => (
            <View key={plan.id} style={s.planRow}>
              {/* Klein mit Absicht: Die eigene Terminliste ist eine
                  Arbeitsfläche — das Bild beantwortet hier „welchen meine ich",
                  nicht „was schaue ich mir an". Groß ist es auf der Startseite,
                  wo gestöbert wird (HANDOFF § 18, Bildgrößen-Regel). */}
              {plan.cover_url ? (
                <Image
                  source={{ uri: plan.cover_url }}
                  style={s.planThumb}
                  contentFit="cover"
                  transition={120}
                />
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.planTitle}>
                  {plan.title}
                </Text>
                <Text style={s.planWhen}>
                  {formatSlot(plan.scheduled_at)} · {formatUntil(plan.scheduled_at)}
                </Text>
              </View>
              <Pressable
                onPress={() => onCancel(plan.id)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`${plan.title} absagen`}
                style={s.cancel}
              >
                <X size={16} color={ui.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: ui.line,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 16, fontWeight: '700', color: ui.text },
  body: { fontSize: 13, color: ui.textMuted, marginTop: space.xs, lineHeight: 19 },

  input: {
    marginTop: space.md,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },
  titleRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.sm },
  titleInput: { flex: 1, minHeight: 64 },
  // 64 statt der 76 im `StandingComposer`: Dort steht daneben ein mehrzeiliges
  // Feld, hier ein einzeiliger Titel. Die Position ist dieselbe, die Höhe folgt
  // dem Nachbarn.
  picker: {
    width: 64,
    minHeight: 64,
    marginTop: space.md,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoHint: { fontSize: 11, color: ui.textMuted, marginTop: space.sm, lineHeight: 16 },
  warn: { fontSize: 12, color: ui.live, marginTop: space.sm },

  label: { fontSize: 12, color: ui.textMuted, marginTop: space.md },
  row: { marginTop: space.sm },

  dayTile: {
    minWidth: 62,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginRight: space.sm,
    alignItems: 'center',
  },
  dayLabel: { fontSize: 14, fontWeight: '700', color: ui.text },
  daySub: { fontSize: 11, color: ui.textMuted, marginTop: 1 },

  timeTile: {
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    marginRight: space.sm,
  },
  timeLabel: { fontSize: 14, fontWeight: '600', color: ui.text },

  // Gold trägt auf hell keinen Text (theme/tokens) — die aktive Kachel ist
  // deshalb die Marken-Fläche mit heller Schrift, nicht Gold.
  tileActive: { backgroundColor: ui.brand },
  tileTextActive: { color: ui.bg },
  tileSubActive: { color: ui.bg, opacity: 0.7 },

  repeatRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  repeatTile: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    paddingVertical: space.sm + 2,
    alignItems: 'center',
  },
  repeatLabel: { fontSize: 13, fontWeight: '600', color: ui.text },
  repeatHint: {
    fontSize: 11,
    color: ui.textMuted,
    marginTop: space.sm,
    textAlign: 'center',
    lineHeight: 16,
  },

  primary: {
    marginTop: space.lg,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },

  list: {
    marginTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    paddingTop: space.sm,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  planThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: ui.sunken },
  planTitle: { fontSize: 14, fontWeight: '600', color: ui.text },
  planWhen: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  cancel: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
